<?php

namespace Database\Seeders;

use App\Models\Menu;
use App\Models\Permission;
use App\Services\Qlib;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class MenuSeeder extends Seeder
{
    /**
     * Seed principal:
     * - Cria menus a partir do JSON (CRM ou Oficina).
     * - Garante grupos de permissões iniciais.
     * - Vincula todos os menus aos grupos em `menu_permission`.
     */
    public function run(): void
    {
        /**
         * Desabilita FKs temporariamente para permitir truncates em ordem segura.
         */
        try { DB::statement('SET FOREIGN_KEY_CHECKS=0'); } catch (\Throwable $e) {}

        // Limpa vínculos dependentes e tabela de menus para evitar duplicações
        DB::table('menu_permission')->truncate();
        DB::table('menus')->truncate();

        // Carrega JSON externo conforme modo do sistema
        if (Qlib::is_crm_aero()) {
            $json = file_get_contents(database_path('seeders/data/menu_crm.json'));
        } else {
            $json = file_get_contents(database_path('seeders/data/menu_oficina.json'));
        }
        $menus = json_decode($json, true);

        // Cria toda a hierarquia de menus
        $this->createMenus($menus);

        /**
         * Permissões iniciais (Master = 1) e vínculos menu_permission.
         */
        DB::table('permissions')->truncate();
        DB::table('permissions')->insert([
            // MASTER → acesso a tudo
            [
                'name' => 'Master',
                'description' => 'Desenvolvedores',
                'redirect_login' => '/home',
                'active' => 's',
                'excluido' => 'n',
                'deletado' => 'n',
            ],

            // ADMINISTRADOR → tudo, mas em configurações só "Usuários" e "Perfis"
            [
                'name' => 'Administrador',
                'description' => 'Administradores do sistema',
                'redirect_login' => '/home',
                'active' => 's',
                'excluido' => 'n',
                'deletado' => 'n',
            ],

            // GERENTE → todos os menus exceto configurações
            [
                'name' => 'Gerente',
                'description' => 'Gerente do sistema (sem acesso a configurações)',
                'redirect_login' => '/home',
                'active' => 's',
                'excluido' => 'n',
                'deletado' => 'n',
            ],

            // ESCRITÓRIO → somente dois primeiros menus
            [
                'name' => 'Consultor',
                'description' => 'Acesso limitado a Dashboard e Clientes e propostas',
                'redirect_login' => '/home',
                'active' => 's',
                'excluido' => 'n',
                'deletado' => 'n',
            ],
            // Cliente → para clientes sem acesso ao admin
            [
                'name' => 'Cliente',
                'description' => 'Acesso limitado a Dashboard e Clientes',
                'redirect_login' => '/home',
                'active' => 's',
                'excluido' => 'n',
                'deletado' => 'n',
            ],
        ]);

        // Recria vínculos de permissão para todos os menus
        $group2Permissions = [
            1  => true, 2  => true, 3  => true,
            4  => true, 5  => true, 6  => true,
            7  => true, 8  => true, 9  => true,
            10 => true, 11 => true, 12 => true,
            13 => true, 14 => true, 15 => true,
            16 => true, 17 => true, 18 => true,
            19 => false, 20 => false, 21 => false,
            22 => false, 23 => true, 24 => true,
            25 => true, 26 => true, 27 => false,
            28 => false, 29 => false, 30 => false,
            31 => false, 32 => false, 33 => true,
            34 => true, 35 => true, 36 => true,
            37 => true, 38 => true, 39 => true,
            40 => true, 41 => false, 42 => true,
            43 => true, 44 => true, 45 => true,
            46 => false, 47 => false, 48 => false,
            49 => false, 50 => false, 51 => false,
        ];

        $group3Permissions = [
            1  => true, 2  => true, 3  => true,
            4  => true, 5  => true, 6  => true,
            7  => true, 8  => true, 9  => true,
            10 => true, 11 => true, 12 => false,
            13 => false, 14 => false, 15 => true,
            16 => false, 17 => false, 18 => false,
            19 => false, 20 => true, 21 => true,
            22 => true, 23 => true, 24 => true,
            25 => true, 26 => true, 27 => true,
            28 => false, 29 => false, 30 => false,
            31 => false, 32 => false, 33 => true,
            34 => true, 35 => false, 36 => true,
            37 => true, 38 => false, 39 => true,
            40 => true, 41 => false, 42 => true,
            43 => false, 44 => true, 45 => true,
            46 => true, 47 => false, 48 => false,
            49 => false, 50 => false, 51 => false,
        ];

        $group4Permissions = [
            1  => true, 2  => false, 3  => true,
            4  => false, 5  => true, 6  => true,
            7  => false, 8  => true, 9  => true,
            10 => true, 11 => true, 12 => true,
            13 => true, 14 => true, 15 => true,
            16 => false, 17 => false, 18 => true,
            19 => false, 20 => false, 21 => false,
            22 => false, 23 => false, 24 => false,
            25 => false, 26 => false, 27 => false,
            28 => false, 29 => false, 30 => false,
            31 => false, 32 => false,
            33 => false, 34 => true, 35 => false,
            36 => true, 37 => false, 38 => false,
            39 => true, 40 => true, 41 => true,
            42 => true, 43 => false, 44 => false,
            45 => false, 46 => false, 47 => false,
            48 => false, 49 => false, 50 => false,
            51 => false,
        ];

        $menusCollection = Menu::all();
        $groupsCollection = Permission::all();
        foreach ($menusCollection as $menu) {
            foreach ($groupsCollection as $group) {
                $map = match ($group->id) {
                    1 => null, // Master: tudo true (tratado abaixo)
                    2 => $group2Permissions,
                    3 => $group3Permissions,
                    4 => $group4Permissions,
                    default => [],
                };
                $canView = $group->id === 1 ? true : (array_key_exists($menu->id, $map) ? $map[$menu->id] : false);
                DB::table('menu_permission')->insert([
                    'menu_id'       => $menu->id,
                    'permission_id' => $group->id,
                    'can_view'      => $canView,
                    'can_create'    => $canView,
                    'can_edit'      => $canView,
                    'can_delete'    => $canView,
                    'can_upload'    => $canView,
                    'created_at'    => now(),
                    'updated_at'    => now(),
                ]);
            }
        }

        // Restaura verificação de FKs
        try { DB::statement('SET FOREIGN_KEY_CHECKS=1'); } catch (\Throwable $e) {}
    }

    /**
     * Cria hierarquia de menus a partir do JSON.
     */
    private function createMenus(array $menus, ?int $parentId = null): void
    {
        foreach ($menus as $index => $menu) {
            $id = DB::table('menus')->insertGetId([
                'title'      => $menu['title'],
                'url'        => $menu['url'] ?? null,
                'icon'       => $menu['icon'] ?? null,
                'items'      => isset($menu['submenu']) ? json_encode($menu['submenu'], JSON_UNESCAPED_UNICODE) : null,
                'active'     => 'y',
                'order'      => $index,
                'parent_id'  => $parentId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if (!empty($menu['submenu'])) {
                $this->createMenus($menu['submenu'], $id);
            }
        }
    }
}
