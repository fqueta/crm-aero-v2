<?php

use App\Services\Asaas\AsaasPaymentMapper;

it('extrai o id da matrícula do externalReference', function () {
    expect(AsaasPaymentMapper::matriculaIdFromExternalReference('matricula:12'))->toBe(12)
        ->and(AsaasPaymentMapper::matriculaIdFromExternalReference('matricula:12:parcelas'))->toBe(12)
        ->and(AsaasPaymentMapper::matriculaIdFromExternalReference('pedido:12'))->toBeNull()
        ->and(AsaasPaymentMapper::matriculaIdFromExternalReference(null))->toBeNull()
        ->and(AsaasPaymentMapper::matriculaIdFromExternalReference(''))->toBeNull();
});

it('classifica eventos de pagamento, vencimento e estorno', function () {
    expect(AsaasPaymentMapper::isPaidEvent('PAYMENT_RECEIVED'))->toBeTrue()
        ->and(AsaasPaymentMapper::isPaidEvent('PAYMENT_CONFIRMED'))->toBeTrue()
        ->and(AsaasPaymentMapper::isPaidEvent('PAYMENT_CREATED'))->toBeFalse()
        ->and(AsaasPaymentMapper::isOverdueEvent('PAYMENT_OVERDUE'))->toBeTrue()
        ->and(AsaasPaymentMapper::isRefundEvent('PAYMENT_REFUNDED'))->toBeTrue()
        ->and(AsaasPaymentMapper::isRefundEvent('PAYMENT_DELETED'))->toBeTrue()
        ->and(AsaasPaymentMapper::isRefundEvent('PAYMENT_RECEIVED'))->toBeFalse()
        ->and(AsaasPaymentMapper::isPartialRefundEvent('PAYMENT_PARTIALLY_REFUNDED'))->toBeTrue();
});

it('extrai valor e data do pagamento', function () {
    expect(AsaasPaymentMapper::paymentValue(['value' => 150.5]))->toBe(150.5)
        ->and(AsaasPaymentMapper::paymentValue([]))->toBe(0.0)
        ->and(AsaasPaymentMapper::paymentDate(['clientPaymentDate' => '2026-10-12']))->toBe('2026-10-12')
        ->and(AsaasPaymentMapper::paymentDate(['paymentDate' => '2026-10-12 16:00:00']))->toBe('2026-10-12')
        ->and(AsaasPaymentMapper::paymentId(['id' => 'pay_1']))->toBe('pay_1')
        ->and(AsaasPaymentMapper::paymentId([]))->toBeNull()
        ->and(AsaasPaymentMapper::installmentId(['installment' => 'inst_1']))->toBe('inst_1')
        ->and(AsaasPaymentMapper::billingType(['billingType' => 'boleto']))->toBe('BOLETO');
});
