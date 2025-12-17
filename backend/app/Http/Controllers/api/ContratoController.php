<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ContratoController extends Controller
{
    /**
     * List contracts (post_type = 'contratos') with optional pagination and filters.
     * Supports filters: name (search in post_title), slug (post_name), id_curso (config.id_curso), periodo (config.periodo), ativo (publish/draft).
     */
    public function index(Request $request)
    {
        $perPage = (int)($request->input('per_page') ?: 20);
        $query = Post::query()->ofType('contratos');

        if ($request->filled('name')) {
            $query->where('post_title', 'like', '%' . $request->input('name') . '%');
        }

        if ($request->filled('slug')) {
            $query->where('post_name', $request->input('slug'));
        }

        if ($request->filled('ativo')) {
            // Expect 'publish' or 'draft'
            $query->where('post_status', $request->input('ativo'));
        }

        if ($request->filled('id_curso')) {
            $query->where(function ($q) use ($request) {
                $q->where('config->id_curso', (int)$request->input('id_curso'))
                  ->orWhere('post_parent', (int)$request->input('id_curso'));
            });
        }

        if ($request->filled('periodo')) {
            $query->where('config->periodo', $request->input('periodo'));
        }

        $query->orderBy('menu_order')->orderByDesc('ID');

        $paginator = $query->paginate($perPage);
        $paginator->getCollection()->transform(function ($item) {
            return [
                'id' => $item->ID,
                'nome' => $item->post_title,
                'slug' => $item->post_name,
                'conteudo' => $item->post_content,
                'id_curso' => $item->config['id_curso'] ?? ($item->post_parent ?: null),
                'periodo' => $item->config['periodo'] ?? null,
                'ativo' => $item->post_status,
            ];
        });

        return response()->json($paginator);
    }

    /**
     * Create a new contract (post_type = 'contratos').
     * Maps: nome->post_title, slug->post_name (auto if empty), conteudo->post_content, id_curso->config.id_curso/post_parent, periodo->config.periodo, ativo->post_status.
     */
    public function store(Request $request)
    {
        $data = $request->all();
        $validator = Validator::make($data, [
            'nome' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'conteudo' => 'nullable|string',
            'id_curso' => 'nullable|integer',
            'periodo' => 'nullable|string|max:150',
            'ativo' => 'nullable|in:publish,draft'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $post = new Post();
        $post->post_type = 'contratos';
        $post->post_title = $data['nome'];
        $post->post_content = $data['conteudo'] ?? '';
        $post->post_status = $data['ativo'] ?? 'publish';
        $post->menu_order = $data['ordenar'] ?? 0;

        // slug generation
        $post->post_name = !empty($data['slug']) ? $data['slug'] : Post::generateSlug($data['nome']);

        // parent and config
        if (!empty($data['id_curso'])) {
            $post->post_parent = (int)$data['id_curso'];
        }
        $post->config = [
            'id_curso' => $data['id_curso'] ?? null,
            'periodo' => $data['periodo'] ?? null,
        ];

        $post->save();

        return response()->json([
            'id' => $post->ID,
            'nome' => $post->post_title,
            'slug' => $post->post_name,
            'conteudo' => $post->post_content,
            'id_curso' => $post->config['id_curso'] ?? ($post->post_parent ?: null),
            'periodo' => $post->config['periodo'] ?? null,
            'ativo' => $post->post_status,
        ], 201);
    }

    /**
     * Show a single contract by ID.
     */
    public function show($id)
    {
        $post = Post::ofType('contratos')->findOrFail($id);
        return response()->json([
            'id' => $post->ID,
            'nome' => $post->post_title,
            'slug' => $post->post_name,
            'conteudo' => $post->post_content,
            'id_curso' => $post->config['id_curso'] ?? ($post->post_parent ?: null),
            'periodo' => $post->config['periodo'] ?? null,
            'ativo' => $post->post_status,
        ]);
    }

    /**
     * Update a contract.
     */
    public function update(Request $request, $id)
    {
        $post = Post::ofType('contratos')->findOrFail($id);

        $data = $request->all();
        $validator = Validator::make($data, [
            'nome' => 'nullable|string|max:255',
            'slug' => 'nullable|string|max:255',
            'conteudo' => 'nullable|string',
            'id_curso' => 'nullable|integer',
            'periodo' => 'nullable|string|max:150',
            'ativo' => 'nullable|in:publish,draft'
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if (isset($data['nome'])) {
            $post->post_title = $data['nome'];
            // regenerate slug if not provided but name changed
            if (empty($data['slug'])) {
                $post->post_name = Post::generateSlug($data['nome']);
            }
        }

        if (isset($data['slug']) && $data['slug'] !== null) {
            $post->post_name = $data['slug'];
        }

        if (isset($data['conteudo'])) {
            $post->post_content = $data['conteudo'];
        }

        if (isset($data['ativo'])) {
            $post->post_status = $data['ativo'];
        }

        if (array_key_exists('id_curso', $data)) {
            $post->post_parent = $data['id_curso'] ? (int)$data['id_curso'] : null;
        }

        // update config while keeping other keys
        $config = is_array($post->config) ? $post->config : [];
        if (array_key_exists('id_curso', $data)) {
            $config['id_curso'] = $data['id_curso'];
        }
        if (array_key_exists('periodo', $data)) {
            $config['periodo'] = $data['periodo'];
        }
        $post->config = $config;

        $post->save();

        return response()->json([
            'id' => $post->ID,
            'nome' => $post->post_title,
            'slug' => $post->post_name,
            'conteudo' => $post->post_content,
            'id_curso' => $post->config['id_curso'] ?? ($post->post_parent ?: null),
            'periodo' => $post->config['periodo'] ?? null,
            'ativo' => $post->post_status,
        ]);
    }

    /**
     * Soft delete a contract (sets `delete` flag to 's').
     */
    public function destroy($id)
    {
        $post = Post::ofType('contratos')->findOrFail($id);
        $post->delete = 's';
        $post->save();
        return response()->json(['message' => 'Contrato movido para lixeira.']);
    }

    /**
     * List trashed contracts (where delete = 's').
     */
    public function trash(Request $request)
    {
        $perPage = (int)($request->input('per_page') ?: 20);
        $query = Post::withoutGlobalScopes()->ofType('contratos')->where('delete', 's');
        $query->orderByDesc('ID');
        $paginator = $query->paginate($perPage);
        $paginator->getCollection()->transform(function ($item) {
            return [
                'id' => $item->ID,
                'nome' => $item->post_title,
                'slug' => $item->post_name,
                'ativo' => $item->post_status,
            ];
        });
        return response()->json($paginator);
    }

    /**
     * Restore a trashed contract (sets `delete` flag to 'n').
     */
    public function restore($id)
    {
        $post = Post::withoutGlobalScopes()->ofType('contratos')->where('delete', 's')->findOrFail($id);
        $post->delete = 'n';
        $post->save();
        return response()->json(['message' => 'Contrato restaurado com sucesso.']);
    }

    /**
     * Force delete a contract (permanent removal).
     */
    public function forceDelete($id)
    {
        $post = Post::withoutGlobalScopes()->ofType('contratos')->findOrFail($id);
        $post->delete();
        return response()->json(['message' => 'Contrato excluído permanentemente.']);
    }
}