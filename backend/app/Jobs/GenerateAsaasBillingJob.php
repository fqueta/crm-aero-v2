<?php

namespace App\Jobs;

use App\Models\EventLog;
use App\Models\FinancialAccount;
use App\Models\Matricula;
use App\Services\Asaas\AsaasService;
use App\Services\PaymentSchedule\PaymentScheduleService;
use App\Services\Qlib;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * GenerateAsaasBillingJob
 * pt-BR: Gera a cobrança Asaas da matrícula após a assinatura no ZapSign.
 *        Usa o snapshot congelado (config.financiamento_aprovado): entrada →
 *        cobrança avulsa, restante → parcelada. Idempotente: se `asaas_billing`
 *        já tem pagamentos, não recria. Falhas transitórias de API relançam
 *        (retry); falta de configuração/plano só registra e encerra.
 * en-US: Generates the Asaas billing after ZapSign signature, from the frozen
 *        snapshot. Idempotent; transient API failures are retried.
 */
class GenerateAsaasBillingJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 180;
    public $tries = 3;

    public function __construct(
        protected int $matriculaId
    ) {
    }

    public function handle(): void
    {
        $matricula = Matricula::find($this->matriculaId);
        if (!$matricula) {
            return;
        }

        // Idempotência: cobrança já gerada.
        $existing = $this->readBillingMeta($matricula->id);
        if (!empty($existing['payments'])) {
            Log::info('Asaas: cobrança já existente, ignorando.', ['matricula_id' => $matricula->id]);
            return;
        }

        $schedule = (new PaymentScheduleService())->forMatricula($matricula);
        if (empty($schedule['programacao'])) {
            $this->logEvent($matricula->id, 'asaas_billing_skipped', 'Sem programação de pagamento (financiamento não definido).');
            return;
        }

        $asaas = new AsaasService();
        if (!$asaas->isConfigured()) {
            $this->logEvent($matricula->id, 'asaas_billing_skipped', 'Credencial Asaas não configurada.');
            return;
        }

        $cliente = $matricula->cliente;
        $cpf = preg_replace('/\D/', '', (string) ($cliente?->cpf ?? ''));
        if ($cliente && $cpf === '') {
            $this->logEvent($matricula->id, 'asaas_billing_skipped', 'Cliente sem CPF para cadastro no Asaas.');
            return;
        }

        $cursoNome = $matricula->curso?->titulo ?? $matricula->curso?->nome ?? 'Curso';
        $description = sprintf('Matrícula #%d — %s', $matricula->id, $cursoNome);

        // Exceções de API sobem (retry via tries); só chegam aqui erros transitórios.
        $customerId = $asaas->findOrCreateCustomer(
            (string) ($cliente?->name ?? 'Aluno'),
            $cpf !== '' ? $cpf : null,
            $cliente?->email,
            $cliente?->celular ? preg_replace('/\D/', '', (string) $cliente->celular) : null
        );

        $billing = $asaas->createBilling($schedule, $customerId, [
            'description' => $description,
            'externalReference' => 'matricula:' . $matricula->id,
        ]);

        Qlib::update_matriculameta($matricula->id, 'asaas_customer_id', $customerId);
        Qlib::update_matriculameta($matricula->id, 'asaas_billing', json_encode(array_merge($billing, [
            'matricula_id' => (int) $matricula->id,
            'created_at' => now()->toDateTimeString(),
        ]), JSON_UNESCAPED_UNICODE));

        $this->syncBillingAccount($matricula, $schedule, $billing, $description, $asaas);
        $this->logEvent($matricula->id, 'asaas_billing_created', 'Cobrança Asaas gerada: ' . count($billing['payments']) . ' pagamento(s).');
    }

    /**
     * Cria/atualiza a conta a receber (source=asaas_billing) para a Fase 3
     * (webhook PAYMENT_* → receive) conciliar por externalReference.
     */
    /**
     * Cria/atualiza contas a receber no CRM para cada parcela gerada no Asaas,
     * permitindo acompanhamento parcela por parcela e links diretos no financeiro.
     */
    private function syncBillingAccount(Matricula $matricula, array $schedule, array $billing, string $description, AsaasService $asaas): void
    {
        $itemsToSync = [];
        $totalInstallments = (int) ($schedule['qtd'] ?? 1);

        foreach ($billing['payments'] ?? [] as $pay) {
            $row = is_array($pay) ? $pay : [];
            if (!empty($row['installment_id'])) {
                try {
                    $instResp = $asaas->getInstallmentPayments((string) $row['installment_id']);
                    $children = $instResp['data'] ?? [];
                    if (is_array($children) && count($children) > 0) {
                        $countChildren = count($children);
                        foreach ($children as $idx => $child) {
                            $num = $child['installmentNumber'] ?? ($idx + 1);
                            $itemsToSync[] = [
                                'asaas_payment_id' => $child['id'],
                                'installment_id' => $row['installment_id'],
                                'installment_number' => $num,
                                'total_installments' => $countChildren,
                                'amount' => (float) ($child['value'] ?? 0),
                                'due_date' => $child['dueDate'] ?? null,
                                'invoice_url' => $child['invoiceUrl'] ?? null,
                                'bank_slip_url' => $child['bankSlipUrl'] ?? null,
                                'label' => sprintf('Parcela %d/%d', $num, $countChildren),
                                'kind' => 'parcela',
                            ];
                        }
                        continue;
                    }
                } catch (\Throwable $e) {
                }
            }

            // Pagamentos avulsos: matricula, entrada, parcela_unica ou parcelas fallback
            $kind = $row['kind'] ?? 'avulsa';
            $label = match ($kind) {
                'matricula' => 'Taxa de Matrícula',
                'entrada' => 'Entrada',
                'parcela_unica' => 'Parcela Única',
                default => 'Parcela',
            };

            $itemsToSync[] = [
                'asaas_payment_id' => $row['id'] ?? null,
                'installment_id' => $row['installment_id'] ?? null,
                'installment_number' => 1,
                'total_installments' => 1,
                'amount' => (float) ($row['value'] ?? 0),
                'due_date' => $row['dueDate'] ?? null,
                'invoice_url' => $row['invoiceUrl'] ?? null,
                'bank_slip_url' => $row['bankSlipUrl'] ?? null,
                'label' => $label,
                'kind' => $kind,
            ];
        }

        $createdAccountIds = [];

        foreach ($itemsToSync as $item) {
            $paymentId = $item['asaas_payment_id'];
            if (!$paymentId) {
                continue;
            }

            $account = FinancialAccount::where('type', 'receivable')
                ->where('client_id', $matricula->id_cliente)
                ->whereJsonContains('config->source', 'asaas_billing')
                ->whereJsonContains('config->asaas_payment_id', $paymentId)
                ->first();

            $fullDesc = sprintf('%s — %s (Asaas)', $description, $item['label']);

            $payload = [
                'amount' => $item['amount'],
                'type' => 'receivable',
                'customer_name' => $matricula->cliente?->name,
                'client_id' => $matricula->id_cliente,
                'description' => $fullDesc,
                'notes' => 'Cobrança gerada automaticamente após assinatura (Asaas).',
                'due_date' => $item['due_date'] ?? now()->format('Y-m-d'),
                'payment_method' => 'other',
                'status' => 'pending',
                'payment_date' => null,
                'paid_amount' => 0,
                'installments' => 1,
                'token' => $account?->token ?: Qlib::token(),
                'excluido' => false,
                'deletado' => false,
                'config' => [
                    'source' => 'asaas_billing',
                    'matricula_id' => (int) $matricula->id,
                    'asaas_customer_id' => $billing['customer_id'] ?? null,
                    'asaas_payment_id' => $paymentId,
                    'asaas_installment_id' => $item['installment_id'],
                    'installment_number' => $item['installment_number'],
                    'total_installments' => $item['total_installments'],
                    'invoice_url' => $item['invoice_url'],
                    'bank_slip_url' => $item['bank_slip_url'],
                    'kind' => $item['kind'],
                ],
            ];

            if ($account) {
                $account->fill($payload);
                $account->save();
            } else {
                $account = FinancialAccount::create($payload);
            }

            $createdAccountIds[] = (string) $account->id;
        }

        if (!empty($createdAccountIds)) {
            Qlib::update_matriculameta($matricula->id, 'financial_asaas_account_ids', json_encode($createdAccountIds));
            Qlib::update_matriculameta($matricula->id, 'financial_asaas_account_id', $createdAccountIds[0]);
        }
    }

    private function readBillingMeta(int $matriculaId): array
    {
        $raw = Qlib::get_matriculameta($matriculaId, 'asaas_billing');
        if (!$raw) {
            return [];
        }
        $decoded = json_decode((string) $raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function logEvent(int $matriculaId, string $action, string $description): void
    {
        try {
            EventLog::create([
                'entity_type' => 'matricula',
                'entity_id' => (string) $matriculaId,
                'action' => $action,
                'description' => $description,
                'actor_id' => '1',
                'ip_address' => request()->ip(),
            ]);
        } catch (\Throwable $e) {
            Log::warning('Asaas: falha ao registrar evento.', ['error' => $e->getMessage()]);
        }
    }
}
