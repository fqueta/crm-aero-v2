<?php

namespace App\Services\PaymentSchedule;

use InvalidArgumentException;

/**
 * PaymentScheduleBuilder (Builder Pattern)
 * pt-BR: Monta a programação de pagamento passo a passo e valida no build().
 *        O total do financiamento é fixo (qtd × valor da linha); a 1ª parcela
 *        pode ter valor/data próprios (entrada) e as demais são recalculadas
 *        para preservar o total (acerto de centavos na última).
 * en-US: Builds the payment schedule step by step, validating on build().
 *        The financed total is fixed (qty × row value); the 1st installment
 *        may carry its own value/date (down payment) and the rest are
 *        recalculated to preserve the total (cents adjusted on the last).
 */
class PaymentScheduleBuilder
{
    private ?int $installments = null;
    private ?float $value = null;
    private ?float $firstValue = null;
    private ?string $firstDate = null;
    private ?int $day = null;
    private string $recebimentoMatricula = 'diluida';
    private ?float $valorMatricula = null;
    private ?string $matriculaVencimento = null;
    private array $customDueDates = [];
    private DueDateStrategyInterface $strategy;

    public function __construct(?DueDateStrategyInterface $strategy = null)
    {
        $this->strategy = $strategy ?? new FirstDueDateThenFixedDayStrategy();
    }

    public function setCustomDueDates(?array $dates): static
    {
        $this->customDueDates = $dates ?? [];
        return $this;
    }

    public function setInstallments(?int $qtd): static
    {
        $this->installments = $qtd;
        return $this;
    }

    public function setValue(?float $value): static
    {
        $this->value = $value;
        return $this;
    }

    public function setFirstValue(?float $value): static
    {
        $this->firstValue = $value;
        return $this;
    }

    public function setFirstDate(?string $date): static
    {
        $this->firstDate = $date;
        return $this;
    }

    public function setDay(?int $day): static
    {
        $this->day = $day;
        return $this;
    }

    public function setRecebimentoMatricula(?string $mode): static
    {
        $m = strtolower(trim((string) $mode));
        $this->recebimentoMatricula = in_array($m, ['avulsa', 'primeira_parcela', 'diluida']) ? $m : 'diluida';
        return $this;
    }

    public function setValorMatricula(?float $valor): static
    {
        $this->valorMatricula = $valor !== null ? max(0.0, (float) $valor) : null;
        return $this;
    }

    public function setMatriculaVencimento(?string $date): static
    {
        $this->matriculaVencimento = $date;
        return $this;
    }

    public function setStrategy(DueDateStrategyInterface $strategy): static
    {
        $this->strategy = $strategy;
        return $this;
    }

