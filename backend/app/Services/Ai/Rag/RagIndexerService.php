<?php

namespace App\Services\Ai\Rag;

use App\Contracts\ChunkingStrategyInterface;
use App\Contracts\EmbeddingProviderInterface;
use App\Contracts\KnowledgeSourceInterface;
use App\Models\AiKnowledgeChunk;
use App\Services\Ai\Embeddings\EmbeddingProviderFactory;
use App\Services\Ai\Rag\Chunking\HtmlSectionChunkingStrategy;
use App\Services\Ai\Rag\Chunking\PlainTextChunkingStrategy;
use App\Services\Ai\Rag\Sources\InstitutionalRulesKnowledgeSource;
use App\Services\Ai\Rag\Sources\InstructionProgramKnowledgeSource;

class RagIndexerService
{
    /** @var array<string, KnowledgeSourceInterface> */
    protected array $sources = [];

    protected EmbeddingProviderInterface $embeddingProvider;

    /** @var array<string, ChunkingStrategyInterface> */
    protected array $chunkers = [];

    public function __construct(
        ?EmbeddingProviderInterface $embeddingProvider = null,
        ?array $sources = null
    ) {
        $this->embeddingProvider = $embeddingProvider ?? EmbeddingProviderFactory::make();
        $this->chunkers = [
            'html' => new HtmlSectionChunkingStrategy(),
            'text' => new PlainTextChunkingStrategy(),
        ];

        $defaultSources = $sources ?? [
            new InstructionProgramKnowledgeSource(),
            new InstitutionalRulesKnowledgeSource(),
        ];
        foreach ($defaultSources as $source) {
            $this->registerSource($source);
        }
    }

    public function registerSource(KnowledgeSourceInterface $source): void
    {
        $this->sources[$source->getSourceType()] = $source;
    }

    /**
     * Reindexa uma fonte específica (ou apenas um source_id).
     *
     * @return array{documents: int, chunks: int, provider: string}
     */
    public function indexSource(string $sourceType, ?int $sourceId = null): array
    {
        if (!isset($this->sources[$sourceType])) {
            return ['documents' => 0, 'chunks' => 0, 'provider' => $this->embeddingProvider->getProviderSlug()];
        }

        $documents = $this->sources[$sourceType]->extractDocuments($sourceId);
        $totalChunks = 0;

        if ($sourceId !== null && empty($documents)) {
            AiKnowledgeChunk::where('source_type', $sourceType)
                ->where('source_id', $sourceId)
                ->delete();

            return ['documents' => 0, 'chunks' => 0, 'provider' => $this->embeddingProvider->getProviderSlug()];
        }

        foreach ($documents as $doc) {
            $totalChunks += $this->indexDocument($doc);
        }

        return [
            'documents' => count($documents),
            'chunks' => $totalChunks,
            'provider' => $this->embeddingProvider->getProviderSlug(),
        ];
    }

    /**
     * Reindexa todas as fontes registradas.
     *
     * @return array<string, array{documents: int, chunks: int, provider: string}>
     */
    public function indexAll(): array
    {
        $report = [];
        foreach (array_keys($this->sources) as $type) {
            $report[$type] = $this->indexSource($type);
        }

        return $report;
    }

    /**
     * Remove chunks de uma fonte excluída.
     */
    public function removeSource(string $sourceType, int $sourceId): void
    {
        AiKnowledgeChunk::where('source_type', $sourceType)
            ->where('source_id', $sourceId)
            ->delete();
    }

    protected function indexDocument(array $doc): int
    {
        $format = $doc['format'] ?? 'text';
        $chunker = $this->chunkers[$format] ?? $this->chunkers['text'];
        $chunks = $chunker->chunk((string) ($doc['content'] ?? ''));

        // Cache de embeddings existentes por content_hash para economizar chamadas de API
        $existingByHash = AiKnowledgeChunk::where('source_type', $doc['source_type'])
            ->where('source_id', $doc['source_id'])
            ->get()
            ->keyBy('content_hash');

        AiKnowledgeChunk::where('source_type', $doc['source_type'])
            ->where('source_id', $doc['source_id'])
            ->delete();

        $providerSlug = $this->embeddingProvider->getProviderSlug();
        $created = 0;

        foreach ($chunks as $idx => $chunk) {
            $chunkContent = trim((string) ($chunk['content'] ?? ''));
            if ($chunkContent === '') {
                continue;
            }

            $sectionTitle = $chunk['section_title'] ?? null;
            $textForEmbedding = trim(($doc['title'] ?? '') . ($sectionTitle ? " — {$sectionTitle}" : '') . "\n" . $chunkContent);
            $hash = hash('sha256', $textForEmbedding);

            $embedding = null;
            $usedProvider = 'none';

            if (isset($existingByHash[$hash]) && !empty($existingByHash[$hash]->embedding)) {
                $embedding = $existingByHash[$hash]->embedding;
                $usedProvider = (string) $existingByHash[$hash]->embedding_provider;
            } elseif ($providerSlug !== 'none') {
                $vec = $this->embeddingProvider->embed($textForEmbedding);
                if (is_array($vec) && !empty($vec)) {
                    $embedding = $vec;
                    $usedProvider = $providerSlug;
                }
            }

            AiKnowledgeChunk::create([
                'source_type' => $doc['source_type'],
                'source_id' => $doc['source_id'],
                'curso_id' => $doc['curso_id'] ?? null,
                'title' => $doc['title'],
                'section_title' => $sectionTitle,
                'chunk_index' => $idx,
                'content' => $chunkContent,
                'content_hash' => $hash,
                'embedding' => $embedding,
                'embedding_provider' => $usedProvider,
                'is_public' => (bool) ($doc['is_public'] ?? false),
                'metadata' => $doc['metadata'] ?? [],
            ]);

            $created++;
        }

        return $created;
    }
}
