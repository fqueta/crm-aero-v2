<?php

namespace App\Services\PaymentSchedule;

use App\Models\Matricula;
use InvalidArgumentException;

/**
 * PaymentScheduleService (Facade)
 * pt-BR: Ponto único de construção da programação de pagamento da matrícula.
 *        Consumido pela tela de proposta (snapshot), pelo shortcode
 *        `{tabela_parcelas}` do contrato e (futuro) pela cobrança Asaas —
 *        uma só fonte da verdade para a regra de vencimentos.
 * en-US: Single entry point for building an enrollment payment schedule.
 *        Consumed by the proposal screen (snapshot), the `{tabela_parcelas}`
 *        contract shortcode and (future) Asaas billing — one source of truth.
 */
class PaymentScheduleService
{
    private DueDateStrategyInterface $strategy;

    public function __construct(?DueDateStrategyInterface $strategy = null)
    {
        $this->strategy = $strategy ?? new FirstDueDateThenFixedDayStrategy();
    }

    /**
     * Normaliza um snapshot (orc.parcelamento ou config.financiamento_aprovado)
     * e constrói a programação. Retorna [] quando não há plano utilizável.
     *
     * @param array $snapshot
     * @return array
     */
    public function build(array $snapshot): array
    {
        // Snapshot congelado na aprovação já traz a programação pronta.
        if (!empty($snapshot['programacao']) && is_array($snapshot['programacao'])) {
            return $snapshot;
        }

        $qtd = $this->pickInt($snapshot, ['parcela_selecionada', 'qtd_parcelas', 'total_parcelas']);
        $linhas = $snapshot['linhas'] ?? [];
        $valor = $this->resolveRowValue($linhas, $qtd);
        // Desconto pontualidade (R$ fixo) da linha selecionada → discount Asaas (FIXED, dia 0).
        $desconto = $this->resolveRowDiscount($linhas, $qtd);

        $recebimentoMatricula = $snapshot['recebimento_matricula'] ?? 'diluida';
        $valorMatricula = $this->pickMoney($snapshot, ['valor_matricula', 'inscricao', 'taxa_matricula']);
        $matriculaVencimento = $this->pickDate($snapshot, ['matricula_vencimento_data', 'data_vencimento_matricula']);
        $vencimentosPersonalizados = $snapshot['vencimentos_personalizados'] ?? $snapshot['datas_parcelas'] ?? [];
        if (is_string($vencimentosPersonalizados)) {
            $vencimentosPersonalizados = json_decode($vencimentosPersonalizados, true) ?: [];
        }
        if (!is_array($vencimentosPersonalizados)) {
            $vencimentosPersonalizados = [];
        }

        try {
            $built = (new PaymentScheduleBuilder($this->strategy))
                ->setInstallments($qtd)
                ->setValue($valor)
                ->setFirstValue($this->pickMoney($snapshot, ['primeira_parcela_valor']))
                ->setFirstDate($this->pickDate($snapshot, ['primeira_parcela_data']))
                ->setDay($this->pickInt($snapshot, ['dia_pagamento']))
                ->setRecebimentoMatricula($recebimentoMatricula)
                ->setValorMatricula($valorMatricula)
                ->setMatriculaVencimento($matriculaVencimento)
                ->setCustomDueDates($vencimentosPersonalizados)
                ->build();
        } catch (InvalidArgumentException $e) {
            return [];
        }

        return array_merge($snapshot, $built, ['desconto_pontualidade' => $desconto]);
    }

    /**
     * Programação da matrícula: prefere o snapshot congelado na aprovação
     * (config.financiamento_aprovado), com fallback para orc.parcelamento.
     */
    public function forMatricula(Matricula $matricula): array
    {
        $config = $matricula->config ?? [];
        if (!empty($config['financiamento_aprovado']) && is_array($config['financiamento_aprovado'])) {
            $fin = $config['financiamento_aprovado'];
            if (!isset($fin['valor_matricula']) && isset($matricula->inscricao)) {
                $fin['valor_matricula'] = (float) $matricula->inscricao;
            }
            return $this->build($fin);
        }

        $orc = $matricula->orc ?? [];
        if (!empty($orc['parcelamento']) && is_array($orc['parcelamento'])) {
            $parc = $orc['parcelamento'];
            if (!isset($parc['valor_matricula']) && isset($matricula->inscricao)) {
                $parc['valor_matricula'] = (float) $matricula->inscricao;
            }
            return $this->build($parc);
        }

        return [];
    }

