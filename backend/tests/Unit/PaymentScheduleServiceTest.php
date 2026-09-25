<?php

use App\Services\PaymentSchedule\FirstDueDateThenFixedDayStrategy;
use App\Services\PaymentSchedule\PaymentScheduleBuilder;
use App\Services\PaymentSchedule\PaymentScheduleService;

it('gera 19 parcelas mensais dia 11 a partir de 11/10/2026', function () {
    $service = new PaymentScheduleService();

    $result = $service->build([
        'parcela_selecionada' => '19',
        'linhas' => [['parcelas' => '19', 'valor' => '2636.72', 'desconto' => '0']],
        'primeira_parcela_data' => '2026-10-11',
        'dia_pagamento' => 11,
    ]);

    expect($result['qtd'])->toBe(19)
        ->and($result['programacao'])->toHaveCount(19)
        ->and($result['programacao'][0])->toMatchArray(['n' => 1, 'vencimento' => '2026-10-11', 'valor' => 2636.72])
        ->and($result['programacao'][1]['vencimento'])->toBe('2026-11-11')
        ->and($result['programacao'][18]['vencimento'])->toBe('2028-04-11')
        ->and($result['total'])->toBe(50097.68);
});

it('trava dia 31 para o último dia do mês', function () {
    $strategy = new FirstDueDateThenFixedDayStrategy();

    $dates = $strategy->dueDates('2026-01-31', 31, 3);

    expect($dates)->toBe(['2026-01-31', '2026-02-28', '2026-03-31']);
});

it('usa valor próprio na primeira parcela (entrada)', function () {
    $result = (new PaymentScheduleBuilder())
        ->setInstallments(3)
        ->setValue(1000.00)
        ->setFirstValue(500.00)
        ->setFirstDate('2026-10-11')
        ->setDay(11)
        ->build();

    expect($result['programacao'][0]['valor'])->toBe(500.00)
        ->and($result['programacao'][1]['valor'])->toBe(1000.00)
        ->and($result['total'])->toBe(2500.00);
});

it('calcula a primeira parcela como próximo dia fixo quando sem data', function () {
    $result = (new PaymentScheduleBuilder())
        ->setInstallments(2)
        ->setValue(100.00)
        ->setDay(5)
        ->build();

    expect($result['programacao'])->toHaveCount(2)
        ->and((int) date('d', strtotime($result['programacao'][1]['vencimento'])))->toBe(5)
        ->and($result['programacao'][1]['vencimento'])->toBeGreaterThan($result['programacao'][0]['vencimento']);
});

it('retorna vazio para plano inválido em vez de exceção no service', function () {
    $service = new PaymentScheduleService();

    expect($service->build([]))->toBe([])
        ->and($service->build(['parcela_selecionada' => '6', 'linhas' => []]))->toBe([]);
});

it('converte moeda BR e gera a tabela HTML do contrato', function () {
    $service = new PaymentScheduleService();

    expect($service->parseMoney('R$ 2.636,72'))->toBe(2636.72)
        ->and($service->parseMoney('2636.72'))->toBe(2636.72)
        ->and($service->formatBRL(2636.72))->toBe('2.636,72');

    $html = $service->toHtmlTable([
        ['n' => 1, 'vencimento' => '2026-10-11', 'valor' => 2636.72],
        ['n' => 2, 'vencimento' => '2026-11-11', 'valor' => 2636.72],
    ], 5273.44);

    expect($html)->toContain('1ª Parcela')
        ->and($html)->toContain('11/10/2026')
        ->and($html)->toContain('R$ 2.636,72')
        ->and($html)->toContain('Total:')
        ->and($html)->toContain('R$ 5.273,44')
        ->and($html)->toContain('<table');
});

it('resolve detalhes de desconto por pontualidade e valor líquido para shortcodes', function () {
    $service = new PaymentScheduleService();

    $snapshot = [
        'parcela_selecionada' => 12,
        'linhas' => [
            ['parcelas' => '6', 'valor' => '5000.00', 'desconto' => '0'],
            ['parcelas' => '12', 'valor' => '3000.00', 'desconto' => '300.00'],
        ],
    ];

    $details = $service->resolveDiscountDetails($snapshot);

    expect($details['qtd'])->toBe(12)
        ->and($details['valor'])->toBe(3000.0)
        ->and($details['desconto'])->toBe(300.0)
        ->and($details['liquido'])->toBe(2700.0);
});

it('gera programação com matrícula avulsa (n: 0) e data de vencimento própria', function () {
    $service = new PaymentScheduleService();

    $result = $service->build([
        'parcela_selecionada' => '3',
        'linhas' => [['parcelas' => '3', 'valor' => '1000.00', 'desconto' => '0']],
        'primeira_parcela_data' => '2026-10-15',
        'dia_pagamento' => 15,
        'recebimento_matricula' => 'avulsa',
        'valor_matricula' => 600.00,
        'matricula_vencimento_data' => '2026-10-05',
    ]);

    expect($result['qtd'])->toBe(3)
        ->and($result['programacao'])->toHaveCount(4)
        ->and($result['programacao'][0])->toMatchArray([
            'n' => 0,
            'vencimento' => '2026-10-05',
            'valor' => 600.00,
            'tipo' => 'matricula',
            'descricao' => 'Taxa de Inscrição / Matrícula',
        ])
        ->and($result['programacao'][1]['n'])->toBe(1)
        ->and($result['programacao'][1]['valor'])->toBe(1000.00)
        ->and($result['programacao'][1]['vencimento'])->toBe('2026-10-15')
        ->and($result['total'])->toBe(3600.00);

    $html = $service->toHtmlTable($result['programacao'], $result['total']);
    expect($html)->toContain('Taxa de Inscrição / Matrícula')
        ->and($html)->toContain('05/10/2026')
        ->and($html)->toContain('R$ 600,00')
        ->and($html)->toContain('R$ 3.600,00');
});

