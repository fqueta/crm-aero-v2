<?php

namespace App\Services\Ai\Embeddings;

use Illuminate\Support\Facades\Http;

class OpenAiEmbeddingStrategy extends BaseEmbeddingStrategy
{
    public function __construct(?string $apiKey = null)
    {
        parent::__construct($apiKey);
        if (empty($this->apiKey)) {
            $this->apiKey = $this->resolveApiKey(
                'OPENAI_API_KEY',
                ['openai', 'chatgpt'],
                ['openai_api_key', 'ai_api_key']
            );
        }
    }

    public function embed(string $text): ?array
    {
        if (!$this->isConfigured() || trim($text) === '') {
            return null;
        }

        try {
            $response = Http::withToken($this->apiKey)
                ->timeout(20)
                ->post('https://api.openai.com/v1/embeddings', [
                    'model' => 'text-embedding-3-small',
                    'input' => mb_substr($text, 0, 8000),
                ]);

            if ($response->successful()) {
                $values = $response->json('data.0.embedding');
                if (is_array($values) && count($values) > 0) {
                    return array_map('floatval', $values);
                }
            }
        } catch (\Throwable $e) {
        }

        return null;
    }

    public function getProviderSlug(): string
    {
        return 'openai';
    }
}
