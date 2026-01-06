<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\Stage;
use App\Models\Curso;
use App\Models\Matricula;
use App\Models\Parcelamento;
use App\Models\Turma;
use App\Models\User;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\DB;
use App\Services\Qlib;
use Illuminate\Support\Facades\Bus;
// Import removido: Str não é mais necessário
use App\Jobs\GeraPdfPropostasPnlJob;
use App\Jobs\GeraPdfcontratosPnlJob;
use App\Jobs\SendPeriodosZapsingJob;

class MatriculaController extends Controller
{
    protected PermissionService $permissionService;
    public $default_funil_vendas_id;
    public $default_etapa_vendas_id;
    public $default_proposal_situacao_id;

    public function __construct()
    {
        $this->permissionService = new PermissionService();
        $this->default_funil_vendas_id = Qlib::qoption('default_funil_vendas_id');
        $this->default_etapa_vendas_id = Qlib::qoption('default_etapa_vendas_id');
        $this->default_proposal_situacao_id = Qlib::qoption('default_proposal_situacao_id');
    }

    /**
     * Lista matriculas com filtros simples e paginação.
     * List enrollments with basic filters and pagination.
     *
     * Filtros suportados via query:
     * - id_cliente, id_curso, id_responsavel, id_consultor, id_turma, status, funnel_id, stage_id|etapa
     * - course (nome ou tipo do curso, parcial), student (nome do usuário, parcial)
     * - search (trecho em descricao)
     *
     * Observação: colunas de filtro da tabela matriculas são sempre qualificadas
     * (ex.: matriculas.id_curso) para evitar ambiguidade em JOINs com cursos/turmas.
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
        $orderBy = $request->input('order_by', 'data');
        $order = $request->input('order', 'desc');
        // Qualificar coluna de ordenação para evitar ambiguidade em JOINs
        $orderByQualified = match ($orderBy) {
            'data' => 'matriculas.data',
            'curso_nome' => 'cursos.nome',
            'turma_nome' => 'turmas.nome',
            'cliente_nome' => 'users.name',
            default => $orderBy,
        };

        $query = Matricula::join('cursos', 'matriculas.id_curso', '=', 'cursos.id')
            ->join('turmas', 'matriculas.id_turma', '=', 'turmas.id')
            ->leftJoin('users', 'matriculas.id_cliente', '=', 'users.id')
            ->leftJoin('posts', 'matriculas.situacao_id', '=', 'posts.id')
           ->select('matriculas.*', 'cursos.nome as curso_nome','cursos.tipo as curso_tipo', 'turmas.nome as turma_nome', 'users.name as cliente_nome', 'posts.post_title as situacao')
            ->orderBy($orderByQualified, $order);

        // Mapear alias de filtro: 'etapa' -> 'stage_id'
        $stageFilter = $request->filled('stage_id')
            ? $request->input('stage_id')
            : ($request->filled('etapa') ? $request->input('etapa') : null);
        // se tiver um filtro do campos situacao então de ser feito um join com a tabela posts e filtra post_name = a situação do filtro

        // dd($request->filled('situacao'));
        if ($request->filled('situacao')) {
            // $query->join('posts', 'matriculas.situacao_id', '=', 'posts.id');
            if($request->input('situacao') == 'mat'){
                $query->where('posts.post_name','!=', 'int');
            }else{
                 $query->where('posts.post_name', $request->input('situacao'));
            }
        }
        // Qualificar colunas para evitar ambiguidade: sempre usar prefixo da tabela
        $filterColumnMap = [
            'id_cliente'    => 'matriculas.id_cliente',
            'id_curso'      => 'matriculas.id_curso',
            'id_responsavel'=> 'matriculas.id_responsavel',
            'id_consultor'  => 'matriculas.id_consultor',
            'id_turma'      => 'matriculas.id_turma',
            'situacao_id'   => 'matriculas.situacao_id',
            'status'        => 'matriculas.status',
            'funnel_id'     => 'matriculas.funnel_id',
        ];
        foreach ($filterColumnMap as $field => $column) {
            if ($request->filled($field)) {
                $query->where($column, $request->input($field));
            }
        }
        if ($stageFilter !== null) {
            $query->where('matriculas.stage_id', $stageFilter);
        }

        // Filtro genérico por descrição da matrícula
        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function($q) use ($search) {
                $q->where('matriculas.descricao', 'like', "%$search%");
            });
        }

        // Filtro por curso: nome ou tipo (parcial)
        // EN: Filter by course: name or type (partial match)
        if ($request->filled('course')) {
            $courseTerm = trim((string)$request->input('course'));
            if ($courseTerm !== '') {
                $query->where(function($q) use ($courseTerm) {
                    $q->where('cursos.nome', 'like', "%$courseTerm%")
                      ->orWhere('cursos.tipo', 'like', "%$courseTerm%");
                });
            }
        }

        // Filtro por aluno/estudante: nome do usuário (parcial)
        // EN: Filter by student: user name (partial match)
        if ($request->filled('student')) {
            $studentTerm = trim((string)$request->input('student'));
            if ($studentTerm !== '') {
                $query->where('users.name', 'like', "%$studentTerm%");
            }
        }

        $items = $query->paginate($perPage);
        // Anexar metacampos a cada item paginado
        $items->getCollection()->transform(function ($item) {
            $item->meta = $this->getAllMatriculaMeta($item->id);
            return $item;
        });
        return response()->json($items);
    }
    /**
     * Metodos para o mapeamento de campos de entrada
     */
    private function mapFields(Request $request): array
    {
        $data = $request->all();

        // Mapear alias de campo: 'etapa' -> 'stage_id'
        if (array_key_exists('etapa', $data) && !array_key_exists('stage_id', $data)) {
            $data['stage_id'] = $data['etapa'];
            unset($data['etapa']);
        }

        return $data;
    }
    /**
     * Mapeia campos de saída: 'stage_id' -> 'etapa'
     */
    private function mapOutputFields(array $data): array
    {
        // Mapear alias de campo: 'stage_id' -> 'etapa'
        if (array_key_exists('stage_id', $data) && !array_key_exists('etapa', $data)) {
            $data['etapa'] = $data['stage_id'];
            unset($data['stage_id']);
        }
        //expoe os dados do cadastro do cliente na matrícula
        if(isset($data['id_cliente'])){
            $cliente = User::find($data['id_cliente']);
            $data['cliente'] = $cliente ? $cliente->toArray() : null;
        }
        //expoe os dados do cadastro do curso na matrícula
        if(isset($data['id_curso'])){
            $curso = Curso::find($data['id_curso']);
            $data['curso'] = $curso ? $curso->toArray() : null;
        }
        //expoe os dados do cadastro do responsável na matrícula
        if(isset($data['id_responsavel'])){
            $responsavel = User::find($data['id_responsavel']);
            $data['responsavel'] = $responsavel ? $responsavel->toArray() : null;
        }
        //expoe os dados do cadastro da turma na matrícula
        if(isset($data['id_turma'])){
            $turma = Turma::find($data['id_turma']);
            $data['turma'] = $turma ? $turma->toArray() : null;
        }

        return $data;
    }

