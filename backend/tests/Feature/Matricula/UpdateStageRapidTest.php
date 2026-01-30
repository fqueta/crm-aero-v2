<?php

use App\Http\Controllers\api\MatriculaController;
use App\Models\Matricula;
use App\Models\Stage;
use App\Models\User;
use Illuminate\Http\Request;

it('atualiza rapidamente a etapa da matrícula com sucesso', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $stage = Stage::create([
        'name' => 'Teste',
        'funnel_id' => null,
        'order' => 1,
        'isActive' => true,
        'color' => '#000000',
        'settings' => [],
    ]);

    $matricula = Matricula::create([
        'id_cliente' => (string)$user->id,
        'id_curso' => 1,
        'id_turma' => 1,
        'status' => 'a',
        'config' => [],
    ]);

    $controller = new MatriculaController();
    $request = Request::create("/api/v1/matriculas/{$matricula->id}/etapa", 'PATCH', [
        'stage_id' => $stage->id,
    ]);

    $response = $controller->updateStageRapid($request, (string)$matricula->id);
    expect($response->getStatusCode())->toBe(200);
    $data = $response->getData(true);
    expect($data['etapa'])->toBe($stage->id);
});

it('retorna 422 quando stage_id é inválido', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $matricula = Matricula::create([
        'id_cliente' => (string)$user->id,
        'id_curso' => 1,
        'id_turma' => 1,
        'status' => 'a',
        'config' => [],
    ]);

    $controller = new MatriculaController();
    $request = Request::create("/api/v1/matriculas/{$matricula->id}/etapa", 'PATCH', [
        'stage_id' => 999999,
    ]);

    $response = $controller->updateStageRapid($request, (string)$matricula->id);
    expect($response->getStatusCode())->toBe(422);
});
