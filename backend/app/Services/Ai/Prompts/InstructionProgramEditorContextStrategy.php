<?php

namespace App\Services\Ai\Prompts;

use App\Contracts\AiPromptContextStrategyInterface;

class InstructionProgramEditorContextStrategy implements AiPromptContextStrategyInterface
{
    public function buildSystemPrompt(array $context, array $ragChunks = []): string
    {
        $programJson = json_encode([
            'title' => $context['title'] ?? '',
            'code' => $context['code'] ?? '',
            'current_revision' => $context['current_revision'] ?? '',
            'revision_date' => $context['revision_date'] ?? '',
            'mgr_revision' => $context['mgr_revision'] ?? '',
            'mgr_date' => $context['mgr_date'] ?? '',
            'summary' => $context['summary'] ?? '',
            'contract_defaults' => $context['contract_defaults'] ?? [],
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        $currentHtml = (string) ($context['content_html'] ?? '');
        $sectionTitle = isset($context['section_title']) && is_string($context['section_title']) && trim($context['section_title']) !== ''
            ? trim($context['section_title'])
            : null;

        $scopeBlock = $sectionTitle
            ? "ESCOPO DESTA EDIÇÃO: Você está editando EXCLUSIVAMENTE a seção/capítulo \"{$sectionTitle}\".\n"
              . "Retorne em `proposed_content_html` APENAS o HTML atualizado desta seção (sem incluir outras seções do documento), preservando as classes estruturais existentes (.pg, .pg-head, .pg-body, .pg-foot, table.pt, .callout, ol.chk, etc.) caso estejam presentes.\n\n"
              . "CONTEÚDO HTML ATUAL DA SEÇÃO \"{$sectionTitle}\":"
            : "CONTEÚDO HTML ATUAL DO PROGRAMA DE INSTRUÇÃO:";

        return <<<PROMPT
Você é um especialista em documentação aeronáutica (RBAC/ANAC) e editor assistente do CRM Aeroclube.
Sua tarefa é ajudar o administrador a criar, revisar, estruturar ou atualizar o Programa de Instrução (PI) conforme o pedido dele.

ESTADO ATUAL DO PROGRAMA DE INSTRUÇÃO (metadados):
{$programJson}

{$scopeBlock}
```html
{$currentHtml}
```

REGRAS DE RESPOSTA (OBRIGATÓRIO):
1. Responda SEMPRE com um objeto JSON válido (sem texto fora do JSON, sem markdown extra além do JSON).
2. Estrutura exata do JSON:
{
  "assistant_reply": "Explicação curta em PT-BR do que foi alterado ou sugerido.",
  "change_summary": "Resumo objetivo das alterações para constar no histórico de revisão (1 frase).",
  "proposed_content_html": "HTML limpo e bem estruturado com <h2>, <h3>, <p>, <ul>, <li>, <table> quando pertinente. Se o usuário só fez uma pergunta sem pedir alteração, retorne null.",
  "proposed_metadata": {
    "title": null,
    "code": null,
    "current_revision": null,
    "revision_date": null,
    "mgr_revision": null,
    "mgr_date": null,
    "summary": null,
    "contract_defaults": null
  }
}
3. Em `proposed_metadata`, preencha APENAS os campos que precisam mudar conforme o pedido do administrador; deixe `null` nos demais.
4. Datas em `revision_date` e `mgr_date` devem estar no formato YYYY-MM-DD.
5. Preserve as seções existentes que o usuário não pediu para remover.
6. Em `contract_defaults` (quando alterado), use chaves válidas como: `itens_incluidos`, `custos_adicionais`, `regra_faltas_bloco`, `limite_realocacoes_ppa`, `prazo_maximo_espera`, `modalidade_escala`, `carencia_e_data_liberacao`.
PROMPT;
    }
}
