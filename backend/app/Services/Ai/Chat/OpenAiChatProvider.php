<?php

namespace App\Services\Ai\Chat;

use Illuminate\Support\Facades\Http;
use Exception;

class OpenAiChatProvider extends BaseAiChatProvider
{
    public function __construct(?string $apiKey = null, ?string $model = null)
    {
        parent::__construct($apiKey, $model);
        if (empty($this->apiKey)) {
            $this->apiKey = $this->resolveApiKey(
                'OPENAI_API_KEY',
                ['openai', 'chatgpt'],
                ['openai_api_key', 'ai_api_key']
            );
        }
    }

    public function chat(string $message, string $systemPrompt, array $history = [], array $options = []): array
    {
        if (!$this->isConfigured()) {
            throw new Exception("Provider {$this->getProviderSlug()} is not configured.");
        }

        $endpoint = 'https://api.openai.com/v1/chat/completions';

        $messages = [
            ['role' => 'system', 'content' => $systemPrompt],
        ];

        foreach ($history as $msg) {
            $messages[] = [
                'role' => $msg['role'] === 'user' ? 'user' : 'assistant',
                'content' => $msg['content'],
            ];
        }

        $messages[] = [
            'role' => 'user',
            'content' => $message,
        ];

        $payload = [
            'model' => $this->model,
            'messages' => $messages,
            'temperature' => $options['temperature'] ?? 0.7,
        ];

        $response = Http::withToken($this->apiKey)
            ->timeout(30)
            ->post($endpoint, $payload);

        if (!$response->successful()) {
            throw new Exception('OpenAI chat failed: ' . $response->body());
        }

        return [
            'reply' => $response->json('choices.0.message.content'),
            'tokens_prompt' => $response->json('usage.prompt_tokens'),
            'tokens_completion' => $response->json('usage.completion_tokens'),
            'model' => $this->model,
        ];
    }

    public function getProviderSlug(): string
    {
        return 'openai';
    }

    public function getDefaultModel(): string
    {
        return 'gpt-4o-mini';
    }
}
