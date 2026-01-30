<?php

use App\Http\Controllers\api\UserController;
use App\Models\Stage;
use App\Models\User;
use Illuminate\Http\Request;

it('atualiza rapidamente a etapa do cliente para 3 e registra', function () {
    $actor = User::factory()->create();
    $this->actingAs($actor);

    $stage3 = Stage::create([
        'name' => 'Etapa 3',
        'funnel_id' => 1,
        'order' => 3,
        'isActive' => true,
        'color' => '#333333',
        'settings' => [],
    ]);

    $client = User::factory()->create();

    $controller = new UserController(new \App\Services\PermissionService());
    $request = Request::create("/api/v1/users/{$client->id}/etapa", 'PATCH', [
        'stage_id' => $stage3->id,
    ]);

    $response = $controller->updateStageRapid($request, (string)$client->id);
    expect($response->getStatusCode())->toBe(200);
    $data = $response->getData(true);
    expect((int)($data['config']['stage_id'] ?? 0))->toBe(3);
});
