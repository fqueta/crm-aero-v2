<?php

namespace App\Services;

use Carbon\Carbon;

/**
 * ContratoValidadeService — regra híbrida de validade de contrato.
 * pt-BR: Usa `config.validade_contrato` (Y-m-d, origem "cadastrada") quando
 * existe; senão calcula `data_contrato|data_inicio + vigencia_meses`
 * (origem "calculada"). A vigência padrão (meses) vem de
 * `qoption('contrato_vigencia_meses')`, fallback 12.
 */
class ContratoValidadeService
{
    public const ORIGIN_EXPLICIT = 'cadastrada';
    public const ORIGIN_COMPUTED = 'calculada';

    public const DEFAULT_VIGENCIA_MESES = 12;

    /**
     * Vigência padrão do contrato em meses.
     */
    public static function vigenciaMeses(?int $override = null): int
    {
        if ($override !== null && $override > 0) {
            return $override;
        }
        try {
            $opt = Qlib::qoption('contrato_vigencia_meses');
            if (is_numeric($opt) && (int) $opt > 0) {
                return (int) $opt;
            }
        } catch (\Throwable $e) {
        }
        return self::DEFAULT_VIGENCIA_MESES;
    }

    /**
     * Data base do contrato (Y-m-d) a partir do config da matrícula.
     * pt-BR: Prefere `data_contrato`, depois `data_inicio`. Ignora valores
     * vazios e datas zeradas do legado (0000-00-00 / 1000-01-01).
     *
     * @param array|string $config config da matrícula (array ou JSON)
     */
    public static function baseDate($config): ?string
    {
        $cfg = is_string($config) ? (json_decode($config, true) ?? []) : (array) ($config ?? []);
        foreach (['data_contrato', 'data_inicio'] as $key) {
            $raw = trim((string) ($cfg[$key] ?? ''));
            $date = self::normalizeDate($raw);
            if ($date !== null) {
                return $date;
            }
        }
        return null;
    }

    /**
     * Validade do contrato (Y-m-d) + origem.
     *
     * @param array|string $config config da matrícula (array ou JSON)
     * @return array{date: ?string, origem: ?string}
     */
    public static function validade($config, ?int $vigenciaMeses = null, ?string $today = null): array
    {
        $cfg = is_string($config) ? (json_decode($config, true) ?? []) : (array) ($config ?? []);

        $explicit = self::normalizeDate(trim((string) ($cfg['validade_contrato'] ?? '')));
        if ($explicit !== null) {
            return ['date' => $explicit, 'origem' => self::ORIGIN_EXPLICIT];
        }

        $base = self::baseDate($cfg);
        if ($base === null) {
            return ['date' => null, 'origem' => null];
        }

        try {
            $date = Carbon::parse($base)->addMonthsNoOverflow(self::vigenciaMeses($vigenciaMeses))->format('Y-m-d');
        } catch (\Throwable $e) {
            return ['date' => null, 'origem' => null];
        }

        return ['date' => $date, 'origem' => self::ORIGIN_COMPUTED];
    }

    /**
     * Verifica se a validade (Y-m-d) está vencida em relação a hoje.
     * pt-BR: Vencido = estritamente anterior ao dia de referência.
     */
    public static function isVencido(?string $dateYmd, ?string $today = null): bool
    {
        if ($dateYmd === null || $dateYmd === '') {
            return false;
        }
        $ref = $today ?? date('Y-m-d');
        return strcmp($dateYmd, $ref) < 0;
    }

    /**
     * Dias em atraso desde a validade até a referência (0 se não vencido).
     */
    public static function diasVencido(string $dateYmd, ?string $today = null): int
    {
        if (!self::isVencido($dateYmd, $today)) {
            return 0;
        }
        try {
            $ref = $today ? Carbon::parse($today)->startOfDay() : Carbon::today();
            return (int) Carbon::parse($dateYmd)->startOfDay()->diffInDays($ref);
        } catch (\Throwable $e) {
            return 0;
        }
    }

    /**
     * Normaliza datas do legado/inputs para Y-m-d ou null.
     */
    public static function normalizeDate(string $raw): ?string
    {
        $raw = trim($raw);
        if ($raw === '' || str_starts_with($raw, '0000') || str_starts_with($raw, '1000-01-01')) {
            return null;
        }
        try {
            $parsed = Carbon::parse($raw);
        } catch (\Throwable $e) {
            return null;
        }
        $date = $parsed->format('Y-m-d');
        if (str_starts_with($date, '0000') || str_starts_with($date, '1000-01-01')) {
            return null;
        }
        return $date;
    }
}
