<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;

class Responsible extends User
{
    protected $table = 'users';

    /**
     * ID de permissão aplicado ao escopo de responsáveis.
     * EN: Permission ID applied to the guardian scope.
     */
    protected static ?int $responsavelPermissionId = null;

    /**
     * setPermissionId
     * pt-BR: Define em tempo de execução o permission_id que o model deve usar.
     * en-US: Sets at runtime the permission_id that the model should use.
     */
    public static function setPermissionId(?int $permissionId): void
    {
        static::$responsavelPermissionId = $permissionId;
    }

    /**
     * resolvePermissionId
     * pt-BR: Resolve o permission_id atual com fallback para 8.
     * en-US: Resolves the current permission_id with fallback to 8.
     */
    protected static function resolvePermissionId(): int
    {
        return (int) (static::$responsavelPermissionId ?? 8);
    }

    /**
     * booted
     * pt-BR: Força criação e consultas apenas para responsáveis.
     * en-US: Forces creation and queries to target only guardians.
     */
    protected static function booted()
    {
        static::creating(function ($responsavel) {
            $responsavel->permission_id = static::resolvePermissionId();
        });

        static::addGlobalScope('responsible', function (Builder $builder) {
            $builder->where('permission_id', static::resolvePermissionId());
        });
    }

    protected $fillable = [
        'tipo_pessoa',
        'name',
        'razao',
        'cpf',
        'cnpj',
        'email',
        'password',
        'status',
        'genero',
        'verificado',
        'permission_id',
        'config',
        'preferencias',
        'foto_perfil',
        'ativo',
        'autor',
        'token',
        'excluido',
        'reg_excluido',
        'deletado',
        'reg_deletado',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];
}
