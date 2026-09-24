<?php

use App\Services\Asaas\AsaasService;
use Illuminate\Support\Facades\Http;

// Boot da aplicação (facades/Http::fake) sem banco — sem RefreshDatabase.
uses(Tests\TestCase::class);

it('não está configurado nem conectado sem chave', function () {
    $service = new AsaasService('  ', 'sandbox');

    expect($service->isConfigured())->toBeFalse()
        ->and($service->isConnected())->toBeFalse();
});

it('conecta com chave válida (Http fake)', function () {
    Http::fake([
        'https://sandbox.asaas.com/api/v3/finance/balance' => Http::response(['balance' => 100.0], 200),
    ]);

    $service = new AsaasService('$aact_fake_key', 'sandbox');

    expect($service->isConfigured())->toBeTrue()
        ->and($service->isConnected())->toBeTrue()
        ->and($service->getEnvironment())->toBe('sandbox');
});

it('falha com chave inválida (Http fake 401)', function () {
    Http::fake([
        'https://sandbox.asaas.com/api/v3/finance/balance' => Http::response(['errors' => []], 401),
    ]);

    $service = new AsaasService('invalid', 'sandbox');

    expect($service->isConfigured())->toBeTrue()
        ->and($service->isConnected())->toBeFalse();
});

it('usa base de produção quando ambiente é production', function () {
    Http::fake([
        'https://api.asaas.com/v3/finance/balance' => Http::response(['balance' => 0], 200),
    ]);

    $service = new AsaasService('key', 'production');

    expect($service->isConnected())->toBeTrue()
        ->and($service->getEnvironment())->toBe('production');

    Http::assertSent(fn ($request) => str_starts_with($request->url(), 'https://api.asaas.com/v3/'));
});

it('reaproveita cliente existente por cpfCnpj', function () {
    Http::fake([
        'https://sandbox.asaas.com/api/v3/customers*' => Http::response(['data' => [['id' => 'cus_123']]], 200),
    ]);

    $service = new AsaasService('key', 'sandbox');

    expect($service->findOrCreateCustomer('Aluno', '123.456.789-00'))->toBe('cus_123');

    Http::assertSentCount(1);
});

it('cria cliente quando não existe', function () {
    Http::fake([
        'https://sandbox.asaas.com/api/v3/customers*' => Http::sequence()
            ->push(['data' => []])
            ->push(['id' => 'cus_999']),
    ]);

    $service = new AsaasService('key', 'sandbox');

    expect($service->findOrCreateCustomer('Aluno', '12345678900', 'a@e.com', '31999999999'))->toBe('cus_999');

    Http::assertSent(fn ($request) => $request->method() === 'POST'
        && ($request->data()['cpfCnpj'] ?? '') === '12345678900');
});

it('gera entrada avulsa + restante parcelado', function () {
    Http::fake([
        'https://sandbox.asaas.com/api/v3/payments' => Http::sequence()
            ->push(['id' => 'pay_entrada'])
            ->push(['id' => 'pay_parc', 'installment' => 'inst_1']),
    ]);

    $service = new AsaasService('key', 'sandbox');

    $result = $service->createBilling([
        'programacao' => [
            ['n' => 1, 'vencimento' => '2026-10-11', 'valor' => 500.00],
            ['n' => 2, 'vencimento' => '2026-11-11', 'valor' => 2636.72],
            ['n' => 3, 'vencimento' => '2026-12-11', 'valor' => 2636.72],
        ],
    ], 'cus_123', [
        'description' => 'Matrícula #1 — Curso',
        'externalReference' => 'matricula:1',
        'billingType' => 'BOLETO',
    ]);

    expect($result['customer_id'])->toBe('cus_123')
        ->and($result['payments'])->toHaveCount(2)
        ->and($result['payments'][0])->toMatchArray(['kind' => 'entrada', 'id' => 'pay_entrada', 'value' => 500.00])
        ->and($result['payments'][1])->toMatchArray(['kind' => 'parcelas', 'id' => 'pay_parc'])
        ->and($result['payments'][1]['value'])->toBe(5273.44);

    Http::assertSent(function ($request) {
        if ($request->method() !== 'POST') {
            return false;
        }
        $data = $request->data();
        // Segunda chamada: parcelada com installmentCount + totalValue, sem value.
        if (($data['installmentCount'] ?? null) === 2) {
            return ($data['totalValue'] ?? 0) == 5273.44
                && ($data['dueDate'] ?? '') === '2026-11-11'
                && ($data['externalReference'] ?? '') === 'matricula:1:parcelas'
                && !array_key_exists('value', $data);
        }
        return false;
    });
});

it('gera cobrança única quando há só uma parcela', function () {
    Http::fake([
        'https://sandbox.asaas.com/api/v3/payments' => Http::response(['id' => 'pay_1'], 200),
    ]);

    $service = new AsaasService('key', 'sandbox');

    $result = $service->createBilling([
        'programacao' => [['n' => 1, 'vencimento' => '2026-10-11', 'valor' => 1000.00]],
    ], 'cus_123', ['externalReference' => 'matricula:2']);

    expect($result['payments'])->toHaveCount(1)
        ->and($result['payments'][0]['kind'])->toBe('entrada');
});