    /**
     * Extrai metacampos do request.
     * EN: Extract meta fields from the request.
     *
     * Aceita:
     * - Campo raiz `meta` como array ou JSON string
     * - Chaves avulsas com prefixo `meta_` (ex.: `meta_origem`)
     * Retorna array `meta_key => meta_value`.
     */
    private function extractMetaFromRequest(Request $request): array
    {
        $meta = [];

        // Campo raiz "meta"
        if ($request->has('meta')) {
            $raw = $request->input('meta');
            if (is_array($raw)) {
                $meta = $raw;
            } elseif (is_string($raw) && trim($raw) !== '') {
                $decoded = json_decode($raw, true);
                if (is_array($decoded)) {
                    $meta = $decoded;
                }
            }
        }

        // Prefixo meta_
        foreach ($request->all() as $key => $value) {
            if (is_string($key) && str_starts_with($key, 'meta_')) {
                $cleanKey = substr($key, 5);
                if ($cleanKey === '') {
                    continue;
                }
                $meta[$cleanKey] = $value;
            }
        }

        // Normalizar valores: arrays -> JSON, strings aparadas
        $normalized = [];
        foreach ($meta as $k => $v) {
            $normalized[$k] = is_array($v) ? json_encode($v) : (is_string($v) ? trim($v) : $v);
        }

        return $normalized;
    }

    /**
     * Persiste metacampos para matrícula usando Qlib::update_matriculameta.
     * EN: Persist meta fields for enrollment via Qlib::update_matriculameta.
     */
    private function persistMatriculaMeta(int|string $matriculaId, array $meta): void
    {
        if (!$matriculaId || empty($meta)) {
            return;
        }
        foreach ($meta as $metaKey => $metaValue) {
            if ($metaKey !== null && $metaKey !== '' && $metaValue !== null && $metaValue !== '') {
                Qlib::update_matriculameta($matriculaId, $metaKey, (string) $metaValue);
            }
        }
    }

    /**
     * Carrega todos os metacampos de uma matrícula e retorna como array associativo.
     * EN: Load all meta fields for an enrollment and return as associative array.
     */
    private function getAllMatriculaMeta(int|string $matriculaId): array
    {
        $out = [];
        if (!$matriculaId) {
            return $out;
        }
        $rows = DB::table('matriculameta')
            ->where('matricula_id', $matriculaId)
            ->select('meta_key', 'meta_value')
            ->get();
        foreach ($rows as $row) {
            $val = $row->meta_value;
            $decoded = null;
            if (is_string($val)) {
                $trimmed = trim($val);
                if ($trimmed !== '') {
                    $decoded = json_decode($trimmed, true);
                }
            }
            $out[$row->meta_key] = is_array($decoded) ? $decoded : $val;
        }
        return $out;
    }

