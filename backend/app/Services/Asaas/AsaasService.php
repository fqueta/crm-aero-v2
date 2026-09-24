<?php

namespace App\Services\Asaas;

use App\Models\ApiCredential;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
use Exception;

/**
 * AsaasService — base da integração Asaas (padrão Help Desk, sem escopo de organização).
 * pt-BR: Lê a credencial `integracao-asaas` (api_credentials), expõe
 * `isConfigured/isConnected` (via GET /finance/balance) e o webhook token.
 * Cobrança e webhook de pagamento entram nas próximas fases.
 * en-US: Reads the `integracao-asaas` credential, exposes
 * `isConfigured/isConnected` (via GET /finance/balance) and the webhook token.
 */
class AsaasService
{
    public const SANDBOX_URL = 'https://sandbox.asaas.com/api/v3';
    public const PRODUCTION_URL = 'https://api.asaas.com/v3';

    protected string $apiKey = '';
    protected string $environment = 'sandbox';
    protected string $baseUrl = self::SANDBOX_URL;
    protected string $webhookToken = '';
    protected string $defaultBillingType = 'BOLETO';
    /** @var array|null Mora padrão: ['fine' => ?array{value: float, type: string}, 'interest' => ?array{value: float}] */
    protected ?array $defaultArrears = null;

    public function __construct(?string $apiKey = null, ?string $environment = null)
    {
        if ($apiKey !== null) {
            $this->apiKey = trim($apiKey);
            $this->environment = $environment ?: 'sandbox';
            $this->baseUrl = $this->environment === 'production' ? self::PRODUCTION_URL : self::SANDBOX_URL;
        } else {
            $this->loadCredentials();
        }
    }

    protected function loadCredentials(): void
    {
        $cred = ApiCredential::withoutGlobalScope('notDeleted')
            ->where(function ($q) {
                $q->where('post_name', 'integracao-asaas')
                    ->orWhere('post_name', 'like', '%asaas%');
            })
            ->where('deletado', '!=', 's')
            ->orderBy('ID', 'desc')
            ->first();

        if ($cred) {
            $config = is_string($cred->config) ? (json_decode($cred->config, true) ?? []) : ($cred->config ?? []);

            $candidate = $this->decrypt($config['pass'] ?? '');
            if (empty($candidate)) {
                $candidate = $this->decrypt($config['access_token'] ?? '');
            }
            if (empty($candidate) && !empty($config['api_key'])) {
                $candidate = (string) $config['api_key'];
            }
            if (empty($candidate) && !empty($cred->token)) {
                $candidate = (string) $cred->token;
            }

            $this->apiKey = trim($candidate);
            $this->environment = $config['environment'] ?? $config['produto'] ?? 'sandbox';
            $this->webhookToken = $this->decrypt($config['webhook_token'] ?? '');
            if (!empty($config['billing_type'])) {
                $this->defaultBillingType = strtoupper((string) $config['billing_type']);
            }
            // Mora padrão (vazio = usa o padrão da conta Asaas, sem enviar os objetos).
            $fineValue = is_numeric($config['fine_value'] ?? null) ? (float) $config['fine_value'] : 0.0;
            $interestValue = is_numeric($config['interest_value'] ?? null) ? (float) $config['interest_value'] : 0.0;
            $this->defaultArrears = [
                'fine' => $fineValue > 0 ? [
                    'value' => $fineValue,
                    'type' => strtoupper((string) ($config['fine_type'] ?? 'PERCENTAGE')),
                ] : null,
                'interest' => $interestValue > 0 ? ['value' => $interestValue] : null,
            ];
        }

        $this->baseUrl = $this->environment === 'production' ? self::PRODUCTION_URL : self::SANDBOX_URL;
    }

    public function isConfigured(): bool
    {
        return !empty($this->apiKey) && $this->apiKey !== 'apikey';
    }

    public function getWebhookToken(): string
    {
        return $this->webhookToken;
    }

    public function getEnvironment(): string
    {
        return $this->environment;
    }

    public function getDefaultBillingType(): string
    {
        return $this->defaultBillingType;
    }

    /**
     * Mora padrão da credencial (multa/juros pós-vencimento) ou null.
     * pt-BR: `fine`/`interest` só vão no payload quando > 0 (a doc Asaas manda
     * não enviar vazio para não sobrescrever o padrão da conta).
     *
     * @return array{fine: ?array, interest: ?array}
     */
    public function getDefaultArrears(): array
    {
        return $this->defaultArrears ?? ['fine' => null, 'interest' => null];
    }

