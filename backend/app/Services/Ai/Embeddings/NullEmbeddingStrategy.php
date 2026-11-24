<?php

namespace App\Services\Ai\Embeddings;

use App\Contracts\EmbeddingProviderInterface;

class NullEmbeddingStrategy implements EmbeddingProviderInterface
{
    public function embed(string $text): ?array
    {
        return null;
    }

    public function isConfigured(): bool
    {
        return true;
    }

    public function getProviderSlug(): string
    {
        return 'none';
    }
}
