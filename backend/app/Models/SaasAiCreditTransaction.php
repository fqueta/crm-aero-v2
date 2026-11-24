<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SaasAiCreditTransaction extends Model
{
    protected $connection = 'mysql';
    protected $table = 'saas_ai_credit_transactions';

    protected $fillable = [
        'tenant_id',
        'type',
        'amount',
        'balance_after',
        'source',
        'description',
        'metadata',
    ];

    protected $casts = [
        'amount' => 'integer',
        'balance_after' => 'integer',
        'metadata' => 'array',
    ];
}