    /**
     * Valida dados do cadastro de matrícula (store/update base).
     * Validate enrollment payload (store/update base).
     */
    private function rules(bool $update = false): array
    {
        $base = [
            // IDs devem existir nas tabelas correspondentes.
            // Valida diretamente em users com permission_id = 7.
            'id_cliente' => [$update ? 'sometimes' : 'required', 'uuid', 'exists:users,id,permission_id,7'],
            'id_curso' => [$update ? 'sometimes' : 'required', 'integer', 'exists:cursos,id'],
            'id_responsavel' => ['nullable', 'uuid'],
            'id_consultor' => ['nullable', 'uuid'],
            'id_turma' => [$update ? 'sometimes' : 'required', 'integer', 'exists:turmas,id'],
            // Situação da matrícula: referência para posts (situacao_matricula)
            'situacao_id' => ['nullable', 'integer', Rule::exists('posts','ID')->where(function($q){ $q->where('post_type','situacao_matricula'); })],
            'descricao' => ['nullable', 'string'],
            // Status da matrícula: 'a' (Atendimento), 'g' (Ganho), 'p' (Perda)
            // EN: Enrollment status: 'a' (Attendance), 'g' (Won), 'p' (Lost)
            'status' => ['nullable', 'string', Rule::in(['a','g','p'])],
            'config' => ['nullable', 'array'],
            'tags' => ['nullable', 'array'],
            'stage_id' => ['nullable', 'integer', 'exists:stages,id'],
            'funnel_id' => ['nullable', 'integer'],
            'desconto' => ['nullable', 'numeric'],
            'combustivel' => ['nullable', 'numeric'],
            'subtotal' => ['nullable', 'numeric'],
            'total' => ['nullable', 'numeric'],
            'orc'   => ['nullable', 'array'],
            // Parcelamentos vinculados ao curso da matrícula (máximo 2)
            'parcelamento_ids' => ['nullable', 'array', 'max:2'],
            'parcelamento_ids.*' => ['integer', 'exists:parcelamentos,id'],
        ];

        return $base;
    }

    /**
     * Verifica se um valor parece ser um UUID (v4).
     * Checks whether a value looks like a UUID (v4).
     */
    // Função removida: não usamos mais UUID para users.id

    /**
     * Normaliza payload: mapeia aliases (etapa -> stage_id) e sanitiza.
     * Normalize payload: map aliases (etapa -> stage_id) and sanitize values.
     */
    private function normalizePayload(array $data): array
    {
        // alias do campo "funnil_id" -> "funnel_id"
        if (array_key_exists('funnil_id', $data) && !array_key_exists('funnel_id', $data)) {
            $data['funnel_id'] = $data['funnil_id'];
            unset($data['funnil_id']);
        }
        // alias do campo "funell_id" -> "funnel_id" (variação)
        if (array_key_exists('funell_id', $data) && !array_key_exists('funnel_id', $data)) {
            $data['funnel_id'] = $data['funell_id'];
            unset($data['funell_id']);
        }
        // alias "Descricao" -> "descricao"
        if (array_key_exists('Descricao', $data) && !array_key_exists('descricao', $data)) {
            $data['descricao'] = $data['Descricao'];
            unset($data['Descricao']);
        }
        // alias "obs" -> "descricao" quando ausente
        if (array_key_exists('obs', $data) && !array_key_exists('descricao', $data)) {
            $data['descricao'] = $data['obs'];
            unset($data['obs']);
        }
        // alias "etapa" -> "stage_id"
        if (array_key_exists('etapa', $data) && !array_key_exists('stage_id', $data)) {
            $data['stage_id'] = $data['etapa'];
            unset($data['etapa']);
        }
        // strings vazias -> null para campos numéricos e chaveados
        foreach (['status','stage_id','funnel_id','situacao_id'] as $k) {
            if (array_key_exists($k, $data) && is_string($data[$k]) && trim($data[$k]) === '') {
                $data[$k] = null;
            }
        }
        // normalizar situacao_id: '0' ou vazio -> colocalar id da proposta padrão; caso contrário, inteiro

        if (array_key_exists('situacao_id', $data)) {
            $vs = trim((string)$data['situacao_id']);
            if ($vs === '' || $vs === '0') {
                $data['situacao_id'] = $this->default_proposal_situacao_id;
            } elseif (is_numeric($vs)) {
                $data['situacao_id'] = (int)$vs;
            }
        }
        foreach (['desconto','combustivel','subtotal','total'] as $k) {
            if (array_key_exists($k, $data)) {
                $v = $data[$k];
                if (is_string($v)) {
                    $v = str_replace([','], ['.'], trim($v));
                    $data[$k] = ($v === '' ? null : (float)$v);
                }
            }
        }
        // Normalizar id_responsavel: '0' ou vazio -> null
        if (array_key_exists('id_responsavel', $data)) {
            $vr = trim((string)$data['id_responsavel']);
            if ($vr === '' || $vr === '0') {
                $data['id_responsavel'] = null;
            }
        }
        // Garantir string aparada para id_cliente
        if (array_key_exists('id_cliente', $data)) {
            $data['id_cliente'] = trim((string)$data['id_cliente']);
        }
        // Consolidar extras em config
        $config = [];
        if (array_key_exists('config', $data)) {
            if (is_array($data['config'])) {
                $config = $data['config'];
            } elseif (is_string($data['config']) && $data['config'] !== '') {
                $decoded = json_decode($data['config'], true);
                $config = is_array($decoded) ? $decoded : [];
            }
        }
        if (array_key_exists('consultor', $data)) {
            $config['consultor'] = $data['consultor'];
            unset($data['consultor']);
        }
        if (array_key_exists('situacao', $data)) {
            $config['situacao'] = $data['situacao'];
            unset($data['situacao']);
        }
        if (array_key_exists('inscricao', $data)) {
            $insc = str_replace([','], ['.'], trim((string)$data['inscricao']));
            $config['inscricao'] = ($insc === '' ? null : (float)$insc);
            unset($data['inscricao']);
        }
        if (array_key_exists('token', $data)) {
            $config['token'] = $data['token'];
            unset($data['token']);
        }
        if (array_key_exists('tag[]', $data)) {
            $tags = $data['tag[]'];
            $config['tags'] = is_array($tags) ? $tags : [$tags];
            unset($data['tag[]']);
        }
        $data['config'] = $config;
        return $data;
    }

