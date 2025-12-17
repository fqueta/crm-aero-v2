<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class UploadController extends Controller
{
    /**
     * Lista uploads (post_type=files_uload) com paginação opcional.
     * Retorna campos essenciais incluindo a URL gravada (guid).
     * Tenants: normaliza a URL para forma absoluta com base no host da requisição.
     */
    public function index(Request $request)
    {
        $query = Post::query()->where('post_type', 'files_uload')->where('deletado', '!=', 's');
        if ($request->filled('search')) {
            $query->where('post_title', 'like', '%' . $request->string('search') . '%');
        }
        // Adicionar consulta por ID se fornecido
        if ($request->filled('id')) {
            $query->where('ID', $request->integer('id'));
        }
        $items = $query->orderBy('menu_order')->orderByDesc('ID')->paginate($request->integer('per_page', 15), [
            'ID as id',
            'post_title as nome',
            'post_name as slug',
            'guid as url',
            'post_mime_type as mime',
            'post_value1 as size',
            'post_status',
            'menu_order as ordenar',
        ]);
        // Normaliza URL considerando tenants: usa asset() multi-tenant para /storage/uploads
        $items->getCollection()->transform(function ($item) {
            if (!empty($item->url)) {
                // Já absoluta e externa: mantém
                if (Str::startsWith($item->url, ['http://', 'https://'])) {
                    // Se apontar para /storage/tenant... normaliza para /storage/uploads e usa asset()
                    $pathOnly = parse_url($item->url, PHP_URL_PATH);
                    if (is_string($pathOnly) && Str::startsWith(ltrim($pathOnly, '/'), 'storage/')) {
                        $rel = ltrim($pathOnly, '/');
                        // Converte storage/tenant<id>/uploads/... -> storage/uploads/...
                        $rel = preg_replace('#^storage/tenant[^/]+/uploads/#', 'storage/uploads/', $rel);
                        // Converte para uploads/... (sem storage) e usa asset/tenant_asset
                        $rel = preg_replace('#^storage/uploads/#', 'uploads/', $rel);
                        $item->url = function_exists('tenant_asset') ? tenant_asset($rel) : asset($rel);
                    }
                    return $item;
                }
                $path = ltrim($item->url, '/');
                // Uniformiza para uploads/... (sem storage)
                if (Str::startsWith($path, 'storage/uploads/')) {
                    $path = preg_replace('#^storage/uploads/#', 'uploads/', $path);
                }
                // Usa tenant_asset() se disponível, caso contrário asset()
                $item->url = function_exists('tenant_asset') ? tenant_asset($path) : asset($path);
            }
            return $item;
        });

        return response()->json($items);
    }

    /**
     * Cria ou atualiza um upload.
     * Aceita arquivo em `arquivo` (multipart/form-data) ou campo `url`.
     * Grava a URL em `guid`, MIME em `post_mime_type` e tamanho em `post_value1`.
     * Sempre retorna no payload os campos `id` e `url` do recurso salvo.
     */
    public function store(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'id' => 'nullable|integer',
            'nome' => 'nullable|string|max:255',
            'slug' => 'nullable|string|max:200',
            'ativo' => 'nullable|in:s,n',
            'ordenar' => 'nullable|integer',
            // Regras: ao menos um entre arquivo ou url deve ser informado
            'arquivo' => 'nullable|file|required_without:url',
            'url' => 'nullable|url|required_without:arquivo',
            'descricao' => 'nullable|string',
        ])->validate();

        $post = null;
        if (!empty($validated['id'])) {
            $post = Post::where('post_type', 'files_uload')->find($validated['id']);
        }
        if (!$post) {
            $post = new Post();
            $post->post_type = 'files_uload';
        }

        // Se veio arquivo, salva no disco public
        $url = $post->guid ?? null;
        $mime = $post->post_mime_type ?? null;
        $size = $post->post_value1 ?? null;
        if ($request->file('arquivo')) {
            $file = $request->file('arquivo');
            $path = $file->store('uploads', 'public');
            // Tenants: construir URL usando tenant_asset() (se disponível) para uploads
            // $path já é 'uploads/<arquivo>' por conta do store('uploads','public')
            $relative = ltrim($path, '/'); // garante 'uploads/...' sem prefixo
            $url = function_exists('tenant_asset') ? tenant_asset($relative) : asset($relative);
            $mime = $file->getMimeType();
            $size = $file->getSize();
            // Nome padrão do arquivo
            $validated['nome'] = $validated['nome'] ?? $file->getClientOriginalName();
            $validated['slug'] = $validated['slug'] ?? pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
        } elseif (!empty($validated['url'])) {
            // URL externa
            $url = $validated['url'];
            $mime = $mime ?: null; // opcional
            $size = $size ?: null; // opcional
        }

        $post->post_title = $validated['nome'] ?? $post->post_title ?? 'arquivo';
        // Slug: normaliza se enviado; caso contrário, gera pelo nome
        if (!empty($validated['slug'])) {
            $post->post_name = Str::slug($validated['slug']);
        } elseif (empty($post->post_name)) {
            $post->post_name = $post->generateSlug($post->post_title);
        }

        // Status, ordenação e descrição
        $post->post_status = ($validated['ativo'] ?? 's') === 's' ? 'publish' : 'draft';
        $post->menu_order = (int)($validated['ordenar'] ?? 0);
        $post->post_content = $validated['descricao'] ?? ($post->post_content ?? '');

        // Metadados do arquivo
        // Persistimos caminho relativo (uploads/...) para evitar acoplar host/ambiente
        if (isset($relative)) {
            $post->guid = $relative; // caminho relativo
        } else {
            $post->guid = $url; // para URLs externas, manter absoluto
        }
        $post->post_mime_type = $mime; // MIME
        $post->post_value1 = $size; // tamanho em bytes

        // Autor: usuário autenticado, se disponível
        $user = $request->user();
        if ($user && !empty($user->id)) {
            $post->post_author = $user->id;
        } else {
            $post->post_author = $post->post_author ?? 0;
        }

        $post->save();

        // Resposta com dados gravados
        $responseData = [
            'id' => $post->ID,
            'nome' => $post->post_title,
            'slug' => $post->post_name,
            // Sempre retorna URL pública resolvida
            'url' => (function () use ($post) {
                $u = $post->guid;
                if (!empty($u)) {
                    if (Str::startsWith($u, ['http://', 'https://'])) {
                        return $u;
                    }
                    $p = ltrim($u, '/');
                    if (Str::startsWith($p, 'storage/uploads/')) {
                        $p = preg_replace('#^storage/uploads/#', 'uploads/', $p);
                    }
                    return function_exists('tenant_asset') ? tenant_asset($p) : asset($p);
                }
                return $u;
            })(),
            'mime' => $post->post_mime_type,
            'size' => $post->post_value1,
            'ativo' => $post->post_status === 'publish' ? 's' : 'n',
            'ordenar' => $post->menu_order,
            'descricao' => $post->post_content,
        ];

        return response()->json(['data' => $responseData], empty($validated['id']) ? 201 : 200);
    }

    /**
     * Atualiza um upload via rota REST (PUT/PATCH).
     * Encaminha para store() reaproveitando a validação e o mapeamento.
     */
    public function update(Request $request, int $id)
    {
        $request->merge(['id' => $id]);
        return $this->store($request);
    }

    /**
     * Exibe um upload pelo ID.
     */
    public function show(int $id)
    {
        $post = Post::where('post_type', 'files_uload')->findOrFail($id);
        // Tenants: normaliza URL usando tenant_asset() multi-tenant (se disponível)
        $url = $post->guid;
        if (!empty($url)) {
            if (Str::startsWith($url, ['http://', 'https://'])) {
                $pathOnly = parse_url($url, PHP_URL_PATH);
                if (is_string($pathOnly) && Str::startsWith(ltrim($pathOnly, '/'), 'storage/')) {
                    $rel = ltrim($pathOnly, '/');
                    $rel = preg_replace('#^storage/tenant[^/]+/uploads/#', 'storage/uploads/', $rel);
                    $rel = preg_replace('#^storage/uploads/#', 'uploads/', $rel);
                    $url = function_exists('tenant_asset') ? tenant_asset($rel) : asset($rel);
                }
            } else {
                $path = ltrim($url, '/');
                // Garantir uploads/... sem storage
                if (Str::startsWith($path, 'storage/uploads/')) {
                    $path = preg_replace('#^storage/uploads/#', 'uploads/', $path);
                }
                $url = function_exists('tenant_asset') ? tenant_asset($path) : asset($path);
            }
        }
        return response()->json([
            'id' => $post->ID,
            'nome' => $post->post_title,
            'slug' => $post->post_name,
            'url' => $url,
            'mime' => $post->post_mime_type,
            'size' => $post->post_value1,
            'ativo' => $post->post_status === 'publish' ? 's' : 'n',
            'ordenar' => $post->menu_order,
            'descricao' => $post->post_content,
        ]);
    }

    /**
     * Remove logicamente (marca deletado) um upload.
     */
    public function destroy(int $id)
    {
        $post = Post::where('post_type', 'files_uload')->findOrFail($id);
        $post->deletado = 's';
        $post->reg_deletado = now();
        $post->save();
        return response()->json(['ok' => true]);
    }
}
