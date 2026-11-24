<?php

namespace App\Contracts;

interface RetrievalStrategyInterface
{
    /**
     * Classifica e retorna os chunks mais relevantes para a consulta.
     *
     * @param  array<int, array<string, mixed>>  $candidates
     * @param  float[]|null                      $queryEmbedding
     * @return array<int, array<string, mixed>>
     */
    public function retrieve(string $query, array $candidates, ?array $queryEmbedding = null, int $limit = 5): array;
}
