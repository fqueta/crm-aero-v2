<?php

namespace App\Services\Ai;

use App\Contracts\AiPromptContextStrategyInterface;
use App\Models\EventLog;
use App\Models\InstructionProgram;
use App\Services\Ai\Chat\AiChatProviderFactory;
use App\Services\Ai\Prompts\AdminAssistantContextStrategy;
use App\Services\Ai\Prompts\PublicInstructionProgramContextStrategy;
use App\Services\Ai\Rag\RagRetrieverService;
use Exception;

class AiChatService
{
    protected RagRetrieverService $ragRetriever;

    protected AiPromptContextStrategyInterface $adminPromptStrategy;

    protected AiPromptContextStrategyInterface $publicProgramPromptStrategy;

    public function __construct(
        ?RagRetrieverService $ragRetriever = null,
        ?AiPromptContextStrategyInterface $adminPromptStrategy = null,
        ?AiPromptContextStrategyInterface $publicProgramPromptStrategy = null
    ) {
        $this->ragRetriever = $ragRetriever ?? new RagRetrieverService();
        $this->adminPromptStrategy = $adminPromptStrategy ?? new AdminAssistantContextStrategy();
        $this->publicProgramPromptStrategy = $publicProgramPromptStrategy ?? new PublicInstructionProgramContextStrategy();
    }

    /**
     * Responde uma mensagem do guia do sistema (admin), enriquecida com RAG.
     */
    public function chat(string $message, array $context, array $history = []): array
    {
        $userId = $context['userId'] ?? null;

        $providers = AiChatProviderFactory::configuredProviders();

        if (empty($providers)) {
            throw new Exception('Nenhum provedor de IA configurado. Cadastre a chave em Configurações > Integrações (OpenAI ou Gemini).');
        }

        $ragChunks = [];
        try {
            $ragChunks = $this->ragRetriever->search($message, [
                'publicOnly' => false,
                'limit' => 5,
            ]);
        } catch (\Throwable $e) {
        }

        $systemPrompt = $this->adminPromptStrategy->buildSystemPrompt($context, $ragChunks);

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
                            'rag_hits' => count($ragChunks),
                        ],
                        'actor_id' => (string) ($userId ?? '0'),
                        'ip_address' => request()->ip(),
                    ]);
                } catch (\Throwable $e) {
                }

                return [
                    'reply' => $result['reply'],
                    'actions' => $this->extractActions((string) ($result['reply'] ?? '')),
                    'sources' => $this->formatSources($ragChunks),
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
     * Responde perguntas públicas na página do Programa de Instrução usando RAG restrito ao escopo público.
     */
    public function publicProgramChat(InstructionProgram $program, string $message, array $history = []): array
    {
        $providers = AiChatProviderFactory::configuredProviders();

        if (empty($providers)) {
            throw new Exception('Assistente virtual temporariamente indisponível.');
        }

        $ragChunks = [];
        try {
            $ragChunks = $this->ragRetriever->search($message, [
                'publicOnly' => true,
                'instructionProgramId' => (int) $program->id,
                'limit' => 6,
            ]);
        } catch (\Throwable $e) {
        }

        // Fallback seguro caso o PI ainda não tenha sido indexado em chunks
        if (empty($ragChunks) && !empty($program->content_html)) {
            $ragChunks = [[
                'title' => $program->title,
                'section_title' => 'Conteúdo publicado',
                'content' => mb_substr(trim(strip_tags((string) $program->content_html)), 0, 4000),
                'metadata' => ['revision' => $program->current_revision, 'slug' => $program->slug],
            ]];
        }

        $systemPrompt = $this->publicProgramPromptStrategy->buildSystemPrompt([
            'programTitle' => $program->title,
            'programCode' => $program->code,
            'revision' => $program->current_revision,
            'revisionDate' => $program->revision_date?->format('d/m/Y'),
        ], $ragChunks);

        $lastError = null;
        foreach ($providers as $provider) {
            try {
                $result = $provider->chat($message, $systemPrompt, $history, ['temperature' => 0.3]);

                return [
                    'reply' => $result['reply'],
                    'sources' => $this->formatSources($ragChunks),
                    'provider' => $provider->getProviderSlug(),
                ];
            } catch (\Throwable $e) {
                $lastError = $e;
            }
        }

        throw new Exception($this->friendlyError($lastError));
    }

    protected function formatSources(array $ragChunks): array
    {
        $sources = [];
        foreach ($ragChunks as $chunk) {
            $sources[] = [
                'title' => $chunk['title'] ?? 'Documento',
                'section' => $chunk['section_title'] ?? null,
                'revision' => $chunk['metadata']['revision'] ?? null,
                'score' => $chunk['score'] ?? null,
            ];
        }

        return $sources;
    }

    /**
     * Converte erros técnicos dos provedores em mensagem curta PT-BR.
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
            '/admin/school/instruction-programs' => ['Como publicar uma nova revisão do PI?', 'Como editar o Programa de Instrução com IA?', 'Quais shortcodes do PI vão para o contrato?'],
            '/admin/school/termination' => ['Como lançar uma rescisão?', 'Como funciona o cálculo da multa de 30%?'],
            '/admin/school/contracts' => ['Como funcionam os shortcodes do contrato?', 'O que é a {tabela_parcelas}?', 'De onde vêm {identificacao_pi} e {revisao_pi}?'],
            '/admin/financial' => ['Como funcionam as cobranças Asaas?', 'Onde configuro multa e juros de mora?'],
            '/admin/reports' => ['Quais relatórios existem?', 'Como ver as horas voadas?'],
            '/admin/settings/integrations' => ['Como configurar a integração Asaas?', 'Como testar a conexão de uma integração?', 'Onde cadastro a chave da IA?'],
            '/admin/settings' => ['Como gerenciar usuários e permissões?', 'Onde configuro os canais oficiais e MGR padrão dos contratos?'],
        ];

        foreach ($map as $path => $suggestions) {
            if (strpos($routePrefix, $path) === 0) {
                return $suggestions;
            }
        }

        return ['Como criar uma proposta?', 'Qual a revisão vigente do Programa de Instrução?', 'Como gerar o contrato em PDF?', 'Onde configuro os canais oficiais dos contratos?'];
    }

    protected function extractActions(string $reply): array
    {
        $actions = [];
        if (preg_match_all('/\[([^\]]+)\]\(([^)]+)\)/', $reply, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
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