    /**
     * Tabela HTML da programação para inserção no contrato ({tabela_parcelas}).
     * pt-BR: Estilo inline compatível com geradores de PDF e visualização web.
     */
    public function toHtmlTable(array $programacao, float $total = 0, array $options = []): string
    {
        if (empty($programacao)) {
            return '';
        }

        $html = '<table style="width:100%;max-width:550px;border-collapse:collapse;margin:12px 0;font-size:13px;font-family:inherit;border:1px solid #cbd5e1;">';
        $html .= '<thead>';
        $html .= '<tr style="background-color:#f1f5f9;border-bottom:2px solid #cbd5e1;">';
        $html .= '<th style="padding:8px 12px;text-align:left;border:1px solid #cbd5e1;font-weight:600;">Parcela</th>';
        $html .= '<th style="padding:8px 12px;text-align:center;border:1px solid #cbd5e1;font-weight:600;">Vencimento</th>';
        $html .= '<th style="padding:8px 12px;text-align:right;border:1px solid #cbd5e1;font-weight:600;">Valor</th>';
        $html .= '</tr>';
        $html .= '</thead>';
        $html .= '<tbody>';

        $sum = 0;
        foreach ($programacao as $item) {
            $n = (int) ($item['n'] ?? 0);
            $tipo = $item['tipo'] ?? ($n === 0 ? 'matricula' : 'parcela');
            $venc = $this->formatDateBR((string) ($item['vencimento'] ?? ''));
            $val = (float) ($item['valor'] ?? 0);
            $sum += $val;
            $valor = $this->formatBRL($val);

            $label = $item['descricao'] ?? ($tipo === 'matricula' ? 'Taxa de Inscrição / Matrícula' : $n . 'ª Parcela');

            $html .= '<tr style="background-color:#ffffff;">';
            $html .= '<td style="padding:6px 12px;border:1px solid #cbd5e1;text-align:left;"><strong>' . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</strong></td>';
            $html .= '<td style="padding:6px 12px;border:1px solid #cbd5e1;text-align:center;">' . htmlspecialchars($venc, ENT_QUOTES, 'UTF-8') . '</td>';
            $html .= '<td style="padding:6px 12px;border:1px solid #cbd5e1;text-align:right;font-weight:500;">R$ ' . $valor . '</td>';
            $html .= '</tr>';
        }

        $finalTotal = $total > 0 ? $total : $sum;
        $html .= '</tbody>';
        $html .= '<tfoot>';
        $html .= '<tr style="background-color:#f8fafc;font-weight:bold;border-top:2px solid #cbd5e1;">';
        $html .= '<td colspan="2" style="padding:8px 12px;border:1px solid #cbd5e1;text-align:right;">Total:</td>';
        $html .= '<td style="padding:8px 12px;border:1px solid #cbd5e1;text-align:right;font-weight:700;">R$ ' . $this->formatBRL($finalTotal) . '</td>';
        $html .= '</tr>';

        // Nota explicativa de desconto de pontualidade no rodapé da tabela
        $descontoPontualidade = (float) ($options['desconto_pontualidade'] ?? 0);
        $valorParcelaLiquida = (float) ($options['parcela_com_desconto'] ?? 0);
        $textoNota = (string) ($options['nota_desconto'] ?? '');

        if ($descontoPontualidade > 0 || !empty($textoNota)) {
            $msg = !empty($textoNota)
                ? $textoNota
                : sprintf(
                    '* Desconto de pontualidade: R$ %s por parcela para pagamentos efetuados até a data de vencimento (valor com desconto: R$ %s). O não pagamento até o vencimento implicará na perda do desconto, incidindo juros e multa contratuais.',
                    $this->formatBRL($descontoPontualidade),
                    $this->formatBRL($valorParcelaLiquida)
                );

            // Verifica se a mensagem contém tags HTML (diretas ou codificadas como entidades &lt;...&gt;)
            $decodedMsg = html_entity_decode($msg, ENT_QUOTES, 'UTF-8');
            $hasHtmlTags = (strip_tags($msg) !== $msg) || (strip_tags($decodedMsg) !== $decodedMsg);

            $formattedMsg = $hasHtmlTags
                ? $decodedMsg
                : nl2br(htmlspecialchars($msg, ENT_QUOTES, 'UTF-8'));

            $html .= '<tr style="background-color:#ffffff;border-top:1px solid #e2e8f0;">';
            $html .= '<td colspan="3" style="padding:8px 12px;font-size:11px;color:#1e293b;line-height:1.4;text-align:left;">';
            $html .= '<strong>Observação:</strong> ' . $formattedMsg;
            $html .= '</td>';
            $html .= '</tr>';
        }

        $html .= '</tfoot>';
        $html .= '</table>';

        return $html;
    }

