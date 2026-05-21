<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class EnrollmentSituationsSeeder extends Seeder
{
    /**
     * Executa o seed das situações de matrícula usando a tabela `posts`.
     * EN: Seeds enrollment situations into `posts` table.
     *
     * Campos mapeados:
     * - post_type = 'situacao_matricula'
     * - post_title  <= Nome amigável (e.g. 'Interessado')
     * - post_name   <= Código/slug curto (e.g. 'int')
     * - post_excerpt<= Grupo/coleção (e.g. 'interessados')
     * - post_status <= Ativo ('s' ou 'n')
     * - menu_order  <= Ordem de exibição
     * - post_content<= Descrição
     * EN: Field mapping above.
     */
    public function run(): void
    {
        $postType = 'situacao_matricula';

        // Lista oficial de situações
        $items = [
            // [id, title, code, group, ativo, order, to_ping, pinged, excluido, deletado, description]
            // IDs a partir de 100 para evitar conflito com TipoConteudoSeeder (IDs 1,2,3,7,9,15,19,20)
            [100, 'Interessado', 'int', 'interessados', 's', 1, 'n', '', 'n', '', 'Pessoas que têm o tiveram algum interesse'],
            [101, 'Matriculado', 'mat', 'matriculados', 's', 2, 'n', '', 'n', '', 'Pessoas Matriculadas que a turma não começou, ou que ainda não assinaram o contrato'],
            [102, 'Realocar', 'alu', 'Realocar', 's', 6, 'n', '', 'n', '', 'Pessoa Matriculada que já pagou e assinou o contrato mais não compareceram no dia de inicio da turma'],
            [103, 'Cursando', 'cur', '', 's', 3, 'n', '', 'n', '', 'Que esta Cursando '],
            [104, 'Cursos Concluído', 'ccn', '', 's', 4, 'n', '', 'n', '', 'que ja concluiu'],
            [105, 'Black List', 'blt', 'black_list', 's', 8, 'n', '', 'n', '', 'que está na lista negra por ter débitos'],
            [106, 'Sequencia LTV', 'ltv', 'sequencia_ltv', 's', 5, 'n', '', 'n', '', 'Sequencia '],
            [107, 'Rescisão de contrato', 'rc', 'sequencia_ltv', 's', 7, 'n', '', 'n', '', 'Sequencia '],
            [108, 'Contrato cancelado', 'cn', 'contrato_cancelado', 's', 7, 'n', '', 'n', '', 'Contrato cancelado'],
        ];

        // Remove TODOS os registros deste post_type para reinserir com IDs fixos
        DB::table('posts')
            ->where('post_type', $postType)
            ->delete();

        // Insere cada item com ID explícito
        foreach ($items as [$id, $title, $code, $group, $ativo, $order, $toPing, $pinged, $excluido, $deletado, $description]) {
            DB::table('posts')->insert([
                'ID'              => $id,
                'post_name'       => $code,
                'post_type'       => $postType,
                'post_title'      => $title,
                'post_content'    => $description,
                'post_excerpt'    => $group,
                'post_status'     => $ativo,
                'menu_order'      => (int) $order,
                'to_ping'         => $toPing ?: 'n',
                'pinged'          => $pinged,
                'excluido'        => $excluido ?: 'n',
                'deletado'        => $deletado ?: 'n',
                'comment_status'  => 'closed',
                'ping_status'     => 'closed',
                'created_at'      => now(),
                'updated_at'      => now(),
            ]);
        }
    }
}