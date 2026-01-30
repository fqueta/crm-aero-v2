<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WorkflowRule extends Model
{
    protected $table = 'workflow_rules';

    protected $fillable = [
        'workflow_id',
        'source_type',
        'event',
        'filters',
        'conditions',
        'order',
        'isActive',
    ];

    protected $casts = [
        'filters' => 'array',
        'conditions' => 'array',
        'isActive' => 'boolean',
        'order' => 'integer',
    ];

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(Workflow::class);
    }

    public function actions(): HasMany
    {
        return $this->hasMany(WorkflowAction::class, 'rule_id')->orderBy('order', 'asc');
    }
}
