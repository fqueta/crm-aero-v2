<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PeriodoController extends Controller
{
    /**
     * index
     * pt-BR: Lista períodos (post_type = 'periodos') com paginação e filtros opcionais.
     *        Filtros: name (post_title), slug (post_name), id_curso (config.id_curso/post_parent), status (publish/draft).
     * en-US: Lists periods (post_type = 'periodos') with pagination and optional filters.
     *        Filters: name (post_title), slug (post_name), id_curso (config.id_curso/post_parent), status (publish/draft).
     */
    public function index(Request $request)
    {
        $perPage = (int)($request->input('per_page') ?: 20);
        $query = Post::query()->ofType('periodos');

        if ($request->filled('name')) {
            $query->where('post_title', 'like', '%' . $request->input('name') . '%');
        }

        if ($request->filled('slug')) {
            $query->where('post_name', $request->input('slug'));
        }

        if ($request->filled('status')) {
            $query->where('post_status', $request->input('status'));
        }

        if ($request->filled('id_curso')) {
            $query->where(function ($q) use ($request) {
                $q->where('config->id_curso', (int)$request->input('id_curso'))
                  ->orWhere('post_parent', (int)$request->input('id_curso'));
            });
        }

        $query->orderBy('menu_order')->orderByDesc('ID');

        $paginator = $query->paginate($perPage);
        $paginator->getCollection()->transform(function ($item) {
            return [
                'id' => $item->ID,
                'nome' => $item->post_title,
                'slug' => $item->post_name,
                'id_curso' => $item->config['id_curso'] ?? ($item->post_parent ?: null),
                // id_contratos: retorna array de IDs armazenados em config (se houver)
                'id_contratos' => $item->config['id_contratos'] ?? [],
                // valor: retorna o valor do período se presente em config
                'valor' => $item->config['valor'] ?? null,
                // tipo_modulo: 1 Teórico, 2 Prático, 3 Teórico/Prático
                'tipo_modulo' => $item->config['tipo_modulo'] ?? null,
                // cursos_incluidos: IDs de cursos vinculados
                'cursos_incluidos' => $item->config['cursos_incluidos'] ?? [],
                // novos campos opcionais
                'h_praticas' => $item->config['h_praticas'] ?? null,
                'h_teoricas' => $item->config['h_teoricas'] ?? null,
                'aeronaves' => $item->config['aeronaves'] ?? [],
                'status' => $item->post_status,
            ];
        });

        return response()->json($paginator);
    }

    /**
     * store
     * pt-BR: Cria um novo período (post_type = 'periodos').
     *        Mapeia: nome->post_title, slug->post_name (auto se vazio), id_curso->config.id_curso/post_parent, status->post_status.
     * en-US: Creates a new period (post_type = 'periodos').
     *        Maps: nome->post_title, slug->post_name (auto if empty), id_curso->config.id_curso/post_parent, status->post_status.
     */
    public function store(Request $request)
    {
        $data = $request->all();
        $validator = Validator::make($data, [
            'nome' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'id_curso' => 'nullable|integer',
            'status' => 'nullable|in:publish,draft',
            // id_contratos: aceita array de inteiros/strings (IDs de contratos)
            'id_contratos' => 'nullable|array',
            'id_contratos.*' => 'nullable',
            // valor: opcional, numérico
            'valor' => 'nullable|numeric',
            // tipo_modulo: 1 Teórico, 2 Prático, 3 Teórico/Prático
            'tipo_modulo' => 'nullable|in:1,2,3',
            // cursos_incluidos: lista de IDs de cursos
            'cursos_incluidos' => 'nullable|array',
            'cursos_incluidos.*' => 'nullable',
            // novos campos
            'h_praticas' => 'nullable|numeric',
            'h_teoricas' => 'nullable|numeric',
            'aeronaves' => 'nullable|array',
            'aeronaves.*' => 'nullable',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $post = new Post();
        $post->post_type = 'periodos';
        $post->post_title = $data['nome'];
        $post->post_status = $data['status'] ?? 'publish';
        $post->menu_order = $data['ordenar'] ?? 0;

        // slug generation
        $post->post_name = !empty($data['slug']) ? $data['slug'] : Post::generateSlug($data['nome']);

        // parent and config
        if (!empty($data['id_curso'])) {
            $post->post_parent = (int)$data['id_curso'];
        }
        // Config: armazena dados complementares do período
        $post->config = [
            'id_curso' => $data['id_curso'] ?? null,
            'id_contratos' => $data['id_contratos'] ?? [],
            'valor' => $data['valor'] ?? null,
            'tipo_modulo' => $data['tipo_modulo'] ?? null,
            'cursos_incluidos' => isset($data['cursos_incluidos']) && is_array($data['cursos_incluidos']) ? $data['cursos_incluidos'] : [],
            'h_praticas' => $data['h_praticas'] ?? null,
            'h_teoricas' => $data['h_teoricas'] ?? null,
            'aeronaves' => isset($data['aeronaves']) && is_array($data['aeronaves']) ? $data['aeronaves'] : [],
        ];

        $post->save();

        return response()->json([
            'id' => $post->ID,
            'nome' => $post->post_title,
            'slug' => $post->post_name,
            'id_curso' => $post->config['id_curso'] ?? ($post->post_parent ?: null),
            'id_contratos' => $post->config['id_contratos'] ?? [],
            'valor' => $post->config['valor'] ?? null,
            'tipo_modulo' => $post->config['tipo_modulo'] ?? null,
            'cursos_incluidos' => $post->config['cursos_incluidos'] ?? [],
            'h_praticas' => $post->config['h_praticas'] ?? null,
            'h_teoricas' => $post->config['h_teoricas'] ?? null,
            'aeronaves' => $post->config['aeronaves'] ?? [],
            'status' => $post->post_status,
        ], 201);
    }

    /**
     * show
     * pt-BR: Exibe um período pelo ID.
     * en-US: Shows a period by ID.
     */
    public function show($id)
    {
        $post = Post::ofType('periodos')->findOrFail($id);
        return response()->json([
            'id' => $post->ID,
            'nome' => $post->post_title,
            'slug' => $post->post_name,
            'id_curso' => $post->config['id_curso'] ?? ($post->post_parent ?: null),
            'id_contratos' => $post->config['id_contratos'] ?? [],
            'valor' => $post->config['valor'] ?? null,
            'tipo_modulo' => $post->config['tipo_modulo'] ?? null,
            'cursos_incluidos' => $post->config['cursos_incluidos'] ?? [],
            'h_praticas' => $post->config['h_praticas'] ?? null,
            'h_teoricas' => $post->config['h_teoricas'] ?? null,
            'aeronaves' => $post->config['aeronaves'] ?? [],
            'status' => $post->post_status,
        ]);
    }

    /**
     * update
     * pt-BR: Atualiza um período existente.
     * en-US: Updates an existing period.
     */
    public function update(Request $request, $id)
    {
        $post = Post::ofType('periodos')->findOrFail($id);
        $data = $request->all();

        $validator = Validator::make($data, [
            'nome' => 'nullable|string|max:255',
            'slug' => 'nullable|string|max:255',
            'id_curso' => 'nullable|integer',
            'status' => 'nullable|in:publish,draft',
            // id_contratos: aceita array para atualização
            'id_contratos' => 'nullable|array',
            'id_contratos.*' => 'nullable',
            // valor: opcional, numérico
            'valor' => 'nullable|numeric',
            // tipo_modulo: 1 Teórico, 2 Prático, 3 Teórico/Prático
            'tipo_modulo' => 'nullable|in:1,2,3',
            // cursos_incluidos: lista de IDs de cursos
            'cursos_incluidos' => 'nullable|array',
            'cursos_incluidos.*' => 'nullable',
            // novos campos
            'h_praticas' => 'nullable|numeric',
            'h_teoricas' => 'nullable|numeric',
            'aeronaves' => 'nullable|array',
            'aeronaves.*' => 'nullable',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        if (array_key_exists('nome', $data)) {
            $post->post_title = $data['nome'] ?? $post->post_title;
        }
        if (array_key_exists('slug', $data)) {
            $post->post_name = !empty($data['slug']) ? $data['slug'] : Post::generateSlug($post->post_title);
        }
        if (array_key_exists('status', $data)) {
            $post->post_status = $data['status'] ?? $post->post_status;
        }
        if (array_key_exists('id_curso', $data) && !empty($data['id_curso'])) {
            $post->post_parent = (int)$data['id_curso'];
        }

        // update config: atualiza campos complementares
        $config = is_array($post->config) ? $post->config : [];
        if (array_key_exists('id_curso', $data)) {
            $config['id_curso'] = $data['id_curso'] ?? null;
        }
        if (array_key_exists('id_contratos', $data)) {
            $config['id_contratos'] = is_array($data['id_contratos']) ? $data['id_contratos'] : [];
        }
        if (array_key_exists('valor', $data)) {
            $config['valor'] = $data['valor'] ?? null;
        }
        if (array_key_exists('tipo_modulo', $data)) {
            $config['tipo_modulo'] = $data['tipo_modulo'] ?? null;
        }
        if (array_key_exists('cursos_incluidos', $data)) {
            $config['cursos_incluidos'] = is_array($data['cursos_incluidos']) ? $data['cursos_incluidos'] : [];
        }
        if (array_key_exists('h_praticas', $data)) {
            $config['h_praticas'] = $data['h_praticas'] ?? null;
        }
        if (array_key_exists('h_teoricas', $data)) {
            $config['h_teoricas'] = $data['h_teoricas'] ?? null;
        }
        if (array_key_exists('aeronaves', $data)) {
            $config['aeronaves'] = is_array($data['aeronaves']) ? $data['aeronaves'] : [];
        }
        $post->config = $config;

        $post->save();

        return response()->json([
            'id' => $post->ID,
            'nome' => $post->post_title,
            'slug' => $post->post_name,
            'id_curso' => $post->config['id_curso'] ?? ($post->post_parent ?: null),
            'id_contratos' => $post->config['id_contratos'] ?? [],
            'valor' => $post->config['valor'] ?? null,
            'tipo_modulo' => $post->config['tipo_modulo'] ?? null,
            'cursos_incluidos' => $post->config['cursos_incluidos'] ?? [],
            'h_praticas' => $post->config['h_praticas'] ?? null,
            'h_teoricas' => $post->config['h_teoricas'] ?? null,
            'aeronaves' => $post->config['aeronaves'] ?? [],
            'status' => $post->post_status,
        ]);
    }

    /**
     * destroy
     * pt-BR: Exclui (marca como deletado) um período.
     * en-US: Deletes (marks as deleted) a period.
     */
    public function destroy($id)
    {
        $post = Post::ofType('periodos')->findOrFail($id);
        // Marca como deletado se a coluna 'delete' é usada; caso contrário, remove.
        if (isset($post->delete)) {
            $post->delete = 's';
            $post->save();
        } else {
            $post->delete();
        }
        return response()->json(['message' => 'Período removido com sucesso']);
    }
}