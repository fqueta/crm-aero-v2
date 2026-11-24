<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Services\Ai\AiChatService;
use App\Services\Ai\Chat\AiChatProviderFactory;
use App\Services\Ai\Chat\GeminiChatProvider;
use App\Services\Ai\Chat\OpenAiChatProvider;
use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

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

    /**
     * Testa a conexão com OpenAI e/ou Gemini usando GET /models (sem consumir tokens).
     */
    public function testConnection(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'provider' => 'nullable|in:openai,gemini,all',
            'openai_key' => 'nullable|string|max:500',
            'gemini_key' => 'nullable|string|max:500',
        ]);

        $target = $validated['provider'] ?? 'all';
        $openaiKey = trim((string) ($validated['openai_key'] ?? ''));
        $geminiKey = trim((string) ($validated['gemini_key'] ?? ''));

        // Fallback para chaves já persistidas no banco caso o campo venha vazio
        if ($openaiKey === '' && in_array($target, ['openai', 'all'], true)) {
            $openaiKey = (string) ((new OpenAiChatProvider())->getApiKey() ?? '');
        }
        if ($geminiKey === '' && in_array($target, ['gemini', 'all'], true)) {
            $geminiKey = (string) ((new GeminiChatProvider())->getApiKey() ?? '');
        }

        $results = [];

        if (in_array($target, ['openai', 'all'], true) && $openaiKey !== '') {
            try {
                $resp = Http::withToken($openaiKey)->timeout(10)->get('https://api.openai.com/v1/models');
                if ($resp->successful()) {
                    $results['openai'] = [
                        'tested' => true,
                        'ok' => true,
                        'message' => 'OpenAI conectada com sucesso.',
                    ];
                } else {
                    $errMsg = (string) ($resp->json('error.message') ?? ('HTTP ' . $resp->status()));
                    $results['openai'] = [
                        'tested' => true,
                        'ok' => false,
                        'message' => 'OpenAI: ' . $errMsg,
                    ];
                }
            } catch (\Throwable $e) {
                $results['openai'] = [
                    'tested' => true,
                    'ok' => false,
                    'message' => 'OpenAI: falha de rede (' . $e->getMessage() . ')',
                ];
            }
        }

        if (in_array($target, ['gemini', 'all'], true) && $geminiKey !== '') {
            try {
                $resp = Http::timeout(10)->get('https://generativelanguage.googleapis.com/v1beta/models', [
                    'key' => $geminiKey,
                ]);
                if ($resp->successful()) {
                    $results['gemini'] = [
                        'tested' => true,
                        'ok' => true,
                        'message' => 'Gemini conectado com sucesso.',
                    ];
                } else {
                    $errMsg = (string) ($resp->json('error.message') ?? ('HTTP ' . $resp->status()));
                    $results['gemini'] = [
                        'tested' => true,
                        'ok' => false,
                        'message' => 'Gemini: ' . $errMsg,
                    ];
                }
            } catch (\Throwable $e) {
                $results['gemini'] = [
                    'tested' => true,
                    'ok' => false,
                    'message' => 'Gemini: falha de rede (' . $e->getMessage() . ')',
                ];
            }
        }

        if (empty($results)) {
            return response()->json([
                'success' => false,
                'message' => 'Informe ao menos uma chave (OpenAI ou Gemini) para testar a conexão.',
                'results' => [],
            ], 422);
        }

        $allOk = collect($results)->every(fn ($r) => (bool) ($r['ok'] ?? false));
        $anyOk = collect($results)->contains(fn ($r) => (bool) ($r['ok'] ?? false));
        $messages = collect($results)->pluck('message')->implode(' | ');

        return response()->json([
            'success' => $allOk,
            'any_ok' => $anyOk,
            'message' => $messages,
            'results' => $results,
        ], $anyOk ? 200 : 422);
    }
}
