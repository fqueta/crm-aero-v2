<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SaasAiCreditPurchase extends Model
{
    protected $connection = 'mysql';
    protected $table = 'saas_ai_credit_purchases';

    protected $fillable = [
        'tenant_id',
        'package_slug',
        'credits',
        'price',
        'status',
        'payment_gateway',
        'payment_gateway_ref',
        'pix_qr_code',
        'pix_copy_paste',
        'invoice_url',
        'paid_at',
    ];

    protected $casts = [
        'credits' => 'integer',
        'price' => 'decimal:2',
        'paid_at' => 'datetime',
    ];
}
