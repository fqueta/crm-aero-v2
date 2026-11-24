<?php

namespace App\Services\Contracts\Strategies;

use App\Contracts\ContractShortcodeResolverInterface;

class InstructionProgramShortcodeStrategy implements ContractShortcodeResolverInterface
{
    public function resolve(array $dm, array $context): array
    {
        $program = $context['instruction_program'] ?? null;
        if (!$program) {
            return [];
        }

        $out = [];

        $code = is_array($program) ? ($program['code'] ?? '') : ($program->code ?? '');
        $title = is_array($program) ? ($program['title'] ?? '') : ($program->title ?? '');
        $rev = is_array($program) ? ($program['current_revision'] ?? '') : ($program->current_revision ?? '');
        $revDate = is_array($program) ? ($program['revision_date'] ?? null) : ($program->revision_date?->format('Y-m-d') ?? null);
        $mgrRev = is_array($program) ? ($program['mgr_revision'] ?? '') : ($program->mgr_revision ?? '');
        $mgrDate = is_array($program) ? ($program['mgr_date'] ?? null) : ($program->mgr_date?->format('Y-m-d') ?? null);
        $defaults = is_array($program) ? ($program['contract_defaults'] ?? []) : ($program->contract_defaults ?? []);

        if (trim((string) $code) !== '') {
            $out['identificacao_pi'] = trim((string) $code);
        } elseif (trim((string) $title) !== '') {
            $out['identificacao_pi'] = trim((string) $title);
        }

        if (trim((string) $rev) !== '') {
            $out['revisao_pi'] = trim((string) $rev);
        }
        if (!empty($revDate)) {
            $out['data_pi'] = $this->formatDate((string) $revDate);
        }

        // Monta texto e cláusula jurídica de ciência e aceite do Programa de Instrução
        $identificacaoPi = $out['identificacao_pi'] ?? '';
        $revisaoPi = $out['revisao_pi'] ?? '';
        $piRotulo = trim(($identificacaoPi !== '' ? $identificacaoPi . ' ' : '') . ($revisaoPi !== '' ? '(Revisão ' . $revisaoPi . ')' : ''));
        if ($piRotulo === '') {
            $piRotulo = 'Programa de Instrução do Curso';
        }

        $meta = is_array($dm['meta'] ?? null) ? $dm['meta'] : [];
        $aceitoEm = $meta['pi_aceito_em'] ?? null;
        $aceitoIp = $meta['pi_aceito_ip'] ?? null;
        $detalhesAceite = '';
        if ($aceitoEm) {
            $ts = strtotime($aceitoEm);
            $dataFormatada = $ts ? date('d/m/Y \à\s H:i', $ts) : $aceitoEm;
            $detalhesAceite = " (Aceite digital registrado em {$dataFormatada}" . ($aceitoIp ? " - IP: {$aceitoIp}" : "") . ")";
        }

        $declaracaoTexto = "Declaro que tive acesso prévio, li, compreendi integralmente e concordo com todas as disposições, requisitos e critérios operacionais do {$piRotulo} do Aeroclube de Juiz de Fora, aprovado pela autoridade de aviação civil (ANAC), comprometendo-me a cumprir todas as suas diretrizes durante toda a realização do treinamento, sendo incabível a alegação de desconhecimento dos seus termos{$detalhesAceite}.";

        $out['declaracao_aceite_pi'] = $declaracaoTexto;
        $out['clausula_aceite_pi'] = "<p><strong>CIÊNCIA E ACEITE DO PROGRAMA DE INSTRUÇÃO (P.I.):</strong> {$declaracaoTexto}</p>";

        if (trim((string) $mgrRev) !== '') {
            $out['revisao_mgr'] = trim((string) $mgrRev);
        }
        if (!empty($mgrDate)) {
            $out['data_mgr'] = $this->formatDate((string) $mgrDate);
        }

        if (is_array($defaults)) {
            foreach ($defaults as $key => $val) {
                if (is_scalar($val) && trim((string) $val) !== '') {
                    $out[(string) $key] = trim((string) $val);
                }
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
}
