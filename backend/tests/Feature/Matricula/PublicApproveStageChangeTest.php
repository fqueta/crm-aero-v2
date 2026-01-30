<?php

use App\Http\Controllers\api\MatriculaController;
use App\Models\Matricula;
use App\Models\Stage;
use App\Models\User;
use Illuminate\Http\Request;

it('publicApprove altera etapa para 8 e registra', function () {
    $client = User::factory()->create();

    Stage::create([
        'name' => 'Etapa 8',
        'funnel_id' => 1,
        'order' => 8,
        'isActive' => true,
        'color' => '#888888',
        'settings' => [],
    ]);

    $matricula = Matricula::create([
        'id_cliente' => (string)$client->id,
        'id_curso' => 1,
        'id_turma' => 1,
        'status' => 'a',
        'config' => ['step1_done' => true],
        'stage_id' => null,
    ]);

    $controller = new MatriculaController();
    $request = Request::create("/api/v1/proposal/{$client->id}/{$matricula->id}/approve", 'POST');
    $response = $controller->publicApprove($request, $client->id, $matricula->id);
    expect($response->getStatusCode())->toBe(200);

    $fresh = Matricula::find($matricula->id);
    expect((int)$fresh->stage_id)->toBe(10);
    $cfg = is_array($fresh->config) ? $fresh->config : [];
    expect((int)$cfg['stage_id'])->toBe(10);
    expect(isset($cfg['step2_done']) && $cfg['step2_done'] === true)->toBeTrue();
});
