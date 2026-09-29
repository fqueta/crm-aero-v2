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
 * `source=asaas_billing`, marca ganho (`status=g` + situação Matriculada) no
 * primeiro pagamento detectado, trata vencimento e estorno (com reversão do
 * ganho automático se o total recebido zerar). Idempotente por evento
 * (`asaas_events`) e por pagamento
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
     * Baixa: cria o pagamento (se novo), recalcula e marca ganho no 1º pagamento.
     */
    private function handlePaid(Matricula $matricula, string $event): void
    {
        $pid = AsaasPaymentMapper::paymentId($this->payment);
        $value = AsaasPaymentMapper::paymentValue($this->payment);
        if (!$pid || $value <= 0) {
            $this->logEvent($matricula->id, 'asaas_payment_ignored', "Evento {$event} sem id/valor válido.");
            return;
        }

        $account = $this->findOrCreateAccount($matricula, $value, $pid);
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

        // Verifica se o total geral de todas as faturas da matrícula foi pago para marcar ganho
        $this->checkTotalGain($matricula, $account);
    }

    private function handleOverdue(Matricula $matricula, string $event): void
    {
        $pid = AsaasPaymentMapper::paymentId($this->payment) ?? 'desconhecido';
        $account = $this->findOrCreateAccount($matricula, 0, $pid);
        if ($account->status !== 'paid') {
            $account->status = 'overdue';
            $account->save();
            Qlib::update_matriculameta($matricula->id, 'financeiro_status_ganho', 'overdue');
        }
        $this->logEvent($matricula->id, 'asaas_payment_overdue', "Cobrança Asaas {$pid} vencida.");
    }

    private function handleRefund(Matricula $matricula, string $event): void
    {
        $pid = AsaasPaymentMapper::paymentId($this->payment);
        $account = $this->findOrCreateAccount($matricula, 0, $pid);
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
        $this->revertGain($matricula, $event);
    }

    /**
     * Reverte o ganho quando o estorno zera o total recebido.
     * pt-BR: Só reverte ganho automático (observacao_ganho "Ganho automático...").
     * Ganho manual é decisão comercial e é mantido. Restaura o status/situação
     * anteriores registrados no EventLog do ganho automático.
     */
    private function revertGain(Matricula $matricula, string $event): void
    {
        if ((string) ($matricula->status ?? 'a') !== 'g') {
            return;
        }

        $obs = (string) (Qlib::get_matriculameta($matricula->id, 'observacao_ganho') ?? '');
        if (!str_starts_with($obs, 'Ganho automático')) {
            $this->logEvent($matricula->id, 'asaas_gain_kept', 'Estorno total com ganho manual: status g mantido.');
            return;
        }

        $totals = $this->gainTotals($matricula, null);
        if ($totals['paid'] > 0) {
            return;
        }

        [$fromStatus, $fromSituacaoId] = $this->previousGainState($matricula->id);
        $matricula->status = $fromStatus;
        if ($fromSituacaoId !== null) {
            $matricula->situacao_id = $fromSituacaoId;
        }
        $matricula->save();

        Qlib::delete_matriculameta($matricula->id, 'data_ganho');

        try {
            EventLog::create([
                'entity_type' => 'matricula',
                'entity_id' => (string) $matricula->id,
                'action' => 'status_changed',
                'description' => 'Status da matrícula revertido de ganho (estorno total Asaas)',
                'payload' => [
                    'from_status' => 'g',
                    'to_status' => $fromStatus,
                    'trigger_event' => $event,
                    'via' => 'asaas_webhook',
                ],
                'actor_id' => '1',
                'ip_address' => request()->ip(),
            ]);
        } catch (\Throwable $e) {
        }
    }

    /**
     * Recupera o status/situação anteriores ao ganho automático
     * a partir do EventLog (payload do markGain).
     * @return array{0:string,1:int|null}
     */
    private function previousGainState(int|string $matriculaId): array
    {
        try {
            $logs = EventLog::where('entity_type', 'matricula')
                ->where('entity_id', (string) $matriculaId)
                ->where('action', 'status_changed')
                ->orderByDesc('id')
                ->limit(20)
                ->get();
            foreach ($logs as $log) {
                $p = is_array($log->payload) ? $log->payload : [];
                if (($p['via'] ?? null) === 'asaas_webhook' && ($p['to_status'] ?? null) === 'g') {
                    $fromStatus = ($p['from_status'] ?? 'a');
                    $fromStatus = in_array($fromStatus, ['a', 'p'], true) ? $fromStatus : 'a';
                    $fromSituacao = $p['from_situacao_id'] ?? null;
                    $fromSituacao = is_numeric($fromSituacao) ? (int) $fromSituacao : null;
                    return [$fromStatus, $fromSituacao];
                }
            }
        } catch (\Throwable $e) {
        }
        return ['a', null];
    }

    /**
     * Totais (negociado/pago) de todas as contas asaas_billing da matrícula.
     * @return array{amount:float,paid:float}
     */
    private function gainTotals(Matricula $matricula, ?FinancialAccount $account): array
    {
        $allAccounts = FinancialAccount::where('type', 'receivable')
            ->where('client_id', $matricula->id_cliente)
            ->whereJsonContains('config->source', 'asaas_billing')
            ->whereJsonContains('config->matricula_id', (int) $matricula->id)
            ->get();

        if ($allAccounts->isEmpty()) {
            if (!$account) {
                return ['amount' => 0.0, 'paid' => 0.0];
            }
            return ['amount' => (float) $account->amount, 'paid' => (float) $account->paid_amount];
        }

        return [
            'amount' => (float) $allAccounts->sum('amount'),
            'paid' => (float) $allAccounts->sum('paid_amount'),
        ];
    }

    /**
     * Transição de ganho (espelha updateStatusRapid 'g'): status, situação
     * Matriculado, metas e eventos.
     */
    private function markGain(Matricula $matricula, FinancialAccount $account, float $negotiatedTotal, float $paidTotal): void
    {
        $oldStatus = (string) ($matricula->status ?? 'a');
        $oldSituacaoId = $matricula->situacao_id;
        $matricula->status = 'g';
        $situacaoId = Qlib::get_post_id_by_slug('mat');
        if ($situacaoId && (int) $matricula->situacao_id !== (int) $situacaoId) {
            $matricula->situacao_id = $situacaoId;
        }
        $matricula->save();

        $gainDate = date('Y-m-d');
        $firstAmount = (string) ($account->payments->sortBy('payment_date')->first()?->amount ?? 0);
        Qlib::update_matriculameta($matricula->id, 'data_ganho', $gainDate);
        Qlib::update_matriculameta($matricula->id, 'valor_negociado_ganho', (string) $negotiatedTotal);
        Qlib::update_matriculameta($matricula->id, 'valor_entrada_ganho', $firstAmount);
        Qlib::update_matriculameta($matricula->id, 'observacao_ganho', 'Ganho automático: primeiro pagamento via Asaas.');

        try {
            EventLog::create([
                'entity_type' => 'matricula',
                'entity_id' => (string) $matricula->id,
                'action' => 'status_changed',
                'description' => 'Status da matrícula alterado para ganho (primeiro pagamento Asaas)',
                'payload' => [
                    'from_status' => $oldStatus,
                    'to_status' => 'g',
                    'from_situacao_id' => $oldSituacaoId !== null ? (string) $oldSituacaoId : null,
                    'gain_date' => $gainDate,
                    'negotiated_amount' => (string) $negotiatedTotal,
                    'paid_amount' => (string) $paidTotal,
                    'via' => 'asaas_webhook',
                ],
                'actor_id' => '1',
                'ip_address' => request()->ip(),
            ]);
        } catch (\Throwable $e) {
        }
    }

    private function checkTotalGain(Matricula $matricula, FinancialAccount $account): void
    {
        // Se já está ganho, nada a fazer
        if ((string) ($matricula->status ?? 'a') === 'g') {
            return;
        }

        $totals = $this->gainTotals($matricula, $account);
        $totalAmount = $totals['amount'];
        $totalPaid = $totals['paid'];

        // Ganho no primeiro pagamento detectado (não espera 100%).
        // O acompanhamento do recebimento continua pelo financeiro
        // (status pending/partial/paid + metas valor_pago/saldo_ganho).
        if ($totalAmount > 0 && $totalPaid > 0) {
            $this->markGain($matricula, $account, $totalAmount, $totalPaid);
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
        $allAccounts = FinancialAccount::where('type', 'receivable')
            ->where('client_id', $matricula->id_cliente)
            ->whereJsonContains('config->source', 'asaas_billing')
            ->whereJsonContains('config->matricula_id', (int) $matricula->id)
            ->with('payments')
            ->get();

        if ($allAccounts->isEmpty()) {
            $allAccounts = collect([$account]);
        }

        $totalAmount = (float) $allAccounts->sum('amount');
        $totalPaid = (float) $allAccounts->sum('paid_amount');
        $allPaid = $allAccounts->every(fn ($a) => $a->status === 'paid');
        $hasOverdue = $allAccounts->contains(fn ($a) => $a->status === 'overdue');

        $overallStatus = $totalPaid <= 0 ? 'pending' : ($allPaid ? 'paid' : ($hasOverdue ? 'overdue' : 'partial'));

        $allPayments = $allAccounts->flatMap->payments;
        $paymentsPayload = $allPayments->map(fn ($p) => [
            'id' => $p->id,
            'amount' => (float) $p->amount,
            'payment_date' => $p->payment_date?->format('Y-m-d'),
            'payment_method' => $p->payment_method,
            'notes' => $p->notes,
        ])->values()->all();

        Qlib::update_matriculameta($matricula->id, 'financial_asaas_account_id', (string) $account->id);
        Qlib::update_matriculameta($matricula->id, 'valor_pago', (string) $totalPaid);
        Qlib::update_matriculameta($matricula->id, 'valor_recebido_ganho', (string) $totalPaid);
        Qlib::update_matriculameta($matricula->id, 'saldo_ganho', (string) max(0, round($totalAmount - $totalPaid, 2)));
        Qlib::update_matriculameta($matricula->id, 'financeiro_status_ganho', $overallStatus);
        Qlib::update_matriculameta($matricula->id, 'pagamentos_ganho', json_encode($paymentsPayload, JSON_UNESCAPED_UNICODE));
    }

    private function findOrCreateAccount(Matricula $matricula, float $fallbackValue, ?string $pid = null): FinancialAccount
    {
        // 1. Tenta encontrar a conta específica da parcela/cobrança
        if ($pid) {
            $account = FinancialAccount::where('type', 'receivable')
                ->where('client_id', $matricula->id_cliente)
                ->whereJsonContains('config->source', 'asaas_billing')
                ->whereJsonContains('config->asaas_payment_id', $pid)
                ->first();
            if ($account) {
                return $account;
            }
        }

        // 2. Fallback: conta vinculada à matrícula
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
            'installments' => 1,
            'token' => Qlib::token(),
            'excluido' => false,
            'deletado' => false,
            'config' => [
                'source' => 'asaas_billing',
                'matricula_id' => (int) $matricula->id,
                'asaas_payment_id' => $pid,
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
