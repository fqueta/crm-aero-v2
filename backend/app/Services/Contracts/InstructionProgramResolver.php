<?php

namespace App\Services\Contracts;

use App\Models\Curso;
use App\Models\InstructionProgram;
use App\Models\Matricula;
use App\Models\Post;
use App\Services\Qlib;
use Illuminate\Support\Facades\Schema;

/**
 * Resolve o Programa de Instrução (PI) aplicável a uma matrícula, período ou contexto contratual.
 * Para cursos do tipo 4 (divididos por períodos), prioriza o PI vinculado ao período selecionado
 * (inclusive quando reaproveitado de outro curso) antes do fallback no curso principal.
 */
class InstructionProgramResolver
{
    public const VALID_OVERRIDES = ['default', 'show', 'show_and_require', 'hide'];

    /**
     * Extrai o ID do período a partir do JSON/array `orc` da matrícula (orc.modulos[0].id).
     */
    public function extractPeriodId(mixed $orc): ?int
    {
        if (is_string($orc) && trim($orc) !== '') {
            $decoded = json_decode($orc, true);
            $orc = is_array($decoded) ? $decoded : null;
        }

        if (!is_array($orc) || empty($orc['modulos']) || !is_array($orc['modulos'])) {
            return null;
        }

        $firstModule = reset($orc['modulos']);
        if (!is_array($firstModule)) {
            return null;
        }

        $rawId = $firstModule['id'] ?? null;
        if (is_numeric($rawId) && (int) $rawId > 0) {
            return (int) $rawId;
        }

        return null;
    }

    /**
     * Carrega o post do período pelo ID.
     */
    public function findPeriod(int $periodId): ?Post
    {
        if ($periodId <= 0) {
            return null;
        }

        return Post::query()->ofType('periodos')->find($periodId);
    }

    /**
     * Serializa um resumo leve do Programa de Instrução para listagens de períodos e cursos.
     */
    public function hydrateSummary(?InstructionProgram $pi): ?array
    {
        if (!$pi) {
            return null;
        }

        if (!$pi->relationLoaded('curso') && $pi->curso_id) {
            $pi->load('curso:id,nome');
        }

        return [
            'id' => (int) $pi->id,
            'title' => (string) $pi->title,
            'code' => $pi->code ? (string) $pi->code : null,
            'slug' => (string) $pi->slug,
            'current_revision' => (string) ($pi->current_revision ?: '001'),
            'revision_date' => $pi->revision_date?->format('Y-m-d'),
            'status' => (string) $pi->status,
            'is_public' => (bool) $pi->is_public,
            'curso_id' => $pi->curso_id ? (int) $pi->curso_id : null,
            'curso_nome' => $pi->curso?->nome ? (string) $pi->curso->nome : null,
        ];
    }

    /**
     * Resolve o modelo InstructionProgram publicado para geração/injeção de shortcodes em contratos.
     */
    public function resolveProgramForContractContext(array $dm): ?InstructionProgram
    {
        try {
            if (!Schema::hasTable('instruction_programs')) {
                return null;
            }
        } catch (\Throwable $e) {
            return null;
        }

        $cursoId = (int) ($dm['id_curso'] ?? 0);
        if ($cursoId <= 0) {
            return null;
        }

        $isTipo4 = isset($dm['curso_tipo']) && (string) $dm['curso_tipo'] === '4';
        if (!isset($dm['curso_tipo'])) {
            $curso = Curso::find($cursoId);
            $isTipo4 = $curso && (string) ($curso->tipo ?? '') === '4';
        }

        $periodId = $this->extractPeriodId($dm['orc'] ?? null);
        if ($isTipo4 && $periodId) {
            $period = $this->findPeriod($periodId);
            $periodConfig = is_array($period?->config) ? $period->config : [];
            $piId = (int) ($periodConfig['instruction_program_id'] ?? 0);

            if ($piId > 0) {
                $periodPi = InstructionProgram::query()
                    ->where('id', $piId)
                    ->where('status', 'published')
                    ->first();

                if ($periodPi) {
                    return $periodPi;
                }
            }
        }

        return InstructionProgram::query()
            ->where('curso_id', $cursoId)
            ->where('status', 'published')
            ->orderByDesc('revision_date')
            ->orderByDesc('id')
            ->first();
    }

