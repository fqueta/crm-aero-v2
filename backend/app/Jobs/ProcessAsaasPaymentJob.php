<?php

namespace App\Jobs;

use App\Models\EventLog;
use App\Models\FinancialAccount;
use App\Models\FinancialAccountPayment;
use App\Models\Matricula;
use App\Services\Asaas\AsaasPaymentMapper;
use App\Services\PaymentSchedule\PaymentScheduleService;
use App\Services\Qlib;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * ProcessAsaasPaymentJob
 * pt-BR: Processa eventos PAYMENT_* do Asaas: registra a baixa na conta
 * `source=asaas_billing`, marca ganho (`status=g`) aos 100%, trata vencimento
 * e estorno. Idempotente por evento (`asaas_events`) e por pagamento
 * (`config.asaas_payment_id`) — suporta o "at least once" do Asaas.
 */
class ProcessAsaasPaymentJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 120;
    public $tries = 3;

    public function __construct(
        protected int $matriculaId,
        protected string $eventId,
        protected string $event,
        protected array $payment
    ) {
    }

    public function handle(): void
    {
        $matricula = Matricula::find($this->matriculaId);
        if (!$matricula) {
            return;
        }

        if ($this->isEventProcessed($matricula->id)) {
            return;
        }

        $event = strtoupper($this->event);

        if (AsaasPaymentMapper::isPaidEvent($event)) {
            $this->handlePaid($matricula, $event);
        } elseif (AsaasPaymentMapper::isOverdueEvent($event)) {
            $this->handleOverdue($matricula, $event);
        } elseif (AsaasPaymentMapper::isRefundEvent($event)) {
            $this->handleRefund($matricula, $event);
        } elseif (AsaasPaymentMapper::isPartialRefundEvent($event)) {
            $pid = AsaasPaymentMapper::paymentId($this->payment) ?? 'desconhecido';
            Qlib::update_matriculameta($matricula->id, 'asaas_review_' . $pid, $event);
            $this->logEvent($matricula->id, 'asaas_payment_partial_refund', "Estorno parcial {$pid}: revisão manual.");
        } else {
            $this->logEvent($matricula->id, 'asaas_event_ignored', "Evento {$event} registrado sem ação.");
        }

        $this->markEventProcessed($matricula->id);
    }

    /**
     * Baixa: cria o pagamento (se novo), recalcula e marca ganho aos 100%.
     */
    private function handlePaid(Matricula $matricula, string $event): void
    {
        $pid = AsaasPaymentMapper::paymentId($this->payment);
        $value = AsaasPaymentMapper::paymentValue($this->payment);
        if (!$pid || $value <= 0) {
            $this->logEvent($matricula->id, 'asaas_payment_ignored', "Evento {$event} sem id/valor válido.");
            return;
        }

        $account = $this->findOrCreateAccount($matricula, $value);
        $account->load('payments');

        $exists = $account->payments->first(fn ($p) => ($p->config['asaas_payment_id'] ?? null) === $pid);
        if (!$exists) {
            $account->payments()->create([
                'amount' => $value,
                'payment_date' => AsaasPaymentMapper::paymentDate($this->payment),
                'payment_method' => 'other',
                'notes' => sprintf('Baixa automática Asaas (%s %s).', $pid, AsaasPaymentMapper::billingType($this->payment)),
                'created_by' => '1',
                'token' => Qlib::token(),
                'config' => [
                    'source' => 'asaas_payment',
                    'asaas_payment_id' => $pid,
                    'asaas_event_id' => $this->eventId,
                    'matricula_id' => (int) $matricula->id,
                ],
            ]);
            $account->unsetRelation('payments');
            $account->load('payments');
        }

        $this->recalc($account);
        $this->syncGainMetas($matricula, $account);

        $this->logEvent($matricula->id, 'asaas_payment_received', sprintf(
            'Pagamento Asaas %s de R$ %s (%s).',
            $pid,
            number_format($value, 2, ',', '.'),
            $account->status
        ));

        $remaining = round((float) $account->amount - (float) $account->paid_amount, 2);
        if ((float) $account->amount > 0 && $remaining <= 0 && (string) ($matricula->status ?? 'a') !== 'g') {
            $this->markGain($matricula, $account);
        }
    }

    private function handleOverdue(Matricula $matricula, string $event): void
    {
        $account = $this->findOrCreateAccount($matricula, 0);
        if ($account->status !== 'paid') {
            $account->status = 'overdue';
            $account->save();
            Qlib::update_matriculameta($matricula->id, 'financeiro_status_ganho', 'overdue');
        }
        $pid = AsaasPaymentMapper::paymentId($this->payment) ?? 'desconhecido';
        $this->logEvent($matricula->id, 'asaas_payment_overdue', "Cobrança Asaas {$pid} vencida.");
    }

    private function handleRefund(Matricula $matricula, string $event): void
    {
        $pid = AsaasPaymentMapper::paymentId($this->payment);
        $account = $this->findOrCreateAccount($matricula, 0);
        $account->load('payments');

        if ($pid) {
            $removed = 0;
            foreach ($account->payments as $payment) {
                if (($payment->config['asaas_payment_id'] ?? null) === $pid) {
                    $payment->delete();
                    $removed++;
                }
            }
            if ($removed > 0) {
                $account->unsetRelation('payments');
                $account->load('payments');
                $this->recalc($account);
                $this->syncGainMetas($matricula, $account);
            }
        }
        $this->logEvent($matricula->id, 'asaas_payment_refunded', "Evento {$event} para {$pid}: baixa revertida.");
    }

    /**
     * Transição de ganho (espelha updateStatusRapid 'g'): status, situação
     * Matriculado, metas e eventos.
     */
    private function markGain(Matricula $matricula, FinancialAccount $account): void
    {
        $oldStatus = (string) ($matricula->status ?? 'a');
        $matricula->status = 'g';
        $situacaoId = Qlib::get_post_id_by_slug('mat');
        if ($situacaoId && (int) $matricula->situacao_id !== (int) $situacaoId) {
            $matricula->situacao_id = $situacaoId;
        }
        $matricula->save();

        $gainDate = date('Y-m-d');
        $firstAmount = (string) ($account->payments->sortBy('payment_date')->first()?->amount ?? 0);
        Qlib::update_matriculameta($matricula->id, 'data_ganho', $gainDate);
        Qlib::update_matriculameta($matricula->id, 'valor_negociado_ganho', (string) $account->amount);
        Qlib::update_matriculameta($matricula->id, 'valor_entrada_ganho', $firstAmount);
        Qlib::update_matriculameta($matricula->id, 'observacao_ganho', 'Ganho automático: pagamento integral via Asaas.');

        try {
            EventLog::create([
                'entity_type' => 'matricula',
                'entity_id' => (string) $matricula->id,
                'action' => 'status_changed',
                'description' => 'Status da matrícula alterado para ganho (pagamento integral Asaas)',
                'payload' => [
                    'from_status' => $oldStatus,
                    'to_status' => 'g',
                    'gain_date' => $gainDate,
                    'negotiated_amount' => (string) $account->amount,
                    'paid_amount' => (string) $account->paid_amount,
                    'via' => 'asaas_webhook',
                ],
                'actor_id' => '1',
                'ip_address' => request()->ip(),
            ]);
        } catch (\Throwable $e) {
        }
    }

    private function recalc(FinancialAccount $account): void
    {
        $totalPaid = round((float) $account->payments->sum(fn ($p) => (float) $p->amount), 2);
        $latest = $account->payments->sortByDesc(fn ($p) => ($p->payment_date?->format('Y-m-d') ?? '') . '-' . $p->id)->first();
        $remaining = round((float) $account->amount - $totalPaid, 2);

        $account->paid_amount = $totalPaid;
        $account->payment_date = $latest?->payment_date;
        $account->status = $totalPaid <= 0 ? 'pending' : ($remaining <= 0 ? 'paid' : 'partial');
        $account->save();
    }

    private function syncGainMetas(Matricula $matricula, FinancialAccount $account): void
    {
        $account->loadMissing('payments');
        $paymentsPayload = $account->payments->map(fn ($p) => [
            'id' => $p->id,
            'amount' => (float) $p->amount,
            'payment_date' => $p->payment_date?->format('Y-m-d'),
            'payment_method' => $p->payment_method,
            'notes' => $p->notes,
        ])->values()->all();

        Qlib::update_matriculameta($matricula->id, 'financial_asaas_account_id', (string) $account->id);
        Qlib::update_matriculameta($matricula->id, 'valor_pago', (string) ($account->paid_amount ?? 0));
        Qlib::update_matriculameta($matricula->id, 'valor_recebido_ganho', (string) ($account->paid_amount ?? 0));
        Qlib::update_matriculameta($matricula->id, 'saldo_ganho', (string) round((float) $account->amount - (float) ($account->paid_amount ?? 0), 2));
        Qlib::update_matriculameta($matricula->id, 'financeiro_status_ganho', (string) $account->status);
        Qlib::update_matriculameta($matricula->id, 'pagamentos_ganho', json_encode($paymentsPayload, JSON_UNESCAPED_UNICODE));
    }

    private function findOrCreateAccount(Matricula $matricula, float $fallbackValue): FinancialAccount
    {
        $account = FinancialAccount::where('type', 'receivable')
            ->where('client_id', $matricula->id_cliente)
            ->whereJsonContains('config->source', 'asaas_billing')
            ->whereJsonContains('config->matricula_id', (int) $matricula->id)
            ->first();

        if ($account) {
            return $account;
        }

        $schedule = (new PaymentScheduleService())->forMatricula($matricula);
        $total = (float) ($schedule['total'] ?? 0);
        if ($total <= 0) {
            $total = $fallbackValue;
        }

        return FinancialAccount::create([
            'amount' => $total,
            'type' => 'receivable',
            'customer_name' => $matricula->cliente?->name,
            'client_id' => $matricula->id_cliente,
            'description' => sprintf('Matrícula #%d (Asaas)', $matricula->id),
            'notes' => 'Conta criada pela conciliação do webhook Asaas.',
            'due_date' => $schedule['programacao'][0]['vencimento'] ?? date('Y-m-d'),
            'payment_method' => 'other',
            'status' => 'pending',
            'payment_date' => null,
            'paid_amount' => 0,
            'installments' => (int) ($schedule['qtd'] ?? 1),
            'token' => Qlib::token(),
            'excluido' => false,
            'deletado' => false,
            'config' => [
                'source' => 'asaas_billing',
                'matricula_id' => (int) $matricula->id,
            ],
        ]);
    }

    private function isEventProcessed(int $matriculaId): bool
    {
        foreach ($this->readEvents($matriculaId) as $evt) {
            if ((string) $evt === $this->eventId) {
                return true;
            }
        }
        return false;
    }

    private function markEventProcessed(int $matriculaId): void
    {
        $events = $this->readEvents($matriculaId);
        $events[] = $this->eventId;
        $events = array_values(array_unique($events));
        $events = array_slice($events, -200);
        Qlib::update_matriculameta($matriculaId, 'asaas_events', json_encode($events, JSON_UNESCAPED_UNICODE));
    }

    private function readEvents(int $matriculaId): array
    {
        $raw = Qlib::get_matriculameta($matriculaId, 'asaas_events');
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
