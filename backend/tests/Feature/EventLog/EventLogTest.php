<?php

use App\Models\EventLog;
use App\Models\User;
use Illuminate\Http\Request;

it('cria event log via endpoint', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    $payload = [
        'entity_type' => 'user',
        'entity_id' => (string)$user->id,
        'action' => 'test_event',
        'description' => 'Teste de log',
        'payload' => ['foo' => 'bar'],
    ];

    $response = $this->post('/api/v1/event-logs', $payload);
    $response->assertStatus(201);
    $data = $response->json();
    expect($data['entity_type'])->toBe('user');
    expect($data['action'])->toBe('test_event');
});

it('lista event logs com paginação', function () {
    $user = User::factory()->create();
    $this->actingAs($user);

    EventLog::create([
        'entity_type' => 'matricula',
        'entity_id' => '1',
        'action' => 'created',
        'payload' => [],
        'actor_id' => (string)$user->id,
    ]);

    $response = $this->get('/api/v1/event-logs?entity_type=matricula');
    $response->assertStatus(200);
    $json = $response->json();
    expect($json['data'])->toBeArray();
});
