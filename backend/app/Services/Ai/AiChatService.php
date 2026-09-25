<?php

namespace App\Services\Ai;

use App\Models\EventLog;
use App\Services\Ai\Chat\AiChatProviderFactory;
use Exception;

class AiChatService
{
    /**
     * Responde uma mensagem do guia do sistema.
     * pt-BR: Sem cota (decisão do projeto) — registra EventLog best-effort.
     * Se o provedor preferido falhar na chamada, tenta o próximo configurado
     * (fallback em runtime). Se todos falharem, lança erro amigável em PT-BR.
     */
    public function chat(string $message, array $context, array $history = []): array
    {
        $userId = $context['userId'] ?? null;

        $providers = AiChatProviderFactory::configuredProviders();

        if (empty($providers)) {
            throw new Exception('Nenhum provedor de IA configurado. Cadastre a chave em Configurações > Integrações (OpenAI ou Gemini).');
        }

        $systemPrompt = $this->buildSystemPrompt($context);

        $lastError = null;
        foreach ($providers as $provider) {
            try {
                $result = $provider->chat($message, $systemPrompt, $history);

                try {
                    EventLog::create([
                        'entity_type' => 'ai_assistant',
                        'entity_id' => (string) ($userId ?? '0'),
                        'action' => 'ai_assistant_chat',
                        'description' => mb_substr($message, 0, 180),
                        'payload' => [
                            'provider' => $provider->getProviderSlug(),
                            'model' => $result['model'] ?? 'unknown',
                        ],
                        'actor_id' => (string) ($userId ?? '0'),
                        'ip_address' => request()->ip(),
                    ]);
                } catch (\Throwable $e) {
                }

                return [
                    'reply' => $result['reply'],
                    'actions' => $this->extractActions((string) ($result['reply'] ?? '')),
                    'provider' => $provider->getProviderSlug(),
                    'quota' => null,
                ];
            } catch (\Throwable $e) {
                $lastError = $e;
            }
        }

        throw new Exception($this->friendlyError($lastError));
    }

    /**
     * Converte erros técnicos dos provedores em mensagem curta PT-BR.
     * pt-BR: Evita vazar JSON cru da API no chat do widget.
     */
    protected function friendlyError(?\Throwable $e): string
    {
        $raw = $e ? strtolower($e->getMessage()) : '';

        if (str_contains($raw, 'api_key_invalid') || str_contains($raw, 'api key not valid') || str_contains($raw, 'invalid api key') || str_contains($raw, 'incorrect api key') || str_contains($raw, 'invalid_api_key')) {
            return 'A chave de API foi rejeitada pelo provedor de IA. Confira a chave em Configurações > Integrações.';
        }
        if (str_contains($raw, '503') || str_contains($raw, 'high demand') || str_contains($raw, 'unavailable') || str_contains($raw, 'temporarily unavailable')) {
            return 'Os servidores de IA estão com alta demanda temporária. Aguarde alguns instantes e tente novamente.';
        }
        if (str_contains($raw, '429') || str_contains($raw, 'quota') || str_contains($raw, 'rate limit') || str_contains($raw, 'resource_exhausted')) {
            return 'O provedor de IA atingiu o limite de uso. Aguarde alguns minutos e tente novamente.';
        }
        if (str_contains($raw, 'timed out') || str_contains($raw, 'timeout') || str_contains($raw, 'falha de comunicação')) {
            return 'Tempo esgotado ao falar com o provedor de IA. Tente novamente.';
        }
        if (str_contains($raw, 'model') && str_contains($raw, 'not found')) {
            return 'Modelo de IA indisponível no momento. Tente novamente.';
        }

        $fallback = $e ? trim(preg_replace('/\s+/', ' ', $e->getMessage())) : '';
        if (mb_strlen($fallback) > 200) {
            $fallback = mb_substr($fallback, 0, 200) . '…';
        }

        return 'Não foi possível obter resposta da IA. ' . ($fallback !== '' ? $fallback : 'Tente novamente.');
    }

