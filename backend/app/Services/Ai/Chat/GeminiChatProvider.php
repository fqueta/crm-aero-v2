<?php

namespace App\Services\Ai\Chat;

use Illuminate\Support\Facades\Http;
use Exception;

class GeminiChatProvider extends BaseAiChatProvider
{
    public function __construct(?string $apiKey = null, ?string $model = null)
    {
        parent::__construct($apiKey, $model);
        if (empty($this->apiKey)) {
            $this->apiKey = $this->resolveApiKey(
                'GEMINI_API_KEY',
                ['gemini', 'google_gemini'],
                ['gemini_api_key', 'ai_api_key']
            );
        }
    }

    public function chat(string $message, string $systemPrompt, array $history = [], array $options = []): array
    {
        if (!$this->isConfigured()) {
            throw new Exception("Provider {$this->getProviderSlug()} is not configured.");
        }

        $models = array_values(array_unique(array_filter([
            $this->model,
            'gemini-3.7-flash',
            'gemini-3.8-flash',
            'gemini-3.5-flash',
            'gemini-3.1-flash-lite',
            'gemini-flash-latest',
        ])));

        $contents = [];
        foreach ($history as $msg) {
            $role = ($msg['role'] === 'user') ? 'user' : 'model';
            $contents[] = [
                'role' => $role,
                'parts' => [['text' => $msg['content']]],
            ];
        }
        $contents[] = [
            'role' => 'user',
            'parts' => [['text' => $message]],
        ];

        $payload = [
            'system_instruction' => ['parts' => [['text' => $systemPrompt]]],
            'contents' => $contents,
            'generationConfig' => [
                'temperature' => $options['temperature'] ?? 0.7,
            ],
        ];

        $headers = [
            'x-goog-api-key' => $this->apiKey,
            'Content-Type' => 'application/json',
        ];

        $lastError = null;
        foreach ($models as $modelToTry) {
            try {
                $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$modelToTry}:generateContent";

                $response = Http::withHeaders($headers)
                    ->timeout(30)
                    ->post($endpoint, $payload);

                if ($response->successful()) {
                    return [
                        'reply' => $response->json('candidates.0.content.parts.0.text'),
                        'tokens_prompt' => $response->json('usageMetadata.promptTokenCount'),
                        'tokens_completion' => $response->json('usageMetadata.candidatesTokenCount'),
                        'model' => $modelToTry,
                    ];
                }
                $lastError = $response->body();
                if ($response->status() === 503) {
                    usleep(1200000); // 1.2s de pausa se houver pico de demanda
                }
            } catch (\Throwable $e) {
                $lastError = $e->getMessage();
            }
        }

        throw new Exception('Gemini chat failed. Last error: ' . $lastError);
    }

    public function getProviderSlug(): string
    {
        return 'gemini';
    }

    public function getDefaultModel(): string
    {
        return 'gemini-3.7-flash';
    }
}
