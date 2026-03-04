<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;
use App\Models\Post;

class ContratoFactory extends Factory
{
    protected $model = Post::class;

    public function definition(): array
    {
        $title = 'Contrato ' . $this->faker->words(3, true);
        $slug = Str::slug($title) . '-' . Str::random(5);
        return [
            'post_author' => 0,
            'post_content' => '<p>Conteúdo padrão do termo/contrato.</p>',
            'post_title' => $title,
            'post_status' => 'publish',
            'post_name' => $slug,
            'post_parent' => null,
            'menu_order' => 0,
            'post_type' => 'contratos',
            'comment_status' => 'closed',
            'ping_status' => 'closed',
            'config' => [
                'id_curso' => null,
                'periodo' => null,
            ],
        ];
    }

    public function forCourse(int $courseId): static
    {
        return $this->state(fn () => [
            'post_parent' => $courseId,
            'config' => [
                'id_curso' => $courseId,
                'periodo' => null,
            ],
        ]);
    }

    public function forPeriodo(string $periodo): static
    {
        return $this->state(function (array $attributes) use ($periodo) {
            $config = $attributes['config'] ?? [];
            $config['periodo'] = $periodo;
            return ['config' => $config];
        });
    }
}

