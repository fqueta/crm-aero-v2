<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Database\Factories\ContratoFactory;

class ContratosFactorySeeder extends Seeder
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
            $slug = 'contrato-' . Str::slug($rotulo) . '-curso-' . $courseId;
            $exists = DB::table('posts')->where([
                ['post_type', '=', 'contratos'],
                ['post_parent', '=', $courseId],
                ['post_name', '=', $slug],
            ])->exists();
            if ($exists) {
                continue;
            }
            ContratoFactory::new()
                ->forCourse($courseId)
                ->forPeriodo($rotulo)
                ->create([
                    'post_title' => 'Contrato - ' . $rotulo . ' - Plano de Formação Ensino Superior',
                    'post_name' => $slug,
                    'menu_order' => $ordem,
                    'post_content' => '<p>Conteúdo padrão do termo/contrato para ' . $rotulo . '.</p>',
                ]);
        }

        $termoSlug = 'termo-adesao-curso-' . $courseId;
        $existsTermo = DB::table('posts')->where([
            ['post_type', '=', 'contratos'],
            ['post_parent', '=', $courseId],
            ['post_name', '=', $termoSlug],
        ])->exists();
        if (!$existsTermo) {
            ContratoFactory::new()
                ->forCourse($courseId)
                ->create([
                    'post_title' => 'Termo de Adesão - Plano de Formação Ensino Superior',
                    'post_name' => $termoSlug,
                    'menu_order' => 0,
                    'post_content' => '<p>Termo de adesão padrão para o Plano de Formação.</p>',
                ]);
        }
    }
}

