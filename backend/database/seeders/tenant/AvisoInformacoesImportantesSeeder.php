<?php

namespace Database\Seeders\Tenant;

use Illuminate\Database\Seeder;
use App\Models\Post;

class AvisoInformacoesImportantesSeeder extends Seeder
{
    /**
     * Run the database seeds.
     * PT: Cria um componente de aviso com informações importantes para as propostas.
     * EN: Creates a warning component with important information for proposals.
     */
    public function run(): void
    {
        $content = "Este orçamento possui validade de {dias} ({dias_extenso}) dias. O valor apresentado poderá ser pago:<br><br>
<strong>Observação:</strong> Os modelos de aeronaves mencionados na proposta são utilizados exclusivamente para ajustes e precificação. O Aeroclube de Juiz de Fora reserva-se o direito de disponibilizar uma aeronave compatível com o treinamento a ser realizado, podendo esta ser de modelo diferente daquele proposto e sem custo adicional. Entretanto, caso o aluno agende espontaneamente em aeronaves de diferentes modelos da proposta fechada, haverá cobrança de crédito devido à diferença de preços entre modelos.<br><br>
<strong>Desconto Promocional de Pacotes:</strong> Nosso desconto promocional aplica-se à compra de pacotes de crédito de voo, com validade de 1 (um) ano conforme contrato. o Valor da hora avulsa é de R$700,00<br><br>
<strong>- O que é Curso:</strong> É o conjunto completo de aulas, treinamentos e atividades (teóricas) que o aluno se compromete a cumprir para conquistar uma certificação ou habilitação. Cada curso tem sua estrutura própria, com carga horária, conteúdos pedagógicos e etapas definidas previamente.<br><br>
<strong>- O que é Crédito:</strong> Crédito é o valor pré-pago disponível para o aluno utilizar em voos ou aulas práticas. Funciona como um saldo: cada hora de voo consumida é debitada desse crédito. Ele pode estar dentro de um pacote, ser adquirido avulso ou sob outras condições previstas em contrato.<br><br>
<strong>- O que é Combustível:</strong> É o valor referente ao combustível usado em cada voo — não está incluso no preço da hora de voo. No modelo de contratação do Aeroclube de Juiz de Fora, o aluno paga à parte, com base no consumo real, conforme registrado no abastecimento e no diário de bordo.<br><br>
<strong>Atenção:</strong> Ter crédito não significa ter combustível incluso. São cobranças independentes e ambas precisam estar quitadas pra seguir voando.";

        $slug = 'aviso-informacoes-importantes-proposta';
        
        $item = [
            'post_title' => 'Aviso de Informações Importantes',
            'post_name' => $slug,
            'post_type' => 'componentes',
            'post_status' => 'publish',
            'post_content' => $content,
            'guid' => '15', // Html Code (conforme TipoConteudoSeeder)
            'config' => [
                'short_code' => $slug
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
