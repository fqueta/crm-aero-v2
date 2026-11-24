<?php

namespace App\Contracts;

interface AiPromptContextStrategyInterface
{
    /**
     * Monta o system prompt apropriado ao contexto de uso (admin, público ou editor de PI).
     *
     * @param  array<string, mixed>              $context
     * @param  array<int, array<string, mixed>>  $ragChunks
     */
    public function buildSystemPrompt(array $context, array $ragChunks = []): string;
}
