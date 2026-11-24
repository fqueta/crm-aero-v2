<?php

namespace App\Contracts;

interface EmbeddingProviderInterface
{
    /**
     * Gera o vetor de embedding para um texto.
     *
     * @return float[]|null
     */
    public function embed(string $text): ?array;

    public function isConfigured(): bool;

    public function getProviderSlug(): string;
}
