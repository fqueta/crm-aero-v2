<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class Rescisao extends Model
{
    use HasFactory;

    const STATUS_PENDING = 'pending';
    const STATUS_SENT = 'sent';
    const STATUS_SIGNED = 'signed';
    const STATUS_CANCELLED = 'cancelled';

    protected $table = 'rescisoes';

    protected $fillable = [
        'matricula_id',
        'data_rescisao',
        'valor_pago',
        'valor_matricula',
        'valor_inicial',
        'horas_compradas',
        'horas_voadas',
        'multa_rescisoria',
        'dias_alojamento',
        'preco_diaria',
        'valor_alojamento',
        'saldo_final',
        'config',
        'obs',
        'status',
        'excluido',
        'deletado',
        'excluido_por',
        'deletado_por'
    ];

    protected $casts = [
        'config' => 'array',
        'data_rescisao' => 'date',
        'valor_pago' => 'float',
        'valor_matricula' => 'float',
        'valor_inicial' => 'float',
        'horas_compradas' => 'integer',
        'horas_voadas' => 'float',
        'multa_rescisoria' => 'float',
        'dias_alojamento' => 'integer',
        'preco_diaria' => 'float',
        'valor_alojamento' => 'float',
        'saldo_final' => 'float',
        'status' => 'string'
    ];

    /**
     * Scope to exclude trashed items.
     */
    protected static function booted()
    {
        static::addGlobalScope('notDeleted', function (Builder $builder) {
            $table = $builder->getModel()->getTable();
            $builder->where(function($q) use ($table) {
                $q->whereNull($table.'.excluido')->orWhere($table.'.excluido', '!=', 's');
            })->where(function($q) use ($table) {
                $q->whereNull($table.'.deletado')->orWhere($table.'.deletado', '!=', 's');
            });
        });
    }

    /**
     * Relationship: The enrollment this termination belongs to.
     */
    public function matricula()
    {
        return $this->belongsTo(Matricula::class, 'matricula_id');
    }
}