it('gera programação com matrícula somada à 1ª parcela', function () {
    $service = new PaymentScheduleService();

    $result = $service->build([
        'parcela_selecionada' => '3',
        'linhas' => [['parcelas' => '3', 'valor' => '1000.00', 'desconto' => '0']],
        'primeira_parcela_data' => '2026-10-15',
        'dia_pagamento' => 15,
        'recebimento_matricula' => 'primeira_parcela',
        'valor_matricula' => 600.00,
    ]);

    expect($result['qtd'])->toBe(3)
        ->and($result['programacao'])->toHaveCount(3)
        ->and($result['programacao'][0]['n'])->toBe(1)
        ->and($result['programacao'][0]['valor'])->toBe(1600.00)
        ->and($result['programacao'][0]['descricao'])->toBe('1ª Parcela (com Matrícula)')
        ->and($result['programacao'][1]['valor'])->toBe(1000.00)
        ->and($result['total'])->toBe(3600.00);

    $html = $service->toHtmlTable($result['programacao'], $result['total']);
    expect($html)->toContain('1ª Parcela (com Matrícula)')
        ->and($html)->toContain('R$ 1.600,00');
});

it('mantém comportamento padrão diluída quando recebimento_matricula é diluida ou ausente', function () {
    $service = new PaymentScheduleService();

    $result = $service->build([
        'parcela_selecionada' => '2',
        'linhas' => [['parcelas' => '2', 'valor' => '1500.00', 'desconto' => '0']],
        'primeira_parcela_data' => '2026-10-15',
        'dia_pagamento' => 15,
        'recebimento_matricula' => 'diluida',
        'valor_matricula' => 600.00,
    ]);

    expect($result['programacao'])->toHaveCount(2)
        ->and($result['programacao'][0]['n'])->toBe(1)
        ->and($result['programacao'][0]['valor'])->toBe(1500.00)
        ->and($result['total'])->toBe(3000.00);
});

it('permite sobrescrever datas de vencimento de parcelas específicas (vencimentos_personalizados)', function () {
    $service = new PaymentScheduleService();

    $result = $service->build([
        'parcela_selecionada' => '3',
        'linhas' => [['parcelas' => '3', 'valor' => '1000.00', 'desconto' => '0']],
        'primeira_parcela_data' => '2026-10-10',
        'dia_pagamento' => 10,
        'vencimentos_personalizados' => [
            1 => '2026-10-01', // comercial definiu que a 1ª é paga antes
            2 => '2026-11-25', // 2ª parcela adiada
        ],
    ]);

    expect($result['programacao'])->toHaveCount(3)
        ->and($result['programacao'][0]['vencimento'])->toBe('2026-10-01')
        ->and($result['programacao'][1]['vencimento'])->toBe('2026-11-25')
        ->and($result['programacao'][2]['vencimento'])->toBe('2026-12-10')
        ->and($result['primeira_parcela']['data'])->toBe('2026-10-01');
});

it('renderiza nota explicativa de desconto de pontualidade no rodapé da tabela HTML', function () {
    $service = new PaymentScheduleService();

    $programacao = [
        ['n' => 1, 'vencimento' => '2026-10-10', 'valor' => 2410.83, 'descricao' => '1ª Parcela'],
        ['n' => 2, 'vencimento' => '2026-11-10', 'valor' => 2410.83, 'descricao' => '2ª Parcela'],
    ];

    $html = $service->toHtmlTable($programacao, 4821.66, [
        'desconto_pontualidade' => 400.00,
        'parcela_com_desconto' => 2010.83,
    ]);

    expect($html)->toContain('Observação:')
        ->and($html)->toContain('Desconto de pontualidade: R$ 400,00 por parcela')
        ->and($html)->toContain('valor com desconto: R$ 2.010,83')
        ->and($html)->toContain('O não pagamento até o vencimento implicará na perda do desconto');
});

it('renderiza nota explicativa com HTML rico e entidades decodificadas sem escapar tags', function () {
    $service = new PaymentScheduleService();

    $programacao = [
        ['n' => 1, 'vencimento' => '2026-10-10', 'valor' => 2410.83, 'descricao' => '1ª Parcela'],
    ];

    // Caso 1: HTML direto
    $html1 = $service->toHtmlTable($programacao, 2410.83, [
        'nota_desconto' => '<p class="MsoBodyText"><b>DESCONTO DE PONTUALIDADE</b></p>',
    ]);

    expect($html1)->toContain('<p class="MsoBodyText"><b>DESCONTO DE PONTUALIDADE</b></p>')
        ->and($html1)->not->toContain('&lt;b&gt;');

    // Caso 2: HTML codificado como entidades (&lt;...&gt;)
    $html2 = $service->toHtmlTable($programacao, 2410.83, [
        'nota_desconto' => '&lt;p class=&quot;MsoBodyText&quot;&gt;&lt;b&gt;DESCONTO&lt;/b&gt;&lt;/p&gt;',
    ]);

    expect($html2)->toContain('<p class="MsoBodyText"><b>DESCONTO</b></p>')
        ->and($html2)->not->toContain('&lt;b&gt;');
});



