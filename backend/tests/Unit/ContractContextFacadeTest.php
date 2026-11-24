<?php

use App\Services\Contracts\ContractContextFacade;

it('resolve todos os shortcodes do Quadro da Contratação respeitando a precedência Proposta > Turma > PI > Institucional', function () {
    $facade = new ContractContextFacade();

    $dm = [
        'id' => 452,
        'data' => '2026-11-20',
        'subtotal' => 45000,
        'forma_pagamento' => 'Boleto Bancário',
        'orc' => [
            'modulos' => [
                ['titulo' => 'Fase 1 — Pré-Solo', 'limite' => 15],
                ['titulo' => 'Fase 2 — Navegação', 'limite' => 25],
            ],
        ],
        'config' => [
            'quadro_contratacao' => [
                'modelo_aeronave' => 'Cessna 152',
                'tarifa_referencia' => '950.00',
                'modalidade_escala' => 'FDS', // sobrescreve Turma e Institucional
            ],
        ],
    ];

    $context = [
        'institutional' => [
            'revisao_mgr' => '003',
            'data_mgr' => '2025-01-15',
            'identificacao_tabela_e_criterios' => 'Tabela Base 2026',
            'data_base_tarifa' => '2026-01-01',
            'custos_adicionais' => 'Cheque ANAC e examinador',
            'juros_e_correcao' => 'Multa 2% + 1% a.m.',
            'modalidade_escala' => 'DDS',
            'carencia_e_data_liberacao' => '6 meses',
            'prazo_maximo_espera' => '30 dias',
            'regra_faltas_bloco' => 'Até 2 faltas no bloco',
            'canal_escala' => 'escala@aeroclube.com.br',
            'canal_secretaria' => 'secretaria@aeroclube.com.br',
            'canal_qualidade' => 'qualidade@aeroclube.com.br',
            'canal_privacidade' => 'lgpd@aeroclube.com.br',
            'limite_realocacoes_ppa' => '1 realocação por turma',
        ],
        'instruction_program' => [
            'code' => 'PPAP',
            'title' => 'Programa PPA Prático',
            'current_revision' => '001F',
            'revision_date' => '2024-08-08',
            'mgr_revision' => '004A', // sobrescreve MGR institucional
            'mgr_date' => '2026-03-10',
            'contract_defaults' => [
                'regra_faltas_bloco' => 'Até 1 falta injustificada no bloco (regra PPAP)', // sobrescreve institucional
            ],
        ],
        'turma' => [
            'nome' => 'Turma PPA 2026/2',
            'inicio' => '2026-12-01',
            'fim' => '2027-12-01',
            'config' => [
                'primeira_chamada_elegivel' => '2027-01-10',
                'inicio_uso_credito' => '2026-12-05',
                'modalidade_escala' => 'DDS',
            ],
        ],
    ];

    $resolved = $facade->resolve($dm, $context);

    // Turma & Vigência
    expect($resolved['identificacao_turma'])->toBe('Turma PPA 2026/2');
    expect($resolved['inicio_turma'])->toBe('01/12/2026');
    expect($resolved['primeira_chamada_elegivel'])->toBe('10/01/2027');
    expect($resolved['inicio_uso_credito'])->toBe('05/12/2026');
    expect($resolved['fim_vigencia'])->toBe('01/12/2027');

    // PI & MGR (PI sobrescreve MGR institucional)
    expect($resolved['identificacao_pi'])->toBe('PPAP');
    expect($resolved['revisao_pi'])->toBe('001F');
    expect($resolved['data_pi'])->toBe('08/08/2024');
    expect($resolved['revisao_mgr'])->toBe('004A');
    expect($resolved['data_mgr'])->toBe('10/03/2026');

    // Proposta, Aeronave & Tarifas
    expect($resolved['identificacao_proposta'])->toBe('Proposta #452');
    expect($resolved['data_proposta'])->toBe('20/11/2026');
    expect($resolved['modelo_aeronave'])->toBe('Cessna 152');
    expect($resolved['valor_credito_voo'])->toBe('R$ 45.000,00');
    expect($resolved['tarifa_referencia'])->toBe('R$ 950,00');
    expect($resolved['horas_estimadas'])->toBe('40h');
    expect($resolved['itens_incluidos'])->toBe('Fase 1 — Pré-Solo, Fase 2 — Navegação');
    expect($resolved['identificacao_tabela_e_criterios'])->toBe('Tabela Base 2026');
    expect($resolved['data_base_tarifa'])->toBe('01/01/2026');
    expect($resolved['custos_adicionais'])->toBe('Cheque ANAC e examinador');

    // Precedência: Proposta ('FDS') > Turma ('DDS') > Institucional ('DDS')
    expect($resolved['modalidade_escala'])->toBe('FDS');
    // Precedência: PI > Institucional
    expect($resolved['regra_faltas_bloco'])->toBe('Até 1 falta injustificada no bloco (regra PPAP)');

    // Canais institucionais
    expect($resolved['canal_escala'])->toBe('escala@aeroclube.com.br');
    expect($resolved['canal_secretaria'])->toBe('secretaria@aeroclube.com.br');
    expect($resolved['canal_qualidade'])->toBe('qualidade@aeroclube.com.br');
    expect($resolved['canal_privacidade'])->toBe('lgpd@aeroclube.com.br');
    expect($resolved['limite_realocacoes_ppa'])->toBe('1 realocação por turma');
    expect($resolved['juros_e_correcao'])->toBe('Multa 2% + 1% a.m.');
    expect($resolved['modalidade_pagamento'])->toBe('Boleto Bancário');
});
