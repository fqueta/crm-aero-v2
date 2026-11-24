<?php

namespace App\Services\Ai\Embeddings;

use App\Contracts\EmbeddingProviderInterface;
use App\Services\Ai\Chat\AiChatProviderFactory;

class EmbeddingProviderFactory
{
    protected static array $providers = [
        'gemini' => GeminiEmbeddingStrategy::class,
        'openai' => OpenAiEmbeddingStrategy::class,
    ];

    public static function make(?string $preferred = null): EmbeddingProviderInterface
    {
        $target = $preferred ?? AiChatProviderFactory::resolvePreferredProvider();

        $ordered = [];
        if ($target && isset(self::$providers[$target])) {
            $ordered[$target] = self::$providers[$target];
        }
        foreach (self::$providers as $slug => $class) {
            if (!isset($ordered[$slug])) {
                $ordered[$slug] = $class;
            }
        }

        foreach ($ordered as $class) {
            try {
                /** @var EmbeddingProviderInterface $instance */
                $instance = new $class();
                if ($instance->isConfigured()) {
                    return $instance;
                }
            } catch (\Throwable $e) {
            }
        }

        return new NullEmbeddingStrategy();
    }
}
