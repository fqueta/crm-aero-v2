<?php

namespace App\Contracts;

interface ContractShortcodeResolverInterface
{
    /**
     * Resolve um subconjunto de shortcodes de contrato.
     *
     * @param  array<string, mixed>  $dm       Dados da matrícula/proposta
     * @param  array<string, mixed>  $context  Contexto carregado (institutional, program, turma, etc.)
     * @return array<string, string>
     */
    public function resolve(array $dm, array $context): array;
}
