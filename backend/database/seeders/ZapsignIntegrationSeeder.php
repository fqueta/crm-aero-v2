<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\ApiCredential;
use Illuminate\Support\Str;

class ZapsignIntegrationSeeder extends Seeder
{
    public function run(): void
    {
        $name = 'ZapSign';
        $slug = 'zapsign';
        ApiCredential::updateOrCreate(
            ['post_name' => $slug],
            [
                'post_title' => $name,
                'post_status' => 'publish',
                'post_author' => 1,
                'comment_status' => 'closed',
                'ping_status' => 'closed',
                'menu_order' => 0,
                'post_type' => 'api_credentials',
                'excluido' => 'n',
                'deletado' => 'n',
                'token' => Str::random(16),
                'config' => [
                    'url' => 'https://api.zapsign.com.br/api/v1',
                    'id_api' => '',
                    'user' => '',
                    'pass' => '',
                    'produto' => '',
                ],
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );

        // Ensure options entry used by ZapsingController exists
        DB::table('options')->updateOrInsert(
            ['url' => 'credenciais_zapsign'],
            [
                'name' => 'Credenciais da Api Zapsign',
                'value' => json_encode([
                    'url_api' => 'https://api.zapsign.com.br/api/v1',
                    'id_api' => '',
                ], JSON_UNESCAPED_UNICODE),
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );
    }
}
