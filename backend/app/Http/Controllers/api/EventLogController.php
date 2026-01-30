<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\EventLog;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class EventLogController extends Controller
{
    protected PermissionService $permissionService;

    public function __construct()
    {
        $this->permissionService = new PermissionService();
    }

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
        $query = EventLog::query()->with('actor')->orderBy('created_at', 'desc');

        if ($request->filled('entity_type')) {
            $query->where('entity_type', $request->input('entity_type'));
        }
        if ($request->filled('entity_id')) {
            $query->where('entity_id', (string)$request->input('entity_id'));
        }
        if ($request->filled('action')) {
            $query->where('action', $request->input('action'));
        }
        if ($request->filled('actor_id')) {
            $query->where('actor_id', (string)$request->input('actor_id'));
        }

        return response()->json($query->paginate($perPage));
    }

    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('create')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $validator = Validator::make($request->all(), [
            'entity_type' => ['required', 'string', 'max:50'],
            'entity_id'   => ['required', 'string', 'max:64'],
            'action'      => ['required', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
            'payload'     => ['nullable', 'array'],
        ]);
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Erro de validação',
                'errors' => $validator->errors(),
            ], 422);
        }
        $data = $validator->validated();
        $data['actor_id'] = (string)$user->id;
        $data['ip_address'] = $request->ip();

        $log = EventLog::create($data);
        return response()->json($log, 201);
    }
}
