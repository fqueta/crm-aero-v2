<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Services\Qlib;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $users = [
            [
                // 'id' => Qlib::token(),
                'name' => 'Fernando Queta',
                'email' => 'fernando@maisaqui.com.br',
                'password' => Hash::make('ferqueta'),
                'status' => 'actived',
                'verificado' => 'n',
                'token' => uniqid(),
                'permission_id' => 1, // Grupo Master
            ],
            [
                // 'id' => Qlib::token(),
                'name' => 'Leandro Lopardi',
                'email' => 'leandro@aeroclubejf.com.br',
                'password' => Hash::make('leandro'),
                'status' => 'actived',
                'verificado' => 'n',
                'token' => 'id_contatada',
                'permission_id' => 2, // Grupo Administrador
            ],
            [
                'name'=> 'Monique Ribeiro',
                'email'=> 'monique@aeroclubejf.com.br',
                'password'=> Hash::make('monique'),
                'status' => 'actived',
                'verificado' => 'n',
                'token' => 'id_testemunha1',
                'permission_id' => 3, // Grupo Administrador
            ],
            [
                'name'=> 'Renan Coimbra',
                'email'=> 'renan@aeroclubejf.com.br',
                'password'=> Hash::make('renan'),
                'status' => 'actived',
                'verificado' => 'n',
                'token' => 'id_testemunha2',
                'permission_id' => 3, // Grupo Administrador
            ]
        ];
        //remove os antigos
        User::where('permission_id', 1)->delete();
        User::where('permission_id', 2)->delete();
        User::where('permission_id', 3)->delete();
        foreach ($users as $userData) {
            // dump($userData);
            // User::updateOrCreate(
            //     ['email' => $userData['email']], // evita duplicados
            //     $userData
            // );
            User::create(
                $userData
            );
        }
    }
}
