<?php

namespace App\Services\Asaas;

/**
 * AsaasPaymentMapper — classificação pura de eventos/pagamentos do webhook Asaas.
 * pt-BR: Sem I/O nem banco; testável em unidade. Centraliza `matricula:{id}`,
 * eventos que pagam, vencimento, estorno e extração de valor/data.
 */
final class AsaasPaymentMapper
{
    public const PAID_EVENTS = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];

    /**
     * Extrai o id da matrícula de `matricula:{id}` ou `matricula:{id}:parcelas`.
     */
    public static function matriculaIdFromExternalReference(mixed $externalReference): ?int
    {
        if (!is_string($externalReference)) {
            return null;
        }
        if (preg_match('/^matricula:(\d+)(?::|$)/', trim($externalReference), $m)) {
            return (int) $m[1];
        }
        return null;
    }

    public static function isPaidEvent(string $event): bool
    {
        return in_array(strtoupper($event), self::PAID_EVENTS, true);
    }

    public static function isOverdueEvent(string $event): bool
    {
        return strtoupper($event) === 'PAYMENT_OVERDUE';
    }

    public static function isRefundEvent(string $event): bool
    {
        return in_array(strtoupper($event), ['PAYMENT_REFUNDED', 'PAYMENT_DELETED'], true);
    }

    public static function isPartialRefundEvent(string $event): bool
    {
        return strtoupper($event) === 'PAYMENT_PARTIALLY_REFUNDED';
    }

    public static function paymentId(array $payment): ?string
    {
        $id = $payment['id'] ?? null;
        return is_string($id) && $id !== '' ? $id : null;
    }

    public static function installmentId(array $payment): ?string
    {
        $id = $payment['installment'] ?? null;
        return is_string($id) && $id !== '' ? $id : null;
    }

    public static function paymentValue(array $payment): float
    {
        return round((float) ($payment['value'] ?? 0), 2);
    }

    /**
     * Data do pagamento (Y-m-d): clientPaymentDate → paymentDate → confirmedDate → hoje.
     */
    public static function paymentDate(array $payment): string
    {
        foreach (['clientPaymentDate', 'paymentDate', 'confirmedDate', 'dateCreated'] as $key) {
            $raw = $payment[$key] ?? null;
            if (is_string($raw) && ($ts = strtotime(substr($raw, 0, 10)))) {
                return date('Y-m-d', $ts);
            }
        }
        return date('Y-m-d');
    }

    public static function billingType(array $payment): string
    {
        return strtoupper((string) ($payment['billingType'] ?? 'UNDEFINED'));
    }
}
