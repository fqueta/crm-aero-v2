<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use App\Models\ApiCredential;

class ZapguruIntegrationSeeder extends Seeder
{
    public function run(): void
    {
        $name = 'ZapGuru';
        $slug = 'zapguru';
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
                    'url' => 'https://s4.chatguru.app/api/v1',
                    'key' => '',
                    'account_id' => '',
                    'phone_id' => '',
                ],
                'updated_at' => now(),
                'created_at' => now(),
            ]
        );
        $postId = DB::table('posts')->where('post_type','api_credentials')->where('post_name',$slug)->value('ID');
        if ($postId && Schema::hasTable('postmeta')) {
            DB::table('postmeta')->updateOrInsert(
                ['post_id' => $postId, 'meta_key' => 'provider'],
                ['meta_value' => 'zapguru']
            );
        }
    }
}
