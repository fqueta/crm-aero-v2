<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\SaasAiCreditTransaction;
use App\Services\Ai\Credits\AiCreditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiCreditController extends Controller
{
    protected AiCreditService $creditService;

    public function __construct(AiCreditService $creditService)
    {
        $this->creditService = $creditService;
    }

    /**
     * Retorna o saldo detalhado da organização / tenant atual.
     */
    public function getBalance(): JsonResponse
    {
        $tenantId = (string) (tenant('id') ?? 'api-crm');

        $balance = $this->creditService->getBalance($tenantId);

        return response()->json([
            'success' => true,
            'data' => $balance,
        ]);
    }

    /**
     * Retorna os pacotes de créditos de IA disponíveis para compra.
     */
    public function getPackages(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => AiCreditService::getAvailablePackages(),
        ]);
    }

    /**
     * Inicia a compra de um pacote e gera o QR Code PIX no Asaas Central.
     */
    public function buyPackage(Request $request): JsonResponse
    {
        $request->validate([
            'package_slug' => 'required|string',
        ]);

        $tenantId = (string) (tenant('id') ?? 'api-crm');

        try {
            $result = $this->creditService->createPurchase($tenantId, $request->input('package_slug'));

            return response()->json([
                'success' => true,
                'message' => 'Cobrança PIX gerada com sucesso! Conclua o pagamento via PIX para liberar os créditos.',
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 422);
        }
    }

    /**
     * Consulta o status do pagamento da compra (usado para auto-detecção no modal).
     */
    public function checkPurchaseStatus(int $id): JsonResponse
    {
        $status = $this->creditService->checkPaymentStatus($id);

        return response()->json([
            'success' => true,
            'data' => $status,
        ]);
    }

    /**
     * Extrato de transações e consumo de IA.
     */
    public function getTransactions(): JsonResponse
    {
        $tenantId = (string) (tenant('id') ?? 'api-crm');

        $transactions = SaasAiCreditTransaction::where('tenant_id', $tenantId)
            ->orderBy('id', 'desc')
            ->limit(30)
            ->get()
            ->map(function ($t) {
                return [
                    'id' => $t->id,
                    'type' => $t->type,
                    'amount' => $t->amount,
                    'balance_after' => $t->balance_after,
                    'source' => $t->source,
                    'description' => $t->description,
                    'date' => $t->created_at?->format('d/m/Y H:i') ?? '',
                ];
            });

        return response()->json([
            'success' => true,
            'data' => $transactions,
        ]);
    }
}