    public function isConnected(): bool
    {
        if (!$this->isConfigured()) {
            return false;
        }

        try {
            $response = Http::withHeaders([
                'access_token' => $this->apiKey,
                'User-Agent' => 'CrmAero/1.0',
                'Content-Type' => 'application/json',
            ])->timeout(10)->get($this->baseUrl . '/finance/balance');

            return $response->successful();
        } catch (Exception $e) {
            return false;
        }
    }

    /**
     * Localiza o cliente no Asaas por CPF/CNPJ ou cria.
     * @return string cus_* id
     * @throws \RuntimeException
     */
    public function findOrCreateCustomer(string $name, ?string $cpfCnpj, ?string $email = null, ?string $mobilePhone = null): string
    {
        $this->assertConfigured();

        $digits = preg_replace('/\D/', '', (string) $cpfCnpj) ?? '';
        if ($digits !== '') {
            $found = $this->request('GET', '/customers', ['cpfCnpj' => $digits]);
            $list = $found['data'] ?? (is_array($found) && isset($found[0]) ? $found : []);
            if (!empty($list[0]['id'])) {
                return (string) $list[0]['id'];
            }
        }

        $payload = ['name' => $name];
        if ($digits !== '') {
            $payload['cpfCnpj'] = $digits;
        }
        if ($email) {
            $payload['email'] = $email;
        }
        if ($mobilePhone) {
            $payload['mobilePhone'] = $mobilePhone;
        }

        $created = $this->request('POST', '/customers', $payload);
        if (empty($created['id'])) {
            throw new \RuntimeException('Asaas: resposta inesperada ao criar cliente.');
        }

        return (string) $created['id'];
    }

