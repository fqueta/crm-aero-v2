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
use App\Services\Escola;
use Illuminate\Support\Facades\Bus;
// Import removido: Str não é mais necessário
use App\Jobs\GeraPdfPropostasPnlJob;
use App\Jobs\GeraPdfcontratosPnlJob;
use App\Jobs\SendPeriodosZapsingJob;
use App\Models\EventLog;
use Illuminate\Support\Facades\Storage;

class MatriculaController extends Controller
{
    protected PermissionService $permissionService;
    public $default_funil_vendas_id;
    public $default_etapa_vendas_id;
    public $default_proposal_situacao_id;
    public $campos_status_assinatura;

    public function __construct()
    {
        $this->permissionService = new PermissionService();
        $this->default_funil_vendas_id = Qlib::qoption('default_funil_vendas_id');
        $this->default_etapa_vendas_id = Qlib::qoption('default_etapa_vendas_id');
        $this->default_proposal_situacao_id = Qlib::qoption('default_proposal_situacao_id');
        $this->campos_status_assinatura = 'status_assinatura';
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

        try {
            EventLog::create([
                'entity_type' => 'matricula',
                'entity_id' => (string)$matricula->id,
                'action' => 'created',
                'description' => 'Matrícula criada',
                'payload' => $validated,
                'actor_id' => (string)$user->id,
                'ip_address' => $request->ip(),
            ]);
        } catch (\Throwable $e) {}

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
     * PT-BR: Retorna dados completos da matrícula (Matricula) com aliases úteis para o front-end,
     * incluindo metadados, parcelamentos e links públicos. Se o parâmetro $id_cliente for informado,
     * valida a existência do cliente.
     * EN: Returns full enrollment (Matricula) data with helpful aliases for the frontend,
     * including metadata, installments and public links. If $id_cliente is provided, validates
     * the client existence.
     *
     * @param int|string $id Identificador da matrícula
     * @param int|null $id_cliente Identificador do cliente (opcional)
     * @return array Dados agregados e normalizados da matrícula
     */
    public function dm(int|string $id, int|string|null $id_cliente = null): array
    {
        $cliente = null;
        if (!is_null($id_cliente)) {
            $cliente = User::findOrFail($id_cliente);
        }

        // Consulta principal usando relacionamentos Eloquent e eager loading
        $matricula = Matricula::with([
                'curso:id,nome,tipo',
                'turma:id,nome',
                'cliente:id,name,email,cpf,celular,config,preferencias,ativo,permission_id,created_at,updated_at,autor',
                'funnel:id,name',
                'stage:id,name,funnel_id',
                'situacao:ID,post_title',
                'parcelamentos'
            ])
            ->findOrFail($id);

        $data = $matricula->toArray();
        // Aliases de nomes para compatibilidade com o front
        $data['curso_nome'] = $matricula->curso->nome ?? null;
        $data['curso_tipo'] = $matricula->curso->tipo ?? null;
        $data['turma_nome'] = $matricula->turma->nome ?? null;
        $data['cliente_nome'] = $matricula->cliente->name ?? null;
        $data['funnel_nome'] = $matricula->funnel->name ?? null;
        $data['stage_nome'] = $matricula->stage->name ?? null;
        $data['situacao_nome'] = $matricula->situacao->post_title ?? null;

        // Nó de cliente estruturado
        $data['cliente'] = $matricula->cliente ? $this->mapClientNodeOutput($matricula->cliente) : null;
        $data['meta'] = $this->getAllMatriculaMeta($matricula['id']);
        $data['consultor'] = $this->mapClientNodeOutput(User::find($matricula['id_consultor']));
        // Parcelamentos via relação Eloquent para manter consistência com sync()
        // Parcelamentos já carregados via relação
        $data['numero_contrato'] = $this->numero_contrato($matricula['id']);
        $data['parcelamentos'] = $matricula->parcelamentos ? $matricula->parcelamentos->toArray() : [];
        //incluir o campo com link publico da proposta
        $link = '/aluno/matricula/'.$matricula['id_cliente'].'_'.Qlib::zerofill($matricula['id'],5).'/1';
        $data['link_orcamento'] = Qlib::qoption('front_url') . $link;
        $data['link_assinatura'] = Qlib::qoption('front_url') . str_replace('matricula','assinatura',$link);
        return $data;
    }
    /**
     * Metodo para exibir o numero do contrato
     * @param int $id_matricula
     */
    public function numero_contrato($id_matricula=false){
        $ret = false;
        if($id_matricula){
            //uso $ret = (new CursosController)->numero_contrato($id_matricula);
            $ret = false;
            if($id_matricula){
                $data = Qlib::buscaValorDb('matriculas','id',$id_matricula,'data');
                if($data){
                    $arr_data = explode('-',explode(' ',$data)[0]);
                    if(isset($arr_data[1])){
                        $ret = Qlib::zerofill($id_matricula,5).'.'.$arr_data[1].'.'.$arr_data[0];
                    }
                }
            }
            return $ret;
        }
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

        try {
            EventLog::create([
                'entity_type' => 'matricula',
                'entity_id' => (string)$matricula->id,
                'action' => 'updated',
                'description' => 'Matrícula atualizada',
                'payload' => $validated,
                'actor_id' => (string)$user->id,
                'ip_address' => $request->ip(),
            ]);
        } catch (\Throwable $e) {}

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
                    //gravar proposta
                    GeraPdfPropostasPnlJob::dispatch($id_matricula);
					//gravar contrato estatico...
                    GeraPdfcontratosPnlJob::dispatch($id_matricula)->delay(now()->addSeconds(5));
                    //enviar para zapsing
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
     * Helper to get matricula ID by token (stored in config).
     */
    public function get_id_by_token($token)
    {
        if (!$token) return null;
        return Matricula::where('config->token', $token)->value('id');
    }


    /**
     * Public endpoint to show proposal details for signature.
     */
    public function publicShow($client_id, $matricula_id)
    {
        try {
            // Normaliza id da matrícula para inteiro (aceita '00002')
            $matricula_id = (int) $matricula_id;
            $matricula = Matricula::where('id', $matricula_id)
                ->where('id_cliente', $client_id)
                ->firstOrFail();
            $data = $this->dm($matricula_id, $client_id);
            //Verificar se a assinatura ja foi registrada
            $status_assintura_atual = Qlib::get_matriculameta($matricula_id,$this->campos_status_assinatura);
            $is_assinado = Escola::contrato_assinado($matricula_id);
            // dd($is_assinado);
            $config = is_array($matricula->config) ? $matricula->config : (is_string($matricula->config) ? (json_decode($matricula->config, true) ?? []) : []);
            $step1Done = !empty($config['step1_done']);
            // Redireciona para etapa 2 somente se já concluiu a etapa 1 (para evitar loop)
            if(($status_assintura_atual == 'aprovado' || $is_assinado) && $step1Done){
                $client = User::findOrFail($client_id);
            $status = $is_assinado ? 'aprovado' : '';
            $message = $is_assinado
                ? 'Está proposta ja está aprovada e assinada'
                : 'A proposta foi aprovada e está aguardando assinatura digital.';
                $ret = [
                    'status' => $status,
                    'message' => $message,
                    'redirect' => '/aluno/matricula/' . $client_id . '_' . Qlib::zerofill($matricula_id, 5) . '/2/aprovado',
                        'client' => $client,
                        // 'list_pdf' => $list_pdf_contratos,
                        'exec' => true,
                    ];
                return response()->json($ret, 200);
            }
            //mudança de etapa da matricula
            $this->applyMatriculaStage($matricula, $this->getMatriculaStageId('show'), (string)$client_id, request()->ip(), 'Etapa alterada via publicShow');
            $clientUser = User::find($client_id);
            if ($clientUser) {
                //mudança de epata do cliente
                $this->applyUserStage($clientUser, $this->getUserStageId('show'), (string)$client_id, request()->ip(), 'Etapa do cliente alterada via publicShow');
            }


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
            // tranform matricual_id em int
            $matricula_id = (int) $matricula_id;
            $client = User::findOrFail($client_id);

            // Validate request data
            // Adapting validation based on the fields shown in the image/request
            $rules = [
                'name' => 'required|string|max:255',
                'email' => ['required', 'email', Rule::unique('users')->ignore($client->id)],
                'celular' => ['required', 'string', Rule::unique('users')->ignore($client->id)],
                'nascimento' => 'required|date',
                'cpf' => ['required', 'string', Rule::unique('users')->ignore($client->id)],
                'cep' => 'required|string',
                'endereco' => 'required|string',
                'numero' => 'required|string',
                'complemento' => 'nullable|string',
                'bairro' => 'required|string',
                'cidade' => 'required|string',
                'estado' => 'required|string',
                'nacionalidade' => 'required|string',
                'profissao' => 'required|string',
                'sexo' => 'required|string',
                'altura' => 'required|numeric',
                'peso' => 'required|numeric',
                'canac' => 'nullable|string',
                'identidade' => 'required|string',
                'pais_origem' => 'required|string',
            ];

            $validator = Validator::make($request->all(), $rules);

            if ($validator->fails()) {
                return response()->json(['error' => 'Erro de validação', 'messages' => $validator->errors()], 422);
            }

            $data = $request->except(['config']);

            // Handle config/meta fields
            // Ensure we handle config correctly regardless of cast
            $currentConfig = is_array($client->config) ? $client->config : (is_string($client->config) ? (json_decode($client->config, true) ?? []) : []);

            // Normaliza altura (m) e peso (kg) recebidos em formatos diversos
            // Accepts values like "1,80", "1.80", "180" (cm) for altura; "64", "64,5" for peso
            $alturaInput = (string)$request->input('altura', '');
            $pesoInput   = (string)$request->input('peso', '');
            $alturaSan   = preg_replace('/[^\d\.,]/', '', $alturaInput ?? '');
            $pesoSan     = preg_replace('/[^\d\.,]/', '', $pesoInput ?? '');
            $alturaNum   = (float)str_replace(',', '.', $alturaSan ?? '');
            $pesoNum     = (float)str_replace(',', '.', $pesoSan ?? '');
            // Se altura >= 3, assume centímetros e converte para metros
            if ($alturaNum >= 3) {
                $alturaNum = $alturaNum / 100.0;
            }
            // Grava valores normalizados em config
            if ($alturaNum > 0) {
                $currentConfig['altura'] = $alturaNum;
            }
            if ($pesoNum > 0) {
                $currentConfig['peso'] = $pesoNum;
            }

            // Map specific fields to config if they don't exist in users table columns
            // Assuming users table has basic fields, others go to config
            // Based on User model fillable: name, email, cpf, cnpj, celular(maybe via cast/accessors?), genero, etc.

            // List of potential config fields based on standard User models in this project type
            $configFields = [
                'pais_origem', 'canac', 'identidade', 'cep', 'endereco', 'numero',
                'complemento', 'bairro', 'cidade', 'estado', 'nacionalidade','sexo','','','','','',
                'profissao', 'altura', 'peso', 'nascimento', 'data_de_nascimento'
            ];

            \Illuminate\Support\Facades\Log::info('Processing Config Fields', ['request_all' => $request->all()]);

            foreach ($configFields as $field) {
                if ($request->has($field)) {
                    // Evita sobrescrever altura/peso já normalizados acima
                    if (in_array($field, ['altura','peso'])) {
                        continue;
                    }
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

            // Verifica se tem CPF mas não tem senha
            if (!empty($client->cpf) && empty($client->password)) {
                $rawCpf = preg_replace('/[^0-9]/', '', $client->cpf);
                if (!empty($rawCpf)) {
                    $client->password = bcrypt($rawCpf);
                }
            }

            $client->save();

            // Mark Step 1 as done in Matricula config
            $matricula = \App\Models\Matricula::find($matricula_id);
            $ret['exec'] = false;
            if ($matricula) {
                $matConfig = $matricula->config ?? [];
                $matConfig['step1_done'] = true;
                $matConfig['step1_at'] = now()->toDateTimeString();
                $matricula->config = $matConfig;
                $matricula->save();
                $this->applyMatriculaStage($matricula, $this->getMatriculaStageId('sign'), (string)$client_id, $request->ip(), 'Etapa alterada via publicSign');
                $clientUser = User::find($client_id);
                if ($clientUser) {
                    $this->applyUserStage($clientUser, $this->getUserStageId('sign'), (string)$client_id, $request->ip(), 'Etapa do cliente alterada via publicSign');
                }
                //gerar pdf
                // $dm = $this->dm($matricula_id);
                // $list_pdf_contratos = $this->contratos_periodos_pdf($matricula_id);
                // if($list_pdf_contratos) {
                    $ret = [
                        'message' => 'Dados atualizados com sucesso!',
                        'redirect' => '/aluno/matricula/' . $client_id . '_' . Qlib::zerofill($matricula_id, 5) . '/2',
                        'client' => $client,
                        // 'list_pdf' => $list_pdf_contratos,
                        'exec' => true,
                    ];
                // }
            }
            if(!$ret['exec']){
                $ret['message'] = 'Erro ao atualizar dados';
            }
            return response()->json($ret ,($ret['exec'])?200:500);

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
                try {
                    $d_periodo = (new PeriodoController())->show($id_periodos)->getData()->id_contratos;
                }catch(\Exception $e){
                    $d_periodo = [];
                }
                $ids = $d_periodo??[];

                // Se não encontrou IDs pelo período, tenta buscar contratos vinculados diretamente ao curso
                // Ajuste: Apenas para cursos do tipo 2 (conforme solicitado)
                if (empty($ids) && !empty($dm['id_curso']) && isset($dm['curso_tipo']) && $dm['curso_tipo'] == 2) {
                    $ids = \App\Models\Post::where('post_type', 'contratos')
                        ->where('config', 'like', '%"id_curso":' . $dm['id_curso'] . '%')
                        ->where('post_status', 'publish')
                        ->orderBy('menu_order')
                        ->orderByDesc('ID')
                        ->pluck('ID')
                        ->toArray();
                }
                // dd($ids);
                // return response()->json(['error' => 'IDs dos contratos são necessários'], 400);
            // }
            // dd($id_periodos);
            //Localizar os conteudos dos contratos com esses ids
            if($ids && count($ids)){
                $cc = new ContratoController();
                //adicionar compatibilidade de campos
                $dm['aluno'] = $dm['cliente_nome']??[];
                $dm['cpf_aluno'] = $dm['cliente']['cpf']??'';
                $dm['estado_civil'] = $dm['cliente']['estado_civil']??'';
                $dm['nacionalidade'] = $dm['cliente']['nacionalidade']??'';
                $dm['data_nascimento'] = $dm['cliente']['config']['nascimento']??'';
                if($dm['data_nascimento']){
                    $dm['data_nascimento'] = date('d/m/Y',strtotime($dm['data_nascimento']));
                }
                $dm['celular'] = $dm['cliente']['config']['celular']??'';
                $dm['telefone'] = $dm['cliente']['config']['telefone']??'';
                //Adicionar mascar de telefone
                if($dm['celular']){
                    $dm['celular'] = Qlib::mask($dm['celular'],'(99) 99999-9999');
                }
                if($dm['telefone']){
                    $dm['telefone'] = Qlib::mask($dm['telefone'],'(99) 9999-9999');
                }

                $dm['curso'] = $dm['curso_nome']??'';
                $dm['nome_curso'] = $dm['curso'];
                $dm['identidade'] = $dm['cliente']['config']['rg']??'';
                $testemunhas = $this->testemunhas();
                $dm['nome_testemunha1'] = $testemunhas[0]['name']??'';
                $dm['cpf_testemunha1'] = $testemunhas[0]['cpf']??'';
                $dm['nome_testemunha2'] = $testemunhas[1]['name']??'';
                $dm['cpf_testemunha2'] = $testemunhas[1]['cpf']??'';
                $dm['data_contrato_aceito'] = Qlib::dataLocal();
                $assinar = $this->helper_assinar($testemunhas);
                if(is_array($assinar) && count($assinar)){
                    $dm = array_merge($dm,$assinar);
                }
                // dd($assinar,$dm);
                foreach($ids as $id){
                    try {
                        $cont = $cc->show($id)->getData();
                    } catch (\Exception $e) {
                       continue;
                    }
                    //Aplicar shortcodes
                    $cont->conteudo = Qlib::apply_shortcodes($cont->conteudo,$dm);
                    $conteudo = $cont->conteudo??'';
                    $contratos[] = ['id'=>$id,'conteudo'=>$conteudo,'nome'=>$cont->nome,'slug'=>$cont->slug];
                }
            }
            return $contratos;
            // $contratos = $dm->contratos()->get();
            // return response()->json($contratos);
        }
        return response()->json(['error' => 'Matrícula não encontrada'], 404);
    }
    /**
     * Metodo para auxiliar o preenchimento de assinaturas nos contratos
     * @param string $conteudo O conteúdo do contrato com os shortcodes {NOME} e {CPF}
     * @param string $nome O nome da pessoa a ser assinada
     * @param string $cpf O CPF da pessoa a ser assinada
     * @return string O conteúdo do contrato com as assinaturas preenchidas
     */
    public function helper_assinar($testemunhas=[]){
        if(!count($testemunhas)){
            $testemunhas =  $this->testemunhas();
        }
        $data_aceito_contrato = Qlib::dataLocal();
        $nome_contratada = '';
        $nome_testemunha1 = '';
        $nome_testemunha2 = '';
        $cpf_testemunha1 = '';
        $cpf_testemunha2 = '';
        $cpf_contratada = '';
        $assinatura_contratada = '';
        $assinatura_testemunha1 = '';
        $assinatura_testemunha2 = '';
        $dcont = User::where('token','id_contatada')->first();
        $ret = [];
        if($dcont){
                // $nome_contratada = $dcont[0]['nome'].' '.$dcont[0]['sobrenome'];
                $nome_contratada = $dcont->name;
                $cpf_contratada = $dcont->cpf;
                $ret['assinatura_contratada'] = '<span style="font-size:13px" class="text-danger">Contrato assinado digitalmete por <b>{nome_contratada}</b> na data em '.$data_aceito_contrato.'</span>';
                $ret['assinatura_contratada'] = str_replace('{nome_contratada}',$nome_contratada,$ret['assinatura_contratada']);
            }
            if($testemunhas[0]){
                $nome_testemunha1 = $testemunhas[0]['name']??'';
                $cpf_testemunha1 = $testemunhas[0]['cpf']??'';
                $assinatura_testemunha1 = '<span style="font-size:13px" class="text-danger" style="">Contrato assinado digitalmete por <b>{nome_testemunha1}</b> na data em '.$data_aceito_contrato.'</span>';
                $ret['assinatura_testemunha1'] = str_replace('{nome_testemunha1}',$nome_testemunha1,$assinatura_testemunha1);
            }
            if($testemunhas[1]){
                $nome_testemunha2 = $testemunhas[1]['name']??'';
                $cpf_testemunha2 = $testemunhas[1]['cpf']??'';
                $ret['assinatura_testemunha2'] = '<span style="font-size:13px" class="text-danger" style="">Contrato assinado digitalmete por <b>{nome_testemunha2}</b> na data em '.$data_aceito_contrato.'</span>';
                $ret['assinatura_testemunha2'] = str_replace('{nome_testemunha2}',$nome_testemunha2,$ret['assinatura_testemunha2']);
            }
            return $ret;
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
     * Metodo para retornar os contratos em HTML para visualização
     */
    public function contratos_periodos_html($client_id, $matricula_id)
    {
        try {
            // Verifica se a matrícula pertence ao cliente
            Matricula::where('id', $matricula_id)
                ->where('id_cliente', $client_id)
                ->firstOrFail();
            $contratos = $this->contratos_periodos($matricula_id);

            // Verifica erro vindo do metodo contratos_periodos
            if (isset($contratos['error']) || $contratos instanceof \Illuminate\Http\JsonResponse) {
                return $contratos;
            }

            return response()->json($contratos);

        } catch (\Illuminate\Database\Eloquent\ModelNotFoundException $e) {
            return response()->json(['error' => 'Matrícula não encontrada ou acesso negado'], 404);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Erro ao carregar contratos: ' . $e->getMessage()], 500);
        }
    }
    /**
     * Criar metodo para gerenciar assinaturas
     */
    /**
     * metodo helper para gerar lista de testemunhas que vao assinar os contratos
     */
    public function testemunhas(){
        $testemunhas = [];
        $arr_token_testemunas = ['id_testemunha1','id_testemunha2'];
        /**Lista do ids das testemunhas da matricula */
        foreach($arr_token_testemunas as $token){
            $testemunhas[] = User::where('token',$token)->first()->toArray();
        }
        /**
         * resgatar os dados de usuarios das testemunhas da matricula
         */
        return $testemunhas;
    }



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
            //se o id do cliente não concidir com o id do cliente da matricula
            if ($client_id != $matricula->id_cliente) {
                return response()->json([
                    'error' => 'Cliente não autorizado.',
                    'redirect' => '/aluno/matricula/' . $client_id . '_' . $matricula_id . '/1'
                ], 403);
            }

            // Update with Step 2 completion
            $config['step2_done'] = true;
            $config['step2_at'] = now()->toDateTimeString();
            $matricula->config = $config;

            $matricula->save();

            //mudança de etapa da matricula
            $this->applyMatriculaStage($matricula, $this->getMatriculaStageId('approve'), (string)$client_id, $request->ip(), 'Etapa alterada via publicApprove');
            $clientUser = User::find($client_id);
            if ($clientUser) {
                //mudança de epata do cliente
                $this->applyUserStage($clientUser, $this->getUserStageId('approve'), (string)$client_id, $request->ip(), 'Etapa do cliente alterada via publicApprove');
            }
            //Grabar status assinatura
            $updata_status = Qlib::update_matriculameta($matricula_id,$this->campos_status_assinatura,'aprovado');
            // Dispatch Jobs Sequentially
            Bus::chain([
                new GeraPdfPropostasPnlJob($matricula_id),
                new GeraPdfcontratosPnlJob($matricula_id),
                new SendPeriodosZapsingJob($matricula_id),
            ])->dispatch();

            return response()->json([
                'message' => 'Proposta aprovada com sucesso!',
                'updata_status' => $updata_status,
                'redirect' => '/aluno/matricula/' . $client_id . '_' . Qlib::zerofill($matricula_id, 5) . '/2/aprovado',
                'exec' => true
            ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Erro ao aprovar proposta: ' . $e->getMessage()], 500);
        }
    }
    /**
     * Atualiza rapidamente a etapa (stage) da matrícula.
     */
    public function updateStageRapid(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('edit')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $matricula = Matricula::find($id);
        if (!$matricula) {
            return response()->json(['error' => 'Matrícula não encontrada'], 404);
        }

        $input = $this->mapFields($request);
        $validator = Validator::make($input, [
            'stage_id' => ['required', 'integer', 'exists:stages,id'],
        ]);
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Erro de validação',
                'errors' => $validator->errors(),
            ], 422);
        }
        $validated = $validator->validated();

        $newStageId = (int)$validated['stage_id'];
        $oldStageId = $matricula->stage_id;
        $matricula->stage_id = $newStageId;

        $stage = null;
        try {
            $stage = Stage::select(['id', 'funnel_id'])->find($newStageId);
        } catch (\Exception $e) {
            $stage = null;
        }
        if ($stage && isset($stage->funnel_id)) {
            $matricula->funnel_id = $stage->funnel_id;
        }

        $currentConfig = is_array($matricula->config)
            ? $matricula->config
            : (is_string($matricula->config) ? (json_decode($matricula->config, true) ?? []) : []);
        $currentConfig['stage_id'] = $newStageId;
        if (!isset($currentConfig['funnelId']) && $stage && isset($stage->funnel_id)) {
            $currentConfig['funnelId'] = $stage->funnel_id;
        }
        $matricula->config = $currentConfig;

        $matricula->save();

        try {
            DB::table('matricula_stage_history')->insert([
                'matricula_id' => $matricula->id,
                'from_stage_id' => $oldStageId,
                'to_stage_id' => $newStageId,
                'user_id' => (string)$user->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Exception $e) {
        }

        try {
            EventLog::create([
                'entity_type' => 'matricula',
                'entity_id' => (string)$matricula->id,
                'action' => 'stage_changed',
                'description' => 'Etapa alterada',
                'payload' => [
                    'from_stage_id' => $oldStageId,
                    'to_stage_id' => $newStageId,
                ],
                'actor_id' => (string)$user->id,
                'ip_address' => $request->ip(),
            ]);
        } catch (\Throwable $e) {}

        $out = $this->mapOutputFields($matricula->toArray());
        return response()->json($out);
    }
    /**
     * Metodo para enviar o termo para zapsing
     * @params $tm $token da matricula
     * @usu $ret = (new MatriculaController)->send_to_zapSing('token_matricula');
     */
    public function send_to_zapSing($id_matricula,$dm=false,$tk_periodo=false){
        if(!$dm && $id_matricula){
            $dm = $this->dm($id_matricula);
        }
        // dd($dm);
        $ret['exec'] = false;
        // $ret['dm'] = $dm;
        $ret['mens'] = 'Matricula de id '.$id_matricula.' não foi encontrada';
        $ret['color'] = 'danger';
        //listar contrato
        // return $ret;
        if(!$dm){
            return $ret;
        }
        $id = isset($dm['id']) ? $dm['id'] : '';
        $tipo_curso = isset($dm['curso_tipo']) ? $dm['curso_tipo'] : '';
        $nome = '';
        // $pdf = new PaginaController();
        if($tipo_curso == 4){
            //Recupera o nome do Periodo
            $nome = $dm['orc'][0]['nome']??'';
        }

        //verifica se ja tem os links do contrato criados
        $contratosMeta = Qlib::get_matriculameta($id, 'contrato_pdf');
        // dd($contratosMeta,$dm);
        $contratos = false;
        if(is_string($contratosMeta)){
            $contratos = json_decode($contratosMeta,true);
        }
        if(!is_array($contratos)){
            //gerar os pdf dos contratos
            $gerar_contratos = $this->contratos_periodos_pdf($id??'');
            if($gerar_contratos['exec']){
                $contratosMeta = Qlib::get_matriculameta($id, 'contrato_pdf');
                $contratos = json_decode($contratosMeta,true);
            }
        }
        // dd($contratos);
        // if($id){
        //     if(!$contratosMeta)
        //         $contratos = $this->contratos_periodos_pdf($id??'');

        // }else{
        //     $contratos = false;
        // }
        $enviar = false;
        if(isset($contratos[0]['url']) && ($link_c = $contratos[0]['url'])){
            //link do contrato de prestação ou seja o principal contrato
            $enviar = $this->enviar_envelope($id,$dm,$link_c);
            // $enviar = (new \App\Http\Controllers\api\ZapsingController)->enviar_envelope($id??'');
            if($tk_periodo){
                if($enviar['exec'] == true){
                    $campo_processamento = 'enviar_envelope_'.$tk_periodo;
                    $ret['exec'] = true;
                    //gravar o processamento em campo
                    $ret['save_process'] = Qlib::update_matriculameta($id,$campo_processamento,Qlib::lib_array_json($enviar));
                    //removendo o primiero contrato da lista
                    if(is_array($contratos)){
                        $n_cont = array_shift($contratos);
                        $token_doc = isset($enviar['response']['token']) ? $enviar['response']['token'] : false;
                        if($token_doc && is_array($n_cont)){
                            $ret['anexos'] = $this->enviar_contratos_anexos(false,false,$dm,$tk_periodo);
                        }
                    }else{
                        $ret['exec'] = false;
                        $ret['mens'] = 'Lista de contratos inválidos';
                        $ret['color'] = 'danger';

                    }
                }
            }else{
                if($enviar['exec'] == true){
                    $ret['exec'] = true;
                    //gravar o processamento em campo
                    $ret['save_process'] = Qlib::update_matriculameta($id,'enviar_envelope',Qlib::lib_array_json($enviar));
                    //removendo o primiero contrato da lista
                    $n_cont = array_shift($contratos);
                    $token_doc = isset($enviar['response']['token']) ? $enviar['response']['token'] : false;
                    if($token_doc && is_array($n_cont)){
                        $ret['anexos'] = $this->enviar_contratos_anexos(false,false,$dm);
                    }
                }
            }
        }
        $ret['enviar'] = $enviar;
        // dump($ret);
        //gravar historico do envio do orçamento
        if(isset($ret['exec']) && $ret['exec']){
            $post_id = isset($dm['id']) ? $dm['id'] : null;
            if($post_id){
                if($tk_periodo){
                    if(isset($ret['enviar']) && ($res_process=$ret['enviar'])){
                        $ret['salv_hist'] = Qlib::update_matriculameta($post_id,'processo_assinatura',Qlib::lib_array_json($res_process));
                    }
                }else{
                    $ret['salv_hist'] = Qlib::update_matriculameta($post_id,(new ZapsingController)->campo_processo,Qlib::lib_array_json($ret));
                    if(isset($ret['salv_hist']['exec']) && $ret['salv_hist']['exec']){
                        $ret['exec'] = true;
                        $ret['mens'] = 'Matricula de id '.$id_matricula.' foi enviada para assinatura';
                        $ret['color'] = 'success';
                    }
                }
                //Envia o link de assinatura para o whatsapp atrave do zapguru
                if(Qlib::qoption('enviar_link_assinatura_zap')=='s'){
                    $ret['enviar_link_assinatura'] = (new ZapsingController())->enviar_link_assinatura($id,$tk_periodo);
                }
            }
        }
        Log::info('send_to_zapSing:', $ret);
        return $ret;
    }
    /**
     * Enviar um envelope com 1 documento para o zapsing
     * @param string $id id da matricula
     * @param string $dm dados da matricula para evitar uma nova consulta
     */
    public function enviar_envelope($id,$dm=false,$url_pdf=''){
        if(!$dm && $id){
            $dm = $this->dm($id);
        }
        $zpc = new ZapsingController;;
        $ret['exec'] = false;
        if($dm && $url_pdf){
            $cliente = $dm['cliente'] ?? [];
            $nome = isset($cliente['nome']) ? $cliente['nome'] : '';
            $email = isset($cliente['email']) ? $cliente['email'] : '';
            $cpf = isset($cliente['cpf']) ? $cliente['cpf'] : '';
            $celular = isset($cliente['celular']) ? $cliente['celular'] : '';
            $tipo_curso = isset($dm['curso_tipo']) ? $dm['curso_tipo'] : '';
            $periodo = isset($dm['orc']['modulos'][0]['nome']) ? $dm['orc']['modulos'][0]['nome'] : '';
            if($tipo_curso == 4){
            }
            $signers = [
                "name" => $nome,
                "email" => $email,
                "cpf" => $cpf,
                "send_automatic_email" => false,
                "send_automatic_whatsapp" => false,
                "auth_mode" => "CPF", //tokenEmail,assinaturaTela-tokenEmail,tokenSms,assinaturaTela-tokenSms,tokenWhatsapp,assinaturaTela-tokenWhatsapp,CPF,assinaturaTela-cpf,assinaturaTela
                "order_group" => 1,
            ];
            $signers = $zpc->signers_matricula($signers);
            //Criar o nome
            $name = $nome. ' * '.@$dm['curso_nome'].' - '.@$dm['id'];
            if($periodo){
                $name .= ' - '.@$periodo;
            }
            //o id externo será a matricula + id do cliente
            $externar_id = $id;
            if($dm['id_cliente']??false){
                $externar_id = $id.'_'.$dm['id_cliente'];
            }
            $body = [
                "name" => trim($name),// 'Assinatura da proposta',
                "url_pdf" => $url_pdf,
                "external_id" => $externar_id,
                "folder_path" => '/CRM',
                "signers" =>$signers,
                ];

            // Log Request
            try {
                if (class_exists('App\Models\EventLog')) {
                    \App\Models\EventLog::create([
                        'entity_type' => 'matricula',
                        'entity_id' => $id,
                        'action' => 'zapsign_send_request',
                        'description' => 'Enviando documento para Zapsign',
                        'payload' => $body,
                        'actor_id' => \Illuminate\Support\Facades\Auth::id() ?? null,
                    ]);
                }
            } catch (\Throwable $th) {
                Log::error('Erro ao criar log de evento zapsign_send_request: ' . $th->getMessage());
            }

            //eviar
            $ret = (new ZapsingController)->post([
                "endpoint" => 'docs',
                "body" => $body,
            ]);

            // Log Response
            try {
                if (class_exists('App\Models\EventLog')) {
                    \App\Models\EventLog::create([
                        'entity_type' => 'matricula',
                        'entity_id' => $id,
                        'action' => 'zapsign_send_response',
                        'description' => 'Resposta do envio para Zapsign',
                        'payload' => $ret,
                        'actor_id' => \Illuminate\Support\Facades\Auth::id() ?? null,
                    ]);
                }
            } catch (\Throwable $th) {
                Log::error('Erro ao criar log de evento zapsign_send_response: ' . $th->getMessage());
            }
        }
        return $ret;

    }
    /**
     * gera um array com os link dos contratos
     */
    public function enviar_contratos_anexos($contatos_anexos=[],$id=false,$dm=false,$tk_periodo=false){
        if(!$dm && $id){
            $dm = $this->dm($id);
        }
        $ret['exec'] = false;
        $ret['dm'] = $dm;
        $ret['mens'] = 'Matricula não encontrada';
        $ret['color'] = 'danger';
        //listar contrato
        if(!$dm){
            return $ret;
        }
        $id = isset($dm['id']) ? $dm['id'] : '';
        if($id && !is_array($contatos_anexos)){
            //gerar os pdf dos contratos
            $gerar_contratos = $this->contratos_periodos_pdf($id??'');
            if($gerar_contratos['exec']){
                $contratosMeta = Qlib::get_matriculameta($id, 'contrato_pdf');
                $contatos_anexos = json_decode($contratosMeta,true);
            }
        }
        // dd($contatos_anexos);
        if(is_array($contatos_anexos)){
            //conseguir o token do contrato principal
            // if($tk_periodo){
            //     $denv_p = Qlib::get_matriculameta($id,'enviar_envelope_'.$tk_periodo);
            // }else{
            $denv_p = Qlib::get_matriculameta($id,'enviar_envelope');
            // }
            $ret['exec'] = false;
            $arr = [];
            if($denv_p){
                $arr = Qlib::lib_json_array($denv_p);
                // dd($arr);
                $token_envelope = isset($arr['response']['token']) ? $arr['response']['token'] : false;
                if($token_envelope && is_array($contatos_anexos)){
                    $zp = new ZapsingController;
                    // $lastKey = array_key_last($contatos_anexos); // Obtém a última chave
                    foreach($contatos_anexos As $k=>$v){
                        $link = isset($v['url']) ? $v['url'] : false;
                        // if ($k === $lastKey) {
                        //     $nome_arquivo = isset($v['meta_key']) ? $v['meta_key'] : false;
                        // } else {
                        // $arr_n = explode('/', $link);
                        $nome_arquivo = isset($v['nome_contrato']) ? $v['nome_contrato'] : '';
                        // }
                        // $nome = ucwords($nome_arquivo);
                        $nome = $nome_arquivo;
                        // dump($token_envelope,$link,$nome);
                        $ret['anexo'][$k] = $zp->enviar_anexo($token_envelope,$link,$nome);
                        if(isset($ret['anexo'][$k]['exec'])){
                            $ret['exec'] = true;
                            $ret['mens'] = 'Enviado o contrato '.$nome_arquivo.' para a matricula '.$id;
                        }

                    }

                }
            }
            return $ret;
        }

    }
    private function applyMatriculaStage(Matricula $matricula, int $newStageId, string $actorId, string $ip, string $description): void
    {
        $oldStageId = $matricula->stage_id;
        $matricula->stage_id = $newStageId;
        $stage = null;
        try {
            $stage = Stage::select(['id','funnel_id'])->find($newStageId);
        } catch (\Throwable $e) {
            $stage = null;
        }
        if ($stage && isset($stage->funnel_id)) {
            $matricula->funnel_id = $stage->funnel_id;
        }
        $cfg = is_array($matricula->config) ? $matricula->config : (is_string($matricula->config) ? (json_decode($matricula->config, true) ?? []) : []);
        $cfg['stage_id'] = $newStageId;
        if (!isset($cfg['funnelId']) && $stage && isset($stage->funnel_id)) {
            $cfg['funnelId'] = $stage->funnel_id;
        }
        $matricula->config = $cfg;
        $matricula->save();
        try {
            DB::table('matricula_stage_history')->insert([
                'matricula_id' => $matricula->id,
                'from_stage_id' => $oldStageId,
                'to_stage_id' => $newStageId,
                'user_id' => $actorId,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (\Throwable $e) {}
        try {
            EventLog::create([
                'entity_type' => 'matricula',
                'entity_id' => (string)$matricula->id,
                'action' => 'stage_changed',
                'description' => $description,
                'payload' => [
                    'from_stage_id' => $oldStageId,
                    'to_stage_id' => $newStageId,
                ],
                'actor_id' => $actorId,
                'ip_address' => $ip,
            ]);
        } catch (\Throwable $e) {}
        try {
            event(new \App\Events\StageChanged(
                'matricula',
                (string)$matricula->id,
                is_null($oldStageId) ? null : (int)$oldStageId,
                (int)$newStageId,
                $actorId,
                $ip,
                []
            ));
        } catch (\Throwable $e) {}
    }
    private function applyUserStage(User $user, int $newStageId, string $actorId, string $ip, string $description): void
    {
        $cfg = is_array($user->config) ? $user->config : (is_string($user->config) ? (json_decode($user->config, true) ?? []) : []);
        $oldStageId = (int)($cfg['stage_id'] ?? 0);
        $cfg['stage_id'] = $newStageId;
        $stage = null;
        try {
            $stage = Stage::select(['id','funnel_id'])->find($newStageId);
        } catch (\Throwable $e) {
            $stage = null;
        }
        if ($stage && isset($stage->funnel_id)) {
            $cfg['funnelId'] = $stage->funnel_id;
        }
        $user->config = $cfg;
        $user->save();
        try {
            EventLog::create([
                'entity_type' => 'user',
                'entity_id' => (string)$user->id,
                'action' => 'stage_changed',
                'description' => $description,
                'payload' => [
                    'from_stage_id' => $oldStageId,
                    'to_stage_id' => $newStageId,
                ],
                'actor_id' => $actorId,
                'ip_address' => $ip,
            ]);
        } catch (\Throwable $e) {}
        try {
            event(new \App\Events\StageChanged(
                'user',
                (string)$user->id,
                $oldStageId,
                $newStageId,
                $actorId,
                $ip,
                []
            ));
        } catch (\Throwable $e) {}
    }


    private function getMatriculaStageId(string $action): int
    {
        $key = match ($action) {
            'show' => 'matricula_stage_show_id',
            'sign' => 'matricula_stage_sign_id',
            'approve' => 'matricula_stage_approve_id',
            default => null,
        };
        if ($key) {
            $opt = Qlib::qoption($key);
            if (is_numeric($opt)) {
                return (int)$opt;
            }
        }
        return match ($action) {
            'show' => 8,
            'sign' => 9,
            'approve' => 10,
            default => 0,
        };
    }

    private function getUserStageId(string $action): int
    {
        $key = match ($action) {
            'show' => 'user_stage_show_id',
            'sign' => 'user_stage_sign_id',
            'approve' => 'user_stage_approve_id',
            default => null,
        };
        if ($key) {
            $opt = Qlib::qoption($key);
            if (is_numeric($opt)) {
                return (int)$opt;
            }
        }
        return match ($action) {
            'show' => 3,
            'sign' => 4,
            'approve' => 5,
            default => 0,
        };
    }
    /**
     * Metodo para baixar o arquivo assinado de um oraçmento baixar em um diretorio padrão de oraçamento
     * @param string $token
     */
    public function baixar_arquivo($id_matricula,$url,$nome_arquivo=false,$slug=false,$pasta=false){
        // $url = "https://zapsign.s3.amazonaws.com/sandbox/dev/2024/12/pdf/72d30d89-da1f-4e10-9025-3689b03ef3d4/7a773057-05d3-4843-be1d-0fe6bffdb730.pdf?AWSAccessKeyId=AKIASUFZJ7JCTI2ZRGWX&Signature=oRLj2PALoDs1JEkx%2FHm4TV1ZM%2BQ%3D&Expires=1734026017";
        $num=null;
        $nome_arquivo = $nome_arquivo?$nome_arquivo:'assinado';
        $nome_arquivo = Qlib::createSlug($nome_arquivo);
        $caminhoSalvar = 'pdfs/termos/'.$id_matricula.'/'.$nome_arquivo.'.pdf';
        if($pasta){
            $caminhoSalvar = 'pdfs/termos/'.$id_matricula.'/'.$pasta.'/'.$nome_arquivo.'.pdf';
        }
        if(Storage::exists($caminhoSalvar)){
            $num='-'.time();
        }
        $caminhoSalvar = 'pdfs/termos/'.$id_matricula.'/'.$nome_arquivo.$num.'.pdf';
        if($pasta){
            $caminhoSalvar = 'pdfs/termos/'.$id_matricula.'/'.$pasta.'/'.$nome_arquivo.$num.'.pdf';
        }
        $ret = Qlib::download_file($url,$caminhoSalvar);
        $ret['url'] = $url;
        $ret['id_matricula'] = $id_matricula;
        if($ret['exec']){
            $link = Storage::url($caminhoSalvar);
            $ret['link'] = $link;
            if($slug){
                $ret['salv'] = Qlib::update_matriculameta($id_matricula,$slug,Qlib::lib_array_json(['link'=>$link,'data'=>Qlib::dataLocal()]));
            }
        }
        return $ret;
    }
    /**
     * Metodo para gerar uma simução do valor do comustivel no orçamento
     */
    public function simuladorCombustivel($id_matricula = null,$dados=false)
	{
		$ret['exec'] = false;
		$ret['valor'] = 0;
		$ret['valor_litro'] = null;
		$ret['tipo_pagamento'] = '';
		$ret['color_tipo_pagamento'] = '';

		if($id_matricula || $dados){

			if(!$dados && $id_matricula){

				$dados = $this->dm($id_matricula);

			}
			if(!isset($dados['modulos']) && isset($dados['orc'])){
                $arr_mod = Qlib::lib_json_array($dados['orc']);
				if(isset($arr_mod['modulos'])){
					$dados['modulos'] = $arr_mod['modulos'];
				}
			}

			if(isset($dados['modulos']) && is_array($dados['modulos'])){

				$arr_mod = $dados['modulos'];

				$previsao_consumo = NULL;
				$preco_litro = null;
                // dd($arr_mod);
				foreach ($arr_mod as $k => $v) {
					$aircraft_id = isset($v['aircraft_id'])?$v['aircraft_id']:0;
					$dAviao = Qlib::buscaValorDb('aeronaves','id',$aircraft_id,'config');
					if($dAviao){
                        $creditos = isset($v['limite'])?$v['limite']:0;

						$arr_dAv = Qlib::lib_json_array($dAviao);
                        // dump($dAviao,$aircraft_id,$creditos);

						if(isset($arr_dAv['combustivel']['consumo_hora']) && isset($arr_dAv['combustivel']['preco_litro']) && isset($arr_dAv['combustivel']['ativar']) && $arr_dAv['combustivel']['ativar']=='s'){

							$p_litro = Qlib::qoption('preco_litro')?Qlib::qoption('preco_litro'): $arr_dAv['combustivel']['preco_litro'];
							$preco_litro = Qlib::precoDbdase($p_litro);
							$consumo = ((int)$arr_dAv['combustivel']['consumo_hora'] * (int)$creditos); //
							$previsao_consumo += ($preco_litro * $consumo);
						}

					}

				}
                // dd($previsao_consumo);

				if($previsao_consumo){

					$ret['valor'] = $previsao_consumo;
					$ret['valor_litro'] = $preco_litro;
					$ret['tipo_pagamento'] = $this->pagamento_combustivel($id_matricula,@$dados['orc']);
					$ret['exec'] = true;
					if($ret['tipo_pagamento']=='antecipado'){
						$ret['color_tipo_pagamento'] = 'text-success';
					}else{
						$ret['color_tipo_pagamento'] = 'text-danger';
					}
				}



			}

		}
		return $ret;
	}
    /**
	 * Metodo para verificar a forma de pagamento de comustivel escolhido
	 * uso $ret = (new Orcamentos)->pagamento_combustivel($token,$org);
	 */
	public function pagamento_combustivel($token,$orc=false){
		$ret = false;
		if(!$orc && $token){
            $dm = $this->dm($token);
            if(isset($dm['orc'])){
                $orc = $dm['orc'];
            }
		}
		if($orc){
			$arr_orc = Qlib::lib_json_array($orc);
			if(isset($arr_orc['sele_pag_combustivel'])){
				$ret = $arr_orc['sele_pag_combustivel'];
			}
		}
		return $ret;
	}

    public function simuladorCombustivelApi(Request $request)
    {
        $dados = $request->all();
        $res = $this->simuladorCombustivel(null, $dados);
        return response()->json($res);
    }
}
