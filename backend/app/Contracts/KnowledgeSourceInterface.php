<?php

namespace App\Contracts;

interface KnowledgeSourceInterface
{
    public function getSourceType(): string;

    /**
     * Extrai documentos prontos para chunking/indexação.
     *
     * @return array<int, array{
     *   source_type: string,
     *   source_id: ?int,
     *   curso_id: ?int,
     *   title: string,
     *   content: string,
     *   format: string,
     *   is_public: bool,
     *   metadata: array<string, mixed>
     * }>
     */
    public function extractDocuments(?int $sourceId = null): array;
}
