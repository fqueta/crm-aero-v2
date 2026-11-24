<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiKnowledgeChunk extends Model
{
    protected $table = 'ai_knowledge_chunks';

    protected $fillable = [
        'source_type',
        'source_id',
        'curso_id',
        'title',
        'section_title',
        'chunk_index',
        'content',
        'content_hash',
        'embedding',
        'embedding_provider',
        'is_public',
        'metadata',
    ];

    protected $casts = [
        'source_id' => 'integer',
        'curso_id' => 'integer',
        'chunk_index' => 'integer',
        'embedding' => 'array',
        'is_public' => 'boolean',
        'metadata' => 'array',
    ];
}