    public function getSuggestions(string $currentRoute): array
    {
        $routePrefix = explode('?', $currentRoute)[0];

        $map = [
            '/admin/sales' => ['Como criar uma proposta?', 'Como mover um card de etapa no funil?', 'Onde vejo as cobranças Asaas da matrícula?'],
            '/admin/clients' => ['Como cadastrar um novo cliente?', 'Como ver o histórico de um cliente?', 'Como funciona a Consulta Geral (lupa)?'],
            '/admin/customers' => ['Como cadastrar um novo cliente?', 'Como converter um lead em cliente?'],
            '/admin/school/enroll' => ['Como criar uma matrícula?', 'Como gerar o contrato em PDF?', 'Como enviar a proposta para assinatura?'],
            '/admin/school/courses' => ['Como cadastrar um curso?', 'Quais páginas aparecem no PDF da proposta?'],
            '/admin/school/classes' => ['Como criar uma turma?', 'Como vincular alunos à turma?'],
            '/admin/school/termination' => ['Como lançar uma rescisão?', 'Como funciona o cálculo da multa de 30%?'],
            '/admin/school/contracts' => ['Como funcionam os shortcodes do contrato?', 'O que é a {tabela_parcelas}?'],
            '/admin/financial' => ['Como funcionam as cobranças Asaas?', 'Onde configuro multa e juros de mora?'],
            '/admin/reports' => ['Quais relatórios existem?', 'Como ver as horas voadas?'],
            '/admin/settings/integrations' => ['Como configurar a integração Asaas?', 'Como testar a conexão de uma integração?', 'Onde cadastro a chave da IA?'],
            '/admin/settings' => ['Como gerenciar usuários e permissões?', 'Como configurar o funil e as etapas?'],
        ];

        foreach ($map as $path => $suggestions) {
            if (strpos($routePrefix, $path) === 0) {
                return $suggestions;
            }
        }

        return ['Como criar uma proposta?', 'Onde vejo as cobranças Asaas?', 'Como gerar o contrato em PDF?', 'Como cadastrar um novo cliente?'];
    }

    protected function buildSystemPrompt(array $context): string
    {
        $currentRoute = $context['currentRoute'] ?? '/admin/';

        return <<<PROMPT
Você é o Assistente do CRM Aeroclube (escola de aviação).
Sua função é ajudar os usuários do sistema com dúvidas, sugerir ações e auxiliá-los na navegação.

Regras:
1. Responda sempre em Português do Brasil (PT-BR).
2. Seja conciso e direto.
3. Use links markdown [Texto do Link](/admin/rota/destino) para sugerir navegação para páginas do sistema.
4. Se o usuário perguntar sobre algo que você não sabe ou não encontrou, responda: "Não encontrei esse recurso no sistema. Tente a Consulta Geral (lupa no topo) ou o menu lateral."

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
  - Rescisões → /admin/school/termination
  - Ganhos → /admin/school/ganhos
  - Situações de matrícula → /admin/school/enrollment-situation
  - Controle de Formação (PNL) → /admin/school/formation-control
  - Períodos → /admin/school/periods
  - Contratos e termos (shortcodes, {tabela_parcelas}) → /admin/school/contracts
💰 Financeiro:
  - Contas → /admin/financial
  - Categorias → /admin/financial/categories
  - Cobranças Asaas da matrícula (ver/editar/excluir, multa e juros de mora) → na tela da proposta
📊 Relatórios:
  - Geral → /admin/reports/relatorio-geral
  - Vendas → /admin/reports/relatorio-vendas
  - Acessos → /admin/reports/relatorio-acessos
⚙️ Configurações:
  - Usuários → /admin/settings/users
  - Aeronaves → /admin/settings/aircrafts
  - Permissões → /admin/settings/permissions
  - Funil e etapas → /admin/settings/stages
  - Tabelas de preço → /admin/settings/table-price
  - Tabelas de parcelamento → /admin/settings/table-installment
  - Tabelas de desconto → /admin/settings/table-discount
  - Cupom de desconto → /admin/settings/cupom_desconto
  - Sistema (logo de e-mail, nome remetente) → /admin/settings/system
  - Integrações (Asaas, Brevo, ZapSign, ChatGuru, IA) → /admin/settings/integrations
  - Importação de dados legados → /admin/settings/import-data
  - Categorias → /admin/categories
  - Site (páginas e componentes) → /admin/site/paginas

Funções principais:
- O funil de Vendas acompanha matrículas por etapa; visualizar a proposta pública move a etapa só quando quem vê não é usuário do sistema.
- A proposta congela a Programação de Pagamento no aceite; o Asaas gera cobranças (entrada avulsa + restante parcelado) e o webhook dá baixa e ganho automáticos.
- O contrato usa shortcodes (ex.: {tabela_parcelas}, {nome_aluno}) editáveis em Contratos e termos.
- A rescisão calcula multa de 30%, taxa de matrícula, horas voadas e alojamento, com termo público assinável.
PROMPT;
    }

    protected function extractActions(string $reply): array
    {
        $actions = [];
        // Links markdown: [label](/route)
        if (preg_match_all('/\[([^\]]+)\]\(([^)]+)\)/', $reply, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                // Apenas rotas relativas internas
                if (strpos($match[2], '/') === 0) {
                    $actions[] = [
                        'label' => $match[1],
                        'route' => $match[2],
                    ];
                }
            }
        }
        return $actions;
    }
}
