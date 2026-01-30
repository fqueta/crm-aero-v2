<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowAction extends Model
{
    protected $table = 'workflow_actions';

    protected $fillable = [
        'rule_id',
        'type',
        'payload',
        'order',
        'isActive',
        'retry_policy',
    ];

    protected $casts = [
        'payload' => 'array',
        'retry_policy' => 'array',
        'isActive' => 'boolean',
        'order' => 'integer',
    ];

    public function rule(): BelongsTo
    {
        return $this->belongsTo(WorkflowRule::class, 'rule_id');
    }
}
