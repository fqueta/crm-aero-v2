<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\WorkflowRule;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class WorkflowRuleController extends Controller
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
        $query = WorkflowRule::query()->orderBy('order','asc');
        if ($request->filled('workflow_id')) {
            $query->where('workflow_id', $request->input('workflow_id'));
        }
        if ($request->filled('source_type')) {
            $query->where('source_type', $request->input('source_type'));
        }
        if ($request->filled('event')) {
            $query->where('event', $request->input('event'));
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
            'workflow_id' => ['required','integer','exists:workflows,id'],
            'source_type' => ['required','string','max:40'],
            'event' => ['required','string','max:40'],
            'filters' => ['nullable','array'],
            'conditions' => ['nullable','array'],
            'order' => ['nullable','integer'],
            'isActive' => ['nullable','boolean'],
        ]);
        if ($validator->fails()) {
            return response()->json(['message'=>'Erro de validação','errors'=>$validator->errors()], 422);
        }
        $rule = WorkflowRule::create($validator->validated());
        return response()->json($rule, 201);
    }

    public function show(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user || !$this->permissionService->isHasPermission('view')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        $rule = WorkflowRule::findOrFail($id);
        return response()->json($rule);
    }

    public function update(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user || !$this->permissionService->isHasPermission('edit')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        $rule = WorkflowRule::findOrFail($id);
        $validator = Validator::make($request->all(), [
            'workflow_id' => ['sometimes','required','integer','exists:workflows,id'],
            'source_type' => ['sometimes','required','string','max:40'],
            'event' => ['sometimes','required','string','max:40'],
            'filters' => ['nullable','array'],
            'conditions' => ['nullable','array'],
            'order' => ['nullable','integer'],
            'isActive' => ['nullable','boolean'],
        ]);
        if ($validator->fails()) {
            return response()->json(['message'=>'Erro de validação','errors'=>$validator->errors()], 422);
        }
        $rule->fill($validator->validated());
        $rule->save();
        return response()->json($rule);
    }

    public function destroy(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user || !$this->permissionService->isHasPermission('delete')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        $rule = WorkflowRule::findOrFail($id);
        $rule->delete();
        return response()->json(['message'=>'Regra excluída']);
    }
}
