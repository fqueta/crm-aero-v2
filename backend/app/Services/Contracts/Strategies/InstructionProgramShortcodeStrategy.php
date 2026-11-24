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
