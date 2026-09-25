<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Services\Ai\AiChatService;
use App\Services\Ai\Chat\AiChatProviderFactory;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiChatController extends Controller
{
    protected AiChatService $chatService;

    public function __construct(AiChatService $chatService)
    {
        $this->chatService = $chatService;
    }

    public function chat(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message' => 'required|string|max:1000',
            'context' => 'nullable|array',
            'context.currentRoute' => 'nullable|string',
            'context.history' => 'nullable|array',
        ]);

        try {
            $user = $request->user();
            $contextArray = $validated['context'] ?? [];
            $contextArray['userId'] = $user ? $user->id : null;

            $history = $contextArray['history'] ?? [];

            $result = $this->chatService->chat($validated['message'], $contextArray, $history);

            return response()->json([
                'success' => true,
                'data' => $result,
            ]);
        } catch (Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    public function suggestions(Request $request): JsonResponse
    {
        $currentRoute = $request->query('route', '/admin/');

        $suggestions = $this->chatService->getSuggestions($currentRoute);

        return response()->json([
            'success' => true,
            'data' => [
                'suggestions' => $suggestions,
                'currentRoute' => $currentRoute,
            ],
        ]);
    }

    /**
     * Status de configuração por provedor (para o card de Integrações).
     * pt-BR: Só verifica presença da chave — não consome tokens da API.
     */
    public function status(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => AiChatProviderFactory::status(),
        ]);
    }
}
