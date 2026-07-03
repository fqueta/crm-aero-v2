<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\Post;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
     * reorder
     * pt-BR: Persiste a ordenação dos períodos atualizando o campo menu_order.
     *        Opcionalmente valida se os IDs pertencem ao curso informado.
     * en-US: Persists periods ordering by updating the menu_order field.
     *        Optionally validates whether the IDs belong to the provided course.
     */
    public function reorder(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'ids' => 'required|array|min:1',
            'ids.*' => 'integer',
            'id_curso' => 'nullable|integer',
        ], [
            'ids.required' => 'A lista de IDs é obrigatória',
            'ids.array' => 'A lista de IDs deve ser um array',
            'ids.min' => 'A lista de IDs deve conter ao menos um ID',
            'ids.*.integer' => 'Todos os IDs devem ser números inteiros',
            'id_curso.integer' => 'id_curso deve ser um número inteiro',
        ]);

        if ($validator->fails()) {
            return response()->json(['message' => 'Erro de validação', 'errors' => $validator->errors()], 422);
        }

        $ids = array_map('intval', (array) $request->input('ids', []));
        $courseId = $request->filled('id_curso') ? (int) $request->input('id_curso') : null;

        $counts = array_count_values($ids);
        $duplicates = array_keys(array_filter($counts, fn ($count) => $count > 1));
        if (!empty($duplicates)) {
            return response()->json([
                'message' => 'Erro de validação',
                'errors' => [
                    'ids' => ['Há IDs duplicados no payload. Remova duplicidades e tente novamente.'],
                    'duplicateIds' => $duplicates,
                ],
            ], 422);
        }

        $query = Post::query()->ofType('periodos')->whereIn('ID', $ids);
        if ($courseId) {
            $query->where(function ($q) use ($courseId) {
                $q->where('config->id_curso', $courseId)
                    ->orWhere('post_parent', $courseId);
            });
        }

        $existingIds = $query->pluck('ID')->all();
        $missing = array_values(array_diff($ids, array_map('intval', $existingIds)));
        if (!empty($missing)) {
            return response()->json([
                'message' => 'Erro de validação',
                'errors' => [
                    'ids' => ['Alguns IDs informados não existem ou não pertencem ao curso.'],
                    'missingIds' => $missing,
                ],
            ], 422);
        }

        DB::transaction(function () use ($ids) {
            foreach ($ids as $position => $id) {
                Post::query()->ofType('periodos')->where('ID', (int) $id)->update(['menu_order' => $position + 1]);
            }
        });

        return response()->json(['ok' => true, 'message' => 'Ordem atualizada com sucesso']);
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

    /**
     * enrolledStudents
     * pt-BR: Lista alunos matriculados num período específico (tipo 4).
     *        Usa JSON_EXTRACT em orc->modulos[0].id para identificar a matrícula do período.
     *        Aceita parâmetro situacao_slug (ou situacao_id) para definir qual situação
     *        representa "pronto para avançar".
     * en-US: Lists students enrolled in a specific period (tipo 4).
     *        Uses JSON_EXTRACT on orc->modulos[0].id to identify the period enrollment.
     *        Accepts situacao_slug (or situacao_id) to define the "ready to advance" situation.
     *
     * @param  Request $request
     * @param  int|string $id  ID do período
     * @return \Illuminate\Http\JsonResponse
     */
    public function enrolledStudents(Request $request, $id)
    {
        // 1. Carrega o período
        $periodo = Post::ofType('periodos')->findOrFail($id);
        $idCurso = $periodo->config['id_curso'] ?? $periodo->post_parent ?? null;

        // 2. Resolve critério de "pronto para avançar" (situação configurável)
        $situacaoSlug = $request->input('situacao_slug', null);
        $situacaoId   = $request->input('situacao_id', null);
        $situacaoAvancar = null;

        if ($situacaoSlug || $situacaoId) {
            $sitQuery = DB::table('posts')->where('post_type', 'situacao_matricula');
            if ($situacaoId) {
                $sitQuery->where('ID', (int)$situacaoId);
            } elseif ($situacaoSlug) {
                $sitQuery->where('post_name', $situacaoSlug);
            }
            $sit = $sitQuery->first();
            if ($sit) {
                $situacaoAvancar = ['slug' => $sit->post_name, 'label' => $sit->post_title];
                $situacaoSlug    = $sit->post_name; // garante o slug para comparação abaixo
            }
        }

        // 3. Busca matrículas do curso com dados do aluno e situação atual
        $todasMatriculasCurso = DB::table('matriculas')
            ->leftJoin('users', 'matriculas.id_cliente', '=', 'users.id')
            ->leftJoin('posts as sit', function ($join) {
                $join->on('matriculas.situacao_id', '=', 'sit.ID')
                     ->where('sit.post_type', '=', 'situacao_matricula');
            })
            ->where('matriculas.id_curso', $idCurso)
            ->where(function ($q) {
                $q->whereNull('matriculas.excluido')->orWhere('matriculas.excluido', '!=', 's');
            })
            ->where(function ($q) {
                $q->whereNull('matriculas.deletado')->orWhere('matriculas.deletado', '!=', 's');
            })
            ->select(
                'matriculas.id as matricula_id',
                'matriculas.id_cliente as aluno_id',
                'matriculas.status',
                'matriculas.data',
                'matriculas.orc',
                'users.name as aluno_nome',
                'sit.post_name as situacao_slug',
                'sit.post_title as situacao_label'
            )
            ->orderByDesc('matriculas.data')
            ->get();

        // 3.1 Filtra em PHP apenas as matrículas cujo PRIMEIRO módulo é o período atual ($id)
        $matriculasFiltradas = [];
        foreach ($todasMatriculasCurso as $m) {
            if (!$m->orc) continue;
            $orc = is_string($m->orc) ? json_decode($m->orc, true) : $m->orc;
            if (!is_array($orc) || empty($orc['modulos'])) continue;
            
            $primeiroModulo = is_array($orc['modulos']) ? reset($orc['modulos']) : null;
            if (!$primeiroModulo || empty($primeiroModulo['id'])) continue;
            
            if ((string)$primeiroModulo['id'] === (string)$id) {
                $matriculasFiltradas[] = $m;
            }
        }
        $matriculasRaw = collect($matriculasFiltradas);

        // 4. Busca o próximo período (mesmo curso, menu_order imediatamente superior)
        $proximoPeriodo = $this->getProximoPeriodo($periodo, $idCurso);

        // 5. Para cada aluno, verifica se já tem matrícula ativa no próximo período
        $alunoIds = $matriculasRaw->pluck('aluno_id')->filter()->unique()->values()->all();
        $jaMatriculadosNoProximo = [];

        if ($proximoPeriodo && !empty($alunoIds)) {
            $proxId = (string)$proximoPeriodo->ID;
            $rows = DB::table('matriculas')
                ->whereIn('id_cliente', $alunoIds)
                ->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(orc, '$.modulos[0].id')) = ?", [$proxId])
                ->where(function ($q) { $q->whereNull('excluido')->orWhere('excluido', '!=', 's'); })
                ->where(function ($q) { $q->whereNull('deletado')->orWhere('deletado', '!=', 's'); })
                ->pluck('id_cliente')
                ->all();
            foreach ($rows as $uid) {
                $jaMatriculadosNoProximo[(string)$uid] = true;
            }
        }

        // 6. Monta resposta
        $matriculados = [];
        $prontosCount = 0;

        foreach ($matriculasRaw as $m) {
            $prontoParaAvancar = $situacaoSlug
                ? ($m->situacao_slug === $situacaoSlug)
                : false;

            if ($prontoParaAvancar) {
                $prontosCount++;
            }

            $matriculados[] = [
                'matricula_id'              => (int)$m->matricula_id,
                'aluno_id'                  => (string)$m->aluno_id,
                'aluno_nome'                => $m->aluno_nome ?? 'Aluno #' . $m->aluno_id,
                'status'                    => $m->status ?? 'a',
                'situacao_slug'             => $m->situacao_slug,
                'situacao_label'            => $m->situacao_label,
                'pronto_para_avancar'       => $prontoParaAvancar,
                'data'                      => $m->data,
                'proximo_periodo_id'        => $proximoPeriodo ? $proximoPeriodo->ID : null,
                'proximo_periodo_nome'      => $proximoPeriodo ? $proximoPeriodo->post_title : null,
                'ja_matriculado_no_proximo' => isset($jaMatriculadosNoProximo[(string)$m->aluno_id]),
            ];
        }

        return response()->json([
            'periodo' => [
                'id'         => $periodo->ID,
                'nome'       => $periodo->post_title,
                'slug'       => $periodo->post_name,
                'id_curso'   => $idCurso,
                'valor'      => $periodo->config['valor'] ?? null,
                'h_praticas' => $periodo->config['h_praticas'] ?? null,
                'h_teoricas' => $periodo->config['h_teoricas'] ?? null,
                'status'     => $periodo->post_status,
            ],
            'situacao_avancar'     => $situacaoAvancar,
            'matriculados'         => $matriculados,
            'total'                => count($matriculados),
            'prontos_para_avancar' => $prontosCount,
        ]);
    }

    /**
     * getProximoPeriodo
     * pt-BR: Retorna o próximo período do mesmo curso (menu_order imediatamente superior).
     * en-US: Returns the next period of the same course (immediately higher menu_order).
     *
     * @param  Post $periodo  Período atual
     * @param  int|string|null $idCurso  ID do curso
     * @return Post|null
     */
    private function getProximoPeriodo(Post $periodo, $idCurso): ?Post
    {
        if (!$idCurso) return null;

        return Post::ofType('periodos')
            ->where(function ($q) use ($idCurso) {
                $q->where('config->id_curso', (int)$idCurso)
                  ->orWhere('post_parent', (int)$idCurso);
            })
            ->where('menu_order', '>', (int)$periodo->menu_order)
            ->orderBy('menu_order')
            ->first();
    }
}
