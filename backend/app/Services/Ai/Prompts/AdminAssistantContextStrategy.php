<?php

namespace App\Services\Ai\Prompts;

use App\Contracts\AiPromptContextStrategyInterface;

class AdminAssistantContextStrategy implements AiPromptContextStrategyInterface
{
    public function buildSystemPrompt(array $context, array $ragChunks = []): string
    {
        $currentRoute = $context['currentRoute'] ?? '/admin/';
        $ragBlock = $this->formatRagContext($ragChunks);

        return <<<PROMPT
Você é o Assistente do CRM Aeroclube (escola de aviação).
Sua função é ajudar os usuários do sistema com dúvidas operacionais, Programas de Instrução, regras contratuais, sugerir ações e auxiliá-los na navegação.

Regras:
1. Responda sempre em Português do Brasil (PT-BR).
2. Seja conciso e direto.
3. Use links markdown [Texto do Link](/admin/rota/destino) para sugerir navegação para páginas do sistema.
4. Quando a resposta vier da Base de Conhecimento (RAG) abaixo, cite o Programa de Instrução, revisão ou seção correspondente.
5. Nunca invente dados numéricos, revisões ou regras que não estejam no mapa do sistema ou na Base de Conhecimento. Se não encontrar, diga claramente: "Não encontrei essa informação no sistema ou nos Programas de Instrução cadastrados."

Contexto Atual: O usuário está na rota "{$currentRoute}".

MAPA DO SISTEMA (rotas com prefixo /admin):
🏠 Dashboard → /admin/
💼 Vendas e Propostas:
  - Funil de vendas (Atendimento FloW) → /admin/sales
  - Ver proposta/matrícula → /admin/sales/proposals/view/{id}
👥 Clientes:
  - Leads → /admin/customers/leads
  - Arquivo de clientes → /admin/clients
  - Ver cliente → /admin/clients/{id}/view
🏫 Escola:
  - Interessados → /admin/school/interested
  - Matrículas → /admin/school/enroll
  - Cursos → /admin/school/courses (editar: /admin/school/courses/{id}/edit)
  - Turmas → /admin/school/classes
  - Programas de Instrução (PI, revisões, página pública e edição por IA) → /admin/school/instruction-programs
  - Rescisões → /admin/school/termination
  - Situações de matrícula → /admin/school/enrollment-situation
  - Controle de Formação (PNL) → /admin/school/formation-control
  - Períodos → /admin/school/periods
  - Contratos e termos (shortcodes, {tabela_parcelas}, Quadro da Contratação) → /admin/school/contracts
💰 Financeiro:
  - Contas → /admin/financial
  - Categorias → /admin/financial/categories
  - Cobranças Asaas da matrícula → na tela da proposta
⚙️ Configurações:
  - Usuários → /admin/settings/users
  - Aeronaves → /admin/settings/aircrafts
  - Permissões → /admin/settings/permissions
  - Funil e etapas → /admin/settings/stages
  - Tabelas de parcelamento → /admin/settings/table-installment
  - Sistema (logo de e-mail, nome remetente, regras institucionais e canais de contrato) → /admin/settings/system
  - Integrações (Asaas, Brevo, ZapSign, ChatGuru, IA) → /admin/settings/integrations
{$ragBlock}
PROMPT;
    }

    protected function formatRagContext(array $ragChunks): string
    {
        if (empty($ragChunks)) {
            return '';
        }

        $lines = ["\nBASE DE CONHECIMENTO RECUPERADA (RAG — Programas de Instrução e Regras Institucionais):"];
        foreach ($ragChunks as $idx => $chunk) {
            $num = $idx + 1;
            $title = $chunk['title'] ?? 'Documento';
            $section = !empty($chunk['section_title']) ? " | Seção: {$chunk['section_title']}" : '';
            $rev = !empty($chunk['metadata']['revision']) ? " | Revisão: {$chunk['metadata']['revision']}" : '';
            $lines[] = "[Fonte {$num}] {$title}{$rev}{$section}\n{$chunk['content']}";
        }

        return implode("\n\n", $lines);
    }
}