it('anexa desconto pontualidade, multa e juros em todas as cobranças', function () {
    Http::fake([
        'https://sandbox.asaas.com/api/v3/payments' => Http::response(['id' => 'pay_x'], 200),
    ]);

    $service = new AsaasService('key', 'sandbox');

    $service->createBilling([
        'desconto_pontualidade' => 100.00,
        'programacao' => [
            ['n' => 1, 'vencimento' => '2026-10-11', 'valor' => 1000.00],
            ['n' => 2, 'vencimento' => '2026-11-11', 'valor' => 1000.00],
        ],
    ], 'cus_123', [
        'arrears' => [
            'fine' => ['value' => 2, 'type' => 'PERCENTAGE'],
            'interest' => ['value' => 1.5],
        ],
    ]);

    Http::assertSent(function ($request) {
        if ($request->method() !== 'POST') {
            return false;
        }
        $data = $request->data();
        return ($data['discount'] ?? []) === ['value' => 100.00, 'type' => 'FIXED', 'dueDateLimitDays' => 0]
            && ($data['fine'] ?? []) === ['value' => 2, 'type' => 'PERCENTAGE']
            && ($data['interest'] ?? []) === ['value' => 1.5];
    });
});

it('não envia discount/fine/interest quando zerados', function () {
    Http::fake([
        'https://sandbox.asaas.com/api/v3/payments' => Http::response(['id' => 'pay_x'], 200),
    ]);

    $service = new AsaasService('key', 'sandbox');

    $service->createBilling([
        'programacao' => [['n' => 1, 'vencimento' => '2026-10-11', 'valor' => 1000.00]],
    ], 'cus_123');

    Http::assertSent(function ($request) {
        if ($request->method() !== 'POST') {
            return false;
        }
        $data = $request->data();
        return !array_key_exists('discount', $data)
            && !array_key_exists('fine', $data)
            && !array_key_exists('interest', $data);
    });
});

it('edita e exclui cobrança, e cancela parcelamento', function () {
    Http::fake([
        'https://sandbox.asaas.com/api/v3/payments/pay_1' => Http::sequence()
            ->push(['id' => 'pay_1', 'dueDate' => '2026-12-11'])
            ->push(['deleted' => true, 'id' => 'pay_1']),
        'https://sandbox.asaas.com/api/v3/installments/inst_1/payments' => Http::response(['deleted' => true, 'id' => 'inst_1'], 200),
    ]);

    $service = new AsaasService('key', 'sandbox');

    $updated = $service->updatePayment('pay_1', ['dueDate' => '2026-12-11']);
    expect($updated['dueDate'])->toBe('2026-12-11');

    $deleted = $service->deletePayment('pay_1');
    expect($deleted['deleted'])->toBeTrue();

    $cancelled = $service->cancelInstallment('inst_1');
    expect($cancelled['deleted'])->toBeTrue();
});

it('gera cobrança de matrícula avulsa separada do parcelamento do curso', function () {
    Http::fake([
        'https://sandbox.asaas.com/api/v3/payments' => Http::sequence()
            ->push(['id' => 'pay_matricula', 'status' => 'PENDING', 'invoiceUrl' => 'https://asaas.com/i/mat', 'bankSlipUrl' => 'https://asaas.com/b/mat'])
            ->push(['id' => 'pay_entrada', 'status' => 'PENDING'])
            ->push(['id' => 'pay_parc', 'installment' => 'inst_1', 'status' => 'PENDING']),
    ]);

    $service = new AsaasService('key', 'sandbox');

    $result = $service->createBilling([
        'programacao' => [
            ['n' => 0, 'vencimento' => '2026-10-01', 'valor' => 600.00, 'tipo' => 'matricula', 'descricao' => 'Taxa de Inscrição / Matrícula'],
            ['n' => 1, 'vencimento' => '2026-10-11', 'valor' => 500.00],
            ['n' => 2, 'vencimento' => '2026-11-11', 'valor' => 2000.00],
            ['n' => 3, 'vencimento' => '2026-12-11', 'valor' => 2000.00],
        ],
    ], 'cus_123', [
        'description' => 'Matrícula #128 — Curso de Piloto Privado',
        'externalReference' => 'matricula:128',
    ]);

    expect($result['payments'])->toHaveCount(3)
        ->and($result['payments'][0])->toMatchArray([
            'kind' => 'matricula',
            'id' => 'pay_matricula',
            'value' => 600.00,
            'dueDate' => '2026-10-01',
            'status' => 'PENDING',
            'invoiceUrl' => 'https://asaas.com/i/mat',
            'bankSlipUrl' => 'https://asaas.com/b/mat',
        ])
        ->and($result['payments'][1]['kind'])->toBe('entrada')
        ->and($result['payments'][2]['kind'])->toBe('parcelas');

    Http::assertSent(fn ($request) =>
        $request->method() === 'POST' &&
        ($request->data()['externalReference'] ?? '') === 'matricula:128:matricula' &&
        ($request->data()['value'] ?? 0) == 600.00
    );
});

