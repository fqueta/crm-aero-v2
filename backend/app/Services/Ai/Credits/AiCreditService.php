<?php

namespace App\Services\Ai\Credits;

use App\Models\SaasAiCreditPurchase;
use App\Models\SaasAiCreditTransaction;
use App\Models\SaasAiCreditWallet;
use App\Models\SaasGateway;
use App\Models\Tenant;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Exception;

class AiCreditService
{
    /**
     * Catálogo padrão de pacotes de créditos de IA para recarga avulsa.
     */
    public static function getAvailablePackages(): array
    {
        return [
            [
                'slug' => 'starter_500',
                'name' => 'Pacote Inicial',
                'credits' => 500,
                'price' => 29.90,
                'unit_price' => 'R$ 0,059/crédito',
                'badge' => null,
                'description' => 'Ideal para testar sugestões e manter as edições ativas.',
                'recommended' => false,
            ],
            [
                'slug' => 'pro_1500',
                'name' => 'Pacote Profissional',
                'credits' => 1500,
                'price' => 69.90,
                'unit_price' => 'R$ 0,046/crédito',
                'badge' => 'Mais Popular (Economia 22%)',
                'description' => 'Volume perfeito para revisões frequentes de Programas de Instrução e chat.',
                'recommended' => true,
            ],
            [
                'slug' => 'business_5000',
                'name' => 'Pacote Business',
                'credits' => 5000,
                'price' => 189.90,
                'unit_price' => 'R$ 0,037/crédito',
                'badge' => 'Melhor Valor (Economia 36%)',
                'description' => 'Máxima escala para equipes pedagógicas e uso intensivo de IA.',
                'recommended' => false,
            ],
        ];
    }

    /**
     * Obtém ou inicializa a carteira do tenant.
     */
    public function getOrCreateWallet(string $tenantId): SaasAiCreditWallet
    {
        $wallet = SaasAiCreditWallet::where('tenant_id', $tenantId)->first();

        if (!$wallet) {
            $wallet = SaasAiCreditWallet::create([
                'tenant_id' => $tenantId,
                'monthly_allowance' => 100, // 100 créditos de cortesia inicial
                'monthly_used' => 0,
                'purchased_balance' => 0,
                'cycle_start_at' => now(),
                'cycle_ends_at' => now()->addMonth(),
            ]);
        }

        // Se o ciclo mensal expirou, reinicia o allowance mensal
        if ($wallet->cycle_ends_at && $wallet->cycle_ends_at->isPast()) {
            $wallet->update([
                'monthly_used' => 0,
                'cycle_start_at' => now(),
                'cycle_ends_at' => now()->addMonth(),
            ]);
            $wallet->refresh();
        }

        return $wallet;
    }

    /**
     * Retorna o balanço atual de créditos do tenant.
     */
    public function getBalance(string $tenantId): array
    {
        $wallet = $this->getOrCreateWallet($tenantId);

        $isUnlimited = $wallet->monthly_allowance < 0;
        $monthlyAllowance = $wallet->monthly_allowance;
        $monthlyUsed = $wallet->monthly_used;
        $monthlyRemaining = $isUnlimited ? -1 : max(0, $monthlyAllowance - $monthlyUsed);
        $purchasedBalance = max(0, $wallet->purchased_balance);
        $totalAvailable = $isUnlimited ? -1 : ($monthlyRemaining + $purchasedBalance);

        $percentUsed = 0;
        if ($monthlyAllowance > 0) {
            $percentUsed = min(100, round(($monthlyUsed / $monthlyAllowance) * 100));
        }

        $isExhausted = !$isUnlimited && $totalAvailable <= 0;

        return [
            'is_unlimited' => $isUnlimited,
            'is_exhausted' => $isExhausted,
            'total_available' => $totalAvailable,
            'monthly_allowance' => $monthlyAllowance,
            'monthly_used' => $monthlyUsed,
            'monthly_remaining' => $monthlyRemaining,
            'purchased_balance' => $purchasedBalance,
            'percent_used' => $percentUsed,
            'cycle_ends_at' => $wallet->cycle_ends_at?->format('d/m/Y'),
            'days_until_renewal' => $wallet->cycle_ends_at ? max(0, now()->diffInDays($wallet->cycle_ends_at)) : 30,
        ];
    }

    /**
     * Verifica se o tenant possui saldo suficiente.
     */
    public function canConsume(string $tenantId, int $cost = 1): bool
    {
        $wallet = $this->getOrCreateWallet($tenantId);
        if ($wallet->monthly_allowance < 0) {
            return true;
        }

        return $wallet->total_available >= $cost;
    }

