<?php

namespace App\Services\PaymentSchedule;

use Carbon\Carbon;

/**
 * FirstDueDateThenFixedDayStrategy (Strategy Pattern)
 * pt-BR: 1ª parcela vence em `primeira_parcela_data`; da 2ª em diante, todo
 *        `dia_pagamento` de cada mês, com trava de fim de mês (dia 31 → último
 *        dia de fevereiro/abril/...). Sem data inicial, a 1ª é o próximo
 *        `dia_pagamento` >= hoje.
 * en-US: 1st installment due on `primeira_parcela_data`; from the 2nd on,
 *        every `dia_pagamento` each month, clamped to month-end. Without an
 *        initial date, the 1st is the next `dia_pagamento` >= today.
 */
class FirstDueDateThenFixedDayStrategy implements DueDateStrategyInterface
{
    public function dueDates(?string $firstDate, int $day, int $count): array
    {
        $day = max(1, min(31, $day));
        $count = max(1, $count);

        $first = $firstDate ? Carbon::parse($firstDate)->startOfDay() : $this->nextFixedDay($day);

        $dates = [$first->format('Y-m-d')];

        // Mês-ano âncora = competência da 1ª parcela; demais = +i meses nesse dia (com trava).
        $anchor = Carbon::create($first->year, $first->month, 1)->startOfDay();
        for ($i = 1; $i < $count; $i++) {
            $month = (clone $anchor)->addMonthsNoOverflow($i);
            $d = min($day, $month->daysInMonth);
            $dates[] = Carbon::create($month->year, $month->month, $d)->format('Y-m-d');
        }

        return $dates;
    }

    /**
     * Próxima ocorrência do dia fixo >= hoje (com trava de fim de mês).
     */
    private function nextFixedDay(int $day): Carbon
    {
        $today = Carbon::today();
        $candidate = Carbon::create($today->year, $today->month, min($day, $today->daysInMonth))->startOfDay();
        if ($candidate->lt($today)) {
            $next = (clone $today)->firstOfMonth()->addMonth();
            $candidate = Carbon::create($next->year, $next->month, min($day, $next->daysInMonth))->startOfDay();
        }
        return $candidate;
    }
}
