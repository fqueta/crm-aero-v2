<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\ApiCredential;
use App\Services\PermissionService;
use App\Services\Qlib;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Http;
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
        // Segredos criptografados: pass (legado) + access_token/webhook_token (Asaas).
        foreach (['pass', 'access_token', 'webhook_token'] as $secret) {
            if (array_key_exists($secret, $config) && is_string($config[$secret]) && $config[$secret] !== '') {
                $config[$secret] = Crypt::encryptString($config[$secret]);
            }
        }
        return $config;
    }

    private function decodePasswordInConfig(array $config): array
    {
        foreach (['pass', 'access_token', 'webhook_token'] as $secret) {
            if (array_key_exists($secret, $config) && is_string($config[$secret]) && $config[$secret] !== '') {
                try {
                    $config[$secret] = Crypt::decryptString($config[$secret]);
                } catch (\Throwable $e) {
                    // Valor legado em texto puro (ex.: criado antes da cripto): mantém como está.
                    if ($secret !== 'pass') {
                        continue;
                    }
                    $config[$secret] = '';
                }
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
            $ensure('integracao-openai', 'Integração OpenAI', [
                'url' => 'https://api.openai.com/v1',
                'access_token' => '',
            ]);
            $ensure('integracao-gemini', 'Integração Gemini', [
                'url' => 'https://generativelanguage.googleapis.com',
                'access_token' => '',
            ]);
            $ensure('integracao-asaas', 'Integração Asaas', [
                'url' => 'https://sandbox.asaas.com/api/v3',
                'access_token' => '',
                'environment' => 'sandbox',
                'billing_type' => 'BOLETO',
                'webhook_token' => '',
                // Multa/juros de mora (vazio = usa o padrão da conta Asaas)
                'fine_value' => '',
                'fine_type' => 'PERCENTAGE',
                'interest_value' => '',
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
            // Asaas (integracao-asaas)
            'config.access_token' => 'nullable|string|max:1024',
            'config.environment' => 'nullable|string|in:sandbox,production',
            'config.billing_type' => 'nullable|string|in:BOLETO,PIX,CREDIT_CARD,UNDEFINED',
            'config.webhook_token' => ['nullable', 'string', 'max:255', 'regex:/^\S*$/'],
            // Multa/juros de mora (vazio = usa o padrão da conta Asaas)
            'config.fine_value' => 'nullable|numeric|min:0',
            'config.fine_type' => 'nullable|string|in:FIXED,PERCENTAGE',
            'config.interest_value' => 'nullable|numeric|min:0',
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

    /**
     * Testa a conexão com o provedor usando as credenciais informadas
     * (não salvas) ou as salvas quando `id` é enviado.
     * pt-BR: Substitui o mock do frontend — faz chamada real à API do
     * provedor (Asaas/Brevo/ZapSign/ChatGuru) ou GET genérico na URL base.
     */
    public function testConnection(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['success' => false, 'message' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('view')) {
            return response()->json(['success' => false, 'message' => 'Acesso negado'], 403);
        }

        $validator = Validator::make($request->all(), [
            'id' => 'nullable',
            'name' => 'nullable|string|max:255',
            'slug' => 'nullable|string|max:255',
            'url' => 'nullable|string|max:1024',
            'user' => 'nullable|string|max:1024',
            'pass' => 'nullable|string|max:2048',
            'produto' => 'nullable|string|max:255',
            'environment' => 'nullable|string|max:64',
            'api_key' => 'nullable|string|max:2048',
            'token' => 'nullable|string|max:2048',
            'key' => 'nullable|string|max:2048',
            'account_id' => 'nullable|string|max:255',
            'phone_id' => 'nullable|string|max:255',
            'config' => 'nullable|array',
            'meta' => 'nullable|array',
        ]);
        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'message' => 'Dados inválidos para o teste.',
                'errors' => $validator->errors(),
            ], 422);
        }
        $input = $validator->validated();

        // Base salva (quando o teste parte da tela de edição).
        $baseName = '';
        $baseSlug = '';
        $baseConfig = [];
        $baseMetaMap = [];
        if (!empty($input['id'])) {
            try {
                $item = ApiCredential::findOrFail($input['id']);
                $baseName = (string) ($item->post_title ?? '');
                $baseSlug = (string) ($item->post_name ?? '');
                $raw = is_string($item->config) ? (json_decode($item->config, true) ?? []) : ($item->config ?? []);
                $baseConfig = $this->decodePasswordInConfig(is_array($raw) ? $raw : []);
                foreach ($this->fetchMetaPairs($item->ID ?? $item->id) as $m) {
                    if (isset($m['key'])) {
                        $baseMetaMap[(string) $m['key']] = (string) ($m['value'] ?? '');
                    }
                }
            } catch (\Throwable $e) {
                return response()->json(['success' => false, 'message' => 'Integração não encontrada.'], 404);
            }
        }

        $payloadConfig = is_array($input['config'] ?? null) ? $input['config'] : [];
        $payloadMetaMap = $this->normalizeMetaMap($input['meta'] ?? null);

        $pick = function (string $key, $fallback = '') use ($input, $payloadConfig, $baseConfig, $payloadMetaMap, $baseMetaMap) {
            foreach ([
                $input[$key] ?? null,
                $payloadConfig[$key] ?? null,
                $payloadMetaMap[$key] ?? null,
                $baseConfig[$key] ?? null,
                $baseMetaMap[$key] ?? null,
            ] as $candidate) {
                if (is_string($candidate) && trim($candidate) !== '') {
                    return trim($candidate);
                }
            }
            return is_string($fallback) ? $fallback : '';
        };

        $name = trim((string) ($input['name'] ?? $payloadConfig['name'] ?? $baseName));
        $slug = trim((string) ($input['slug'] ?? $payloadConfig['slug'] ?? $baseSlug));
        $url = trim((string) ($input['url'] ?? $payloadConfig['url'] ?? $baseConfig['url'] ?? ''));
        $credUser = trim((string) ($input['user'] ?? $payloadConfig['user'] ?? $baseConfig['user'] ?? ''));
        $environment = strtolower(trim((string) (
            $input['environment'] ?? $payloadConfig['environment'] ?? $payloadConfig['produto']
            ?? $baseConfig['environment'] ?? $baseConfig['produto'] ?? $input['produto'] ?? ''
        )));

        // Token/candidatos de chave nas várias convenções de campo.
        $token = '';
        foreach (['pass', 'access_token', 'api_key', 'apiKey', 'token', 'key', 'id_api'] as $tk) {
            $v = $pick($tk);
            if ($v !== '') {
                $token = $v;
                break;
            }
        }
        if ($token === '' && isset($payloadMetaMap['webhook_token']) && $slug === '') {
            // Não usa webhook_token como auth; mantém vazio.
        }

        $provider = $this->detectProvider($name, $slug, $url);

        try {
            $result = match ($provider) {
                'asaas' => $this->probeAsaas($url, $token, $environment),
                'brevo' => $this->probeBrevo($token, $url),
                'zapsign' => $this->probeZapsign($url, $token),
                'zapguru' => $this->probeZapguru(
                    $url !== '' ? $url : ($baseConfig['url'] ?? ''),
                    $pick('key', $token),
                    $pick('account_id'),
                    $pick('phone_id')
                ),
                default => $this->probeGeneric($url, $credUser, $token),
            };
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'provider' => $provider,
                'message' => 'Falha ao testar: ' . $e->getMessage(),
            ], 400);
        }

        $result['provider'] = $provider;
        return response()->json($result, !empty($result['success']) ? 200 : 400);
    }

    /**
     * Normaliza `meta` (lista de pares ou mapa) para mapa chave => valor.
     */
    private function normalizeMetaMap(mixed $meta): array
    {
        $map = [];
        if (!is_array($meta)) {
            return $map;
        }
        foreach ($meta as $k => $m) {
            if (is_array($m) && array_key_exists('key', $m)) {
                $map[(string) $m['key']] = (string) ($m['value'] ?? '');
            } elseif (is_string($k)) {
                $map[$k] = is_string($m) ? $m : (string) ($m ?? '');
            }
        }
        return $map;
    }

    /**
     * Detecta o provedor pelo nome/slug/URL.
     */
    private function detectProvider(string $name, string $slug, string $url): string
    {
        $hay = strtolower($name . ' ' . $slug . ' ' . $url);
        if (str_contains($hay, 'asaas')) {
            return 'asaas';
        }
        if (str_contains($hay, 'brevo') || str_contains($hay, 'api.brevo.com')) {
            return 'brevo';
        }
        if (str_contains($hay, 'zapsign')) {
            return 'zapsign';
        }
        if (str_contains($hay, 'zapguru') || str_contains($hay, 'chatguru') || str_contains($hay, 'chat.guru')) {
            return 'zapguru';
        }
        return 'generic';
    }

    /**
     * Asaas: GET {base}/finance/balance com header access_token.
     */
    private function probeAsaas(string $url, string $apiKey, string $environment): array
    {
        if ($apiKey === '' || $apiKey === 'apikey') {
            return ['success' => false, 'message' => 'Informe a API Key do Asaas para testar.'];
        }
        $base = $url !== '' ? rtrim($url, '/') : (
            $environment === 'production'
                ? 'https://api.asaas.com/v3'
                : 'https://sandbox.asaas.com/api/v3'
        );
        try {
            $resp = Http::withHeaders([
                'access_token' => $apiKey,
                'User-Agent' => 'CrmAero/1.0',
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ])->timeout(12)->get($base . '/finance/balance');
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => 'Asaas: falha de comunicação (' . $e->getMessage() . ').'];
        }
        if ($resp->successful()) {
            return ['success' => true, 'message' => 'Conexão com Asaas estabelecida com sucesso!'];
        }
        $decoded = $resp->json() ?? [];
        $detail = '';
        if (is_array($decoded)) {
            $errors = $decoded['errors'] ?? [];
            if (is_array($errors) && !empty($errors[0]['description'])) {
                $detail = (string) $errors[0]['description'];
            } elseif (!empty($decoded['message'])) {
                $detail = (string) $decoded['message'];
            }
        }
        if (in_array($resp->status(), [401, 403], true)) {
            return ['success' => false, 'http_status' => $resp->status(), 'message' => 'Asaas: API Key inválida ou sem permissão.' . ($detail !== '' ? ' (' . $detail . ')' : '')];
        }
        return ['success' => false, 'http_status' => $resp->status(), 'message' => 'Asaas: falha ao conectar (HTTP ' . $resp->status() . ').' . ($detail !== '' ? ' ' . $detail : '')];
    }

    /**
     * Brevo: GET {base}/account com header api-key.
     */
    private function probeBrevo(string $apiKey, string $url): array
    {
        if ($apiKey === '') {
            return ['success' => false, 'message' => 'Informe a API Key do Brevo (campo Senha/Token) para testar.'];
        }
        $base = str_contains(strtolower($url), 'brevo')
            ? rtrim(explode('?', $url)[0], '/')
            : 'https://api.brevo.com/v3';
        try {
            $resp = Http::withHeaders([
                'api-key' => $apiKey,
                'Accept' => 'application/json',
            ])->timeout(12)->get($base . '/account');
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => 'Brevo: falha de comunicação (' . $e->getMessage() . ').'];
        }
        if ($resp->successful()) {
            $data = $resp->json() ?? [];
            $email = is_array($data) ? ($data['email'] ?? '') : '';
            return ['success' => true, 'message' => 'Conexão com Brevo estabelecida com sucesso!' . ($email !== '' ? " Conta: {$email}." : '')];
        }
        if (in_array($resp->status(), [401, 403], true)) {
            return ['success' => false, 'http_status' => $resp->status(), 'message' => 'Brevo: API Key inválida ou sem permissão.'];
        }
        return ['success' => false, 'http_status' => $resp->status(), 'message' => 'Brevo: falha ao conectar (HTTP ' . $resp->status() . ').'];
    }

    /**
     * ZapSign: GET {base}/docs/?page=1&page_size=1 com Bearer token.
     */
    private function probeZapsign(string $url, string $token): array
    {
        $clean = preg_replace('/^\s*Bearer\s+/i', '', trim($token));
        if ($clean === '') {
            return ['success' => false, 'message' => 'Informe o API Token do ZapSign (campo Senha/Token ou id_api) para testar.'];
        }
        $base = $url !== '' ? rtrim(explode('?', $url)[0], '/') : 'https://api.zapsign.com.br/api/v1';
        try {
            $resp = Http::withHeaders([
                'Authorization' => 'Bearer ' . $clean,
                'Accept' => 'application/json',
            ])->timeout(12)->get($base . '/docs/', ['page' => 1, 'page_size' => 1]);
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => 'ZapSign: falha de comunicação (' . $e->getMessage() . ').'];
        }
        if ($resp->successful()) {
            return ['success' => true, 'message' => 'Conexão com ZapSign estabelecida com sucesso!'];
        }
        if ($resp->status() === 402) {
            return ['success' => true, 'message' => 'Token ZapSign válido, mas a conta está sem plano de API (HTTP 402).'];
        }
        if (in_array($resp->status(), [401, 403], true)) {
            return ['success' => false, 'http_status' => $resp->status(), 'message' => 'ZapSign: token inválido ou sem permissão.'];
        }
        return ['success' => false, 'http_status' => $resp->status(), 'message' => 'ZapSign: falha ao conectar (HTTP ' . $resp->status() . ').'];
    }

    /**
     * ChatGuru/ZapGuru: POST asForm action=message_status (somente leitura,
     * sem efeitos colaterais) com um message_id inexistente.
     * Com credenciais válidas a API responde 400 "message_id inválida" — o que
     * prova que a autenticação passou. Erros citando key/account_id/phone_id
     * como inválidos (ou HTTP 401/403) indicam credencial errada.
     * Documentação: https://wiki.chatguru.com.br/documentacao-api/parametros-obrigatorios
     */
    private function probeZapguru(string $url, string $key, string $accountId, string $phoneId): array
    {
        if ($key === '' || $accountId === '') {
            return ['success' => false, 'message' => 'Informe key e account_id do ChatGuru (Senha/Token e metacampos) para testar.'];
        }
        $base = $url !== '' ? trim(explode('?', $url)[0]) : 'https://s4.chatguru.app/api/v1';
        $base = rtrim($base, '/');
        // A API exige key+account_id+phone_id em todas as requisições.
        $payload = [
            'key' => $key,
            'account_id' => $accountId,
            'action' => 'message_status',
            'message_id' => '000000000000000000000000',
        ];
        if ($phoneId !== '') {
            $payload['phone_id'] = $phoneId;
        }
        try {
            $resp = Http::asForm()->acceptJson()->timeout(12)->post($base, $payload);
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => 'ChatGuru: falha de comunicação (' . $e->getMessage() . ').'];
        }
        $data = [];
        try {
            $data = $resp->json() ?? [];
        } catch (\Throwable $e) {
            $data = [];
        }
        $code = is_array($data) ? (int) ($data['code'] ?? 0) : 0;
        $description = is_array($data) ? (string) ($data['description'] ?? '') : '';
        if ($resp->successful() && in_array($code, [200, 201], true)) {
            return ['success' => true, 'message' => 'Conexão com ChatGuru estabelecida com sucesso!'];
        }
        if ($description === '') {
            return ['success' => false, 'http_status' => $resp->status(), 'message' => 'ChatGuru: resposta inesperada (HTTP ' . $resp->status() . '). Verifique a URL base.'];
        }
        // Falha de autenticação: a API cita a credencial como inválida/ausente.
        // (Regex com modificador `u`: sem ele, classes acentuadas nunca casam UTF-8.)
        $mentionsCredential = (bool) preg_match('/\bkey\b|account_id|phone_id|\bconta\b|\bchave\b/ui', $description);
        $mentionsInvalid = (bool) preg_match('/inv[aá]lid|invalid|incorret|n[aã]o encontrad|inexistente|unauthor|forbidden|negad|denied|sem permiss/ui', $description);
        if (in_array($resp->status(), [401, 403], true)
            || preg_match('/acesso negado|access denied/ui', $description)
            || ($mentionsCredential && $mentionsInvalid)) {
            return ['success' => false, 'http_status' => $resp->status(), 'message' => 'ChatGuru: key/account_id/phone_id inválidos.' . ($description !== '' ? " ({$description})" : '')];
        }
        // Qualquer outro erro (ex.: "message_id inválida") significa que a
        // autenticação passou — as credenciais estão válidas.
        return ['success' => true, 'message' => 'Conexão com ChatGuru estabelecida com sucesso! (autenticação aceita)'];
    }

    /**
     * Genérico: GET na URL base, com Basic (user+pass) ou Bearer (só pass).
     */
    private function probeGeneric(string $url, string $credUser, string $token): array
    {
        if ($url === '') {
            return ['success' => false, 'message' => 'Informe a URL da API para testar.'];
        }
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            return ['success' => false, 'message' => 'URL inválida para teste.'];
        }
        try {
            $req = Http::acceptJson()->timeout(12);
            if ($credUser !== '' && $token !== '') {
                $req = $req->withBasicAuth($credUser, $token);
            } elseif ($token !== '') {
                $req = $req->withHeaders(['Authorization' => 'Bearer ' . $token]);
            }
            $resp = $req->get($url);
        } catch (\Throwable $e) {
            return ['success' => false, 'message' => 'Falha de comunicação com a URL (' . $e->getMessage() . ').'];
        }
        if ($resp->successful()) {
            return ['success' => true, 'http_status' => $resp->status(), 'message' => 'Conexão estabelecida com sucesso!'];
        }
        if (in_array($resp->status(), [401, 403], true)) {
            return ['success' => false, 'http_status' => $resp->status(), 'message' => 'URL acessível, mas a autenticação falhou (HTTP ' . $resp->status() . '). Verifique usuário/token.'];
        }
        if ($resp->status() === 404) {
            return ['success' => false, 'http_status' => 404, 'message' => 'Servidor acessível, mas a URL retornou 404. Verifique a URL base.'];
        }
        return ['success' => false, 'http_status' => $resp->status(), 'message' => 'A URL respondeu com HTTP ' . $resp->status() . '. Verifique a URL/credenciais.'];
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
            // Asaas (integracao-asaas)
            'config.access_token' => 'nullable|string|max:1024',
            'config.environment' => 'nullable|string|in:sandbox,production',
            'config.billing_type' => 'nullable|string|in:BOLETO,PIX,CREDIT_CARD,UNDEFINED',
            'config.webhook_token' => ['nullable', 'string', 'max:255', 'regex:/^\S*$/'],
            // Multa/juros de mora (vazio = usa o padrão da conta Asaas)
            'config.fine_value' => 'nullable|numeric|min:0',
            'config.fine_type' => 'nullable|string|in:FIXED,PERCENTAGE',
            'config.interest_value' => 'nullable|numeric|min:0',
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
