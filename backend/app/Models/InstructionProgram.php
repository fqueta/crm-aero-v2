<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class InstructionProgram extends Model
{
    use SoftDeletes;

    protected $table = 'instruction_programs';

    protected $fillable = [
        'curso_id',
        'title',
        'slug',
        'code',
        'current_revision',
        'revision_date',
        'mgr_revision',
        'mgr_date',
        'status',
        'is_public',
        'summary',
        'content_html',
        'contract_defaults',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'curso_id' => 'integer',
        'revision_date' => 'date:Y-m-d',
        'mgr_date' => 'date:Y-m-d',
        'is_public' => 'boolean',
        'contract_defaults' => 'array',
    ];

    public function curso(): BelongsTo
    {
        return $this->belongsTo(Curso::class, 'curso_id');
    }

    public function revisions(): HasMany
    {
        return $this->hasMany(InstructionProgramRevision::class, 'instruction_program_id')
            ->orderByDesc('id');
    }

    /**
     * Snapshot Memento da revisão atual do Programa de Instrução.
     */
    public function createRevisionSnapshot(
        ?string $changeNotes = null,
        bool $editedByAi = false,
        ?string $actorId = null
    ): InstructionProgramRevision {
        return $this->revisions()->create([
            'revision_code' => $this->current_revision ?: '001',
            'revision_date' => $this->revision_date?->format('Y-m-d'),
            'mgr_revision' => $this->mgr_revision,
            'mgr_date' => $this->mgr_date?->format('Y-m-d'),
            'content_html' => $this->content_html,
            'contract_defaults' => $this->contract_defaults,
            'change_notes' => $changeNotes,
            'edited_by_ai' => $editedByAi,
            'created_by' => $actorId,
        ]);
    }
}