    /**
     * Cria a cobrança a partir da programação (snapshot congelado).
     * pt-BR: 1ª parcela (entrada) → cobrança avulsa; demais → parcelada
     * (installmentCount + totalValue). Retorna os ids criados p/ conciliação.
     *
     * @param array $schedule Saída de PaymentScheduleService::build()
     * @param string $customerId cus_* id
     * @param array $opts {description?: string, externalReference?: string, billingType?: string}
     * @return array{customer_id: string, payments: array<int, array{kind: string, id: string, value: float, dueDate: string, installment_id?: string}>}
     * @throws \RuntimeException
     */
    public function createBilling(array $schedule, string $customerId, array $opts = []): array
    {
        $this->assertConfigured();

        $programacao = $schedule['programacao'] ?? [];
        if (empty($programacao)) {
            throw new \RuntimeException('Asaas: programação de pagamento vazia.');
        }

        $billingType = strtoupper((string) ($opts['billingType'] ?? $this->defaultBillingType));
        $description = (string) ($opts['description'] ?? 'Cobrança de matrícula');
        $externalReference = (string) ($opts['externalReference'] ?? '');

        // Desconto pontualidade (FIXED até o vencimento) em todas as cobranças.
        $descontoValue = round((float) ($schedule['desconto_pontualidade'] ?? 0), 2);
        $discount = $descontoValue > 0 ? [
            'value' => $descontoValue,
            'type' => 'FIXED',
            'dueDateLimitDays' => 0,
        ] : null;
        // Mora (multa/juros pós-vencimento): credencial, com override via $opts.
        $arrears = is_array($opts['arrears'] ?? null) ? $opts['arrears'] : $this->getDefaultArrears();
        $fine = $arrears['fine'] ?? null;
        $interest = $arrears['interest'] ?? null;

        $payments = [];

        // 1. Extrair item avulso exclusivo de matrícula (tipo === 'matricula' ou n === 0)
        $matriculaItem = null;
        $parcelasItems = [];
        foreach ($programacao as $item) {
            if (($item['tipo'] ?? null) === 'matricula' || ($item['n'] ?? null) === 0) {
                $matriculaItem = $item;
            } else {
                $parcelasItems[] = $item;
            }
        }

        // Se houver taxa de matrícula avulsa, cria cobrança exclusiva para ela
        if ($matriculaItem && (float) ($matriculaItem['valor'] ?? 0) > 0) {
            $created = $this->createPayment([
                'customer' => $customerId,
                'billingType' => $billingType,
                'value' => round((float) $matriculaItem['valor'], 2),
                'dueDate' => $matriculaItem['vencimento'],
                'description' => $description . ' — Taxa de Inscrição / Matrícula',
                'externalReference' => $externalReference !== '' ? $externalReference . ':matricula' : null,
                'discount' => $discount,
                'fine' => $fine,
                'interest' => $interest,
            ]);
            $payments[] = [
                'kind' => 'matricula',
                'id' => $created['id'],
                'value' => round((float) $matriculaItem['valor'], 2),
                'dueDate' => $matriculaItem['vencimento'],
                'status' => $created['status'] ?? 'PENDING',
                'invoiceUrl' => $created['invoiceUrl'] ?? null,
                'bankSlipUrl' => $created['bankSlipUrl'] ?? null,
            ];
        }

        if (empty($parcelasItems)) {
            return ['customer_id' => $customerId, 'payments' => $payments];
        }

        $first = $parcelasItems[0];
        $rest = array_slice($parcelasItems, 1);

        // Entrada / 1ª parcela: cobrança avulsa.
        if ((float) ($first['valor'] ?? 0) > 0) {
            $created = $this->createPayment([
                'customer' => $customerId,
                'billingType' => $billingType,
                'value' => round((float) $first['valor'], 2),
                'dueDate' => $first['vencimento'],
                'description' => $description . ' — Entrada',
                'externalReference' => $externalReference !== '' ? $externalReference : null,
                'discount' => $discount,
                'fine' => $fine,
                'interest' => $interest,
            ]);
            $payments[] = [
                'kind' => 'entrada',
                'id' => $created['id'],
                'value' => round((float) $first['valor'], 2),
                'dueDate' => $first['vencimento'],
                'status' => $created['status'] ?? 'PENDING',
                'invoiceUrl' => $created['invoiceUrl'] ?? null,
                'bankSlipUrl' => $created['bankSlipUrl'] ?? null,
            ];
        }

        // Restante: avulsa (1 item) ou parcelada (installmentCount + totalValue).
        $rest = array_values(array_filter($rest, fn ($p) => (float) ($p['valor'] ?? 0) > 0));
        if (count($rest) === 1) {
            $created = $this->createPayment([
                'customer' => $customerId,
                'billingType' => $billingType,
                'value' => round((float) $rest[0]['valor'], 2),
                'dueDate' => $rest[0]['vencimento'],
                'description' => $description . ' — Parcela única',
                'externalReference' => $externalReference !== '' ? $externalReference . ':parcelas' : null,
                'discount' => $discount,
                'fine' => $fine,
                'interest' => $interest,
            ]);
            $payments[] = [
                'kind' => 'parcela_unica',
                'id' => $created['id'],
                'value' => round((float) $rest[0]['valor'], 2),
                'dueDate' => $rest[0]['vencimento'],
                'status' => $created['status'] ?? 'PENDING',
                'invoiceUrl' => $created['invoiceUrl'] ?? null,
                'bankSlipUrl' => $created['bankSlipUrl'] ?? null,
            ];
        } elseif (count($rest) > 1) {
            $total = round(array_sum(array_map(fn ($p) => (float) $p['valor'], $rest)), 2);
            $created = $this->createPayment([
                'customer' => $customerId,
                'billingType' => $billingType,
                'installmentCount' => count($rest),
                'totalValue' => $total,
                'dueDate' => $rest[0]['vencimento'],
                'description' => $description . sprintf(' — %dx', count($rest)),
                'externalReference' => $externalReference !== '' ? $externalReference . ':parcelas' : null,
                'discount' => $discount,
                'fine' => $fine,
                'interest' => $interest,
            ]);
            $payments[] = [
                'kind' => 'parcelas',
                'id' => $created['id'],
                'value' => $total,
                'dueDate' => $rest[0]['vencimento'],
                'installment_id' => $created['installment'] ?? null,
                'status' => $created['status'] ?? 'PENDING',
                'invoiceUrl' => $created['invoiceUrl'] ?? null,
                'bankSlipUrl' => $created['bankSlipUrl'] ?? null,
            ];
        }

        return ['customer_id' => $customerId, 'payments' => $payments];
    }

