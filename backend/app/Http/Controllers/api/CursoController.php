<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCursoRequest;
use App\Http\Requests\UpdateCursoRequest;
use App\Models\Curso;
use App\Services\PermissionService;
use App\Services\Qlib;
use Illuminate\Http\Request;

class CursoController extends Controller
{
    /**
     * Serviço de permissões.
     */
    protected PermissionService $permissionService;

    /**
     * Construtor: inicializa serviço de permissões.
     */
    public function __construct()
    {
        $this->permissionService = new PermissionService();
    }

    /**
     * Lista cursos com paginação e filtros simples.
     * Exige autenticação e permissão de visualização.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('view')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $perPage = (int) $request->input('per_page', 15);
        // Permitir incluir itens da lixeira quando include_trashed=true
        $includeTrashed = filter_var($request->input('include_trashed', false), FILTER_VALIDATE_BOOLEAN);
        $query = $includeTrashed
            ? Curso::withoutGlobalScope('notDeleted')
            : Curso::query();

        // Filtro por nome/título ou no campo q ou  campo search
        if ($search = $request->input('q') ?: $request->input('search')) {

            $query->where(function ($q) use ($search) {
                $q->where('nome', 'like', "%{$search}%")
                  ->orWhere('titulo', 'like', "%{$search}%");
            });
        }
        // Filtro por tipo de módulo
        if ($request->filled('tipo')) {
            $query->where('tipo', $request->string('tipo')->toString());
        }
        // Filtro por categoria
        if ($request->filled('categoria')) {
            $query->where('categoria', $request->string('categoria')->toString());
        }

        // Filtro por ativo
        if ($request->filled('ativo')) {
            $v = strtolower($request->string('ativo')->toString());
            if (in_array($v, ['s','n'])) {
                $query->where('ativo', $v);
            }
        }

        $cursos = $query->orderByDesc('updated_at')->paginate($perPage);
        return response()->json($cursos);
    }

    /**
     * Criar (ou atualizar por id) um curso.
     * Aceita payload validado em StoreCursoRequest e garante permissões.
     * Se houver 'id' numérico, usa updateOrCreate.
     */
    public function store(StoreCursoRequest $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('create')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $data = $request->validated();

        // Definir defaults similares ao AeronaveController
        if (!isset($data['autor']) || $data['autor'] === null || $data['autor'] === '') {
            $data['autor'] = (string) $user->id;
        }
        if (!isset($data['token']) || $data['token'] === null || $data['token'] === '') {
            $data['token'] = Qlib::token();
        }
        if (!isset($data['ativo'])) {
            $data['ativo'] = 's';
        }
        if (!isset($data['publicar'])) {
            $data['publicar'] = 'n';
        }

        // Se vier id numérico, usa updateOrCreate para evitar duplicidade
        if (isset($data['id']) && is_numeric($data['id'])) {
            $id = (int) $data['id'];
            unset($data['id']);
            $curso = Curso::updateOrCreate(['id' => $id], $data);
            return response()->json([
                'data' => $curso,
                'message' => 'Curso atualizado com sucesso',
                'status' => 201,
            ], 201);
        }

        $curso = Curso::create($data);
        return response()->json([
            'data' => $curso,
            'message' => 'Curso criado com sucesso',
            'status' => 201,
        ], 201);
    }

    /**
     * Exibir um curso específico.
     * Exige autenticação e permissão de visualização.
     */
    public function show(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('view')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $curso = Curso::find($id);
        if (!$curso) {
            return response()->json(['error' => 'Curso não encontrado'], 404);
        }

        return response()->json($curso);
    }

    /**
     * Atualizar um curso específico.
     * Exige autenticação e permissão de edição.
     */
    public function update(UpdateCursoRequest $request, string $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('edit')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $curso = Curso::find($id);
        if (!$curso) {
            return response()->json(['error' => 'Curso não encontrado'], 404);
        }

        $data = $request->validated();
        $curso->update($data);

        return response()->json([
            'data' => $curso,
            'message' => 'Curso atualizado com sucesso',
        ], 200);
    }

    /**
     * Excluir um curso pelo id.
     * Exige autenticação e permissão de exclusão.
     *
     * Comportamento:
     * - Por padrão, marca o curso como excluído (lixeira) sem remover do banco.
     * - Se for passado `force=true` na query, executa exclusão permanente.
     */
    public function destroy(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('delete')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $curso = Curso::find($id);
        if (!$curso) {
            return response()->json(['error' => 'Curso não encontrado'], 404);
        }

        // Se a query tiver force=true, exclui definitivamente
        $force = filter_var($request->input('force', false), FILTER_VALIDATE_BOOLEAN);
        if ($force) {
            $curso->delete();
            return response()->json([
                'message' => 'Curso excluído permanentemente',
            ], 200);
        }

        // Caso contrário, marca como excluído (lixeira)
        $registro = [
            'por' => (string) $user->id,
            'ip' => $request->ip(),
            'data' => now()->toISOString(),
        ];
        $curso->update([
            'excluido' => 's',
            'deletado' => 's',
            'excluido_por' => (string) $user->id,
            'deletado_por' => (string) $user->id,
            'reg_excluido' => $registro,
            'reg_deletado' => $registro,
        ]);

        return response()->json([
            'message' => 'Curso movido para a lixeira',
            'data' => $curso->fresh(),
        ], 200);
    }

    /**
     * Listar cursos na lixeira (marcados como excluídos/deletados).
     */
    public function trash(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('view')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $perPage = (int) $request->input('per_page', 15);
        $query = Curso::withoutGlobalScope('notDeleted')
            ->where(function($q) {
                $q->where('deletado', 's')->orWhere('excluido', 's');
            });

        if ($search = $request->string('q')->toString()) {
            $query->where(function ($q) use ($search) {
                $q->where('nome', 'like', "%{$search}%")
                  ->orWhere('titulo', 'like', "%{$search}%");
            });
        }

        $cursos = $query->orderByDesc('updated_at')->paginate($perPage);
        return response()->json($cursos);
    }

    /**
     * Restaurar curso da lixeira.
     */
    public function restore(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('delete')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $curso = Curso::withoutGlobalScope('notDeleted')
            ->where('id', $id)
            ->where(function($q) {
                $q->where('deletado', 's')->orWhere('excluido', 's');
            })
            ->first();

        if (!$curso) {
            return response()->json(['error' => 'Curso não encontrado na lixeira'], 404);
        }

        $curso->update([
            'excluido' => 'n',
            'deletado' => 'n',
            'reg_excluido' => null,
            'reg_deletado' => null,
            'excluido_por' => null,
            'deletado_por' => null,
        ]);

        return response()->json([
            'message' => 'Curso restaurado com sucesso',
            'data' => $curso->fresh(),
        ], 200);
    }

    /**
     * Exclusão permanente de um curso que está na lixeira.
     */
    public function forceDelete(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('delete')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $curso = Curso::withoutGlobalScope('notDeleted')
            ->where('id', $id)
            ->where(function($q) {
                $q->where('deletado', 's')->orWhere('excluido', 's');
            })
            ->first();

        if (!$curso) {
            return response()->json(['error' => 'Curso não encontrado na lixeira'], 404);
        }

        $curso->delete();

        return response()->json([
            'message' => 'Curso excluído permanentemente com sucesso',
        ], 200);
    }
}
