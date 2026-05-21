<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TipoConteudoSeeder extends Seeder
{
    /**
     * Executa a seed para tipos de conteúdo de componentes.
     * Insere/atualiza registros na tabela `posts` com `post_type = tipo_conteudo`
     * utilizando IDs fixos conforme especificação do usuário.
     */
    public function run(): void
    {
        $tipos = [
            1 => 'Artigo',
            2 => 'Banner',
            3 => 'Galeria',
            7 => 'PDF',
            9 => 'Contratos',
            15 => 'Html Code',
            19 => 'Galeria Completa',
            20 => 'Tags',
        ];

        // Remove todos os registros existentes deste post_type
        DB::table('posts')
            ->where('post_type', 'tipo_conteudo')
            ->delete();

        // Insere cada tipo com ID explícito
        foreach ($tipos as $id => $nome) {
            DB::table('posts')->insert([
                'ID' => $id,
                'post_author' => 0,
                'post_title' => $nome,
                'post_name' => Str::slug($nome),
                'post_status' => 'publish',
                'post_type' => 'tipo_conteudo',
                'menu_order' => 0,
                'comment_status' => 'closed',
                'ping_status' => 'closed',
                'guid' => (string)$id,
                'comment_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }
}