    /**
     * Gera tabela HTML para contratos (alias/legado de toHtmlTable).
     */
    public function toHtmlList(array $programacao, float $total = 0, array $options = []): string
    {
        return $this->toHtmlTable($programacao, $total, $options);
    }

    public function formatBRL(float $value): string
    {
        return number_format($value, 2, ',', '.');
    }

    public function formatDateBR(string $date): string
    {
        $ts = strtotime($date);
        return $ts ? date('d/m/Y', $ts) : $date;
    }

    /**
     * Converte moeda em float. Aceita 2636.72, "2636.72", "2.636,72" e "R$ 2.636,72".
     */
    public function parseMoney(mixed $value): ?float
    {
        if ($value === null || $value === '') {
            return null;
        }
        if (is_numeric($value)) {
            return (float) $value;
        }
        $s = trim((string) $value);
        $s = preg_replace('/[^0-9,.\-]/', '', $s) ?? '';
        if ($s === '' || $s === '-') {
            return null;
        }
        // Formato BR (2.636,72) tem vírgula decimal; senão, ponto decimal.
        if (str_contains($s, ',')) {
            $s = str_replace('.', '', $s);
            $s = str_replace(',', '.', $s);
        }
        return is_numeric($s) ? (float) $s : null;
    }

    /**
     * Localiza a linha selecionada pelo número de parcelas ($qtd).
     */
    public function resolveRow(mixed $linhas, ?int $qtd): ?array
    {
        if ($qtd === null || !is_array($linhas)) {
            return null;
        }
        foreach ($linhas as $row) {
            if (!is_array($row)) {
                continue;
            }
            $parcelas = $row['parcelas'] ?? $row['parcela'] ?? null;
            if ((string) $parcelas === (string) $qtd) {
                return $row;
            }
        }
        return null;
    }

    /**
     * Extrai os valores brutos, desconto por pontualidade e valor líquido
     * da linha de parcelamento selecionada no snapshot.
     */
    public function resolveDiscountDetails(array $snapshot): array
    {
        $qtd = $this->pickInt($snapshot, ['parcela_selecionada', 'qtd_parcelas', 'total_parcelas']);
        $linhas = $snapshot['linhas'] ?? [];
        $row = $this->resolveRow($linhas, $qtd);

        $valor = 0.0;
        $desconto = 0.0;

        if ($row) {
            $valor = $this->parseMoney($row['valor'] ?? null) ?? 0.0;
            $desconto = $this->parseMoney($row['desconto'] ?? null) ?? 0.0;
        } else {
            $valor = (float) ($snapshot['valor_parcela'] ?? 0.0);
        }

        $liquido = max(0.0, $valor - $desconto);

        return [
            'qtd' => $qtd,
            'valor' => $valor,
            'desconto' => $desconto,
            'liquido' => $liquido,
        ];
    }

    /**
     * Desconto (R$) da linha selecionada.
     */
    private function resolveRowDiscount(mixed $linhas, ?int $qtd): float
    {
        if ($qtd === null || !is_array($linhas)) {
            return 0.0;
        }
        foreach ($linhas as $row) {
            if (!is_array($row)) {
                continue;
            }
            $parcelas = $row['parcelas'] ?? $row['parcela'] ?? null;
            if ((string) $parcelas === (string) $qtd) {
                return round((float) ($this->parseMoney($row['desconto'] ?? null) ?? 0), 2);
            }
        }
        return 0.0;
    }
    private function resolveRowValue(mixed $linhas, ?int $qtd): ?float
    {
        $row = $this->resolveRow($linhas, $qtd);
        return $row ? $this->parseMoney($row['valor'] ?? null) : null;
    }

    private function pickInt(array $snapshot, array $keys): ?int
    {
        foreach ($keys as $k) {
            if (isset($snapshot[$k]) && $snapshot[$k] !== '' && is_numeric($snapshot[$k])) {
                return (int) $snapshot[$k];
            }
        }
        return null;
    }

    private function pickMoney(array $snapshot, array $keys): ?float
    {
        foreach ($keys as $k) {
            if (array_key_exists($k, $snapshot)) {
                $v = $this->parseMoney($snapshot[$k]);
                if ($v !== null) {
                    return $v;
                }
            }
        }
        return null;
    }

    private function pickDate(array $snapshot, array $keys): ?string
    {
        foreach ($keys as $k) {
            $v = trim((string) ($snapshot[$k] ?? ''));
            if ($v !== '' && strtotime($v)) {
                return date('Y-m-d', strtotime($v));
            }
        }
        return null;
    }
}