    /**
     * Debita créditos de forma atômica.
     */
    public function consume(
        string $tenantId,
        int $cost = 1,
        string $source = 'instruction_program_editor',
        string $description = '',
        ?array $metadata = []
    ): bool {
        $wallet = $this->getOrCreateWallet($tenantId);

        if ($wallet->monthly_allowance < 0) {
            $wallet->increment('monthly_used', $cost);
            return true;
        }

        if ($wallet->total_available < $cost) {
            return false;
        }

        $balanceAfter = 0;

        DB::transaction(function () use ($wallet, $cost, &$balanceAfter) {
            $monthlyRemaining = max(0, $wallet->monthly_allowance - $wallet->monthly_used);

            if ($monthlyRemaining >= $cost) {
                $wallet->increment('monthly_used', $cost);
            } else {
                $overflow = $cost - $monthlyRemaining;
                if ($monthlyRemaining > 0) {
                    $wallet->increment('monthly_used', $monthlyRemaining);
                }
                $wallet->decrement('purchased_balance', $overflow);
            }

            $wallet->refresh();
            $balanceAfter = $wallet->total_available;
        });

        try {
            SaasAiCreditTransaction::create([
                'tenant_id' => $tenantId,
                'type' => 'usage',
                'amount' => -$cost,
                'balance_after' => $balanceAfter,
                'source' => $source,
                'description' => $description ?: "Consumo de IA ({$source})",
                'metadata' => $metadata,
            ]);
        } catch (\Throwable $e) {
            Log::warning("Falha ao registrar SaasAiCreditTransaction: " . $e->getMessage());
        }

        return true;
    }

    /**
     * Cria uma compra de pacote e gera o PIX dinâmico no Asaas Central.
     */
    public function createPurchase(string $tenantId, string $packageSlug): array
    {
        $package = collect(self::getAvailablePackages())->firstWhere('slug', $packageSlug);
        if (!$package) {
            throw new Exception("Pacote de créditos inválido selecionado.");
        }

        $gateway = SaasGateway::where('gateway', 'asaas')->where('is_active', true)->first();
        if (!$gateway || empty($gateway->api_key)) {
            throw new Exception("Gateway de pagamento Asaas Central não está configurado.");
        }

        $apiKey = Crypt::decryptString($gateway->api_key);
        $baseUrl = $gateway->environment === 'sandbox'
            ? 'https://sandbox.asaas.com/api/v3'
            : 'https://api.asaas.com/v3';

        // Localiza ou cadastra o cliente do Tenant no Asaas Central
        $customerId = $this->resolveAsaasCustomerId($tenantId, $apiKey, $baseUrl);

        $purchase = SaasAiCreditPurchase::create([
            'tenant_id' => $tenantId,
            'package_slug' => $packageSlug,
            'credits' => $package['credits'],
            'price' => $package['price'],
            'status' => 'pending',
            'payment_gateway' => 'asaas',
        ]);

        $description = "Recarga de {$package['credits']} Créditos de IA (Tenant {$tenantId})";

        $billingPayload = [
            'customer' => $customerId,
            'billingType' => 'PIX',
            'value' => (float) $package['price'],
            'dueDate' => now()->addDays(1)->format('Y-m-d'),
            'description' => substr($description, 0, 500),
            'externalReference' => "saas_ai_credits_{$purchase->id}",
            'postalService' => false,
        ];

        $resp = Http::withHeaders([
            'access_token' => $apiKey,
            'Content-Type' => 'application/json',
        ])->timeout(20)->post("{$baseUrl}/payments", $billingPayload);

        if (!$resp->successful()) {
            $purchase->update(['status' => 'failed']);
            $err = $resp->json('errors.0.description') ?? $resp->body();
            throw new Exception("Falha ao gerar cobrança no Asaas: {$err}");
        }

        $paymentData = $resp->json();
        $paymentId = $paymentData['id'] ?? null;
        $invoiceUrl = $paymentData['invoiceUrl'] ?? null;

        // Busca o QR Code PIX oficial
        $pixQrCode = null;
        $pixCopyPaste = null;

        if ($paymentId) {
            try {
                $qrResp = Http::withHeaders([
                    'access_token' => $apiKey,
                ])->timeout(15)->get("{$baseUrl}/payments/{$paymentId}/pixQrCode");

                if ($qrResp->successful()) {
                    $qrData = $qrResp->json();
                    $pixQrCode = $qrData['encodedImage'] ?? null;
                    $pixCopyPaste = $qrData['payload'] ?? null;
                }
            } catch (\Throwable $e) {
                Log::warning("Erro ao obter PIX QR Code do Asaas: " . $e->getMessage());
            }
        }

        $purchase->update([
            'payment_gateway_ref' => $paymentId,
            'pix_qr_code' => $pixQrCode,
            'pix_copy_paste' => $pixCopyPaste,
            'invoice_url' => $invoiceUrl,
        ]);

        return [
            'purchase_id' => $purchase->id,
            'payment_id' => $paymentId,
            'package' => $package,
            'price' => (float) $package['price'],
            'credits' => $package['credits'],
            'pix_qr_code' => $pixQrCode,
            'pix_copy_paste' => $pixCopyPaste,
            'invoice_url' => $invoiceUrl,
            'status' => 'pending',
        ];
    }

