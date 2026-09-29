<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\EventLog;
use App\Models\FinancialAccount;
use App\Models\Matricula;
use App\Services\Asaas\AsaasService;
use App\Services\Qlib;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

/**
 * AsaasController — status e teste de conexão (padrão Help Desk).
 * pt-BR: Cobrança e webhook de pagamento entram nas próximas fases.
 */
class AsaasController extends Controller
{
    /**
     * Gate de acesso: Master (1) e Administrador (2).
     */
    private function assertAdmin(Request $request): ?\Illuminate\Http\JsonResponse
    {
        $user = $request->user();
        if (!$user || !in_array((int) ($user->permission_id ?? 0), [1, 2], true)) {
            return response()->json(['error' => 'Permissão insuficiente.'], 403);
        }
        return null;
    }

    public function status(Request $request)
    {
        if ($denied = $this->assertAdmin($request)) {
            return $denied;
        }

        $asaasService = new AsaasService();

        return response()->json([
            'success' => true,
            'configured' => $asaasService->isConfigured(),
            'connected' => $asaasService->isConnected(),
        ]);
    }

    public function testConnection(Request $request)
    {
        if ($denied = $this->assertAdmin($request)) {
            return $denied;
        }

        $apiKey = $request->input('api_key');
        $environment = $request->input('environment');

        $asaasService = $apiKey
            ? new AsaasService($apiKey, $environment)
            : new AsaasService();

        if (!$asaasService->isConfigured()) {
            return response()->json([
                'success' => false,
                'message' => 'API Key não configurada.',
            ], 400);
        }

        if ($asaasService->isConnected()) {
            return response()->json([
                'success' => true,
                'message' => 'Conexão estabelecida com sucesso.',
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Falha ao conectar. Verifique a API Key e o ambiente.',
        ], 400);
    }

    /**
     * Lista as cobranças da matrícula (meta asaas_billing + status vivo).
     * pt-BR: Leitura liberada para todo usuário interno ativo (ex.: consultores
     * precisam acompanhar as faturas na proposta). Escrita continua admin (1,2).
     */
    public function billing(Request $request, string $matriculaId)
    {
        if (!Qlib::isInternalActiveUser($request->user())) {
            return response()->json(['error' => 'Permissão insuficiente.'], 403);
        }

        $matricula = Matricula::find($matriculaId);
        if (!$matricula) {
            return response()->json(['error' => 'Matrícula não encontrada.'], 404);
        }

        $billing = $this->readBillingMeta((int) $matricula->id);
        $asaas = new AsaasService();
        $payments = [];
        foreach ($billing['payments'] ?? [] as $pay) {
            $row = is_array($pay) ? $pay : [];
            $row['live_status'] = null;

            // Se for parcelas com installment_id, busca as parcelas individuais para permitir link e acompanhamento de cada uma
            if (!empty($row['installment_id']) && $asaas->isConfigured()) {
                try {
                    $instResp = $asaas->getInstallmentPayments((string) $row['installment_id']);
                    $childPayments = $instResp['data'] ?? [];
                    if (is_array($childPayments) && count($childPayments) > 0) {
                        $totalCount = count($childPayments);
                        foreach ($childPayments as $idx => $child) {
                            $installmentNum = $child['installmentNumber'] ?? ($idx + 1);
                            $payments[] = [
                                'kind' => 'parcela',
                                'installment_number' => $installmentNum,
                                'total_installments' => $totalCount,
                                'id' => $child['id'],
                                'value' => (float) ($child['value'] ?? 0),
                                'dueDate' => $child['dueDate'] ?? null,
                                'installment_id' => $row['installment_id'],
                                'status' => $child['status'] ?? 'PENDING',
                                'live_status' => $child['status'] ?? null,
                                'invoiceUrl' => $child['invoiceUrl'] ?? null,
                                'bankSlipUrl' => $child['bankSlipUrl'] ?? null,
                                'description' => $child['description'] ?? null,
                                'lastInvoiceViewedDate' => $child['lastInvoiceViewedDate'] ?? null,
                                'lastBankSlipViewedDate' => $child['lastBankSlipViewedDate'] ?? null,
                            ];
                        }
                        continue;
                    }
                } catch (\Throwable $e) {
                    $row['live_error'] = $e->getMessage();
                }
            }

            if ($asaas->isConfigured() && !empty($row['id'])) {
                try {
                    $live = $asaas->getPayment((string) $row['id']);
                    $row['live_status'] = $live['status'] ?? null;
                    $row['invoiceUrl'] = $live['invoiceUrl'] ?? ($row['invoiceUrl'] ?? null);
                    $row['bankSlipUrl'] = $live['bankSlipUrl'] ?? ($row['bankSlipUrl'] ?? null);
                    $row['lastInvoiceViewedDate'] = $live['lastInvoiceViewedDate'] ?? ($row['lastInvoiceViewedDate'] ?? null);
                    $row['lastBankSlipViewedDate'] = $live['lastBankSlipViewedDate'] ?? ($row['lastBankSlipViewedDate'] ?? null);
                } catch (\Throwable $e) {
                    $row['live_error'] = $e->getMessage();
                }
            }
            $payments[] = $row;
        }

        return response()->json([
            'success' => true,
            'matricula_id' => (int) $matricula->id,
            'customer_id' => $billing['customer_id'] ?? null,
            'payments' => $payments,
        ]);
    }

    /**
     * Edita cobrança PENDING/OVERDUE (dueDate, value, description, discount).
     */
    public function updateBillingPayment(Request $request, string $paymentId)
    {
        if ($denied = $this->assertAdmin($request)) {
            return $denied;
        }

        $validator = Validator::make($request->all(), [
            'matricula_id' => ['required', 'integer', 'exists:matriculas,id'],
            'dueDate' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:today'],
            'value' => ['nullable', 'numeric', 'gt:0'],
            'description' => ['nullable', 'string', 'max:500'],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Erro de validação', 'errors' => $validator->errors()], 422);
        }
        $data = $validator->validated();
        $matriculaId = (int) $data['matricula_id'];

        try {
            $asaas = new AsaasService();
            $live = $asaas->getPayment($paymentId);
            if (!$this->isEditableStatus((string) ($live['status'] ?? ''))) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cobrança paga/confirmada não pode ser editada.',
                ], 409);
            }

            $payload = [];
            if (isset($data['dueDate'])) {
                $payload['dueDate'] = $data['dueDate'];
            }
            if (isset($data['value'])) {
                $payload['value'] = round((float) $data['value'], 2);
            }
            if (isset($data['description'])) {
                $payload['description'] = $data['description'];
            }
            if (isset($data['discount_value'])) {
                $discountValue = round((float) $data['discount_value'], 2);
                $payload['discount'] = $discountValue > 0
                    ? ['value' => $discountValue, 'type' => 'FIXED', 'dueDateLimitDays' => 0]
                    : null;
            }
            if (empty($payload)) {
                return response()->json(['success' => false, 'message' => 'Nada para atualizar.'], 422);
            }

            $updated = $asaas->updatePayment($paymentId, $payload);
            $this->patchBillingMeta($matriculaId, $paymentId, [
                'dueDate' => $updated['dueDate'] ?? ($payload['dueDate'] ?? null),
                'value' => isset($updated['value']) ? (float) $updated['value'] : null,
            ]);
            $this->syncMirrorFromMeta($matriculaId);
            $this->logBillingEvent($matriculaId, 'asaas_billing_updated', "Cobrança {$paymentId} atualizada no Asaas.", $request);

            return response()->json(['success' => true, 'data' => $updated]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    /**
     * Exclui cobrança ainda não paga. Paga/confirmada → 409 (usar estorno).
     */
    public function deleteBillingPayment(Request $request, string $paymentId)
    {
        if ($denied = $this->assertAdmin($request)) {
            return $denied;
        }

        $validator = Validator::make($request->all(), [
            'matricula_id' => ['required', 'integer', 'exists:matriculas,id'],
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Erro de validação', 'errors' => $validator->errors()], 422);
        }
        $matriculaId = (int) $validator->validated()['matricula_id'];

        try {
            $asaas = new AsaasService();
            $live = $asaas->getPayment($paymentId);
            $status = strtoupper((string) ($live['status'] ?? ''));
            if (!in_array($status, ['PENDING', 'OVERDUE'], true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cobrança paga/confirmada não pode ser excluída. Use estorno.',
                ], 409);
            }

            $deleted = $asaas->deletePayment($paymentId);
            $this->removeBillingMetaPayment($matriculaId, $paymentId);
            $this->syncMirrorFromMeta($matriculaId);
            $this->logBillingEvent($matriculaId, 'asaas_billing_deleted', "Cobrança {$paymentId} excluída no Asaas.", $request);

            return response()->json(['success' => true, 'data' => $deleted]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    /**
     * Estorna cobrança paga no Asaas e reverte a baixa local.
     * pt-BR: RECEIVED/CONFIRMED → POST /payments/{id}/refund (Pix/cartão,
     * total ou parcial via value) ou POST .../bankSlip/refund (boleto, que
     * retorna requestUrl para o cliente completar dados bancários).
     * Após estorno concluído (não-boleto), remove a baixa espelho
     * (source=asaas_payment), recalcula e reverte ganho automático se zerar.
     */
    public function refundBillingPayment(Request $request, string $paymentId)
    {
        if ($denied = $this->assertAdmin($request)) {
            return $denied;
        }

        $validator = Validator::make($request->all(), [
            'matricula_id' => ['required', 'integer', 'exists:matriculas,id'],
            'value' => ['nullable', 'numeric', 'gt:0'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Erro de validação', 'errors' => $validator->errors()], 422);
        }
        $data = $validator->validated();
        $matriculaId = (int) $data['matricula_id'];

        $matricula = Matricula::find($matriculaId);
        if (!$matricula) {
            return response()->json(['success' => false, 'message' => 'Matrícula não encontrada.'], 404);
        }

        try {
            $asaas = new AsaasService();
            $live = $asaas->getPayment($paymentId);
            $status = strtoupper((string) ($live['status'] ?? ''));
            if (!in_array($status, ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'], true)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Só cobranças pagas/confirmadas podem ser estornadas. Pendentes usam excluir.',
                ], 409);
            }

            $billingType = strtoupper((string) ($live['billingType'] ?? ''));
            if ($billingType === 'BOLETO') {
                $result = $asaas->refundBankSlip($paymentId);
                $requestUrl = (string) ($result['requestUrl'] ?? '');
                $this->logBillingEvent(
                    $matriculaId,
                    'asaas_billing_refund_requested',
                    "Estorno de boleto {$paymentId} iniciado no Asaas. Aguardando dados do cliente.",
                    $request
                );

                return response()->json([
                    'success' => true,
                    'bank_slip' => true,
                    'request_url' => $requestUrl,
                    'data' => $result,
                    'message' => 'Estorno de boleto iniciado. Envie o link ao cliente para informar os dados bancários.',
                ]);
            }

            $value = isset($data['value']) ? round((float) $data['value'], 2) : null;
            $liveValue = round((float) ($live['value'] ?? 0), 2);
            if ($value !== null && $liveValue > 0 && $value > $liveValue) {
                return response()->json([
                    'success' => false,
                    'message' => 'Valor do estorno não pode ser maior que o valor da cobrança.',
                ], 422);
            }

            $result = $asaas->refundPayment($paymentId, $value, $data['description'] ?? null);
            $this->removeLocalBaixa($matricula, $paymentId);
            $this->logBillingEvent(
                $matriculaId,
                'asaas_billing_refunded',
                "Cobrança {$paymentId} estornada no Asaas" . ($value ? " (R$ " . number_format($value, 2, ',', '.') . ")" : " (integral)") . ".",
                $request
            );

            return response()->json(['success' => true, 'data' => $result]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    /**
     * Cancela o plano inteiro (pendentes/vencidas; confirmadas intactas).
     */
    public function cancelBillingInstallment(Request $request, string $installmentId)
    {
        if ($denied = $this->assertAdmin($request)) {
            return $denied;
        }

        $validator = Validator::make($request->all(), [
            'matricula_id' => ['required', 'integer', 'exists:matriculas,id'],
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Erro de validação', 'errors' => $validator->errors()], 422);
        }
        $matriculaId = (int) $validator->validated()['matricula_id'];

        try {
            $asaas = new AsaasService();
            $result = $asaas->cancelInstallment($installmentId);
            $this->removeBillingMetaInstallment($matriculaId, $installmentId);
            $this->syncMirrorFromMeta($matriculaId);
            $this->logBillingEvent($matriculaId, 'asaas_installment_cancelled', "Parcelamento {$installmentId} cancelado no Asaas.", $request);

            return response()->json(['success' => true, 'data' => $result]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 400);
        }
    }

    private function isEditableStatus(string $status): bool
    {
        return in_array(strtoupper($status), ['PENDING', 'OVERDUE'], true);
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

    private function writeBillingMeta(int $matriculaId, array $billing): void
    {
        Qlib::update_matriculameta($matriculaId, 'asaas_billing', json_encode($billing, JSON_UNESCAPED_UNICODE));
    }

    /**
     * Sincroniza a conta espelho (receivable source=asaas_billing, uma por
     * matrícula) com a meta após edição/exclusão no Asaas: recalcula total,
     * vencimento e ids; sem faturas restantes, marca como cancelada.
     * Nunca cria a conta aqui (criação é do GenerateAsaasBillingJob).
     */
    private function syncMirrorFromMeta(int $matriculaId): void
    {
        try {
            $matricula = Matricula::find($matriculaId);
            if (!$matricula) {
                return;
            }
            $account = FinancialAccount::where('type', 'receivable')
                ->where('client_id', $matricula->id_cliente)
                ->whereJsonContains('config->source', 'asaas_billing')
                ->whereJsonContains('config->matricula_id', (int) $matriculaId)
                ->first();
            if (!$account) {
                return;
            }
            $payments = $this->readBillingMeta($matriculaId)['payments'] ?? [];
            if (empty($payments)) {
                $account->status = 'cancelled';
                $account->save();
                return;
            }
            $total = 0.0;
            $earliest = null;
            $ids = [];
            foreach ($payments as $pay) {
                $row = is_array($pay) ? $pay : [];
                $total += (float) ($row['value'] ?? 0);
                if (!empty($row['id'])) {
                    $ids[] = (string) $row['id'];
                }
                $due = substr((string) ($row['dueDate'] ?? ''), 0, 10);
                if ($due !== '' && ($earliest === null || $due < $earliest)) {
                    $earliest = $due;
                }
            }
            $account->amount = round($total, 2);
            if ($earliest !== null) {
                $account->due_date = $earliest;
            }
            $config = is_array($account->config) ? $account->config : [];
            $config['asaas_payment_ids'] = array_values($ids);
            $account->config = $config;
            if (in_array($account->status, ['cancelled'], true)) {
                $account->status = 'pending';
            }
            $account->save();
        } catch (\Throwable $e) {
        }
    }

    private function patchBillingMeta(int $matriculaId, string $paymentId, array $patch): void
    {
        $billing = $this->readBillingMeta($matriculaId);
        if (empty($billing['payments'])) {
            return;
        }
        foreach ($billing['payments'] as &$pay) {
            if (($pay['id'] ?? null) === $paymentId) {
                foreach ($patch as $k => $v) {
                    if ($v !== null) {
                        $pay[$k] = $v;
                    }
                }
            }
        }
        unset($pay);
        $this->writeBillingMeta($matriculaId, $billing);
    }

    private function removeBillingMetaPayment(int $matriculaId, string $paymentId): void
    {
        $billing = $this->readBillingMeta($matriculaId);
        if (empty($billing['payments'])) {
            return;
        }
        $billing['payments'] = array_values(array_filter(
            $billing['payments'],
            fn ($pay) => ($pay['id'] ?? null) !== $paymentId
        ));
        $this->writeBillingMeta($matriculaId, $billing);
    }

    private function removeBillingMetaInstallment(int $matriculaId, string $installmentId): void
    {
        $billing = $this->readBillingMeta($matriculaId);
        if (empty($billing['payments'])) {
            return;
        }
        $billing['payments'] = array_values(array_filter(
            $billing['payments'],
            fn ($pay) => ($pay['installment_id'] ?? null) !== $installmentId
                && ($pay['kind'] ?? null) !== 'parcelas'
        ));
        $this->writeBillingMeta($matriculaId, $billing);
    }

    private function logBillingEvent(int $matriculaId, string $action, string $description, Request $request): void
    {
        try {
            EventLog::create([
                'entity_type' => 'matricula',
                'entity_id' => (string) $matriculaId,
                'action' => $action,
                'description' => $description,
                'actor_id' => (string) ($request->user()?->id ?? '1'),
                'ip_address' => $request->ip(),
            ]);
        } catch (\Throwable $e) {
        }
    }

    /**
     * Remove a baixa espelho (source=asaas_payment) do pagamento estornado,
     * recalcula conta, sincroniza metas e reverte ganho automático se zerar.
     * pt-BR: Espelha ProcessAsaasPaymentJob::handleRefund para o estorno manual.
     */
    private function removeLocalBaixa(Matricula $matricula, string $paymentId): void
    {
        try {
            $accounts = FinancialAccount::where('type', 'receivable')
                ->where('client_id', $matricula->id_cliente)
                ->whereJsonContains('config->source', 'asaas_billing')
                ->whereJsonContains('config->matricula_id', (int) $matricula->id)
                ->with('payments')
                ->get();

            $touched = null;
            foreach ($accounts as $account) {
                $removed = 0;
                foreach ($account->payments as $payment) {
                    $cfg = is_array($payment->config) ? $payment->config : [];
                    if (($cfg['asaas_payment_id'] ?? null) === $paymentId) {
                        $payment->delete();
                        $removed++;
                    }
                }
                if ($removed > 0) {
                    $account->unsetRelation('payments');
                    $account->load('payments');
                    $this->recalcLocalAccount($account);
                    $touched = $account;
                }
            }

            if ($touched) {
                $this->syncLocalGainMetas($matricula, $touched);
            }
            $this->revertAutoGainIfZero($matricula);
        } catch (\Throwable $e) {
        }
    }

    private function recalcLocalAccount(FinancialAccount $account): void
    {
        $totalPaid = round((float) $account->payments->sum(fn ($p) => (float) $p->amount), 2);
        $latest = $account->payments->sortByDesc(fn ($p) => ($p->payment_date?->format('Y-m-d') ?? '') . '-' . $p->id)->first();
        $remaining = round((float) $account->amount - $totalPaid, 2);

        $account->paid_amount = $totalPaid;
        $account->payment_date = $latest?->payment_date;
        $account->status = $totalPaid <= 0 ? 'pending' : ($remaining <= 0 ? 'paid' : 'partial');
        $account->save();
    }

    private function syncLocalGainMetas(Matricula $matricula, FinancialAccount $account): void
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

        Qlib::update_matriculameta($matricula->id, 'valor_pago', (string) $totalPaid);
        Qlib::update_matriculameta($matricula->id, 'valor_recebido_ganho', (string) $totalPaid);
        Qlib::update_matriculameta($matricula->id, 'saldo_ganho', (string) max(0, round($totalAmount - $totalPaid, 2)));
        Qlib::update_matriculameta($matricula->id, 'financeiro_status_ganho', $overallStatus);
    }

    private function revertAutoGainIfZero(Matricula $matricula): void
    {
        if ((string) ($matricula->status ?? 'a') !== 'g') {
            return;
        }
        $obs = (string) (Qlib::get_matriculameta($matricula->id, 'observacao_ganho') ?? '');
        if (!str_starts_with($obs, 'Ganho automático')) {
            return;
        }
        $totalPaid = (float) FinancialAccount::where('type', 'receivable')
            ->where('client_id', $matricula->id_cliente)
            ->whereJsonContains('config->source', 'asaas_billing')
            ->whereJsonContains('config->matricula_id', (int) $matricula->id)
            ->sum('paid_amount');
        if ($totalPaid > 0) {
            return;
        }

        $fromStatus = 'a';
        $fromSituacaoId = null;
        try {
            $logs = EventLog::where('entity_type', 'matricula')
                ->where('entity_id', (string) $matricula->id)
                ->where('action', 'status_changed')
                ->orderByDesc('id')
                ->limit(20)
                ->get();
            foreach ($logs as $log) {
                $p = is_array($log->payload) ? $log->payload : [];
                if (($p['via'] ?? null) === 'asaas_webhook' && ($p['to_status'] ?? null) === 'g') {
                    $fromStatus = in_array(($p['from_status'] ?? 'a'), ['a', 'p'], true) ? (string) $p['from_status'] : 'a';
                    $fromSituacaoId = is_numeric($p['from_situacao_id'] ?? null) ? (int) $p['from_situacao_id'] : null;
                    break;
                }
            }
        } catch (\Throwable $e) {
        }

        $matricula->status = $fromStatus;
        if ($fromSituacaoId !== null) {
            $matricula->situacao_id = $fromSituacaoId;
        }
        $matricula->save();
        Qlib::delete_matriculameta($matricula->id, 'data_ganho');
    }
}
