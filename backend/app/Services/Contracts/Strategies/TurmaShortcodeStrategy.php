<?php

namespace App\Services\Contracts\Strategies;

use App\Contracts\ContractShortcodeResolverInterface;

class TurmaShortcodeStrategy implements ContractShortcodeResolverInterface
{
    public function resolve(array $dm, array $context): array
    {
        $turma = $context['turma'] ?? null;
        $out = [];

        if ($turma) {
            $nome = is_array($turma) ? ($turma['nome'] ?? '') : ($turma->nome ?? '');
            $inicio = is_array($turma) ? ($turma['inicio'] ?? null) : ($turma->inicio ?? null);
            $fim = is_array($turma) ? ($turma['fim'] ?? null) : ($turma->fim ?? null);
            $rawCfg = is_array($turma) ? ($turma['config'] ?? []) : ($turma->config ?? []);
            $cfg = is_array($rawCfg) ? $rawCfg : (is_string($rawCfg) ? (json_decode($rawCfg, true) ?: []) : []);

            if (trim((string) $nome) !== '') {
                $out['identificacao_turma'] = trim((string) $nome);
            }
            if (!empty($inicio)) {
                $out['inicio_turma'] = $this->formatDate((string) $inicio);
            }
            if (!empty($fim)) {
                $out['fim_vigencia'] = $this->formatDate((string) $fim);
            }

            $map = [
                'primeira_chamada_elegivel' => true,
                'inicio_uso_credito' => true,
                'fim_vigencia' => true,
                'modalidade_escala' => false,
                'carencia_e_data_liberacao' => false,
                'limite_realocacoes_ppa' => false,
            ];
            foreach ($map as $field => $isDate) {
                if (!empty($cfg[$field])) {
                    $val = trim((string) $cfg[$field]);
                    $out[$field] = $isDate ? $this->formatDate($val) : $val;
                }
            }
        } elseif (!empty($dm['turma_nome'])) {
            $out['identificacao_turma'] = trim((string) $dm['turma_nome']);
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
}
