<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\ApiCredential;
use App\Services\PermissionService;
use App\Services\Qlib;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Schema;

class ApiCredentialController extends Controller
{
    protected PermissionService $permissionService;

    public function __construct()
    {
        $this->permissionService = new PermissionService();
    }

    private function sanitize($input)
    {
        if (is_array($input)) {
            $sanitized = [];
            foreach ($input as $k => $v) {
                $sanitized[$k] = $this->sanitize($v);
            }
            return $sanitized;
        }
        if (is_string($input)) {
            return trim(strip_tags($input));
        }
        return $input;
    }

    private function encodePasswordInConfig(array $config): array
    {
        if (array_key_exists('pass', $config) && is_string($config['pass']) && $config['pass'] !== '') {
            $config['pass'] = Crypt::encryptString($config['pass']);
        }
        return $config;
    }

    private function decodePasswordInConfig(array $config): array
    {
        if (array_key_exists('pass', $config) && is_string($config['pass']) && $config['pass'] !== '') {
            try {
                $config['pass'] = Crypt::decryptString($config['pass']);
            } catch (\Throwable $e) {
                $config['pass'] = '';
            }
        }
        return $config;
    }
    private function fetchMetaPairs(int|string $postId): array
    {
        try {
            $rows = DB::table('postmeta')
                ->where('post_id', $postId)
                ->select(['meta_key', 'meta_value'])
                ->get();
            return $rows->map(function($r){
                return ['key' => $r->meta_key, 'value' => (string)($r->meta_value ?? '')];
            })->toArray();
        } catch (\Throwable $e) {
            return [];
        }
    }

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        // if (!$this->permissionService->isHasPermission('view')) {
        //     return response()->json(['error' => 'Acesso negado'], 403);
        // }
        // Auto-bootstrap: cria integrações padrão se não existirem
        try {
            $ensure = function(string $slug, string $title, array $config) use ($user) {
                $exists = ApiCredential::where('post_name', $slug)->first();
                if (!$exists) {
                    ApiCredential::create([
                        'post_title' => $title,
                        'post_type' => 'api_credentials',
                        'post_name' => $slug,
                        'post_status' => 'publish',
                        'post_author' => $user->id,
                        'comment_status' => 'closed',
                        'ping_status' => 'closed',
                        'menu_order' => 0,
                        'comment_count' => 0,
                        'excluido' => 'n',
                        'deletado' => 'n',
                        'token' => Qlib::token(),
                        'config' => json_encode($this->encodePasswordInConfig($config)),
                    ]);
                }
            };
            $ensure('zapsign', 'ZapSign', [
                'url' => 'https://api.zapsign.com.br/api/v1',
                'id_api' => '',
            ]);
            $ensure('zapguru', 'ZapGuru', [
                'url' => 'https://s4.chatguru.app/api/v1',
                'key' => '',
                'account_id' => '',
                'phone_id' => '',
            ]);
        } catch (\Throwable $e) {
            // silencioso
        }
        $perPage = $request->input('per_page', 10);
        $order_by = $request->input('order_by', 'created_at');
        $order = $request->input('order', 'desc');
        $query = ApiCredential::query()->orderBy($order_by, $order);
        if ($request->filled('name')) {
            $query->where('post_title', 'like', '%' . $request->input('name') . '%');
        }
        if ($request->filled('slug')) {
            $query->where('post_name', 'like', '%' . $request->input('slug') . '%');
        }
        $items = $query->paginate($perPage);
        $items->getCollection()->transform(function ($item) {
            $cfg = is_string($item->config) ? (json_decode($item->config, true) ?? []) : ($item->config ?? []);
            $item->config = $this->decodePasswordInConfig($cfg);
            return [
                'id' => $item->ID ?? $item->id,
                'name' => $item->post_title ?? '',
                'slug' => $item->post_name ?? '',
                'active' => ($item->post_status ?? '') === 'publish',
                'config' => $item->config,
                'meta' => $this->fetchMetaPairs($item->ID ?? $item->id),
                'created_at' => $item->created_at ?? null,
                'updated_at' => $item->updated_at ?? null,
            ];
        });
        return response()->json($items);
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
            'name' => 'required|string|max:255',
            'active' => 'boolean',
            'config' => 'required|array',
            'config.url' => 'required|string|max:1024',
            'config.user' => 'nullable|string|max:255',
            'config.pass' => 'nullable|string|max:1024',
            'config.produto' => 'nullable|string|max:255',
            'meta' => 'array',
            'meta.*.key' => 'required|string|max:255',
            'meta.*.value' => 'nullable|string',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Erro de validação',
                'errors' => $validator->errors(),
            ], 422);
        }
        $data = $this->sanitize($validator->validated());
        $existsInTrash = ApiCredential::withoutGlobalScope('notDeleted')
            ->where('post_title', $data['name'])
            ->where(function($q){
                $q->where('deletado','s')->orWhere('excluido','s');
            })->first();
        if ($existsInTrash) {
            return response()->json([
                'message' => 'Este registro já está em nossa base de dados, verifique na lixeira.',
                'errors' => ['name' => ['Registro com este nome está na lixeira']],
            ], 422);
        }
        $payload = [
            'post_title' => $data['name'],
            'post_type' => 'api_credentials',
            'post_name' => \Illuminate\Support\Str::slug($data['name']),
            'post_status' => ($data['active'] ?? true) ? 'publish' : 'draft',
            'post_author' => $user->id,
            'comment_status' => 'closed',
            'ping_status' => 'closed',
            'menu_order' => 0,
            'comment_count' => 0,
            'excluido' => 'n',
            'deletado' => 'n',
            'token' => Qlib::token(),
            'config' => json_encode($this->encodePasswordInConfig($data['config'] ?? [])),
        ];
        $created = ApiCredential::create($payload);
        // Persistir metas (text)
        $metas = $data['meta'] ?? [];
        if (is_array($metas)) {
            foreach ($metas as $m) {
                $mk = is_array($m) ? ($m['key'] ?? null) : null;
                $mv = is_array($m) ? ($m['value'] ?? null) : null;
                if ($mk !== null) {
                    Qlib::update_postmeta($created->ID ?? $created->id, (string)$mk, (string)($mv ?? ''));
                }
            }
        }
        $cfg = json_decode($created->config ?? '[]', true) ?? [];
        $created->config = $this->decodePasswordInConfig($cfg);
        return response()->json([
            'data' => [
                'id' => $created->ID ?? $created->id,
                'name' => $created->post_title ?? '',
                'slug' => $created->post_name ?? '',
                'active' => ($created->post_status ?? '') === 'publish',
                'config' => $created->config,
                'meta' => $this->fetchMetaPairs($created->ID ?? $created->id),
            ],
            'message' => 'Credencial criada com sucesso',
            'status' => 201,
        ], 201);
    }

    public function show(string $id)
    {
        $user = request()->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('view')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        $item = ApiCredential::findOrFail($id);
        $cfg = is_string($item->config) ? (json_decode($item->config, true) ?? []) : ($item->config ?? []);
        $item->config = $this->decodePasswordInConfig($cfg);
        return response()->json([
            'data' => [
                'id' => $item->ID ?? $item->id,
                'name' => $item->post_title ?? '',
                'slug' => $item->post_name ?? '',
                'active' => ($item->post_status ?? '') === 'publish',
                'config' => $item->config,
                'meta' => $this->fetchMetaPairs($item->ID ?? $item->id),
            ],
            'status' => 200,
        ], 200);
    }

    /**
     * Coletor rápido por slug (post_name)
     * pt-BR: Retorna um array com dados e metacampos da credencial, buscando por post_name.
     * en-US: Returns an array with credential data and meta fields, looked up by post_name.
     *
     * @param string $postName Slug (post_name) da credencial
     * @return array Estrutura: [id,name,slug,active,config,meta[]] ou []
     */
    public function get(string $postName): array
    {
        $item = ApiCredential::where('post_name', $postName)->first();
        if (!$item) {
            return [];
        }
        $cfg = is_string($item->config) ? (json_decode($item->config, true) ?? []) : ($item->config ?? []);
        $cfg = $this->decodePasswordInConfig($cfg);
        return [
            'id' => $item->ID ?? $item->id,
            'name' => $item->post_title ?? '',
            'slug' => $item->post_name ?? '',
            'active' => ($item->post_status ?? '') === 'publish',
            'config' => $cfg,
            'meta' => $this->fetchMetaPairs($item->ID ?? $item->id),
        ];
    }

    public function update(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('edit')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        $item = ApiCredential::findOrFail($id);
        $validator = Validator::make($request->all(), [
            'name' => ['sometimes', 'required', 'string', 'max:255', Rule::unique('posts', 'post_title')->ignore($item->ID, 'ID')],
            'active' => 'boolean',
            'config' => 'sometimes|array',
            'config.url' => 'sometimes|required|string|max:1024',
            'config.user' => 'nullable|string|max:255',
            'config.pass' => 'nullable|string|max:1024',
            'config.produto' => 'nullable|string|max:255',
            'meta' => 'array',
            'meta.*.key' => 'required|string|max:255',
            'meta.*.value' => 'nullable|string',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'exec' => false,
                'message' => 'Erro de validação',
                'errors' => $validator->errors(),
            ], 422);
        }
        $data = $this->sanitize($validator->validated());
        $mapped = [];
        if (isset($data['name'])) {
            $mapped['post_title'] = $data['name'];
            $mapped['post_name'] = \Illuminate\Support\Str::slug($data['name']);
        }
        if (isset($data['active'])) {
            $mapped['post_status'] = $data['active'] ? 'publish' : 'draft';
        }
        if (array_key_exists('config', $data)) {
            $mapped['config'] = json_encode($this->encodePasswordInConfig($data['config'] ?? []));
        }
        $mapped['post_type'] = 'api_credentials';
        $item->update($mapped);
        // Atualizar metas (text) e remover chaves ausentes
        if (array_key_exists('meta', $data) && is_array($data['meta'])) {
            $postId = $item->ID ?? $item->id;
            $providedKeys = [];
            foreach ($data['meta'] as $m) {
                $mk = is_array($m) ? ($m['key'] ?? null) : null;
                $mv = is_array($m) ? ($m['value'] ?? null) : null;
                if ($mk !== null) {
                    $providedKeys[] = (string)$mk;
                    Qlib::update_postmeta($postId, (string)$mk, (string)($mv ?? ''));
                }
            }
            try {
                $existingKeys = \Illuminate\Support\Facades\DB::table('postmeta')
                    ->where('post_id', $postId)
                    ->pluck('meta_key')
                    ->toArray();
                $toDelete = array_diff($existingKeys, $providedKeys);
                foreach ($toDelete as $delKey) {
                    Qlib::delete_postmeta($postId, $delKey);
                }
            } catch (\Throwable $e) {
                // Silencioso: remoção de chaves ausentes é best-effort
            }
        }
        $cfg = json_decode($item->config ?? '[]', true) ?? [];
        $item->config = $this->decodePasswordInConfig($cfg);
        return response()->json([
            'exec' => true,
            'data' => [
                'id' => $item->ID ?? $item->id,
                'name' => $item->post_title ?? '',
                'slug' => $item->post_name ?? '',
                'active' => ($item->post_status ?? '') === 'publish',
                'config' => $item->config,
                'meta' => $this->fetchMetaPairs($item->ID ?? $item->id),
            ],
            'message' => 'Credencial atualizada com sucesso',
            'status' => 200,
        ]);
    }

    public function destroy(string $id)
    {
        $user = request()->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('delete')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        $item = ApiCredential::find($id);
        if (!$item) {
            return response()->json(['error' => 'Registro não encontrado'], 404);
        }
        $item->update([
            'excluido' => 's',
            'deletado' => 's',
            'reg_deletado' => json_encode([
                'data' => now()->toDateTimeString(),
                'user_id' => $user->id,
            ]),
        ]);
        return response()->json(['message' => 'Registro marcado como deletado com sucesso'], 200);
    }

    public function trash(Request $request)
    {
        $user = request()->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('view')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        $perPage = $request->input('per_page', 10);
        $order_by = $request->input('order_by', 'created_at');
        $order = $request->input('order', 'desc');
        $query = ApiCredential::withoutGlobalScope('notDeleted')
            ->where(function($q){
                $q->where('deletado','s')->orWhere('excluido','s');
            })->orderBy($order_by, $order);
        $items = $query->paginate($perPage);
        $items->getCollection()->transform(function ($item) {
            $cfg = is_string($item->config) ? (json_decode($item->config, true) ?? []) : ($item->config ?? []);
            $item->config = $this->decodePasswordInConfig($cfg);
            return [
                'id' => $item->ID ?? $item->id,
                'name' => $item->post_title ?? '',
                'slug' => $item->post_name ?? '',
                'active' => ($item->post_status ?? '') === 'publish',
                'config' => $item->config,
                'meta' => $this->fetchMetaPairs($item->ID ?? $item->id),
            ];
        });
        return response()->json($items);
    }

    public function restore(string $id)
    {
        $user = request()->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('edit')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        $item = ApiCredential::withoutGlobalScope('notDeleted')
            ->where('ID', $id)
            ->where(function($q){
                $q->where('deletado','s')->orWhere('excluido','s');
            })->first();
        if (!$item) {
            return response()->json(['error' => 'Registro não encontrado na lixeira'], 404);
        }
        $item->update([
            'excluido' => 'n',
            'deletado' => 'n',
            'reg_excluido' => null,
            'reg_deletado' => null,
        ]);
        return response()->json(['message' => 'Registro restaurado com sucesso'], 200);
    }

    public function forceDelete(string $id)
    {
        $user = request()->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('delete')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        $item = ApiCredential::withoutGlobalScope('notDeleted')
            ->where('ID', $id)
            ->where(function($q){
                $q->where('deletado','s')->orWhere('excluido','s');
            })->first();
        if (!$item) {
            return response()->json(['error' => 'Registro não encontrado na lixeira'], 404);
        }
        $item->forceDelete();
        return response()->json(['message' => 'Registro excluído permanentemente'], 200);
    }
}
