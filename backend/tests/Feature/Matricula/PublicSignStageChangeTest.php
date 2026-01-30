<?php

use App\Http\Controllers\api\MatriculaController;
use App\Models\Matricula;
use App\Models\Stage;
use App\Models\User;
use Illuminate\Http\Request;

it('ao concluir publicSign muda etapa para 9 e registra histórico e altera cliente para 4', function () {
    $client = User::factory()->create();

    $stage9 = Stage::create([
        'name' => 'Etapa 9',
        'funnel_id' => 1,
        'order' => 9,
        'isActive' => true,
        'color' => '#123456',
        'settings' => [],
    ]);

    $matricula = Matricula::create([
        'id_cliente' => (string)$client->id,
        'id_curso' => 1,
        'id_turma' => 1,
        'status' => 'a',
        'config' => [],
        'stage_id' => null,
    ]);

    $controller = new MatriculaController();
    $request = Request::create("/api/v1/proposal/{$client->id}/{$matricula->id}/sign", 'POST', [
        'name' => $client->name,
        'email' => $client->email ?: 'test@example.com',
        'celular' => $client->config['celular'] ?? '11999999999',
        'nascimento' => '2000-01-01',
        'cpf' => $client->cpf ?: '00000000000',
        'cep' => '01001000',
        'endereco' => 'Rua Teste',
        'numero' => '123',
        'bairro' => 'Centro',
        'cidade' => 'São Paulo',
        'estado' => 'SP',
        'nacionalidade' => 'Brasileira',
        'profissao' => 'Profissional',
        'sexo' => 'm',
        'altura' => 1.70,
        'peso' => 70,
        'identidade' => 'RG123',
        'pais_origem' => 'Brasil',
    ]);

    $response = $controller->publicSign($request, $client->id, $matricula->id);
    expect($response->getStatusCode())->toBe(200);

    $fresh = Matricula::find($matricula->id);
    expect((int)$fresh->stage_id)->toBe(9);
    $cfg = is_array($fresh->config) ? $fresh->config : [];
    expect((int)$cfg['stage_id'])->toBe(9);
    $clientFresh = User::find($client->id);
    $clientCfg = is_array($clientFresh->config) ? $clientFresh->config : [];
    expect((int)($clientCfg['stage_id'] ?? 0))->toBe(4);
});