    /**
     * POST /payments (avulsa ou parcelada).
     * @return array Resposta decodificada (com ao menos `id`).
     * @throws \RuntimeException
     */
    public function createPayment(array $data): array
    {
        $this->assertConfigured();

        $payload = array_filter([
            'customer' => $data['customer'] ?? null,
            'billingType' => $data['billingType'] ?? $this->defaultBillingType,
            'value' => $data['value'] ?? null,
            'installmentCount' => $data['installmentCount'] ?? null,
            'totalValue' => $data['totalValue'] ?? null,
            'dueDate' => $data['dueDate'] ?? null,
            'description' => $data['description'] ?? null,
            'externalReference' => $data['externalReference'] ?? null,
            'discount' => $data['discount'] ?? null,
            'fine' => $data['fine'] ?? null,
            'interest' => $data['interest'] ?? null,
        ], fn ($v) => $v !== null);

        $created = $this->request('POST', '/payments', $payload);
        if (empty($created['id'])) {
            throw new \RuntimeException('Asaas: resposta inesperada ao criar cobrança.');
        }

        return $created;
    }

    /**
     * GET /payments/{id} — detalhe completo (usado pelo webhook quando o
     * payload chega mínimo ou sem externalReference).
     * @throws \RuntimeException
     */
    public function getPayment(string $paymentId): array
    {
        $this->assertConfigured();

        return $this->request('GET', '/payments/' . urlencode($paymentId));
    }

    /**
     * PUT /payments/{id} — edita cobrança PENDING/OVERDUE.
     * pt-BR: Campos editáveis: dueDate, value, description, discount,
     * externalReference. Nunca troca o customer (regra Asaas).
     * @throws \RuntimeException
     */
    public function updatePayment(string $paymentId, array $data): array
    {
        $this->assertConfigured();

        $payload = array_filter([
            'dueDate' => $data['dueDate'] ?? null,
            'value' => isset($data['value']) ? round((float) $data['value'], 2) : null,
            'description' => $data['description'] ?? null,
            'discount' => $data['discount'] ?? null,
            'externalReference' => $data['externalReference'] ?? null,
        ], fn ($v) => $v !== null);

        return $this->request('PUT', '/payments/' . urlencode($paymentId), $payload);
    }

    /**
     * DELETE /payments/{id} — exclui cobrança ainda não paga.
     * pt-BR: Paga/confirmada/liquidada não pode (usar estorno); o Asaas
     * responde 400 e a mensagem é repassada.
     * @throws \RuntimeException
     */
    public function deletePayment(string $paymentId): array
    {
        $this->assertConfigured();

        return $this->request('DELETE', '/payments/' . urlencode($paymentId));
    }

    /**
     * DELETE /installments/{id}/payments — cancela as cobranças pendentes/
     * vencidas de um parcelamento (confirmadas não são afetadas).
     * pt-BR: Usado na exclusão do plano inteiro (kind=parcelas).
     * @throws \RuntimeException
     */
    public function cancelInstallment(string $installmentId): array
    {
        $this->assertConfigured();

        return $this->request('DELETE', '/installments/' . urlencode($installmentId) . '/payments');
    }

    /**
     * Requisição autenticada à API v3. Lança RuntimeException com a mensagem do Asaas.
     */
    private function request(string $method, string $path, array $data = []): array
    {
        try {
            $req = Http::withHeaders([
                'access_token' => $this->apiKey,
                'User-Agent' => 'CrmAero/1.0',
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ])->timeout(20);

            $url = $this->baseUrl . $path;
            $response = match (strtoupper($method)) {
                'GET' => $req->get($url, $data),
                'PUT' => $req->put($url, $data),
                'DELETE' => $req->delete($url, $data),
                default => $req->post($url, $data),
            };
        } catch (Exception $e) {
            throw new \RuntimeException('Asaas: falha de comunicação (' . $e->getMessage() . ')');
        }

        $decoded = $response->json() ?? [];
        if (!$response->successful()) {
            throw new \RuntimeException('Asaas: ' . $this->extractErrorMessage($decoded, $response->status()));
        }

        return is_array($decoded) ? $decoded : [];
    }

    private function extractErrorMessage(mixed $decoded, int $status): string
    {
        if (is_array($decoded)) {
            $errors = $decoded['errors'] ?? [];
            if (is_array($errors) && !empty($errors[0]['description'])) {
                return (string) $errors[0]['description'];
            }
            if (!empty($decoded['message'])) {
                return (string) $decoded['message'];
            }
        }
        return 'requisição rejeitada (HTTP ' . $status . ').';
    }

    private function assertConfigured(): void
    {
        if (!$this->isConfigured()) {
            throw new \RuntimeException('Asaas: credencial não configurada.');
        }
    }

    private function decrypt(mixed $value): string
    {
        if (!is_string($value) || $value === '') {
            return '';
        }
        try {
            return Crypt::decryptString($value);
        } catch (\Throwable $e) {
            return $value;
        }
    }
}
