<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PeriodosSeeder extends Seeder
{
    /**
     * run
     * pt-BR: Cadastra períodos (post_type = 'periodos') para cursos específicos.
     *        Curso ID 128: períodos 1 a 8. Curso ID 132: períodos 1 a 4. incluir valor do período no campo config->valor
     *        Cada período recebe nome, slug único por curso, status 'publish',
     *        e referência do curso em `post_parent` e `config.id_curso`.
     * en-US: Seeds periods (post_type = 'periodos') for specific courses.
     *        Course ID 128: periods 1 to 8. Course ID 132: periods 1 to 4.
     *        Each period gets a name, course-unique slug, 'publish' status,
     *        and the course reference in `post_parent` and `config.id_curso`.
     */
    public function run(): void
    {
        $courses = [
            128 => 8, // Curso ID 128: 1º ao 8º período
            132 => 4, // Curso ID 132: 1º ao 4º período
        ];

        $ordinals = [
            128=>[
                    1 => ['label' => 'Primeiro', 'valor' => 17820.00,'h_teoricas'=>135,'h_praticas'=>0],
                    2 => ['label' => 'Segundo', 'valor' => 25740.00,'h_teoricas'=>0,'h_praticas'=>42],
                    3 => ['label' => 'Terceiro', 'valor' => 26340.00,'h_teoricas'=>620,'h_praticas'=>0],
                    4 => ['label' => 'Quarto', 'valor' => 23820.00,'h_teoricas'=>400,'h_praticas'=>64],
                    5 => ['label' => 'Quinto', 'valor' => 23820.00,'h_teoricas'=>400,'h_praticas'=>30],
                    6 => ['label' => 'Sexto', 'valor' => 23820.00,'h_teoricas'=>400,'h_praticas'=>22],
                    7 => ['label' => 'Sétimo', 'valor' => 17820.00,'h_teoricas'=>140,'h_praticas'=>30],
                    8 => ['label' => 'Oitavo', 'valor' => 17820,'h_teoricas'=>150,'h_praticas'=>64],
                ],
            132=>[
                    1 => ['label' => 'Primeiro', 'valor' => 2994.00,'h_teoricas'=>560,'h_praticas'=>0],
                    2 => ['label' => 'Segundo', 'valor' => 2994.00,'h_teoricas'=>640,'h_praticas'=>0],
                    3 => ['label' => 'Terceiro', 'valor' => 2994.00,'h_teoricas'=>640,'h_praticas'=>0],
                    4 => ['label' => 'Quarto', 'valor' => 2994.00,'h_teoricas'=>0,'h_praticas'=>198],
                ],
        ];
        //para o curso de id 132 todos valores dos periodos deve ser 2.994,00
        //remover campos antes de adicionar
        DB::table('posts')->where('post_type', 'periodos')->delete();

        foreach ($courses as $courseId => $maxPeriods) {
            for ($i = 1; $i <= $maxPeriods; $i++) {
                $label = $ordinals[$courseId][$i]['label'] ?? (string)$i;
                $name = $label . ' Período';
                $slugBase = Str::slug($name);
                // Garante slug único por curso para evitar colisões entre cursos
                $slug = $slugBase . '-curso-' . $courseId;

                DB::table('posts')->updateOrInsert(
                    [
                        'post_type'   => 'periodos',
                        'post_parent' => $courseId,
                        'post_name'   => $slug,
                    ],
                    [
                        'post_author'    => 0,
                        'post_title'     => $name,
                        'post_status'    => 'publish',
                        'menu_order'     => $i,
                        'comment_status' => 'closed',
                        'ping_status'    => 'closed',
                        'config'         => json_encode(['id_curso' => $courseId, 'valor' => $ordinals[$courseId][$i]['valor'],'h_praticas'=>$ordinals[$courseId][$i]['h_praticas'],'h_teoricas'=>$ordinals[$courseId][$i]['h_teoricas']], JSON_UNESCAPED_UNICODE),
                        'created_at'     => now(),
                        'updated_at'     => now(),
                    ]
                );
            }
        }
    }
}
