<?php

namespace App\Services\Contracts\Strategies;

use App\Contracts\ContractShortcodeResolverInterface;

class InstitutionalRulesShortcodeStrategy implements ContractShortcodeResolverInterface
{
    public const KEYS = [
        'revisao_mgr',
        'data_mgr',
        'identificacao_tabela_e_criterios',
        'data_base_tarifa',
        'itens_incluidos',
        'custos_adicionais',
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

    public function resolve(array $dm, array $context): array
    {
        $defaults = is_array($context['institutional'] ?? null) ? $context['institutional'] : [];
        $out = [];

        foreach (self::KEYS as $key) {
            $val = $defaults[$key] ?? '';
            if (is_scalar($val) && trim((string) $val) !== '') {
                $out[$key] = $key === 'data_mgr' || $key === 'data_base_tarifa'
                    ? $this->formatDateIfIso((string) $val)
                    : trim((string) $val);
            }
        }

        // Fallback automático de juros_e_correcao a partir da config Asaas se não preenchido
        if (empty($out['juros_e_correcao']) && !empty($context['asaas_fine_interest'])) {
            $out['juros_e_correcao'] = (string) $context['asaas_fine_interest'];
        }

        return $out;
    }

    protected function formatDateIfIso(string $value): string
    {
        $v = trim($value);
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $v)) {
            $ts = strtotime($v);
            if ($ts !== false) {
                return date('d/m/Y', $ts);
            }
        }

        return $v;
    }
}
