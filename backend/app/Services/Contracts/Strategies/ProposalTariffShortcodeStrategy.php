<?php

namespace App\Services\Contracts\Strategies;

use App\Contracts\ContractShortcodeResolverInterface;

class ProposalTariffShortcodeStrategy implements ContractShortcodeResolverInterface
{
    public function resolve(array $dm, array $context): array
    {
        $out = [];

        // Identificação e data da proposta
        $id = $dm['id'] ?? $dm['id_matricula'] ?? null;
        if ($id) {
            $out['identificacao_proposta'] = 'Proposta #' . $id;
        }
        $dataProp = $dm['data'] ?? $dm['created_at'] ?? null;
        if ($dataProp) {
            $out['data_proposta'] = $this->formatDate((string) $dataProp);
        }

        // Modalidade de pagamento (reaproveita forma_pagamento ou infere à vista/parcelado)
        if (!empty($dm['forma_pagamento'])) {
            $out['modalidade_pagamento'] = trim((string) $dm['forma_pagamento']);
        } else {
            $qtd = (int) ($dm['qtd_parcelas'] ?? $dm['total_parcelas'] ?? 0);
            if ($qtd === 1) {
                $out['modalidade_pagamento'] = 'À vista';
            } elseif ($qtd > 1) {
                $out['modalidade_pagamento'] = "Parcelado em {$qtd}x";
            }
        }

        // Saldo de instrução / horas estimadas a partir do orçamento (quando não sobrescritos)
        $orc = is_array($dm['orc'] ?? null) ? $dm['orc'] : [];
        if (isset($dm['subtotal']) && is_numeric($dm['subtotal']) && (float) $dm['subtotal'] > 0) {
            $out['valor_credito_voo'] = $this->formatMoney((float) $dm['subtotal']);
        } elseif (isset($dm['total']) && is_numeric($dm['total']) && (float) $dm['total'] > 0) {
            $out['valor_credito_voo'] = $this->formatMoney((float) $dm['total']);
        }

        // Itens incluídos inferidos dos módulos do orçamento
        if (!empty($orc['modulos']) && is_array($orc['modulos'])) {
            $titles = [];
            $totalHours = 0.0;
            foreach ($orc['modulos'] as $mod) {
                if (is_array($mod)) {
                    if (!empty($mod['titulo'])) {
                        $titles[] = trim((string) $mod['titulo']);
                    } elseif (!empty($mod['nome'])) {
                        $titles[] = trim((string) $mod['nome']);
                    }
                    if (!empty($mod['limite']) && is_numeric($mod['limite'])) {
                        $totalHours += (float) $mod['limite'];
                    }
                }
            }
            if (!empty($titles)) {
                $out['itens_incluidos'] = implode(', ', array_unique($titles));
            }
            if ($totalHours > 0) {
                $out['horas_estimadas'] = rtrim(rtrim(number_format($totalHours, 1, ',', '.'), '0'), ',') . 'h';
            }
        }

        // Overrides explícitos salvos em config.quadro_contratacao na proposta/matrícula
        $cfg = is_array($dm['config'] ?? null) ? $dm['config'] : [];
        $quadro = is_array($cfg['quadro_contratacao'] ?? null) ? $cfg['quadro_contratacao'] : [];

        $dateFields = [
            'inicio_turma',
            'primeira_chamada_elegivel',
            'inicio_uso_credito',
            'fim_vigencia',
            'data_proposta',
            'data_pi',
            'data_mgr',
            'data_base_tarifa',
        ];
        $moneyFields = [
            'valor_credito_voo',
            'tarifa_referencia',
        ];

        foreach ($quadro as $key => $val) {
            if (!is_scalar($val) || trim((string) $val) === '') {
                continue;
            }
            $strVal = trim((string) $val);
            if (in_array($key, $dateFields, true)) {
                $out[$key] = $this->formatDate($strVal);
            } elseif (in_array($key, $moneyFields, true) && is_numeric(str_replace(',', '.', $strVal))) {
                $out[$key] = $this->formatMoney((float) str_replace(',', '.', $strVal));
            } else {
                $out[$key] = $strVal;
            }
        }

        return $out;
    }

    protected function formatDate(string $value): string
    {
        $v = trim($value);
        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $v)) {
            $ts = strtotime(substr($v, 0, 10));
            if ($ts !== false) {
                return date('d/m/Y', $ts);
            }
        }

        return $v;
    }

    protected function formatMoney(float $amount): string
    {
        return 'R$ ' . number_format($amount, 2, ',', '.');
    }
}