    /**
     * Cria uma nova matrícula.
     * Create a new enrollment.
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

        // Antes do validador: capturar metacampos do payload
        $requestMeta = $this->extractMetaFromRequest($request);

        $input = $this->normalizePayload($request->all());
        $validator = Validator::make($input, $this->rules(false));
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Erro de validação',
                'errors' => $validator->errors(),
            ], 422);
        }
        $validated = $validator->validated();

        // Pós-validação removida: validação via regra exists já garante integridade

        $matricula = new Matricula();
        // se o funnel_id não foi informado, usar o default
        if (!array_key_exists('funnel_id', $validated)) {
            $matricula->funnel_id = $this->default_funil_vendas_id;
        }
        // se o stage_id não foi informado, usar o default
        if (!array_key_exists('stage_id', $validated)) {
            $matricula->stage_id = $this->default_etapa_vendas_id;
        }
        // se o situacao_id não foi informado, usar o default
        if (!array_key_exists('situacao_id', $validated)) {
            $matricula->situacao_id = $this->default_proposal_situacao_id;
        }



        $matricula->fill($validated);
        $matricula->save();

        // Vincular parcelamentos do curso (até 2), garantindo compatibilidade com o curso da matrícula
        if (array_key_exists('parcelamento_ids', $validated) && is_array($validated['parcelamento_ids'])) {
            $ids = array_unique(array_filter($validated['parcelamento_ids'], fn($v) => is_numeric($v)));
            if (!empty($ids)) {
                $validIds = Parcelamento::whereIn('id', $ids)
                    ->where('id_curso', $matricula->id_curso)
                    ->where('ativo', 's')
                    ->pluck('id')
                    ->all();
                $matricula->parcelamentos()->sync($validIds);
            }
        }

        // Após criação: persistir metacampos capturados
        if (!empty($requestMeta)) {
            $this->persistMatriculaMeta($matricula->id, $requestMeta);
        }

        return response()->json($matricula, 201);
    }

    /**
     * Mostra uma matrícula.
     * Show single enrollment.
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
        $data = $this->dm($id);

        return response()->json($data);
    }
    /**
     * Metodo para retornar dados da matricula atravez do id da matricula se o campo id_cliente for informado varifica se o cliente existe
     * Show single enrollment.
     * @param string $id
     */
    public function dm($id,$id_cliente=false){
        if($id_cliente){
            $cliente = User::findOrFail($id_cliente);
        }
        $matricula = Matricula::join('cursos', 'matriculas.id_curso', '=', 'cursos.id')
            ->join('turmas', 'matriculas.id_turma', '=', 'turmas.id')
            ->leftJoin('users', 'matriculas.id_cliente', '=', 'users.id')
            ->select('matriculas.*', 'cursos.nome as curso_nome','cursos.tipo as curso_tipo', 'turmas.nome as turma_nome', 'users.name as cliente_nome')
            ->findOrFail($id);
        $data = $matricula->toArray();
        /**
         * cliente
         * pt-BR: Inclui um nó com dados básicos do cliente associado à matrícula.
         *        Evita expor campos sensíveis retornando apenas id, name e email.
         * en-US: Adds a node with basic client data associated with the enrollment.
         *        Avoids exposing sensitive fields by returning only id, name and email.
         */
        $cliente = null;
        if (!empty($matricula->id_cliente)) {
            // Buscar registro completo do cliente para permitir mapeamento estendido
            $cliente = User::find($matricula->id_cliente);
        }
        // PT-BR: Mapear nó de cliente com os mesmos aliases/camelCase usados em ClientController->mapIndexItemOutput.
        // EN: Map client node using the same aliases/camelCase as ClientController->mapIndexItemOutput.
        $data['cliente'] = $cliente ? $this->mapClientNodeOutput($cliente) : null;
        $data['meta'] = $this->getAllMatriculaMeta($matricula->id);
        // Expor parcelamentos vinculados via pivot
        $data['parcelamentos'] = Parcelamento::join('matricula_parcelamento', 'parcelamentos.id', '=', 'matricula_parcelamento.parcelamento_id')
            ->where('matricula_parcelamento.matricula_id', $matricula->id)
            ->select('parcelamentos.*')
            ->get()
            ->toArray();
        //incluir o campo com link publico da proposta
        $link = '/aluno/matricula/'.$matricula->id_cliente.'_'.Qlib::zeroFill($matricula->id,5);
        $data['link_orcamento'] = Qlib::qoption('front_url') . $link;//$matricula->link_orcamento??'';
        $data['link_assinatura'] = Qlib::qoption('front_url') . str_replace('matricula','assinatura',$link);//$matricula->link_orcamento??'';
        return $data;
    }

