<?php

namespace App\Services\Ai\Embeddings;

use Illuminate\Support\Facades\Http;

class GeminiEmbeddingStrategy extends BaseEmbeddingStrategy
{
    public function __construct(?string $apiKey = null)
    {
        parent::__construct($apiKey);
        if (empty($this->apiKey)) {
            $this->apiKey = $this->resolveApiKey(
                'GEMINI_API_KEY',
                ['gemini', 'google_gemini'],
                ['gemini_api_key', 'ai_api_key']
            );
        }
    }

    public function embed(string $text): ?array
    {
        if (!$this->isConfigured() || trim($text) === '') {
            return null;
        }

        $models = ['gemini-embedding-001', 'text-embedding-004'];
        $payload = [
            'content' => [
                'parts' => [
                    ['text' => mb_substr($text, 0, 8000)],
                ],
            ],
        ];

        foreach ($models as $model) {
            try {
                $endpoint = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:embedContent";
                $response = Http::withHeaders([
                    'x-goog-api-key' => $this->apiKey,
                    'Content-Type' => 'application/json',
                ])->timeout(20)->post($endpoint, $payload);

                if ($response->successful()) {
                    $values = $response->json('embedding.values');
                    if (is_array($values) && count($values) > 0) {
                        return array_map('floatval', $values);
                    }
                }
            } catch (\Throwable $e) {
            }
        }

        return null;
    }

    public function getProviderSlug(): string
    {
        return 'gemini';
    }
}