    /**
     * Consulta o status do pagamento da compra (para polling do modal).
     */
    public function checkPaymentStatus(int $purchaseId): array
    {
        $purchase = SaasAiCreditPurchase::find($purchaseId);
        if (!$purchase) {
            return ['status' => 'not_found', 'is_paid' => false];
        }

        if ($purchase->status === 'paid') {
            return [
                'status' => 'paid',
                'is_paid' => true,
                'credits' => $purchase->credits,
                'paid_at' => $purchase->paid_at?->format('d/m/Y H:i:s'),
            ];
        }

        // Se ainda está pendente, consulta o Asaas diretamente
        if ($purchase->payment_gateway_ref) {
            $gateway = SaasGateway::where('gateway', 'asaas')->first();
            if ($gateway && !empty($gateway->api_key)) {
                $apiKey = Crypt::decryptString($gateway->api_key);
                $baseUrl = $gateway->environment === 'sandbox'
                    ? 'https://sandbox.asaas.com/api/v3'
                    : 'https://api.asaas.com/v3';

                try {
                    $resp = Http::withHeaders(['access_token' => $apiKey])
                        ->timeout(10)
                        ->get("{$baseUrl}/payments/{$purchase->payment_gateway_ref}");

                    if ($resp->successful()) {
                        $payment = $resp->json();
                        $status = $payment['status'] ?? '';

                        if (in_array($status, ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'])) {
                            $this->markAsPaid($purchase, $payment['id'] ?? null);
                            return [
                                'status' => 'paid',
                                'is_paid' => true,
                                'credits' => $purchase->credits,
                                'paid_at' => now()->format('d/m/Y H:i:s'),
                            ];
                        }
                    }
                } catch (\Throwable $e) {
                    Log::warning("Erro ao consultar pagamento no Asaas: " . $e->getMessage());
                }
            }
        }

        return [
            'status' => $purchase->status,
            'is_paid' => false,
            'pix_qr_code' => $purchase->pix_qr_code,
            'pix_copy_paste' => $purchase->pix_copy_paste,
        ];
    }

    /**
     * Marca uma compra como paga e adiciona os créditos à carteira.
     */
    public function markAsPaid(SaasAiCreditPurchase $purchase, ?string $asaasPaymentId = null): bool
    {
        if ($purchase->status === 'paid') {
            return true;
        }

        DB::transaction(function () use ($purchase, $asaasPaymentId) {
            $purchase->update([
                'status' => 'paid',
                'paid_at' => now(),
            ]);

            $wallet = $this->getOrCreateWallet($purchase->tenant_id);
            $wallet->increment('purchased_balance', $purchase->credits);
            $wallet->refresh();

            SaasAiCreditTransaction::create([
                'tenant_id' => $purchase->tenant_id,
                'type' => 'purchase',
                'amount' => $purchase->credits,
                'balance_after' => $wallet->total_available,
                'source' => 'package_purchase',
                'description' => "Recarga de {$purchase->credits} créditos de IA (PIX Asaas)",
                'metadata' => [
                    'purchase_id' => $purchase->id,
                    'asaas_payment_id' => $asaasPaymentId ?? $purchase->payment_gateway_ref,
                    'price' => $purchase->price,
                    'package_slug' => $purchase->package_slug,
                ],
            ]);
        });

        Log::info("Créditos de IA liberados com sucesso para tenant {$purchase->tenant_id}: +{$purchase->credits} créditos.");

        return true;
    }

    /**
     * Resolve o customer ID no Asaas Central.
     */
    protected function resolveAsaasCustomerId(string $tenantId, string $apiKey, string $baseUrl): string
    {
        $tenant = Tenant::find($tenantId);
        $customerName = "Assinante CRM {$tenantId}";
        $customerEmail = "financeiro+{$tenantId}@aeroclubejf.com.br";

        // Tenta buscar por email
        $searchResp = Http::withHeaders(['access_token' => $apiKey])
            ->timeout(15)
            ->get("{$baseUrl}/customers", ['email' => $customerEmail]);

        if ($searchResp->successful() && !empty($searchResp->json('data.0.id'))) {
            return $searchResp->json('data.0.id');
        }

        // Cria o customer no Asaas
        $createResp = Http::withHeaders(['access_token' => $apiKey])
            ->timeout(15)
            ->post("{$baseUrl}/customers", [
                'name' => $customerName,
                'email' => $customerEmail,
                'externalReference' => "tenant_{$tenantId}",
            ]);

        if ($createResp->successful() && !empty($createResp->json('id'))) {
            return $createResp->json('id');
        }

        throw new Exception("Não foi possível criar o cliente no Asaas Central: " . $createResp->body());
    }
}