    /**
     * PT-BR: Mapeia os dados de um cliente (User) para saída compatível com o front-end,
     * replicando os aliases e normalizações usadas em ClientController->mapIndexItemOutput.
     * EN: Maps client (User) data to front-end compatible output, replicating the aliases
     * and normalizations used in ClientController->mapIndexItemOutput.
     *
     * @param mixed $client Registro do usuário/cliente
     * @return array Dados normalizados e com aliases camelCase
     */
    private function mapClientNodeOutput($client): array
    {
        // Base em array para manipulação
        $data = is_array($client) ? $client : $client->toArray();

        // Converter config para array e substituir null por string vazia
        if (isset($data['config'])) {
            if (is_string($data['config'])) {
                $configArr = json_decode($data['config'], true) ?? [];
                array_walk($configArr, function (&$value) {
                    if (is_null($value)) {
                        $value = (string)'';
                    }
                });
                $data['config'] = $configArr;
            } elseif (is_array($data['config'])) {
                array_walk($data['config'], function (&$value) {
                    if (is_null($value)) {
                        $value = (string)'';
                    }
                });
            }
        }

        // Garantir estrutura de preferencias
        if (!isset($data['preferencias']) || !is_array($data['preferencias'])) {
            $data['preferencias'] = [];
        }
        if (!isset($data['preferencias']['pipeline']) || !is_array($data['preferencias']['pipeline'])) {
            $data['preferencias']['pipeline'] = [];
        }

        // Copiar stage_id para preferencias.pipeline a partir de config, se existir
        if (isset($data['config']) && is_array($data['config']) && isset($data['config']['stage_id'])) {
            $data['preferencias']['pipeline']['stage_id'] = $data['config']['stage_id'];
        }
        // Se preferências.pipeline.stage_id estiver presente mas config.stage_id não, reflete em config
        if (isset($data['preferencias']['pipeline']['stage_id']) && (!isset($data['config']['stage_id']) || empty($data['config']['stage_id']))) {
            $data['config']['stage_id'] = $data['preferencias']['pipeline']['stage_id'];
        }
        // Derivar funnelId via Stage quando possível
        if (isset($data['config']['stage_id']) && (!isset($data['config']['funnelId']) || empty($data['config']['funnelId']))) {
            $stageId = $data['config']['stage_id'];
            $stage = null;
            try {
                $stage = Stage::select(['id','funnel_id'])->find($stageId);
            } catch (\Exception $e) {
                $stage = null;
            }
            if ($stage && isset($stage->funnel_id)) {
                $data['config']['funnelId'] = $stage->funnel_id;
            }
        }

        // Aliases em camelCase (mantendo originais)
        $data['createdAt'] = $data['created_at'] ?? null;
        $data['updatedAt'] = $data['updated_at'] ?? null;
        $data['permissionId'] = $data['permission_id'] ?? null;
        $data['tipoPessoa'] = $data['tipo_pessoa'] ?? null;

        // Normalizar ativo para booleano em alias "active"
        if (array_key_exists('ativo', $data)) {
            $data['active'] = ($data['ativo'] === 's');
        }

        // Enriquecer autor_name quando possível
        if (isset($data['autor']) && !empty($data['autor']) && is_numeric($data['autor'])) {
            $autorUser = null;
            try {
                $autorUser = User::find($data['autor']);
            } catch (\Exception $e) {
                $autorUser = null;
            }
            if ($autorUser) {
                $data['autor_name'] = $autorUser->name ?? null;
            }
        }

        // Garantir chaves esperadas mesmo que nulas
        $data['points'] = $data['points'] ?? null;
        $data['is_alloyal'] = $data['is_alloyal'] ?? null;

        return $data;
    }

