<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\WorkflowAction;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class WorkflowActionController extends Controller
{
    protected PermissionService $permissionService;
    public function __construct()
    {
        $this->permissionService = new PermissionService();
    }

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user || !$this->permissionService->isHasPermission('view')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        $perPage = (int)$request->input('per_page', 10);
        $query = WorkflowAction::query()->orderBy('order','asc');
        if ($request->filled('rule_id')) {
            $query->where('rule_id', $request->input('rule_id'));
        }
        if ($request->filled('type')) {
            $query->where('type', $request->input('type'));
        }
        if ($request->filled('isActive')) {
            $query->where('isActive', filter_var($request->input('isActive'), FILTER_VALIDATE_BOOLEAN));
        }
        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user || !$this->permissionService->isHasPermission('create')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        $validator = Validator::make($request->all(), [
            'rule_id' => ['required','integer','exists:workflow_rules,id'],
            'type' => ['required','string','max:40'],
            'payload' => ['nullable','array'],
            'order' => ['nullable','integer'],
            'isActive' => ['nullable','boolean'],
            'retry_policy' => ['nullable','array'],
        ]);
        if ($validator->fails()) {
            return response()->json(['message'=>'Erro de validação','errors'=>$validator->errors()], 422);
        }
        $action = WorkflowAction::create($validator->validated());
        return response()->json($action, 201);
    }

    public function show(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user || !$this->permissionService->isHasPermission('view')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        $action = WorkflowAction::findOrFail($id);
        return response()->json($action);
    }

    public function update(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user || !$this->permissionService->isHasPermission('edit')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        $action = WorkflowAction::findOrFail($id);
        $validator = Validator::make($request->all(), [
            'rule_id' => ['sometimes','required','integer','exists:workflow_rules,id'],
            'type' => ['sometimes','required','string','max:40'],
            'payload' => ['nullable','array'],
            'order' => ['nullable','integer'],
            'isActive' => ['nullable','boolean'],
            'retry_policy' => ['nullable','array'],
        ]);
        if ($validator->fails()) {
            return response()->json(['message'=>'Erro de validação','errors'=>$validator->errors()], 422);
        }
        $action->fill($validator->validated());
        $action->save();
        return response()->json($action);
    }

    public function destroy(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user || !$this->permissionService->isHasPermission('delete')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        $action = WorkflowAction::findOrFail($id);
        $action->delete();
        return response()->json(['message'=>'Ação excluída']);
    }
}
