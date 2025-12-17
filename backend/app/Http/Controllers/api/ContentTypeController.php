<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class ContentTypeController extends Controller
{
    /**
     * Lista tipos de conteúdo (post_type=tipo_conteudo).
     * Retorna coleção simplificada para uso em selects, incluindo slug.
     */
    public function index(Request $request)
    {
        $query = Post::query()->where('post_type', 'tipo_conteudo')->where('deletado', '!=', 's');
        $items = $query->orderBy('ID')->get(['ID as id', 'post_title as nome', 'post_name as slug', 'post_status']);

        return response()->json([
            'data' => $items,
        ]);
    }

    /**
     * Cria um tipo de conteúdo.
     * Mapeamento:
     * - nome -> post_title
     * - slug -> post_name (se não informado, gera do nome)
     * - ativo (s/n) -> post_status (publish/draft)
     */
    public function store(Request $request)
    {
        $validated = Validator::make($request->all(), [
            'nome' => 'required|string|max:255',
            'slug' => 'nullable|string|max:200',
            'ativo' => 'nullable|in:s,n',
        ])->validate();

        $post = new Post();
        $post->post_type = 'tipo_conteudo';
        $post->post_title = $validated['nome'];
        // Definir post_name (slug)
        if (!empty($validated['slug'])) {
            $post->post_name = Str::slug($validated['slug']);
        } else {
            $post->post_name = $post->generateSlug($validated['nome']);
        }
        $post->post_status = ($validated['ativo'] ?? 's') === 's' ? 'publish' : 'draft';
        $post->post_author = auth()->id() ?? 0;
        $post->save();

        // Resposta com dados gravados
        $responseData = [
            'id' => $post->ID,
            'nome' => $post->post_title,
            'slug' => $post->post_name,
            'ativo' => $post->post_status === 'publish' ? 's' : 'n',
        ];
        return response()->json(['data' => $responseData], 201);
    }

    /**
     * Atualiza um tipo de conteúdo pelo ID.
     * Permite ajustar nome, status e opcionalmente slug (post_name).
     */
    public function update(Request $request, int $id)
    {
        $validated = Validator::make($request->all(), [
            'nome' => 'required|string|max:255',
            'slug' => 'nullable|string|max:200',
            'ativo' => 'nullable|in:s,n',
        ])->validate();

        $post = Post::where('post_type', 'tipo_conteudo')->findOrFail($id);
        $post->post_title = $validated['nome'];
        if (!empty($validated['slug'])) {
            $post->post_name = Str::slug($validated['slug']);
        }
        $post->post_status = ($validated['ativo'] ?? 's') === 's' ? 'publish' : 'draft';
        $post->save();

        // Resposta com dados atualizados
        $responseData = [
            'id' => $post->ID,
            'nome' => $post->post_title,
            'slug' => $post->post_name,
            'ativo' => $post->post_status === 'publish' ? 's' : 'n',
        ];
        return response()->json(['data' => $responseData]);
    }

    /**
     * Exibe um tipo de conteúdo pelo ID.
     */
    public function show(int $id)
    {
        $post = Post::where('post_type', 'tipo_conteudo')->findOrFail($id);
        return response()->json([
            'id' => $post->ID,
            'nome' => $post->post_title,
            'slug' => $post->post_name,
            'ativo' => $post->post_status === 'publish' ? 's' : 'n',
        ]);
    }

    /**
     * Remove logicamente (marca deletado) um tipo de conteúdo.
     */
    public function destroy(int $id)
    {
        $post = Post::where('post_type', 'tipo_conteudo')->findOrFail($id);
        $post->deletado = 's';
        $post->reg_deletado = now();
        $post->save();
        return response()->json(['ok' => true]);
    }
}