    /**
     * Atualiza uma matrícula existente.
     * Update an existing enrollment.
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

        $matricula = Matricula::findOrFail($id);
        // Antes do validador: capturar e persistir metacampos
        $requestMeta = $this->extractMetaFromRequest($request);
        if (!empty($requestMeta)) {
            $this->persistMatriculaMeta($matricula->id, $requestMeta);
        }
        $input = $this->normalizePayload($request->all());
        $validator = Validator::make($input, $this->rules(true));
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Erro de validação',
                'errors' => $validator->errors(),
            ], 422);
        }
        $validated = $validator->validated();

        // Pós-validação removida: validação via regra exists já garante integridade
        $matricula->fill($validated);
        $matricula->save();

        // Sincronizar parcelamentos do curso, se informados
        if (array_key_exists('parcelamento_ids', $validated) && is_array($validated['parcelamento_ids'])) {
            $ids = array_unique(array_filter($validated['parcelamento_ids'], fn($v) => is_numeric($v)));
            if (!empty($ids)) {
                $validIds = Parcelamento::whereIn('id', $ids)
                    ->where('id_curso', $matricula->id_curso)
                    ->where('ativo', 's')
                    ->pluck('id')
                    ->all();
                $matricula->parcelamentos()->sync($validIds);
            }
        }

        return response()->json($matricula);
    }

    /**
     * Exclui uma matrícula com suporte a lixeira e exclusão permanente.
     * Delete an enrollment, supporting trash (soft delete) and force delete.
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

        $matricula = Matricula::find($id);
        if (!$matricula) {
            return response()->json(['error' => 'Matrícula não encontrada'], 404);
        }

        // Se a query tiver force=true, exclui definitivamente
        $force = filter_var($request->input('force', false), FILTER_VALIDATE_BOOLEAN);
        if ($force) {
            $matricula->delete();
            return response()->json([
                'message' => 'Matrícula excluída permanentemente',
            ], 200);
        }

        // Caso contrário, marca como excluída (lixeira) usando flags customizadas
        $registro = [
            'por' => (string) $user->id,
            'ip' => $request->ip(),
            'data' => now()->toISOString(),
        ];
        $matricula->update([
            'excluido' => 's',
            'deletado' => 's',
            'excluido_por' => (string) $user->id,
            'deletado_por' => (string) $user->id,
            'reg_excluido' => $registro,
            'reg_deletado' => $registro,
        ]);

        return response()->json([
            'message' => 'Matrícula movida para a lixeira',
            'data' => $matricula->fresh(),
        ], 200);
    }
    /**
	 * Salva todas as etapas de aceitação do contrato de periodos do plano de formação
	 */
	public function assinar_proposta_periodo($config){
		$ret['exec'] = false;
		$ret['valida']['mens'] = false;
		//salvar conteudo da página 2
		if(isset($config['token_matricula']) && isset($config['meta']) && is_array($config['meta'])){
			//11 o id da etapa 'Proposta aprovada' do flow de atendimento
            $config['id'] = $this->get_id_by_token($config['token_matricula']);
			$id_matricula = $config['id'];
            // $ret['validar'] = $this->valida_respostas_assinatura_periodo($config['token_matricula'],'token');
            $ret['save'] = $this->sava_meta_fields($config);
			if($ret['save']['exec']){
				if(isset($config['arr_periodo'])){
					$ret['exec'] = true;
					//variavel que grava uma strig contendo o codigo que array do periodo proveniente do formulario gerando no metodo $this->formAceitoPropostaPeriodo
					$arr_periodo = Qlib::decodeArray($config['arr_periodo']);
					$token_periodo = isset($arr_periodo['token']) ? $arr_periodo['token'] : '';
                    // $token = $config['token_matricula'];
					//gravar contrato estatico...
                    GeraPdfPropostasPnlJob::dispatch($id_matricula);
                    GeraPdfcontratosPnlJob::dispatch($id_matricula)->delay(now()->addSeconds(5));
                    SendPeriodosZapsingJob::dispatch($id_matricula)->delay(now()->addSeconds(5));
					// $ret['gravar_copia'] = $this->grava_contrato_statico_periodo($config['token_matricula'],$token_periodo);

                    // GeraPdfPropostaJoub::dispatch($config['token_matricula']);
                    // GeraPdfContratoJoub::dispatch($config['token_matricula'])->delay(now()->addSeconds(5));


                    $ret['nextPage'] = Qlib::qoption('dominio').'/solicitar-orcamento/proposta/'.$config['token_matricula'].'/a/'.$token_periodo;
					//Enviar para zapsing
                    // lib_print($arr_periodo);
					// lib_print($ret);
					// dd($config);
				}
			}else{
				$ret['exec'] = false;
				$ret['mens'] = 'Erro ao validar as respostas do termo';
			}

		}
		return $ret;
	}


