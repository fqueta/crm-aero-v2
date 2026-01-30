<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\Workflow;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class WorkflowController extends Controller
{
    protected PermissionService $permissionService;

    public function __construct()
    {
        $this->permissionService = new PermissionService();
    }
    /**
     * Display a listing of the resource.
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
        $perPage = (int)($request->input('per_page', 10));
        $query = Workflow::query();
        if ($request->filled('funnel_id')) {
            $query->where('funnel_id', $request->input('funnel_id'));
        }
        if ($request->filled('isActive')) {
            $query->where('isActive', filter_var($request->input('isActive'), FILTER_VALIDATE_BOOLEAN));
        }
        if ($request->filled('search')) {
            $term = trim((string)$request->input('search'));
            if ($term !== '') {
                $query->where(function($q) use ($term) {
                    $q->where('name', 'like', "%$term%")->orWhere('description', 'like', "%$term%");
                });
            }
        }
        $query->orderBy('name', 'asc');
        return response()->json($query->paginate($perPage));
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('create')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        $data = Workflow::map_campos($request->all());
        $validator = Validator::make($data, [
            'name' => ['required','string','max:120'],
            'description' => ['nullable','string'],
            'funnel_id' => ['nullable','integer','exists:funnels,id'],
            'isActive' => ['nullable','boolean'],
            'settings' => ['nullable','array'],
        ]);
        if ($validator->fails()) {
            return response()->json(['message'=>'Erro de validação','errors'=>$validator->errors()], 422);
        }
        $validated = $validator->validated();
        $wf = Workflow::create($validated);
        return response()->json($wf, 201);
    }

    /**
     * Display the specified resource.
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
        $wf = Workflow::findOrFail($id);
        return response()->json($wf);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('edit')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        $wf = Workflow::findOrFail($id);
        $data = Workflow::map_campos($request->all());
        $validator = Validator::make($data, [
            'name' => ['sometimes','required','string','max:120'],
            'description' => ['nullable','string'],
            'funnel_id' => ['nullable','integer','exists:funnels,id'],
            'isActive' => ['nullable','boolean'],
            'settings' => ['nullable','array'],
        ]);
        if ($validator->fails()) {
            return response()->json(['message'=>'Erro de validação','errors'=>$validator->errors()], 422);
        }
        $validated = $validator->validated();
        $wf->fill($validated);
        $wf->save();
        return response()->json($wf);
    }

    /**
     * Remove the specified resource from storage.
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
        $wf = Workflow::findOrFail($id);
        $wf->delete();
        return response()->json(['message'=>'Workflow excluído']);
    }

    public function toggleActive(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('edit')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        $wf = Workflow::findOrFail($id);
        $wf->isActive = !((bool)$wf->isActive);
        $wf->save();
        return response()->json($wf);
    }
}
