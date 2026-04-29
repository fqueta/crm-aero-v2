<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FinancialAccountPayment extends Model
{
    use HasFactory;

    /**
     * Campos liberados para atribuicao em massa.
     */
    protected $fillable = [
        'financial_account_id',
        'amount',
        'payment_date',
        'payment_method',
        'notes',
        'created_by',
        'token',
        'config',
    ];

    /**
     * Casts nativos do modelo.
     */
    protected $casts = [
        'amount' => 'decimal:2',
        'payment_date' => 'date',
        'config' => 'array',
    ];

    /**
     * paymentAccount
     * pt-BR: Conta financeira principal a que este pagamento pertence.
     * en-US: Main financial account that owns this payment entry.
     */
    public function paymentAccount(): BelongsTo
    {
        return $this->belongsTo(FinancialAccount::class, 'financial_account_id');
    }
}
