<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Post;

class ComponentesFundosPropostaSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $componentes = [
            [
                'post_title' => 'Fundo Proposta Prático',
                'post_name' => 'fundo-proposta-pratico',
                'guid' => '3', // tipo_conteudo
                'config' => [
                    'short_code' => 'fundo-proposta-pratico'
                ]
            ],
            [
                'post_title' => 'Fundo Proposta Plano',
                'post_name' => 'fundo-proposta-plano',
                'guid' => '3', // tipo_conteudo
                'config' => [
                    'short_code' => 'fundo-proposta-plano'
                ]
            ],
            [
                'post_title' => 'Fundo Proposta Teórico',
                'post_name' => 'fundo-proposta-teorico',
                'guid' => '3', // tipo_conteudo
                'config' => [
                    'short_code' => 'fundo-proposta-teorico'
                ]
            ]
        ];

        foreach ($componentes as $item) {
            $post = Post::where('post_type', 'componentes')
                ->where('post_name', $item['post_name'])
                ->first();

            if (!$post) {
                $post = new Post();
                $post->post_type = 'componentes';
                $post->post_status = 'publish';
                $post->post_name = $item['post_name'];
                $post->post_title = $item['post_title'];
                $post->post_content = ''; // O conteúdo da imagem será incluído via painel
            }

            $post->guid = $item['guid'];
            $post->config = $item['config'];
            $post->save();
        }
    }
}
