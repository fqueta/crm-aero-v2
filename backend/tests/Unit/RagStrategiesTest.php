<?php

use App\Services\Ai\Prompts\PublicInstructionProgramContextStrategy;
use App\Services\Ai\Rag\Chunking\HtmlSectionChunkingStrategy;
use App\Services\Ai\Rag\Chunking\PlainTextChunkingStrategy;
use App\Services\Ai\Rag\Retrieval\HybridVectorLexicalRetrievalStrategy;
use App\Services\Ai\Rag\Retrieval\LexicalFallbackRetrievalStrategy;

it('divide HTML de Programa de Instrução em chunks preservando títulos de seção', function () {
    $html = <<<'HTML'
    <h2>Objetivo do Programa</h2>
    <p>Formar pilotos privados de avião conforme RBAC 61.</p>
    <h2>Regra de Escala e Carência</h2>
    <p>No parcelamento do PPA aplica-se carência de seis meses a partir da matrícula.</p>
    HTML;

    $strategy = new HtmlSectionChunkingStrategy();
    $chunks = $strategy->chunk($html);

    expect($chunks)->toHaveCount(2);
    expect($chunks[0]['section_title'])->toBe('Objetivo do Programa');
    expect($chunks[0]['content'])->toContain('RBAC 61');
    expect($chunks[1]['section_title'])->toBe('Regra de Escala e Carência');
    expect($chunks[1]['content'])->toContain('carência de seis meses');
});

it('subdivide texto longo com overlap em PlainTextChunkingStrategy', function () {
    $strategy = new PlainTextChunkingStrategy();
    $text = str_repeat('Instrução prática de voo em aeronave monomotor. ', 30);

    $chunks = $strategy->chunk($text, ['max_chars' => 300, 'overlap' => 50, 'section_title' => 'Grade']);

    expect(count($chunks))->toBeGreaterThan(2);
    expect($chunks[0]['section_title'])->toBe('Grade');
    expect(mb_strlen($chunks[0]['content']))->toBeLessThanOrEqual(300);
});

it('ranqueia trechos corretamente usando busca híbrida vetorial + lexical', function () {
    $strategy = new HybridVectorLexicalRetrievalStrategy();

    $candidates = [
        [
            'title' => 'PPAP',
            'section_title' => 'Carência',
            'content' => 'Carência de 6 meses no parcelamento do PPA.',
            'embedding' => [0.95, 0.10, 0.05],
        ],
        [
            'title' => 'PPAP',
            'section_title' => 'Uniforme',
            'content' => 'O aluno deve comparecer uniformizado.',
            'embedding' => [0.05, 0.95, 0.10],
        ],
    ];

    $results = $strategy->retrieve('qual a carencia do parcelamento?', $candidates, [0.96, 0.08, 0.04], 2);

    expect($results)->not->toBeEmpty();
    expect($results[0]['section_title'])->toBe('Carência');
    expect($results[0]['score'])->toBeGreaterThan($results[1]['score']);
});

it('faz fallback lexical normalizando acentos quando não há embedding', function () {
    $strategy = new LexicalFallbackRetrievalStrategy();

    $candidates = [
        ['title' => 'Regras', 'section_title' => 'Canais', 'content' => 'Canal oficial de escala: escala@aeroclube.com.br'],
        ['title' => 'Regras', 'section_title' => 'Faltas', 'content' => 'Limite de 2 faltas injustificadas por bloco.'],
    ];

    $results = $strategy->retrieve('limite de faltas no bloco', $candidates, null, 2);

    expect($results)->toHaveCount(1);
    expect($results[0]['section_title'])->toBe('Faltas');
});

it('monta prompt público restrito ao Programa de Instrução sem rotas admin', function () {
    $strategy = new PublicInstructionProgramContextStrategy();
    $prompt = $strategy->buildSystemPrompt([
        'programTitle' => 'PPAP Prático',
        'programCode' => 'PPAP',
        'revision' => '001F',
        'revisionDate' => '08/08/2024',
    ], [
        ['title' => 'PPAP', 'section_title' => 'Escala', 'content' => 'Regime PROA INPUT/OUTPUT.'],
    ]);

    expect($prompt)->toContain('PPAP Prático');
    expect($prompt)->toContain('001F');
    expect($prompt)->toContain('Regime PROA INPUT/OUTPUT.');
    expect($prompt)->toContain('NUNCA divulgue dados internos');
});
