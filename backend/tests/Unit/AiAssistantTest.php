<?php

use App\Services\Ai\AiChatService;
use App\Services\Ai\Chat\AiChatProviderFactory;
use Illuminate\Support\Facades\Http;

uses(Tests\TestCase::class);

function tmpAiInvoke(string $method, array $args = []): mixed
{
    $svc = new AiChatService();
    $ref = new ReflectionMethod(AiChatService::class, $method);
    $ref->setAccessible(true);
    return $ref->invokeArgs($svc, $args);
}

it('extrai ações apenas de links internos', function () {
    $actions = tmpAiInvoke('extractActions', ['Veja [Propostas](/admin/sales) e [Google](https://google.com).']);
    expect($actions)->toBe([['label' => 'Propostas', 'route' => '/admin/sales']]);
});

it('sugestões por rota do CRM', function () {
    $svc = new AiChatService();
    expect($svc->getSuggestions('/admin/sales?funnel=2')[0])->toContain('proposta')
        ->and($svc->getSuggestions('/admin/school/termination'))->toContain('Como lançar uma rescisão?')
        ->and($svc->getSuggestions('/rota/inexistente'))->toContain('Como criar uma proposta?');
});

it('sem chave nenhum provedor é resolvido', function () {
    // Sem OPENAI_API_KEY/GEMINI_API_KEY no ambiente de teste: factory retorna null
    // e o chat falha com mensagem amigável em PT-BR (sem tocar na API externa).
    if (getenv('OPENAI_API_KEY') || getenv('GEMINI_API_KEY')) {
        $this->markTestSkipped('Chave de IA presente no ambiente.');
    }
    expect(AiChatProviderFactory::make())->toBeNull()
        ->and(AiChatProviderFactory::hasConfiguredProvider())->toBeFalse();

    $status = AiChatProviderFactory::status();
    expect($status['providers'])->toBe(['gemini' => false, 'openai' => false]);

    $svc = new AiChatService();
    expect(fn () => $svc->chat('Olá', [], []))->toThrow(Exception::class, 'Nenhum provedor de IA configurado');
});

it('fallback em runtime: gemini falha e openai responde', function () {
    putenv('GEMINI_API_KEY=fake-gemini');
    putenv('OPENAI_API_KEY=fake-openai');
    Http::fake([
        'https://generativelanguage.googleapis.com/*' => Http::response(['error' => ['code' => 400, 'message' => 'API key not valid.']], 400),
        'https://api.openai.com/*' => Http::response(['choices' => [['message' => ['content' => 'OPENAI-OK']]], 'usage' => ['prompt_tokens' => 1, 'completion_tokens' => 1]], 200),
    ]);

    $svc = new AiChatService();
    $ret = $svc->chat('Olá', ['userId' => 1], []);
    expect($ret['reply'])->toBe('OPENAI-OK')
        ->and($ret['provider'])->toBe('openai');
});

it('todos falham: erro amigável sem JSON cru', function () {
    putenv('GEMINI_API_KEY=fake-gemini');
    putenv('OPENAI_API_KEY=fake-openai');
    Http::fake([
        '*' => Http::response(['error' => ['code' => 400, 'message' => 'API key not valid.', 'status' => 'INVALID_ARGUMENT']], 400),
    ]);

    $svc = new AiChatService();
    expect(fn () => $svc->chat('Olá', ['userId' => 1], []))
        ->toThrow(Exception::class, 'chave de API foi rejeitada');
});
