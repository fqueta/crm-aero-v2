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

        $this->syncBillingAccount($matricula, $schedule, $billing, $description);
        $this->logEvent($matricula->id, 'asaas_billing_created', 'Cobrança Asaas gerada: ' . count($billing['payments']) . ' pagamento(s).');
    }

    /**
     * Cria/atualiza a conta a receber (source=asaas_billing) para a Fase 3
     * (webhook PAYMENT_* → receive) conciliar por externalReference.
     */
    private function syncBillingAccount(Matricula $matricula, array $schedule, array $billing, string $description): void
    {
        $total = (float) ($schedule['total'] ?? 0);
        $firstDue = $schedule['programacao'][0]['vencimento'] ?? now()->format('Y-m-d');
        $paymentIds = array_column($billing['payments'], 'id');

        $account = FinancialAccount::where('type', 'receivable')
            ->where('client_id', $matricula->id_cliente)
            ->whereJsonContains('config->source', 'asaas_billing')
            ->whereJsonContains('config->matricula_id', (int) $matricula->id)
            ->first();

        $payload = [
            'amount' => $total,
            'type' => 'receivable',
            'customer_name' => $matricula->cliente?->name,
            'client_id' => $matricula->id_cliente,
            'description' => $description . ' (Asaas)',
            'notes' => 'Cobrança gerada automaticamente após assinatura (Asaas).',
            'due_date' => $firstDue,
            'payment_method' => 'other',
            'status' => 'pending',
            'payment_date' => null,
            'paid_amount' => 0,
            'installments' => (int) ($schedule['qtd'] ?? 1),
            'token' => $account?->token ?: Qlib::token(),
            'excluido' => false,
            'deletado' => false,
            'config' => [
                'source' => 'asaas_billing',
                'matricula_id' => (int) $matricula->id,
                'asaas_customer_id' => $billing['customer_id'],
                'asaas_payment_ids' => $paymentIds,
            ],
        ];

        if ($account) {
            $account->fill($payload);
            $account->save();
        } else {
            $account = FinancialAccount::create($payload);
        }

        Qlib::update_matriculameta($matricula->id, 'financial_asaas_account_id', (string) $account->id);
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
