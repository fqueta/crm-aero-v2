<?php

use App\Http\Controllers\api\MatriculaController;
use App\Models\Matricula;
use App\Models\Stage;
use App\Models\User;
use App\Services\PermissionService;
use Illuminate\Http\Request;

/**
 * Cria um usuário ativo com permissão de edição em vendas e injeta o contexto no request.
 */
function makeAuthorizedRequestUser(string $routeName): array
{
    $user = new User([
        'name' => 'Usuário Teste',
        'email' => 'teste_' . uniqid() . '@example.com',
        'status' => 'actived',
        'permission_id' => 1,
    ]);
    $user->id = 'test-user-' . uniqid();

    return [$user, function () use ($routeName) {
        return new class($routeName) {
            public function __construct(private string $routeName) {}
            public function getName(): string
            {
                return $this->routeName;
            }
        };
    }];
}

/**
 * Injeta um serviço de permissão fake para focar o teste no controller.
 */
function makeControllerWithGrantedPermission(): MatriculaController
{
    $controller = new MatriculaController();
    $reflection = new ReflectionClass($controller);
    $property = $reflection->getProperty('permissionService');
    $property->setAccessible(true);
    $property->setValue($controller, new class extends PermissionService {
        public function isHasPermission($permissao = ''): bool
        {
            return true;
        }
    });

    return $controller;
}

it('atualiza rapidamente a etapa da matrícula com sucesso', function () {
    [$user, $routeResolver] = makeAuthorizedRequestUser('api.matriculas.update-stage');

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

    $controller = makeControllerWithGrantedPermission();
    $request = Request::create("/api/v1/matriculas/{$matricula->id}/etapa", 'PATCH', [
        'stage_id' => $stage->id,
    ]);
    $request->setUserResolver(fn () => $user);
    $request->setRouteResolver($routeResolver);

    $response = $controller->updateStageRapid($request, (string)$matricula->id);
    expect($response->getStatusCode())->toBe(200);
    $data = $response->getData(true);
    expect($data['etapa'])->toBe($stage->id);
});

it('retorna 422 quando stage_id é inválido', function () {
    [$user, $routeResolver] = makeAuthorizedRequestUser('api.matriculas.update-stage');

    $matricula = Matricula::create([
        'id_cliente' => (string)$user->id,
        'id_curso' => 1,
        'id_turma' => 1,
        'status' => 'a',
        'config' => [],
    ]);

    $controller = makeControllerWithGrantedPermission();
    $request = Request::create("/api/v1/matriculas/{$matricula->id}/etapa", 'PATCH', [
        'stage_id' => 999999,
    ]);
    $request->setUserResolver(fn () => $user);
    $request->setRouteResolver($routeResolver);

    $response = $controller->updateStageRapid($request, (string)$matricula->id);
    expect($response->getStatusCode())->toBe(422);
});

it('atualiza rapidamente o status da matrícula com sucesso', function () {
    [$user, $routeResolver] = makeAuthorizedRequestUser('api.matriculas.update-status');

    $matricula = Matricula::create([
        'id_cliente' => (string)$user->id,
        'id_curso' => 1,
        'id_turma' => 1,
        'status' => 'a',
        'config' => [],
    ]);

    $controller = makeControllerWithGrantedPermission();
    $request = Request::create("/api/v1/matriculas/{$matricula->id}/status", 'PATCH', [
        'status' => 'g',
    ]);
    $request->setUserResolver(fn () => $user);
    $request->setRouteResolver($routeResolver);

    $response = $controller->updateStatusRapid($request, (string)$matricula->id);
    expect($response->getStatusCode())->toBe(200);
    $data = $response->getData(true);
    expect($data['status'])->toBe('g');
});

it('retorna 422 quando status da matrícula é inválido', function () {
    [$user, $routeResolver] = makeAuthorizedRequestUser('api.matriculas.update-status');

    $matricula = Matricula::create([
        'id_cliente' => (string)$user->id,
        'id_curso' => 1,
        'id_turma' => 1,
        'status' => 'a',
        'config' => [],
    ]);

    $controller = makeControllerWithGrantedPermission();
    $request = Request::create("/api/v1/matriculas/{$matricula->id}/status", 'PATCH', [
        'status' => 'x',
    ]);
    $request->setUserResolver(fn () => $user);
    $request->setRouteResolver($routeResolver);

    $response = $controller->updateStatusRapid($request, (string)$matricula->id);
    expect($response->getStatusCode())->toBe(422);
});
