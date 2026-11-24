<?php

namespace App\Services\Ai\Prompts;

use App\Contracts\AiPromptContextStrategyInterface;

class PublicInstructionProgramContextStrategy implements AiPromptContextStrategyInterface
{
    public function buildSystemPrompt(array $context, array $ragChunks = []): string
    {
        $programTitle = $context['programTitle'] ?? 'Programa de Instrução';
        $programCode = $context['programCode'] ?? '';
        $revision = $context['revision'] ?? '';
        $revisionDate = $context['revisionDate'] ?? '';

        $ragBlock = '';
        if (!empty($ragChunks)) {
            $lines = ["TRECHOS OFICIAIS RECUPERADOS DO PROGRAMA DE INSTRUÇÃO E REGRAS PÚBLICAS:"];
            foreach ($ragChunks as $idx => $chunk) {
                $num = $idx + 1;
                $section = !empty($chunk['section_title']) ? " — Seção: {$chunk['section_title']}" : '';
                $lines[] = "[Trecho {$num}] {$chunk['title']}{$section}\n{$chunk['content']}";
            }
            $ragBlock = "\n\n" . implode("\n\n", $lines);
        } else {
            $ragBlock = "\n\n(Nenhum trecho específico encontrado na base pública para esta pergunta.)";
        }

        $headerInfo = trim("{$programTitle}" . ($programCode ? " ({$programCode})" : '') . ($revision ? " — Revisão {$revision}" : '') . ($revisionDate ? " ({$revisionDate})" : ''));

        return <<<PROMPT
Você é o Assistente Virtual oficial da escola de aviação para dúvidas sobre o Programa de Instrução "{$headerInfo}".

Regras obrigatórias:
1. Responda sempre em Português do Brasil (PT-BR), com clareza, cordialidade e precisão técnica.
2. Baseie suas respostas EXCLUSIVAMENTE nos trechos oficiais fornecidos abaixo.
3. Sempre que possível, mencione a seção ou revisão do Programa de Instrução de onde veio a informação.
4. NUNCA invente valores, prazos, revisões, regras de escala ou requisitos ANAC que não estejam nos trechos fornecidos.
5. NUNCA divulgue dados internos, rotas administrativas (/admin), informações de outros alunos ou dados confidenciais.
6. Se a pergunta não estiver respondida nos trechos oficiais, diga educadamente que essa informação não consta na revisão publicada e oriente o aluno a consultar a Secretaria pelos canais oficiais (se informados nos trechos).
{$ragBlock}
PROMPT;
    }
}
