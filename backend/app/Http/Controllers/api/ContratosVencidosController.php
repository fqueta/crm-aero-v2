<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\EventLog;
use App\Models\Matricula;
use App\Models\User;
use App\Services\ContratoValidadeService;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

/**
 * ContratosVencidosController — SPA /admin/reports/contratos_vencidos.
 * pt-BR: Lista matrículas com contrato vencido pela regra híbrida
 * (validade explícita em config.validade_contrato ou calculada por
 * data_contrato/data_inicio + vigência). Equivale ao relatório do legado.
 */
class ContratosVencidosController extends Controller
{
    protected PermissionService $permissionService;

    public function __construct()
    {
        $this->permissionService = new PermissionService();
    }

    /**
     * Lista paginada de contratos vencidos.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $validated = $request->validate([
            'search' => 'nullable|string|max:255',
            'id_curso' => 'nullable|integer',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
        ]);

        $rows = $this->vencidos($validated);

        $perPage = (int) ($validated['per_page'] ?? 10);
        $page = (int) ($validated['page'] ?? 1);
        $total = count($rows);
        $items = array_slice($rows, ($page - 1) * $perPage, $perPage);

        $paginator = new LengthAwarePaginator($items, $total, $perPage, $page, [
            'path' => $request->url(),
            'query' => $request->query(),
        ]);

        $payload = $paginator->toArray();
        $payload['total_vencidos'] = $total;
        $payload['data_consulta'] = date('d/m/Y');

        return response()->json($payload);
    }

    /**
     * Exporta a lista filtrada em CSV (separador ;, padrão Excel PT-BR).
     */
    public function export(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $validated = $request->validate([
            'search' => 'nullable|string|max:255',
            'id_curso' => 'nullable|integer',
        ]);

        $rows = $this->vencidos($validated);

        $lines = [];
        $lines[] = ['#', 'Aluno', 'Curso', 'Validade', 'Origem', 'Dias vencido', 'Telefone'];
        foreach ($rows as $i => $row) {
            $lines[] = [
                $i + 1,
                $row['aluno'],
                $row['curso'],
                $row['validade_br'],
                $row['origem'] === ContratoValidadeService::ORIGIN_EXPLICIT ? 'Cadastrada' : 'Calculada',
                $row['dias_vencido'],
                $row['telefone'],
            ];
        }

        $csv = "\xEF\xBB\xBF";
        foreach ($lines as $fields) {
            $escaped = array_map(function ($v) {
                $v = (string) ($v ?? '');
                return '"' . str_replace('"', '""', $v) . '"';
            }, $fields);
            $csv .= implode(';', $escaped) . "\r\n";
        }

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="contratos-vencidos-' . date('Ymd-His') . '.csv"',
        ]);
    }

    /**
     * Define/limpa a validade explícita do contrato (config.validade_contrato).
     * pt-BR: null volta a usar a regra calculada.
     */
    public function setValidade(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('edit')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $validator = Validator::make($request->all(), [
            'validade' => 'nullable|date_format:Y-m-d',
        ]);
        if ($validator->fails()) {
            return response()->json(['message' => 'Data inválida (use AAAA-MM-DD).', 'errors' => $validator->errors()], 422);
        }

        $matricula = Matricula::find($id);
        if (!$matricula) {
            return response()->json(['error' => 'Matrícula não encontrada.'], 404);
        }

        $config = is_array($matricula->config) ? $matricula->config : [];
        $validade = $validator->validated()['validade'] ?? null;
        if ($validade) {
            $config['validade_contrato'] = $validade;
        } else {
            unset($config['validade_contrato']);
        }
        $matricula->config = $config;
        $matricula->save();

        return response()->json([
            'success' => true,
            'data' => $this->buildRow($matricula, $validade),
            'message' => 'Validade atualizada.',
        ]);
    }

    /**
     * Envia mensagem de cobrança de renovação via ZapGuru (WhatsApp).
     */
    public function whatsapp(Request $request, string $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('view')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $matricula = Matricula::find($id);
        if (!$matricula) {
            return response()->json(['error' => 'Matrícula não encontrada.'], 404);
        }

        $cliente = User::find($matricula->id_cliente);
        $digits = preg_replace('/\D/', '', (string) ($cliente->celular ?? ''));
        if (strlen((string) $digits) <= 11) {
            $digits = '55' . $digits;
        }
        if (strlen((string) $digits) < 12) {
            return response()->json(['success' => false, 'message' => 'Aluno sem telefone válido cadastrado.'], 422);
        }

        $row = $this->buildRow($matricula, null);
        $nome = explode(' ', trim((string) ($cliente->name ?? 'Aluno')))[0];
        $text = "Olá *{$nome}*! Aqui é do Aeroclube de Juiz de Fora. ✈️\n"
            . "Seu contrato do curso *{$row['curso']}* venceu em *{$row['validade_br']}*. "
            . 'Fale conosco para renovar e continuar voando!';

        try {
            $ret = (new ZapguruController())->enviar_mensagem([
                'celular_completo' => $digits,
                'nome' => (string) ($cliente->name ?? 'Aluno'),
                'text' => $text,
            ]);
        } catch (\Throwable $e) {
            return response()->json(['success' => false, 'message' => 'Falha ao enviar: ' . $e->getMessage()], 400);
        }

        if (empty($ret['exec'])) {
            $desc = is_array($ret['response'] ?? null) ? ($ret['response']['description'] ?? '') : '';
            return response()->json(['success' => false, 'message' => 'ZapGuru não enviou.' . ($desc !== '' ? " ({$desc})" : '')], 400);
        }

        try {
            EventLog::create([
                'entity_type' => 'matricula',
                'entity_id' => (string) $matricula->id,
                'action' => 'whatsapp_contrato_vencido',
                'description' => "Cobrança de renovação enviada via WhatsApp para {$cliente->name}.",
                'actor_id' => (string) ($user->id ?? '0'),
                'ip_address' => $request->ip(),
            ]);
        } catch (\Throwable $e) {
        }

        return response()->json(['success' => true, 'message' => 'Mensagem enviada via WhatsApp!']);
    }

    /**
     * Pipeline: busca candidatas, calcula validade, filtra vencidas, ordena.
     *
     * @return array<int, array>
     */
    private function vencidos(array $filters): array
    {
        $query = Matricula::query()
            ->join('users as cliente', 'cliente.id', '=', 'matriculas.id_cliente')
            ->leftJoin('cursos', 'cursos.id', '=', 'matriculas.id_curso')
            ->where(function ($q) {
                $q->whereNull('cliente.excluido')->orWhere('cliente.excluido', '!=', 's');
            })
            ->where(function ($q) {
                $q->whereNull('cliente.deletado')->orWhere('cliente.deletado', '!=', 's');
            })
            ->select([
                'matriculas.id',
                'matriculas.id_cliente',
                'matriculas.id_curso',
                'matriculas.status',
                'matriculas.config',
                DB::raw('cliente.name as aluno'),
                DB::raw('cliente.celular as telefone'),
                DB::raw('cursos.titulo as curso'),
            ]);

        if (!empty($filters['search'])) {
            $search = '%' . $filters['search'] . '%';
            $query->where(function ($q) use ($search) {
                $q->where('cliente.name', 'like', $search)
                    ->orWhere('cursos.titulo', 'like', $search);
            });
        }

        if (!empty($filters['id_curso'])) {
            $query->where('matriculas.id_curso', (int) $filters['id_curso']);
        }

        $rows = [];
        foreach ($query->orderBy('matriculas.id')->cursor() as $m) {
            $calc = ContratoValidadeService::validade($m->config ?? []);
            if ($calc['date'] === null || !ContratoValidadeService::isVencido($calc['date'])) {
                continue;
            }
            $rows[] = [
                'matricula_id' => (int) $m->id,
                'cliente_id' => $m->id_cliente,
                'aluno' => (string) ($m->aluno ?? ''),
                'curso' => (string) ($m->curso ?? '—'),
                'validade' => $calc['date'],
                'validade_br' => implode('/', array_reverse(explode('-', $calc['date']))),
                'origem' => $calc['origem'],
                'dias_vencido' => ContratoValidadeService::diasVencido($calc['date']),
                'telefone' => (string) ($m->telefone ?? ''),
            ];
        }

        usort($rows, fn ($a, $b) => strcmp($a['validade'], $b['validade']) ?: ($a['matricula_id'] <=> $b['matricula_id']));

        return $rows;
    }

    /**
     * Monta a linha de uma matrícula (reuso em setValidade/whatsapp).
     */
    private function buildRow(Matricula $matricula, ?string $overrideValidDate): array
    {
        $cliente = User::find($matricula->id_cliente);
        $cursoTitulo = DB::table('cursos')->where('id', $matricula->id_curso)->value('titulo');
        $calc = ContratoValidadeService::validade($matricula->config ?? []);
        $date = $overrideValidDate ?? $calc['date'];
        return [
            'matricula_id' => (int) $matricula->id,
            'cliente_id' => $matricula->id_cliente,
            'aluno' => (string) ($cliente->name ?? ''),
            'curso' => (string) ($cursoTitulo ?? '—'),
            'validade' => $date,
            'validade_br' => $date ? implode('/', array_reverse(explode('-', $date))) : null,
            'origem' => $overrideValidDate ? ContratoValidadeService::ORIGIN_EXPLICIT : $calc['origem'],
            'dias_vencido' => $date ? ContratoValidadeService::diasVencido($date) : 0,
            'telefone' => (string) ($cliente->celular ?? ''),
        ];
    }
}