    /**
     * @return array{qtd:int,valor_parcela:float,recebimento_matricula:string,valor_matricula:float,matricula_vencimento:string,primeira_parcela:array{valor:float,data:string},dia_pagamento:int,programacao:array<int,array{n:int,tipo:string,descricao:string,vencimento:string,valor:float}>,total:float}
     * @throws InvalidArgumentException
     */
    public function build(): array
    {
        $qtd = (int) ($this->installments ?? 0);
        if ($qtd < 1) {
            throw new InvalidArgumentException('Quantidade de parcelas inválida.');
        }

        $value = (float) ($this->value ?? 0);
        if ($value <= 0) {
            throw new InvalidArgumentException('Valor da parcela inválido.');
        }

        // Total fixo do financiamento: qtd × valor da linha selecionada.
        // Quando a 1ª parcela tem valor próprio (entrada), as demais são
        // recalculadas para que a soma continue igual ao total (diferença
        // diluída nas parcelas 2..N, com acerto de centavos na última).
        $finTotal = round($qtd * $value, 2);

        $hasCustomFirst = $this->firstValue !== null;
        $firstValue = $hasCustomFirst ? (float) $this->firstValue : $value;
        if ($firstValue < 0) {
            throw new InvalidArgumentException('Valor da primeira parcela inválido.');
        }
        if ($hasCustomFirst && $qtd > 1 && round($firstValue, 2) > $finTotal) {
            throw new InvalidArgumentException('Valor da primeira parcela maior que o total do financiamento.');
        }
        $firstValue = round($firstValue, 2);

        // Valores das parcelas 2..N em centavos (base + resto na última).
        $restValues = [];
        if ($qtd > 1) {
            if ($hasCustomFirst) {
                $restCents = (int) round(($finTotal - $firstValue) * 100);
                $base = intdiv($restCents, $qtd - 1);
                $remainder = $restCents % ($qtd - 1);
                for ($i = 0; $i < $qtd - 1; $i++) {
                    $cents = $base + ($i === $qtd - 2 ? $remainder : 0);
                    $restValues[] = (float) ($cents / 100);
                }
            } else {
                $restValues = array_fill(0, $qtd - 1, round($value, 2));
            }
        }
        $valorDemais = $qtd > 1 ? (float) $restValues[0] : $firstValue;

        $firstDate = $this->firstDate ? date('Y-m-d', strtotime((string) $this->firstDate)) : null;
        if ($this->firstDate && !$firstDate) {
            throw new InvalidArgumentException('Data da primeira parcela inválida.');
        }

        $day = $this->day ?? ($firstDate ? (int) date('d', strtotime($firstDate)) : (int) date('d'));
        $day = max(1, min(31, $day));

        $dates = $this->strategy->dueDates($firstDate, $day, $qtd);

        $recebimentoMatricula = $this->recebimentoMatricula ?: 'diluida';
        $valorMatricula = round((float) ($this->valorMatricula ?? 0), 2);
        $matriculaVencimento = $this->matriculaVencimento
            ? date('Y-m-d', strtotime((string) $this->matriculaVencimento))
            : ($firstDate ?: date('Y-m-d'));

        $programacao = [];
        $total = 0.0;

        // Se for parcela avulsa para a matrícula, adiciona como item próprio
        if ($recebimentoMatricula === 'avulsa' && $valorMatricula > 0) {
            $total += $valorMatricula;
            $matVenc = $this->customDueDates[0] ?? $this->customDueDates['0'] ?? $matriculaVencimento;
            if (!empty($matVenc) && strtotime((string) $matVenc)) {
                $matVenc = date('Y-m-d', strtotime((string) $matVenc));
            } else {
                $matVenc = $matriculaVencimento;
            }
            $programacao[] = [
                'n' => 0,
                'tipo' => 'matricula',
                'descricao' => 'Taxa de Inscrição / Matrícula',
                'vencimento' => $matVenc,
                'valor' => $valorMatricula,
            ];
        }

        foreach ($dates as $i => $date) {
            $n = $i + 1;
            $dueDate = $this->customDueDates[$n] ?? $this->customDueDates[(string) $n] ?? $date;
            if (!empty($dueDate) && strtotime((string) $dueDate)) {
                $dueDate = date('Y-m-d', strtotime((string) $dueDate));
            } else {
                $dueDate = $date;
            }

            $v = $i === 0 ? $firstValue : $restValues[$i - 1];
            // Se for primeira_parcela, soma a taxa de matrícula na 1ª parcela
            if ($i === 0 && $recebimentoMatricula === 'primeira_parcela' && $valorMatricula > 0) {
                $v = round($v + $valorMatricula, 2);
            }
            $total += $v;
            $desc = $n . 'ª Parcela' . ($i === 0 && $recebimentoMatricula === 'primeira_parcela' && $valorMatricula > 0 ? ' (com Matrícula)' : '');
            $programacao[] = [
                'n' => $n,
                'tipo' => 'parcela',
                'descricao' => $desc,
                'vencimento' => $dueDate,
                'valor' => $v,
            ];
        }

        $primeiraDataFinal = $dates[0];
        foreach ($programacao as $item) {
            if (($item['n'] ?? null) === 1) {
                $primeiraDataFinal = $item['vencimento'];
                break;
            }
        }

        $primeiraValorFinal = $recebimentoMatricula === 'primeira_parcela' && $valorMatricula > 0
            ? round($firstValue + $valorMatricula, 2)
            : round($firstValue, 2);

        return [
            'qtd' => $qtd,
            'valor_parcela' => round($value, 2),
            'valor_demais_parcelas' => round($valorDemais, 2),
            'total_financiamento' => $qtd > 1 ? $finTotal : round($firstValue, 2),
            'recebimento_matricula' => $recebimentoMatricula,
            'valor_matricula' => $valorMatricula,
            'matricula_vencimento' => $matriculaVencimento,
            'primeira_parcela' => [
                'valor' => $primeiraValorFinal,
                'data' => $primeiraDataFinal,
            ],
            'dia_pagamento' => $day,
            'vencimentos_personalizados' => $this->customDueDates,
            'programacao' => $programacao,
            'total' => round($total, 2),
        ];
    }
}
