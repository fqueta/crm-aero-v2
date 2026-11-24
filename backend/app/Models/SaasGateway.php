<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SaasGateway extends Model
{
    protected $connection = 'mysql';
    protected $table = 'saas_gateways';

    protected $fillable = [
        'gateway',
        'api_key',
        'environment',
        'webhook_token',
        'is_active',
        'config',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'config' => 'array',
    ];
}
