<?php

namespace App\Services\Contracts;

use App\Contracts\ContractShortcodeResolverInterface;
use App\Models\InstructionProgram;
use App\Models\Turma;
use App\Services\Ai\Rag\Sources\InstitutionalRulesKnowledgeSource;
use App\Services\Contracts\Strategies\InstitutionalRulesShortcodeStrategy;
use App\Services\Contracts\Strategies\InstructionProgramShortcodeStrategy;
use App\Services\Contracts\Strategies\ProposalTariffShortcodeStrategy;
use App\Services\Contracts\Strategies\TurmaShortcodeStrategy;
use App\Services\Qlib;
use Illuminate\Support\Facades\Schema;

class ContractContextFacade
{
    public const ALL_SHORTCODES = [
        'identificacao_turma',
        'inicio_turma',
        'primeira_chamada_elegivel',
        'inicio_uso_credito',
        'fim_vigencia',
        'identificacao_pi',
        'revisao_pi',
        'data_pi',
        'revisao_mgr',
        'data_mgr',
        'identificacao_proposta',
        'data_proposta',
        'modelo_aeronave',
        'valor_credito_voo',
        'tarifa_referencia',
        'horas_estimadas',
        'identificacao_tabela_e_criterios',
        'data_base_tarifa',
        'itens_incluidos',
        'custos_adicionais',
        'modalidade_pagamento',
        'juros_e_correcao',
        'modalidade_escala',
        'carencia_e_data_liberacao',
        'prazo_maximo_espera',
        'regra_faltas_bloco',
        'canal_escala',
        'canal_secretaria',
        'canal_qualidade',
        'canal_privacidade',
        'limite_realocacoes_ppa',
    ];

    /** @var ContractShortcodeResolverInterface[] */
    protected array $strategies;

    /**
     * @param ContractShortcodeResolverInterface[]|null $strategies
     */
    public function __construct(?array $strategies = null)
    {
        // Ordem crescente de especificidade: o último não-vazio prevalece
        $this->strategies = $strategies ?? [
            new InstitutionalRulesShortcodeStrategy(),
            new InstructionProgramShortcodeStrategy(),
            new TurmaShortcodeStrategy(),
            new ProposalTariffShortcodeStrategy(),
        ];
    }

    /**
     * Resolve todos os shortcodes do Quadro da Contratação para um array $dm.
     * Se $context for passado, opera de forma pura (ideal para testes sem DB).
     *
     * @param  array<string, mixed>      $dm
     * @param  array<string, mixed>|null $context
     * @return array<string, string>
     */
    public function resolve(array $dm, ?array $context = null): array
    {
        $resolvedContext = $context ?? $this->loadContextFromDatabase($dm);

        $merged = array_fill_keys(self::ALL_SHORTCODES, '');

        foreach ($this->strategies as $strategy) {
            $values = $strategy->resolve($dm, $resolvedContext);
            foreach ($values as $key => $value) {
                if (is_scalar($value) && trim((string) $value) !== '') {
                    $merged[$key] = trim((string) $value);
                }
            }
        }

        return $merged;
    }

    /**
     * Injeta os shortcodes resolvidos diretamente no array $dm sem sobrescrever chaves existentes não-vazias.
     *
     * @param  array<string, mixed>      $dm
     * @param  array<string, mixed>|null $context
     * @return array<string, mixed>
     */
    public function inject(array $dm, ?array $context = null): array
    {
        $shortcodes = $this->resolve($dm, $context);

        foreach ($shortcodes as $key => $val) {
            if (!isset($dm[$key]) || trim((string) $dm[$key]) === '') {
                $dm[$key] = $val;
            }
        }

        return $dm;
    }

    /**
     * Carrega institucional, Programa de Instrução vigente do curso e Turma do banco tenant.
     *
     * @return array<string, mixed>
     */
    protected function loadContextFromDatabase(array $dm): array
    {
        $institutional = [];
        try {
            $raw = Qlib::qoption(InstitutionalRulesKnowledgeSource::OPTION_KEY);
            $decoded = is_array($raw) ? $raw : (is_string($raw) ? json_decode($raw, true) : []);
            if (is_array($decoded)) {
                $institutional = $decoded;
            }
        } catch (\Throwable $e) {
        }

        $program = null;
        $cursoId = $dm['id_curso'] ?? null;
        if ($cursoId) {
            try {
                if (Schema::hasTable('instruction_programs')) {
                    $program = InstructionProgram::query()
                        ->where('curso_id', (int) $cursoId)
                        ->where('status', 'published')
                        ->orderByDesc('revision_date')
                        ->orderByDesc('id')
                        ->first();
                }
            } catch (\Throwable $e) {
            }
        }

        $turma = null;
        $turmaId = $dm['id_turma'] ?? null;
        if ($turmaId && is_numeric($turmaId)) {
            try {
                $turma = Turma::find((int) $turmaId);
            } catch (\Throwable $e) {
            }
        }

        return [
            'institutional' => $institutional,
            'instruction_program' => $program,
            'turma' => $turma,
        ];
    }
}
