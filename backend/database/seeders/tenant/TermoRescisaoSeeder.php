<?php

namespace Database\Seeders\Tenant;

use Illuminate\Database\Seeder;
use App\Models\Post;

class TermoRescisaoSeeder extends Seeder
{
    public function run(): void
    {
        $shortcode = 'termo_rescisao';

        $content = <<<'HTML'
<h2 style="text-align: center;">Solicitação de Rescisão {numero_contrato}</h2>
<p>Eu, <strong>{nome_aluno}</strong>, canac: {canac}, Aluno (a) do Aeroclube de Juiz de Fora, venho por meio desta declarar que solicitei formalmente a transferência ou rescisão do curso que estive matriculado e frequentando nesta instituição.</p>
<p>O presente termo tem por objeto a solicitação da recisao unilateral do contrato de prestação de serviços educacionais contrato <strong>{numero_contrato}</strong>, celebrado entre:</p>
<p><strong>{nome_aluno}</strong>, portador do CPF {cpf}, residente e domiciliado na {endereco}.</p>
<p>e <strong>AEROCLUBE DE JUIZ DE FORA</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob no 21616420000177, com sede na Avenida Prefeito Mello Reis, 311 - Aeroporto, Aeroporto, CEP: 36033560, Juiz de Fora/MG.</p>
<p>o Contratante, <strong>{nome_aluno}</strong> rescinde unilateralmente, por sua livre e espontânea vontade, o contrato em discussão, ciente do contido no CAPÍTULO - DOS VALORES E DOS REAJUSTES, descritos no presente instrumento, que em caso de rescisão unilateral pelo CONTRATANTE, o estorno referente ao montante residual deverá ser iniciado pela CONTRATADA em até 90 (noventa) dias úteis, contados após 30 (trinta) dias da solicitação formal do pedido de rescisão, no contrato firmado diretamente com o Aeroclube de Juiz de Fora e neste caso, descontado o percentual de 30% (trinta por cento) a título de despesas administrativas e tributárias, sendo restituído da seguinte forma: em 12 (doze) parcelas, mensais, ou em uma única parcela ao final da 12º parcela, a critério da CONTRATADA.</p>
<p>Nos contratos do Plano de Formação, se couber, caso o CONTRATANTE venha optar pelo trancamento ou cancelamento de matrícula a partir do primeiro dia de início das aulas e até o dia anterior de encerramento do semestre em que se encontrar, conforme cronograma exposto também no presente contrato, não fará jus ao ressarcimento de nenhum valor pago, além de ser devido as mensalidades do semestre vigente, cabe ressaltar que será renovado automaticamente a matrícula do CONTRATANTE a cada final de semestre para o semestre subsequente se não houver manifestação expressa contrária.</p>
<p>Conforme estipulado pela Instrução Suplementar 141 (IS- 141), o Aeroclube de Juiz de Fora tem o prazo de até 10 (dez) dias úteis para providenciar a entrega da rescisão ou documentação pertinente relacionada à minha transferência.</p>
<p>Além disso, estou ciente de que, após o pedido de rescisão, devo deixar imediatamente as dependências da escola, incluindo alojamento coletivos ou suites particulares, conforme procedimento padrão estabelecido pelo Aeroclube de Juiz de Fora.</p>
<p>Também tenho ciência que o pedido de transferência enseja na solicitação de rescisão contratual conforme Contrato de Prestação de Serviço devidamente assinado por mim no momento da matrícula nessa instituição.</p>
<p>Para todos os fins, integra o presente termo de rescisão o demonstrativo de cálculo anexo em que consta na forma mercantil o montante residual a que tem direito o contratante.</p>

<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
<tr><td style="padding: 8px; border: 1px solid #ccc;"><strong>Valor total do contrato</strong></td><td style="padding: 8px; border: 1px solid #ccc; text-align: right;"><strong>{valor_inicial}</strong></td></tr>
<tr><td style="padding: 8px; border: 1px solid #ccc;">Valor pago ate a recisao</td><td style="padding: 8px; border: 1px solid #ccc; text-align: right;">{valor_pago_ate_rescisao}</td></tr>
</table>

{tabela_multa}

{tabela_matricula}

{tabela_horas_voadas}

{tabela_alojamento}

{tabela_resumo}

{previsao_pagamento}

<p style="text-align: center;">Por estarem de acordo com as informacoes acima, assinam a presente recisao em duas vias com duas testemunhas.</p>
<p style="text-align: center;">&nbsp;</p>
<p style="text-align: center;">Juiz de Fora, {dia} de {mes} de {ano}.</p>
<p style="text-align: center;">&nbsp;</p>
{assinatura}
HTML;

        $item = [
            'post_title' => 'Termo de Rescisão',
            'post_name' => $shortcode,
            'post_type' => 'componentes',
            'post_status' => 'publish',
            'post_content' => $content,
            'guid' => '15',
            'config' => [
                'short_code' => $shortcode
            ]
        ];

        $post = Post::where('post_type', 'componentes')
            ->where('post_name', $item['post_name'])
            ->first();

        if (!$post) {
            $post = new Post();
            $post->post_type = 'componentes';
            $post->post_status = 'publish';
            $post->post_name = $item['post_name'];
        }

        $post->post_title = $item['post_title'];
        $post->post_content = $item['post_content'];
        $post->guid = $item['guid'];
        $post->config = $item['config'];
        $post->save();
    }
}
