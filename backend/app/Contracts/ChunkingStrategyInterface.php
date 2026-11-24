<?php

namespace App\Contracts;

interface ChunkingStrategyInterface
{
    /**
     * Divide um conteúdo bruto (HTML ou texto) em chunks semânticos.
     *
     * @return array<int, array{section_title: ?string, content: string}>
     */
    public function chunk(string $content, array $options = []): array;
}
