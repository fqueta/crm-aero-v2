<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\EventLog;
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
     */
    public function billing(Request $request, string $matriculaId)
    {
        if ($denied = $this->assertAdmin($request)) {
            return $denied;
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
            if ($asaas->isConfigured() && !empty($row['id'])) {
                try {
                    $live = $asaas->getPayment((string) $row['id']);
                    $row['live_status'] = $live['status'] ?? null;
                    $row['invoiceUrl'] = $live['invoiceUrl'] ?? ($row['invoiceUrl'] ?? null);
                    $row['bankSlipUrl'] = $live['bankSlipUrl'] ?? ($row['bankSlipUrl'] ?? null);
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
            $this->logBillingEvent($matriculaId, 'asaas_billing_deleted', "Cobrança {$paymentId} excluída no Asaas.", $request);

            return response()->json(['success' => true, 'data' => $deleted]);
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
}
