<?php

use App\Services\ContratoValidadeService;

uses(Tests\TestCase::class);

it('usa validade explícita quando cadastrada', function () {
    $ret = ContratoValidadeService::validade(['validade_contrato' => '2024-01-15', 'data_contrato' => '2023-01-01']);
    expect($ret)->toBe(['date' => '2024-01-15', 'origem' => ContratoValidadeService::ORIGIN_EXPLICIT]);
});

it('calcula pela data do contrato + vigência', function () {
    $ret = ContratoValidadeService::validade(['data_contrato' => '2024-02-13 10:28:52'], 12);
    expect($ret)->toBe(['date' => '2025-02-13', 'origem' => ContratoValidadeService::ORIGIN_COMPUTED]);
});

it('usa data_inicio quando sem data_contrato e ignora datas zeradas', function () {
    $ret = ContratoValidadeService::validade(['data_contrato' => '0000-00-00 00:00:00', 'data_inicio' => '2023-06-10'], 6);
    expect($ret)->toBe(['date' => '2023-12-10', 'origem' => ContratoValidadeService::ORIGIN_COMPUTED]);

    $ret = ContratoValidadeService::validade(['data_contrato' => '0000-00-00 00:00:00', 'data_inicio' => '0000-00-00 00:00:00'], 12);
    expect($ret)->toBe(['date' => null, 'origem' => null]);

    $ret = ContratoValidadeService::validade([], 12);
    expect($ret)->toBe(['date' => null, 'origem' => null]);
});

it('aceita config como JSON', function () {
    $ret = ContratoValidadeService::validade(json_encode(['validade_contrato' => '2024-05-01']));
    expect($ret['date'])->toBe('2024-05-01');
});

it('vencido é estritamente anterior à referência', function () {
    expect(ContratoValidadeService::isVencido('2024-01-14', '2024-01-15'))->toBeTrue()
        ->and(ContratoValidadeService::isVencido('2024-01-15', '2024-01-15'))->toBeFalse()
        ->and(ContratoValidadeService::isVencido('2024-01-16', '2024-01-15'))->toBeFalse()
        ->and(ContratoValidadeService::isVencido(null, '2024-01-15'))->toBeFalse()
        ->and(ContratoValidadeService::diasVencido('2024-01-10', '2024-01-15'))->toBe(5)
        ->and(ContratoValidadeService::diasVencido('2024-01-15', '2024-01-15'))->toBe(0);
});

it('normaliza datas do legado', function () {
    expect(ContratoValidadeService::normalizeDate('2024-02-13 10:28:52'))->toBe('2024-02-13')
        ->and(ContratoValidadeService::normalizeDate(''))->toBeNull()
        ->and(ContratoValidadeService::normalizeDate('0000-00-00 00:00:00'))->toBeNull()
        ->and(ContratoValidadeService::normalizeDate('texto'))->toBeNull();
});
