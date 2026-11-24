<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InstructionProgramRevision extends Model
{
    protected $table = 'instruction_program_revisions';

    protected $fillable = [
        'instruction_program_id',
        'revision_code',
        'revision_date',
        'mgr_revision',
        'mgr_date',
        'content_html',
        'contract_defaults',
        'change_notes',
        'edited_by_ai',
        'created_by',
    ];

    protected $casts = [
        'instruction_program_id' => 'integer',
        'revision_date' => 'date:Y-m-d',
        'mgr_date' => 'date:Y-m-d',
        'contract_defaults' => 'array',
        'edited_by_ai' => 'boolean',
    ];

    public function program(): BelongsTo
    {
        return $this->belongsTo(InstructionProgram::class, 'instruction_program_id');
    }
}
