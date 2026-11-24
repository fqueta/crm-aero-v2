<?php

namespace App\Services\Ai\Rag;

use App\Contracts\EmbeddingProviderInterface;
use App\Contracts\RetrievalStrategyInterface;
use App\Models\AiKnowledgeChunk;
use App\Services\Ai\Embeddings\EmbeddingProviderFactory;
use App\Services\Ai\Rag\Retrieval\HybridVectorLexicalRetrievalStrategy;
use Illuminate\Support\Facades\Schema;

class RagRetrieverService
{
    protected RetrievalStrategyInterface $retrievalStrategy;

    protected EmbeddingProviderInterface $embeddingProvider;

    public function __construct(
        ?RetrievalStrategyInterface $retrievalStrategy = null,
        ?EmbeddingProviderInterface $embeddingProvider = null
    ) {
        $this->retrievalStrategy = $retrievalStrategy ?? new HybridVectorLexicalRetrievalStrategy();
        $this->embeddingProvider = $embeddingProvider ?? EmbeddingProviderFactory::make();
    }

    /**
     * Recupera os trechos mais relevantes do banco RAG do tenant.
     *
     * @param  array{publicOnly?: bool, instructionProgramId?: ?int, cursoId?: ?int, limit?: int} $filters
     * @return array<int, array<string, mixed>>
     */
    public function search(string $query, array $filters = []): array
    {
        if (trim($query) === '') {
            return [];
        }

        try {
            if (!Schema::hasTable('ai_knowledge_chunks')) {
                return [];
            }
        } catch (\Throwable $e) {
            return [];
        }

        $limit = (int) ($filters['limit'] ?? 5);
        $publicOnly = (bool) ($filters['publicOnly'] ?? false);
        $programId = $filters['instructionProgramId'] ?? null;
        $cursoId = $filters['cursoId'] ?? null;

        $q = AiKnowledgeChunk::query();
        if ($publicOnly) {
            $q->where('is_public', true);
        }

        if ($programId !== null) {
            // Na página pública de um PI específico: inclui o PI selecionado + regras institucionais públicas
            $q->where(function ($sub) use ($programId) {
                $sub->where(function ($w) use ($programId) {
                    $w->where('source_type', 'instruction_program')
                        ->where('source_id', $programId);
                })->orWhere('source_type', 'institutional_rules');
            });
        } elseif ($cursoId !== null) {
            $q->where(function ($sub) use ($cursoId) {
                $sub->where('curso_id', $cursoId)
                    ->orWhereNull('curso_id');
            });
        }

        $rows = $q->limit(400)->get();
        if ($rows->isEmpty()) {
            return [];
        }

        $candidates = [];
        $hasAnyEmbedding = false;
        foreach ($rows as $row) {
            $emb = is_array($row->embedding) ? $row->embedding : null;
            if (!empty($emb)) {
                $hasAnyEmbedding = true;
            }
            $candidates[] = [
                'id' => $row->id,
                'source_type' => $row->source_type,
                'source_id' => $row->source_id,
                'title' => $row->title,
                'section_title' => $row->section_title,
                'content' => $row->content,
                'embedding' => $emb,
                'metadata' => is_array($row->metadata) ? $row->metadata : [],
            ];
        }

        $queryEmbedding = null;
        if ($hasAnyEmbedding && $this->embeddingProvider->getProviderSlug() !== 'none') {
            $queryEmbedding = $this->embeddingProvider->embed($query);
        }

        $results = $this->retrievalStrategy->retrieve($query, $candidates, $queryEmbedding, $limit);

        // Remove vetor pesado do retorno
        return array_map(function (array $item) {
            unset($item['embedding']);
            return $item;
        }, $results);
    }
}
