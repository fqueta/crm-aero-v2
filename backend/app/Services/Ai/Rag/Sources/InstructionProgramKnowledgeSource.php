<?php

namespace App\Services\Ai\Rag\Sources;

use App\Contracts\KnowledgeSourceInterface;
use App\Models\InstructionProgram;

class InstructionProgramKnowledgeSource implements KnowledgeSourceInterface
{
    public function getSourceType(): string
    {
        return 'instruction_program';
    }

    public function extractDocuments(?int $sourceId = null): array
    {
        $query = InstructionProgram::query()->with('curso');
        if ($sourceId !== null) {
            $query->where('id', $sourceId);
        } else {
            $query->where('status', 'published');
        }

        $programs = $query->get();
        $docs = [];

        foreach ($programs as $program) {
            $metaHeader = $this->buildMetadataHeader($program);
            $content = $metaHeader . "\n" . (string) ($program->content_html ?? '');

            $docs[] = [
                'source_type' => $this->getSourceType(),
                'source_id' => (int) $program->id,
                'curso_id' => $program->curso_id ? (int) $program->curso_id : null,
                'title' => trim($program->title . ($program->code ? " ({$program->code})" : '')),
                'content' => $content,
                'format' => 'html',
                'is_public' => (bool) ($program->status === 'published' && $program->is_public),
                'metadata' => [
                    'slug' => $program->slug,
                    'code' => $program->code,
                    'revision' => $program->current_revision,
                    'revision_date' => $program->revision_date?->format('Y-m-d'),
                    'mgr_revision' => $program->mgr_revision,
                    'mgr_date' => $program->mgr_date?->format('Y-m-d'),
                    'curso_nome' => $program->curso?->nome,
                ],
            ];
        }

        return $docs;
    }

    protected function buildMetadataHeader(InstructionProgram $program): string
    {
        $lines = [
            '<h2>Identificação do Programa de Instrução</h2>',
            '<p>Programa: ' . e($program->title) . '</p>',
        ];
        if ($program->code) {
            $lines[] = '<p>Código / Identificação PI: ' . e($program->code) . '</p>';
        }
        if ($program->current_revision) {
            $revDate = $program->revision_date ? $program->revision_date->format('d/m/Y') : '';
            $lines[] = '<p>Revisão vigente do PI: ' . e($program->current_revision) . ($revDate ? " emitida em {$revDate}" : '') . '</p>';
        }
        if ($program->mgr_revision) {
            $mgrDate = $program->mgr_date ? $program->mgr_date->format('d/m/Y') : '';
            $lines[] = '<p>MGR disponibilizado: revisão ' . e($program->mgr_revision) . ($mgrDate ? " de {$mgrDate}" : '') . '</p>';
        }
        if ($program->summary) {
            $lines[] = '<p>Resumo: ' . e($program->summary) . '</p>';
        }
        if (is_array($program->contract_defaults) && !empty($program->contract_defaults)) {
            $lines[] = '<h3>Regras e Padrões Contratuais do Programa</h3>';
            foreach ($program->contract_defaults as $k => $v) {
                if (is_scalar($v) && trim((string) $v) !== '') {
                    $label = ucfirst(str_replace('_', ' ', (string) $k));
                    $lines[] = '<p>' . e($label) . ': ' . e((string) $v) . '</p>';
                }
            }
        }

        return implode("\n", $lines);
    }
}
