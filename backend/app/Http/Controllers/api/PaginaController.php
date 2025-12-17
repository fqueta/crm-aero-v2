<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class PaginaController extends Controller
{
    /**
     * Lista páginas (post_type=paginas) com paginação opcional.
     * Retorna campos essenciais incluindo slug.
     */
    public function index(Request $request)
    {
        $query = Post::query()->where('post_type', 'paginas')->where('deletado', '!=', 's');
        if ($request->filled('search')) {
            $query->where('post_title', 'like', '%' . $request->string('search') . '%');
        }
        $items = $query->orderBy('menu_order')->orderByDesc('ID')->paginate($request->integer('per_page', 15), [
            'ID as id',
            'post_title as nome',
            'post_name as slug',
            'post_status',
            'menu_order as ordenar',
        ]);

        return response()->json($items);
    }

    /**
     * Cria ou atualiza uma página baseada no payload informado.
     * Mapeamento:
     * - nome -> post_title
     * - slug -> post_name (se vazio, gera automaticamente)
     * - ativo (s/n) -> post_status (publish/draft)
     * - conteudo -> post_content (HTML)
     * - ordenar -> menu_order
     * - autor -> preenchido automaticamente do usuário autenticado
     */
    public function store(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'id' => 'nullable|integer',
            'nome' => 'required|string|max:255',
            'slug' => 'nullable|string|max:200',
            'ativo' => 'nullable|in:s,n',
            'conteudo' => 'nullable|string',
            'ordenar' => 'nullable|integer',
        ])->validate();

        $post = null;
        if (!empty($validated['id'])) {
            $post = Post::where('post_type', 'paginas')->find($validated['id']);
        }
        if (!$post) {
            $post = new Post();
            $post->post_type = 'paginas';
        }

        $post->post_title = $validated['nome'];
        // Slug: normaliza se enviado; caso contrário, gera pelo nome
        if (!empty($validated['slug'])) {
            $post->post_name = Str::slug($validated['slug']);
        } elseif (empty($post->post_name)) {
            $post->post_name = $post->generateSlug($validated['nome']);
        }
        $post->post_status = ($validated['ativo'] ?? 's') === 's' ? 'publish' : 'draft';
        $post->post_content = $validated['conteudo'] ?? '';
        $post->menu_order = (int)($validated['ordenar'] ?? 0);

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
            'ativo' => $post->post_status === 'publish' ? 's' : 'n',
            'conteudo' => $post->post_content,
            'ordenar' => $post->menu_order,
        ];

        return response()->json(['data' => $responseData], empty($validated['id']) ? 201 : 200);
    }

    /**
     * Atualiza uma página via rota REST (PUT/PATCH).
     * Encaminha para store() reaproveitando a validação e o mapeamento.
     */
    public function update(Request $request, int $id)
    {
        $request->merge(['id' => $id]);
        return $this->store($request);
    }

    /**
     * Exibe uma página pelo ID.
     */
    public function show(int $id)
    {
        $post = Post::where('post_type', 'paginas')->findOrFail($id);
        return response()->json([
            'id' => $post->ID,
            'nome' => $post->post_title,
            'slug' => $post->post_name,
            'ativo' => $post->post_status === 'publish' ? 's' : 'n',
            'conteudo' => $post->post_content,
            'ordenar' => $post->menu_order,
        ]);
    }

    /**
     * Remove logicamente (marca deletado) uma página.
     */
    public function destroy(int $id)
    {
        $post = Post::where('post_type', 'paginas')->findOrFail($id);
        $post->deletado = 's';
        $post->reg_deletado = now();
        $post->save();
        return response()->json(['ok' => true]);
    }
}