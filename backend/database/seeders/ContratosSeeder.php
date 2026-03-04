<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class ContratosSeeder extends Seeder
{
    public function run(): void
    {
        $courseId = 128;

        $periodos = [
            1 => 'Primeiro Período',
            2 => 'Segundo Período',
            3 => 'Terceiro Período',
            4 => 'Quarto Período',
            5 => 'Quinto Período',
            6 => 'Sexto Período',
            7 => 'Sétimo Período',
            8 => 'Oitavo Período',
        ];

        foreach ($periodos as $ordem => $rotulo) {
            $name = 'Contrato - ' . $rotulo . ' - Plano de Formação Ensino Superior';
            $slug = 'contrato-' . Str::slug($rotulo) . '-curso-' . $courseId;

            DB::table('posts')->updateOrInsert(
                [
                    'post_type'   => 'contratos',
                    'post_parent' => $courseId,
                    'post_name'   => $slug,
                ],
                [
                    'post_author'    => 0,
                    'post_title'     => $name,
                    'post_content'   => '<p>Conteúdo padrão do termo/contrato para '.$rotulo.'.</p>',
                    'post_status'    => 'publish',
                    'menu_order'     => $ordem,
                    'comment_status' => 'closed',
                    'ping_status'    => 'closed',
                    'config'         => json_encode(['id_curso' => $courseId, 'periodo' => $rotulo], JSON_UNESCAPED_UNICODE),
                    'created_at'     => now(),
                    'updated_at'     => now(),
                ]
            );
        }

        $termoName = 'Termo de Adesão - Plano de Formação Ensino Superior';
        $termoSlug = 'termo-adesao-curso-' . $courseId;

        DB::table('posts')->updateOrInsert(
            [
                'post_type'   => 'contratos',
                'post_parent' => $courseId,
                'post_name'   => $termoSlug,
            ],
            [
                'post_author'    => 0,
                'post_title'     => $termoName,
                'post_content'   => '<p>Termo de adesão padrão para o Plano de Formação.</p>',
                'post_status'    => 'publish',
                'menu_order'     => 0,
                'comment_status' => 'closed',
                'ping_status'    => 'closed',
                'config'         => json_encode(['id_curso' => $courseId, 'periodo' => null], JSON_UNESCAPED_UNICODE),
                'created_at'     => now(),
                'updated_at'     => now(),
            ]
        );
    }
}

