<?php

namespace App\Services\PaymentSchedule;

/**
 * DueDateStrategyInterface (Strategy Pattern)
 * pt-BR: Contrato para cálculo de vencimentos de um plano de pagamento.
 *        Permite trocar a regra (ex.: tudo no dia fixo) sem tocar nos consumidores.
 * en-US: Contract for computing due dates of a payment plan.
 *        Allows swapping the rule without touching consumers.
 */
interface DueDateStrategyInterface
{
    /**
     * Calcula a lista de vencimentos.
     * pt-BR: A primeira data é usada como está; as demais seguem a regra da estratégia.
     *
     * @param string|null $firstDate Y-m-d da primeira parcela (null = calcular a partir de hoje)
     * @param int $day Dia fixo de vencimento (1-31)
     * @param int $count Quantidade total de parcelas
     * @return string[] Datas Y-m-d
     */
    public function dueDates(?string $firstDate, int $day, int $count): array;
}