    /**
     * Resolve o contexto completo de PI + regras de exibição/aceite para uma matrícula (proposta/assinatura).
     */
    public function resolveForMatricula(Matricula $matricula, bool $forPublicSignature = true): ?array
    {
        try {
            if (!Schema::hasTable('instruction_programs')) {
                return null;
            }

            $cursoId = (int) ($matricula->id_curso ?? 0);
            if ($cursoId <= 0) {
                return null;
            }

            $curso = Curso::find($cursoId);
            if (!$curso) {
                return null;
            }

            $cursoConfig = is_array($curso->config)
                ? $curso->config
                : (is_string($curso->config) ? (json_decode($curso->config, true) ?? []) : []);

            $isTipo4 = (string) ($curso->tipo ?? '') === '4';
            $periodId = $this->extractPeriodId($matricula->orc ?? null);
            $period = ($isTipo4 && $periodId) ? $this->findPeriod($periodId) : null;
            $periodConfig = is_array($period?->config) ? $period->config : [];

            $pi = null;
            if ($isTipo4 && $period && !empty($periodConfig['instruction_program_id'])) {
                $piQuery = InstructionProgram::query()
                    ->where('id', (int) $periodConfig['instruction_program_id'])
                    ->where('status', 'published');
                if ($forPublicSignature) {
                    $piQuery->where('is_public', true);
                }
                $pi = $piQuery->first();
            }

            if (!$pi) {
                $coursePiQuery = InstructionProgram::query()
                    ->where('curso_id', $cursoId)
                    ->where('status', 'published');
                if ($forPublicSignature) {
                    $coursePiQuery->where('is_public', true);
                }
                $pi = $coursePiQuery->orderByDesc('id')->first();
            }

            // Determina flags base (período sobrescreve curso quando configurado no período)
            if (
                $isTipo4 &&
                $period &&
                (
                    array_key_exists('signature_show_pi_link', $periodConfig) ||
                    array_key_exists('signature_require_pi_acceptance', $periodConfig)
                )
            ) {
                $showInSignature = !empty($periodConfig['signature_show_pi_link']);
                $requireAcceptance = !empty($periodConfig['signature_require_pi_acceptance']);
            } else {
                $showInSignature = !empty($cursoConfig['signature_show_pi_link']);
                $requireAcceptance = !empty($cursoConfig['signature_require_pi_acceptance']);
            }

            // Aplica override específico da proposta/contrato (se definido na matrícula)
            $rawOverride = trim((string) Qlib::get_matriculameta($matricula->id, 'pi_signature_override'));
            $override = in_array($rawOverride, self::VALID_OVERRIDES, true) ? $rawOverride : 'default';

            if ($override === 'hide') {
                $showInSignature = false;
                $requireAcceptance = false;
            } elseif ($override === 'show') {
                $showInSignature = true;
                $requireAcceptance = false;
            } elseif ($override === 'show_and_require') {
                $showInSignature = true;
                $requireAcceptance = true;
            }

            if ($requireAcceptance) {
                $showInSignature = true;
            }

            if ($forPublicSignature && ((!$showInSignature && !$requireAcceptance) || !$pi)) {
                return null;
            }

            if (!$pi) {
                return null;
            }

            return [
                'id' => (int) $pi->id,
                'title' => (string) $pi->title,
                'code' => $pi->code ? (string) $pi->code : null,
                'slug' => (string) $pi->slug,
                'current_revision' => (string) ($pi->current_revision ?: '001'),
                'revision_date' => $pi->revision_date?->format('Y-m-d'),
                'show_in_signature' => $showInSignature,
                'require_acceptance' => $requireAcceptance,
                'period_id' => $period ? (int) $period->ID : null,
                'period_name' => $period ? (string) $period->post_title : null,
                'reused_from_course_id' => ($pi->curso_id && (int) $pi->curso_id !== $cursoId) ? (int) $pi->curso_id : null,
            ];
        } catch (\Throwable $e) {
            return null;
        }
    }
}
