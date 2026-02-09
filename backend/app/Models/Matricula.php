<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Builder;

class Matricula extends Model
{
    use HasFactory;
    /**
     * Usa timestamps customizados: 'data' e 'atualizado'.
     * Use custom timestamps columns: 'data' and 'atualizado'.
     */
    const CREATED_AT = 'data';
    const UPDATED_AT = 'atualizado';

    /**
     * Nome da tabela explícito para evitar ambiguidades.
     * Explicit table name to avoid ambiguity.
     */
    protected $table = 'matriculas';

    /**
     * Conversões automáticas para arrays de JSON.
     * Automatic casting for JSON arrays.
     */
    protected $casts = [
        'orc' => 'array',
        'config' => 'array',
        'reg_excluido' => 'array',
        'reg_deletado' => 'array',
    ];

    /**
     * Campos permitidos para atribuição em massa.
     * Mass assignable fields.
     */
    protected $fillable = [
        'id_cliente',
        'id_curso',
        'id_responsavel',
        'id_turma',
        'parcelamento_id',
        'situacao_id',
        'id_consultor',
        'descricao',
        'status',
        'config',
        'stage_id',
        'funnel_id',
        'desconto',
        'combustivel',
        'subtotal',
        'total',
        'orc',
        // Lixeira personalizada
        'excluido',
        'deletado',
        'excluido_por',
        'deletado_por',
        'reg_excluido',
        'reg_deletado',
    ];

    /**
     * Aplica escopo global para ocultar registros na lixeira.
     * Qualifica colunas com o nome da tabela para evitar ambiguidade em JOINs.
     * Apply global scope to hide trashed records (custom flags).
     * Qualifies columns with table name to avoid ambiguity in JOINs.
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
     * Relacionamento: parcelamento vinculado à matrícula.
     */
    public function parcelamento()
    {
        return $this->belongsTo(Parcelamento::class, 'parcelamento_id');
    }

    /**
     * Relação N:N com parcelamentos do curso através da tabela pivot.
     * EN: Many-to-many relation to course installment plans via pivot.
     */
    public function parcelamentos()
    {
        return $this->belongsToMany(Parcelamento::class, 'matricula_parcelamento', 'matricula_id', 'parcelamento_id');
    }

    /**
     * Relacionamento: curso associado à matrícula.
     * EN: Course related to the enrollment.
     */
    public function curso()
    {
        return $this->belongsTo(Curso::class, 'id_curso');
    }

    /**
     * Relacionamento: turma associada à matrícula.
     * EN: Class group related to the enrollment.
     */
    public function turma()
    {
        return $this->belongsTo(Turma::class, 'id_turma');
    }

    /**
     * Relacionamento: cliente (usuário) associado à matrícula.
     * EN: Client (user) related to the enrollment.
     */
    public function cliente()
    {
        return $this->belongsTo(User::class, 'id_cliente');
    }

    /**
     * Relacionamento: funil (pipeline) associado.
     * EN: Funnel related to the enrollment.
     */
    public function funnel()
    {
        return $this->belongsTo(Funnel::class, 'funnel_id');
    }

    /**
     * Relacionamento: etapa (stage) associada.
     * EN: Stage related to the enrollment.
     */
    public function stage()
    {
        return $this->belongsTo(Stage::class, 'stage_id');
    }

    /**
     * Relacionamento: situação associada (posts.situacao_matricula).
     * EN: Enrollment situation related to the enrollment.
     */
    public function situacao()
    {
        return $this->belongsTo(EnrollmentSituation::class, 'situacao_id', 'ID');
    }
}
