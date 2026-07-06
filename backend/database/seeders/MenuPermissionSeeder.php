<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use App\Models\Menu;
use App\Models\Permission;

class MenuPermissionSeeder extends Seeder
{
    public function run(): void
    {
        $menus = Menu::all();
        $groups = Permission::all();

        // Mapas de permissões por grupo

        $group2Permissions = [
            1  => true,   // Dashboard
            2  => true,   // Vendas e Propostas
            3  => true,   // Atendimento (FloW)
            4  => true,   // Clientes
            5  => true,   // Atendimento (FloW)
            6  => true,   // Arquivo Clientes
            7  => true,   // Escola
            8  => true,   // Interessados
            9  => true,   // Matrículas
            10 => true,   // Todos cursos
            11 => true,   // Todas turmas
            12 => true,   // Rescisões
            13 => true,   // Ganhos
            14 => true,   // Situações
            15 => true,   // Controle de Formação
            16 => true,   // Gerenciar Site
            17 => true,   // Paginas do site
            18 => true,   // Componentes
            19 => false,  // Tipos de conteúdo
            20 => false,  // Financeiro
            21 => false,  // Contas
            22 => false,  // Categorias
            23 => true,   // Relatórios
            24 => true,   // Geral
            25 => true,   // Vendas
            26 => true,   // Pós Venda
            27 => false,  // Balanço
            28 => false,  // Turmas
            29 => false,  // Atendimento
            30 => false,  // Acessos
            31 => false,  // Horas Voadas
            32 => false,  // Contratos vencidos
            33 => true,   // Configurações
            34 => true,   // Usuários
            35 => true,   // Dados da empresa
            36 => true,   // Aeronaves
            37 => true,   // Permissões
            38 => true,   // Cupom de desconto
            39 => true,   // Tabelas de preço
            40 => true,   // Funil e etapas
            41 => false,  // Categorias
            42 => true,   // Tabelas de parcelamento
            43 => true,   // Tabelas de desconto
            44 => true,   // Contratos e termos
            45 => true,   // Períodos
            46 => false,  // Sistema
            47 => false,  // Workflows
            48 => false,  // Regras
            49 => false,  // Ações
            50 => false,  // Integrações
            51 => false,  // Importação de Dados
        ];

        $group3Permissions = [
            1  => true,   // Dashboard
            2  => true,   // Vendas e Propostas
            3  => true,   // Atendimento (FloW)
            4  => true,   // Clientes
            5  => true,   // Atendimento (FloW)
            6  => true,   // Arquivo Clientes
            7  => true,   // Escola
            8  => true,   // Interessados
            9  => true,   // Matrículas
            10 => true,   // Todos cursos
            11 => true,   // Todas turmas
            12 => false,  // Rescisões
            13 => false,  // Ganhos
            14 => false,  // Situações
            15 => true,   // Controle de Formação
            16 => false,  // Gerenciar Site
            17 => false,  // Paginas do site
            18 => false,  // Componentes
            19 => false,  // Tipos de conteúdo
            20 => true,   // Financeiro
            21 => true,   // Contas
            22 => true,   // Categorias
            23 => true,   // Relatórios
            24 => true,   // Geral
            25 => true,   // Vendas
            26 => true,   // Pós Venda
            27 => true,   // Balanço
            28 => false,  // Turmas
            29 => false,  // Atendimento
            30 => false,  // Acessos
            31 => false,  // Horas Voadas
            32 => false,  // Contratos vencidos
            33 => true,   // Configurações
            34 => true,   // Usuários
            35 => false,  // Dados da empresa
            36 => true,   // Aeronaves
            37 => true,   // Permissões
            38 => false,  // Cupom de desconto
            39 => true,   // Tabelas de preço
            40 => true,   // Funil e etapas
            41 => false,  // Categorias
            42 => true,   // Tabelas de parcelamento
            43 => false,  // Tabelas de desconto
            44 => true,   // Contratos e termos
            45 => true,   // Períodos
            46 => true,   // Sistema
            47 => false,  // Workflows
            48 => false,  // Regras
            49 => false,  // Ações
            50 => false,  // Integrações
            51 => false,  // Importação de Dados
        ];

        $group4Permissions = [
            1  => true,   // Dashboard
            2  => true,   // Vendas e Propostas
            4  => true,   // Clientes
        ];

        DB::table('menu_permission')->delete();

        foreach ($menus as $menu) {
            foreach ($groups as $group) {
                $canView = match ($group->id) {
                    1 => true,  // Master: tudo true
                    2 => $group2Permissions[$menu->id] ?? false,
                    3 => $group3Permissions[$menu->id] ?? false,
                    4 => $group4Permissions[$menu->id] ?? false,
                    default => false,
                };

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
    }
}
