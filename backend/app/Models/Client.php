<?php

namespace App\Models;

use App\Http\Controllers\Api\ClientController;
use Illuminate\Database\Eloquent\Builder;
use App\Models\User;
use App\Services\Qlib;

class Client extends User
{
    protected $table = 'users';

    // Sempre traz só usuários com permission_id = 5
    protected static function booted()
    {
        $cliente_permission_id = (new ClientController)->cliente_permission_id ?? Qlib::qoption('permission_client_id');
        static::creating(function ($client) use ($cliente_permission_id) {
            $client->permission_id = $cliente_permission_id; // força sempre grupo cliente
        });

        static::addGlobalScope('client', function (Builder $builder) use ($cliente_permission_id) {
            $builder->where('permission_id', $cliente_permission_id);
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
