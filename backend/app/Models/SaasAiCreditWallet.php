<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SaasAiCreditWallet extends Model
{
    protected $connection = 'mysql';
    protected $table = 'saas_ai_credit_wallets';

    protected $fillable = [
        'tenant_id',
        'monthly_allowance',
        'monthly_used',
        'purchased_balance',
        'cycle_start_at',
        'cycle_ends_at',
    ];

    protected $casts = [
        'monthly_allowance' => 'integer',
        'monthly_used' => 'integer',
        'purchased_balance' => 'integer',
        'cycle_start_at' => 'datetime',
        'cycle_ends_at' => 'datetime',
    ];

    public function getTotalAvailableAttribute(): int
    {
        if ($this->monthly_allowance < 0) {
            return -1; // Ilimitado
        }
        $monthlyRem = max(0, $this->monthly_allowance - $this->monthly_used);
        return $monthlyRem + max(0, $this->purchased_balance);
    }
}
