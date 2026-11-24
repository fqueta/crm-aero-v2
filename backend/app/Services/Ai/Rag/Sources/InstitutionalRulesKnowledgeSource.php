<?php

namespace App\Services\Ai\Rag\Sources;

use App\Contracts\KnowledgeSourceInterface;
use App\Services\Qlib;

class InstitutionalRulesKnowledgeSource implements KnowledgeSourceInterface
{
    public const OPTION_KEY = 'contract_institutional_defaults';

    public function getSourceType(): string
    {
        return 'institutional_rules';
    }

    public function extractDocuments(?int $sourceId = null): array
    {
        $raw = Qlib::qoption(self::OPTION_KEY);
        $data = is_array($raw) ? $raw : (is_string($raw) ? json_decode($raw, true) : []);
        if (!is_array($data) || empty($data)) {
            return [];
        }

        $labels = [
            'revisao_mgr' => 'Revisão padrão do MGR',
            'data_mgr' => 'Data do MGR',
            'identificacao_tabela_e_criterios' => 'Tabela de tarifas-base e critérios',
            'data_base_tarifa' => 'Data-base da tarifa',
            'itens_incluidos' => 'Itens incluídos padrão',
            'custos_adicionais' => 'Custos adicionais (cheque, examinador, taxas, simulador, materiais)',
            'juros_e_correcao' => 'Juros e correção por atraso',
            'modalidade_escala' => 'Modalidade de escala padrão (DDS/FDS)',
            'carencia_e_data_liberacao' => 'Carência e liberação padrão',
            'prazo_maximo_espera' => 'Prioridade contratual por prazo máximo de espera',
            'regra_faltas_bloco' => 'Regra disciplinar por faltas no bloco',
            'canal_escala' => 'Canal oficial de escala',
            'canal_secretaria' => 'Canal da Secretaria',
            'canal_qualidade' => 'Canal do Gestor da Qualidade',
            'canal_privacidade' => 'Canal de privacidade (LGPD)',
            'limite_realocacoes_ppa' => 'Limite de realocações por turma',
        ];

        $lines = [];
        foreach ($labels as $key => $label) {
            if (!empty($data[$key])) {
                $lines[] = "{$label}: {$data[$key]}";
            }
        }

        if (empty($lines)) {
            return [];
        }

        return [[
            'source_type' => $this->getSourceType(),
            'source_id' => 1,
            'curso_id' => null,
            'title' => 'Regras Institucionais, Escala e Canais Oficiais',
            'content' => implode("\n\n", $lines),
            'format' => 'text',
            'is_public' => true,
            'metadata' => [
                'option_key' => self::OPTION_KEY,
            ],
        ]];
    }
}
