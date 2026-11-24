<?php

namespace App\Services\Ai;

use App\Contracts\AiPromptContextStrategyInterface;
use App\Models\InstructionProgram;
use App\Services\Ai\Chat\AiChatProviderFactory;
use App\Services\Ai\Prompts\InstructionProgramEditorContextStrategy;
use Exception;

class InstructionProgramAiEditorService
{
    protected AiPromptContextStrategyInterface $promptStrategy;

    public function __construct(?AiPromptContextStrategyInterface $promptStrategy = null)
    {
        $this->promptStrategy = $promptStrategy ?? new InstructionProgramEditorContextStrategy();
    }

    /**
     * Gera uma proposta estruturada de edição do Programa de Instrução via IA.
     *
     * @param  array<int, array{role: string, content: string}>  $history
     * @param  array<string, mixed>                              $draftOverrides
     * @return array<string, mixed>
     */
    public function proposeEdit(
        InstructionProgram $program,
        string $instruction,
        array $history = [],
        array $draftOverrides = []
    ): array {
        $providers = AiChatProviderFactory::configuredProviders();
        if (empty($providers)) {
            throw new Exception('Nenhum provedor de IA configurado. Cadastre a chave em Configurações > Integrações (OpenAI ou Gemini).');
        }

        $context = [
            'title' => $draftOverrides['title'] ?? $program->title,
            'code' => $draftOverrides['code'] ?? $program->code,
            'current_revision' => $draftOverrides['current_revision'] ?? $program->current_revision,
            'revision_date' => $draftOverrides['revision_date'] ?? $program->revision_date?->format('Y-m-d'),
            'mgr_revision' => $draftOverrides['mgr_revision'] ?? $program->mgr_revision,
            'mgr_date' => $draftOverrides['mgr_date'] ?? $program->mgr_date?->format('Y-m-d'),
            'summary' => $draftOverrides['summary'] ?? $program->summary,
            'content_html' => $draftOverrides['content_html'] ?? $program->content_html,
            'section_title' => $draftOverrides['section_title'] ?? null,
            'contract_defaults' => $draftOverrides['contract_defaults'] ?? ($program->contract_defaults ?? []),
        ];

        $systemPrompt = $this->promptStrategy->buildSystemPrompt($context);

        $lastError = null;
        foreach ($providers as $provider) {
            try {
                \Illuminate\Support\Facades\Log::info('InstructionProgramAiEditor: tentando provider ' . $provider->getProviderSlug());
                $result = $provider->chat($instruction, $systemPrompt, $history, ['temperature' => 0.35]);
                $parsed = $this->parseJsonResponse((string) ($result['reply'] ?? ''));

                return [
                    'assistant_reply' => $parsed['assistant_reply'],
                    'change_summary' => $parsed['change_summary'],
                    'proposed_content_html' => $parsed['proposed_content_html'],
                    'proposed_metadata' => $parsed['proposed_metadata'],
                    'provider' => $provider->getProviderSlug(),
                    'model' => $result['model'] ?? 'unknown',
                ];
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('InstructionProgramAiEditor: provider ' . $provider->getProviderSlug() . ' falhou: ' . $e->getMessage());
                $lastError = $e;
            }
        }

        $msg = $lastError ? $lastError->getMessage() : 'erro desconhecido';

        if (
            str_contains($msg, 'credit_balance_exhausted') ||
            str_contains($msg, 'insufficient_quota') ||
            str_contains($msg, 'RESOURCE_EXHAUSTED') ||
            str_contains($msg, 'Quota exceeded') ||
            str_contains($msg, 'rate-limits')
        ) {
            throw new Exception('Os créditos ou cotas de Inteligência Artificial estão esgotados no momento. Por favor, recarregue seus créditos para continuar utilizando o assistente.');
        }

        throw new Exception('Não foi possível gerar a edição com IA: ' . $msg);
    }

    /**
     * Faz parsing tolerante do JSON retornado pela IA (remove cercas ```json se existirem).
     *
     * @return array<string, mixed>
     */
    protected function parseJsonResponse(string $raw): array
    {
        $clean = trim($raw);
        if (preg_match('/```(?:json)?\s*(\{.*\})\s*```/is', $clean, $m)) {
            $clean = $m[1];
        } elseif (($start = strpos($clean, '{')) !== false && ($end = strrpos($clean, '}')) !== false && $end > $start) {
            $clean = substr($clean, $start, $end - $start + 1);
        }

        $decoded = json_decode($clean, true);
        if (!is_array($decoded)) {
            return [
                'assistant_reply' => $raw,
                'change_summary' => null,
                'proposed_content_html' => null,
                'proposed_metadata' => null,
            ];
        }

        $meta = is_array($decoded['proposed_metadata'] ?? null)
            ? array_filter($decoded['proposed_metadata'], fn ($v) => $v !== null)
            : null;

        return [
            'assistant_reply' => (string) ($decoded['assistant_reply'] ?? 'Sugestão gerada com sucesso.'),
            'change_summary' => isset($decoded['change_summary']) ? (string) $decoded['change_summary'] : null,
            'proposed_content_html' => isset($decoded['proposed_content_html']) && is_string($decoded['proposed_content_html'])
                ? $decoded['proposed_content_html']
                : null,
            'proposed_metadata' => !empty($meta) ? $meta : null,
        ];
    }
}