    /**
     * Public endpoint to show proposal details for signature.
     */
    public function publicShow($client_id, $matricula_id)
    {
        // Simple validation or hash check could be added here for security
        // For now, fetching by IDs as requested
        
        try {
            $matricula = Matricula::join('cursos', 'matriculas.id_curso', '=', 'cursos.id')
                ->join('turmas', 'matriculas.id_turma', '=', 'turmas.id')
                ->select('matriculas.*', 'cursos.nome as curso_nome', 'cursos.tipo as curso_tipo', 'turmas.nome as turma_nome')
                ->where('matriculas.id', $matricula_id)
                ->where('matriculas.id_cliente', $client_id)
                ->firstOrFail();

            $client = User::findOrFail($client_id);
            // Config is already cast to array in User model, but check just in case
            if (!is_array($client->config)) {
               $client->config = is_string($client->config) ? (json_decode($client->config, true) ?? []) : [];
            }

            $data = $matricula->toArray();
            
            // Format values for frontend
            // Using Qlib::formatMoney or number_format if Qlib not available, assuming raw values are floats
            // $data['valor_proposta_formatted'] = 'R$ ' . number_format($matricula->total ?? 0, 2, ',', '.');
            
            $data['cliente'] = $client->toArray();
            $data['meta'] = $this->getAllMatriculaMeta($matricula_id);
            $data['matricula'] = $matricula->toArray();
            // Hide sensitive fields
            unset($data['cliente']['password']);
            unset($data['cliente']['remember_token']);
            unset($data['cliente']['token']);
            // dd($data);
            return response()->json($data);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Proposta não encontrada.'], 404);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Erro ao carregar proposta: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Public endpoint to sign proposal (update client data).
     */
    public function publicSign(Request $request, $client_id, $matricula_id)
    {
        try {
            $client = User::findOrFail($client_id);
            
            // Validate request data
            // Adapting validation based on the fields shown in the image/request
            $rules = [
                'name' => 'required|string|max:255',
                'email' => ['required', 'email', Rule::unique('users')->ignore($client->id)],
                // 'pais_origem' -> stored in config or specific field? Assuming config or extra field.
                // 'telefone' -> 'celular'?
                'celular' => ['nullable', 'string', Rule::unique('users')->ignore($client->id)],
                'nascimento' => 'nullable|date', // or string format validation
                'cpf' => ['required', 'string', Rule::unique('users')->ignore($client->id)],
                'cep' => 'nullable|string',
                'endereco' => 'nullable|string',
                'numero' => 'nullable|string',
                'complemento' => 'nullable|string',
                'bairro' => 'nullable|string',
                'cidade' => 'nullable|string',
                'estado' => 'nullable|string', // UF
                'nacionalidade' => 'nullable|string',
                'profissao' => 'nullable|string',
                'sexo' => 'nullable|string',
                'altura' => 'nullable|numeric',
                'peso' => 'nullable|numeric',
                // Extra fields might go into config
                'canac' => 'nullable|string',
                'identidade' => 'nullable|string',
            ];

            $validator = Validator::make($request->all(), $rules);

            if ($validator->fails()) {
                return response()->json(['error' => 'Erro de validação', 'messages' => $validator->errors()], 422);
            }

            $data = $request->except(['config']);
            
            // Handle config/meta fields
            // Ensure we handle config correctly regardless of cast
            $currentConfig = is_array($client->config) ? $client->config : (is_string($client->config) ? (json_decode($client->config, true) ?? []) : []);
            
            // Map specific fields to config if they don't exist in users table columns
            // Assuming users table has basic fields, others go to config
            // Based on User model fillable: name, email, cpf, cnpj, celular(maybe via cast/accessors?), genero, etc.
            
            // List of potential config fields based on standard User models in this project type
            $configFields = [
                'pais_origem', 'canac', 'identidade', 'cep', 'endereco', 'numero',
                'complemento', 'bairro', 'cidade', 'estado', 'nacionalidade',
                'profissao', 'altura', 'peso', 'nascimento', 'data_de_nascimento'
            ];
            
            \Illuminate\Support\Facades\Log::info('Processing Config Fields', ['request_all' => $request->all()]);

            foreach ($configFields as $field) {
                if ($request->has($field)) {
                    $currentConfig[$field] = $request->input($field);
                }
            }
            
            // Direct update for fillable fields
            $fillableUpdates = $request->only(['name', 'email', 'cpf', 'celular', 'sexo']); // sexo might require mapping to 'genero'
            if ($request->has('sexo')) {
                // Map sexo (Masculino/Feminino/ni) to genero (m/f/ni)
                $sexo = strtolower($request->input('sexo'));
                if (in_array($sexo, ['m', 'f'])) {
                     $fillableUpdates['genero'] = $sexo;
                } elseif (in_array($sexo, ['masculino', 'feminino'])) {
                     $fillableUpdates['genero'] = substr($sexo, 0, 1);
                } elseif ($sexo === 'ni' || $sexo === 'não informar') {
                     $fillableUpdates['genero'] = 'ni';
                }
            }

            \Illuminate\Support\Facades\Log::info('PublicSign Update:', ['fillable' => $fillableUpdates, 'config' => $currentConfig]);

            $client->fill($fillableUpdates);
            $client->config = $currentConfig; // Laravel will cast to JSON
            $client->save();

            // Mark Step 1 as done in Matricula config
            $matricula = \App\Models\Matricula::find($matricula_id);
            if ($matricula) {
                $matConfig = $matricula->config ?? [];
                $matConfig['step1_done'] = true;
                $matConfig['step1_at'] = now()->toDateTimeString();
                $matricula->config = $matConfig;
                $matricula->save();
                //gerar pdf
                $dm = $this->dm($matricula_id); 
                $list_pdf_contratos = $this->contratos_periodos_pdf($matricula_id,$dm);
                if($list_pdf_contratos) {
                    $ret['exec'] = true;
                }
            }

            return response()->json([
                'message' => 'Dados atualizados com sucesso!',
                'redirect' => '/aluno/matricula/' . $client_id . '_' . $matricula_id . '/2',
                'client' => $client,
                'list_pdf' => $list_pdf_contratos,
            ]);

        } catch (\Exception $e) {
            return response()->json(['error' => 'Erro ao salvar dados: ' . $e->getMessage()], 500);
        }
    }
    /**
     * Metodo para revelar a lista de contratos pdf gerados para a matricula
     */
    public function list_link_periodos_pdf($matricula_id,$dm){
        $list = Qlib::get_matriculameta($matricula_id,'contrato_pdf',true);
        $list_pdf_contratos = [];
        if($list){
            $list_pdf_contratos = json_decode($list,true);
        }
        return $list_pdf_contratos;
    }
    /**
     * @return array
     */
	public function sava_meta_fields($config){
		$id_matricula = isset($config['id'])?$config['id']:null;
        $meta = isset($config['meta'])?$config['meta']:null;
		$ret['exec'] = false;
    	if($id_matricula && $meta){
			if(!isset($meta['instrutores'])){
				$verf = Qlib::get_matriculameta($id_matricula,'instrutores',true);
				if($verf) {
					$ret['sm']['remove_inst'] = Qlib::update_matriculameta($id_matricula,'instrutores',Qlib::lib_array_json([]));
					if($ret['sm']['remove_inst']){
						$ret['exec'] = true;
					}
				}
			}
			foreach ($meta as $km => $vm) {
				if(is_array($vm)){
					$ret['sm'][$km] = Qlib::update_matriculameta($id_matricula,$km,Qlib::lib_array_json($vm));
				}else{
					$ret['sm'][$km] = Qlib::update_matriculameta($id_matricula,$km,$vm);
				}
				if($ret['sm'][$km]){
					$ret['exec'] = true;
				}
			}
		}
		return $ret;
	}
    /**
     * Metodo para renderizar os contratos de periodos de uma matricula
     */
    public function contratos_periodos($id,$dm=[]){
        if(!$id){
            return response()->json(['error' => 'ID da matrícula é necessário'], 400);
        }
        if(!$dm){
            $dm = $this->dm($id);
        }
        $contratos = [];
        if($dm){
            //Carrgar o id dos contratos na propospota
            $ids = $dm['orc']['modulos'][0]['id_contratos']??null;
            // if(!$ids){
                //Buscar ids atualizados dos contratos atravez do id do periodo
                $id_periodos = $dm['orc']['modulos'][0]['id']??null;
                $d_periodo = (new PeriodoController())->show($id_periodos)->getData()->id_contratos;
                $ids = $d_periodo??[];
                // return response()->json(['error' => 'IDs dos contratos são necessários'], 400);
            // }
            // dd($dm,$ids);
            //Localizar os conteudos dos contratos com esses ids
            if($ids && count($ids)){
                $cc = new ContratoController();
                //adicionar complatibilidade de campos
                $dm['aluno'] = $dm['cliente_nome']??[];
                $dm['cpf_aluno'] = $dm['cliente']['cpf']??'';
                $dm['estado_civil'] = $dm['cliente']['estado_civil']??'';
                $dm['nacionalidade'] = $dm['cliente']['nacionalidade']??'';
                $dm['curso'] = $dm['curso_nome']??'';
                $dm['identidade'] = $dm['cliente']['config']['rg']??'';
                // dd($dm);
                foreach($ids as $id){
                    $cont = $cc->show($id)->getData();
                    //Aplicar shortcodes
                    $cont->conteudo = Qlib::apply_shortcodes($cont->conteudo,$dm);
                    $contratos[] = ['id'=>$id,'conteudo'=>$cont->conteudo,'nome'=>$cont->nome,'slug'=>$cont->slug];
                }
            }
            return $contratos;
            // $contratos = $dm->contratos()->get();
            // return response()->json($contratos);
        }
        return response()->json(['error' => 'Matrícula não encontrada'], 404);
    }
    /**
     * Metodo para gerar um arquivos pdf estatico com os contratos de periodos de uma matricula
     */
    public function contratos_periodos_pdf($id,$dm=[]){
        $ret['exec'] = false;
        $contratos_pdf = [];
        if(!$id){
            return response()->json(['error' => 'ID da matrícula é necessário'], 400);
        }
        if(!$dm){
            $dm = $this->dm($id);
        }
        $contratos = $this->contratos_periodos($id,$dm);
        if($contratos){
            $token = $dm['token']??'';
            $nome_periodo = $dm['orc']['modulos'][0]['nome']??'';
            $slug_periodo = $dm['orc']['modulos'][0]['slug']??'';
            $pasta = 'contratos/periodos/'.$slug_periodo??'';
            $id_matricula = $id;
            $contratos_pdf = [];
            // dd($contratos);
            if(is_array($contratos)){
                //limpar os dados do meta campo
                $campo_meta = 'contrato_pdf';
                Qlib::update_matriculameta($id_matricula,$campo_meta,Qlib::lib_array_json([]));
                foreach($contratos as $k=> $cont){
                    $periodo = $nome_periodo??'';
                    $conteudo = $cont['conteudo']??'';
                    $titulo = $cont['slug']??'';
                    $dados = [
                        'html'=>$conteudo,
                        'titulo'=>$campo_meta,
                        'nome_aquivo_savo'=>$titulo.'_'.$id_matricula.'_'.$k,
                        'id_matricula'=>$id_matricula,
                        'token'=>$token,
                        'short_code'=>$titulo.'_'.$id_matricula,
                        'pasta'=>$pasta,
                        'f_exibe'=>'server',
                    ];
                    $contratos_pdf[] = (new PdfController)->convert_html($dados);
                }
            }
        }else{
            $ret['exec'] = false;
            $ret['mens'] = 'Erro ao gerar os contratos de periodos';
        }
        $ret['exec'] = true;
        $ret['contratos_pdf'] = $contratos_pdf;
        return $ret;
    }
    /**
     * Criar metodo para gerenciar assinaturas
     */
    /**
     * metodo helper para gerar lista de testemunhas que vao assinar os contratos
     */


use Illuminate\Support\Facades\Bus; // Added Bus import

    public function publicApprove(Request $request, $client_id, $matricula_id)
    {
        try {
            $matricula = \App\Models\Matricula::findOrFail($matricula_id);
            
            // Validate Step 1 completion
            $config = $matricula->config ?? [];
            if (empty($config['step1_done'])) {
                return response()->json([
                    'error' => 'Etapa 1 não concluída.',
                    'redirect' => '/aluno/matricula/' . $client_id . '_' . $matricula_id . '/1'
                ], 403);
            }

            // Update with Step 2 completion
            $config['step2_done'] = true;
            $config['step2_at'] = now()->toDateTimeString();
            $matricula->config = $config;
            
            $matricula->save();

            // Dispatch Jobs Sequentially
            Bus::chain([
                new GeraPdfPropostasPnlJob($matricula_id),
                new GeraPdfcontratosPnlJob($matricula_id),
                new SendPeriodosZapsingJob($matricula_id),
            ])->dispatch();

            return response()->json(['message' => 'Proposta aprovada com sucesso!']);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Erro ao aprovar proposta: ' . $e->getMessage()], 500);
        }
    }
}
