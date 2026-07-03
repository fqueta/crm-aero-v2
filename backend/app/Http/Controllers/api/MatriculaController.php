<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\Stage;
use App\Models\Curso;
use App\Models\Category;
use App\Models\FinancialAccount;
use App\Models\FinancialAccountPayment;
use App\Models\Matricula;
use App\Models\Parcelamento;
use App\Models\Turma;
use App\Models\User;
use App\Models\ClientAttendance;
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
use Carbon\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

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
            ->leftJoin('turmas', 'matriculas.id_turma', '=', 'turmas.id')
            ->leftJoin('users', 'matriculas.id_cliente', '=', 'users.id')
            ->leftJoin('posts', 'matriculas.situacao_id', '=', 'posts.ID')
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

        // Filtro por Período (para Cursos do tipo 4 - Planos de Formação)
        if ($request->filled('periodo_id')) {
            $periodoId = $request->input('periodo_id');
            $query->whereRaw("JSON_UNQUOTE(JSON_EXTRACT(matriculas.orc, '$.modulos[0].id')) = ?", [(string) $periodoId]);
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
            
            // Resolve o nome do período para cursos tipo 4 legados que não possuem o nome no JSON 'orc'
            if ($item->curso_tipo == '4') {
                $orc = is_string($item->orc) ? json_decode($item->orc, true) : (array)$item->orc;
                if (empty($orc['modulos'][0]['nome']) && empty($orc['modulos'][0]['titulo'])) {
                    $periodoId = $orc['modulos'][0]['id'] ?? $item->meta['gera_valor'] ?? null;
                    if ($periodoId) {
                        $periodo = \App\Models\Post::find($periodoId);
                        if ($periodo) {
                            $item->periodo_nome = $periodo->post_title;
                        }
                    }
                }
            }
            
            return $item;
        });

        return response()->json($items);
    }

    /**
     * Retorna um relatório geral com conversão mensal e tempo até ganho.
     */
    public function generalConversionReport(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        // if (!$this->permissionService->isHasPermission('view')) {
        //     return response()->json(['error' => 'Acesso negado'], 403);
        // }

        $validator = Validator::make($request->all(), [
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'consultant_id' => 'nullable|uuid',
            'funnel_id' => 'nullable',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Dados de validação inválidos',
                'errors' => $validator->errors(),
                'status' => 422,
            ], 422);
        }

        $validated = $validator->validated();
        $consultantId = !empty($validated['consultant_id']) ? (string) $validated['consultant_id'] : null;
        $funnelId = !empty($validated['funnel_id']) ? (string) $validated['funnel_id'] : null;
        $startDate = !empty($validated['start_date'])
            ? Carbon::parse($validated['start_date'])->startOfDay()
            : now()->copy()->subMonths(5)->startOfMonth();
        $endDate = !empty($validated['end_date'])
            ? Carbon::parse($validated['end_date'])->endOfDay()
            : now()->copy()->endOfDay();

        $leadCount = $this->getLeadCountForPeriod($startDate, $endDate, $consultantId, $funnelId);
        $monthlyLeadCounts = $this->getLeadCountsByMonth($startDate, $endDate, $consultantId, $funnelId);
        $conversions = $this->getConversionsForPeriod($startDate, $endDate, $consultantId, $funnelId);

        $periodSummary = $this->buildGeneralConversionSummary($leadCount, $conversions);
        $monthlyConversion = $this->buildMonthlyConversionSeries($startDate, $endDate, $monthlyLeadCounts, $conversions);
        $conversionTimeBuckets = $this->buildConversionTimeBuckets($conversions);

        $currentMonthStart = now()->copy()->startOfMonth();
        $currentMonthEnd = now()->copy()->endOfMonth();
        $currentMonthLeadCount = $this->getLeadCountForPeriod($currentMonthStart, $currentMonthEnd, $consultantId, $funnelId);
        $currentMonthConversions = $this->getConversionsForPeriod($currentMonthStart, $currentMonthEnd, $consultantId, $funnelId);
        $currentMonthSummary = $this->buildGeneralConversionSummary($currentMonthLeadCount, $currentMonthConversions);
        $consultantBreakdown = $this->buildConsultantBreakdown($conversions, $startDate, $endDate, $consultantId, $funnelId);

        $recentConversions = $conversions
            ->sortByDesc('gain_date')
            ->take(10)
            ->values()
            ->map(function ($item) {
                return [
                    'leadId' => (string) $item->lead_id,
                    'leadName' => $item->lead_name,
                    'matriculaId' => (string) $item->matricula_id,
                    'consultantName' => $item->consultant_name,
                    'leadCreatedAt' => $item->lead_created_date,
                    'gainDate' => $item->gain_date,
                    'conversionDays' => (int) $item->conversion_days,
                    'negotiatedAmount' => round((float) ($item->negotiated_amount ?? 0), 2),
                ];
            });

        return response()->json([
            'filters' => [
                'startDate' => $startDate->toDateString(),
                'endDate' => $endDate->toDateString(),
                'consultantId' => $consultantId,
                'funnelId' => $funnelId,
            ],
            'currentMonth' => [
                'label' => now()->format('m/Y'),
                'summary' => $currentMonthSummary,
            ],
            'periodSummary' => $periodSummary,
            'monthlyConversion' => $monthlyConversion,
            'conversionTimeBuckets' => $conversionTimeBuckets,
            'consultantBreakdown' => $consultantBreakdown,
            'recentConversions' => $recentConversions,
        ]);
    }

    /**
     * Retorna a lista detalhada que compõe os cards do relatório geral.
     */
    public function generalConversionReportDetails(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $validator = Validator::make($request->all(), [
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'consultant_id' => 'nullable|uuid',
            'funnel_id' => 'nullable',
            'type' => 'required|in:leads,unique_converted_leads,won_proposals',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Dados de validação inválidos',
                'errors' => $validator->errors(),
                'status' => 422,
            ], 422);
        }

        $validated = $validator->validated();
        $consultantId = !empty($validated['consultant_id']) ? (string) $validated['consultant_id'] : null;
        $funnelId = !empty($validated['funnel_id']) ? (string) $validated['funnel_id'] : null;
        $type = (string) $validated['type'];
        $startDate = !empty($validated['start_date'])
            ? Carbon::parse($validated['start_date'])->startOfDay()
            : now()->copy()->subMonths(5)->startOfMonth();
        $endDate = !empty($validated['end_date'])
            ? Carbon::parse($validated['end_date'])->endOfDay()
            : now()->copy()->endOfDay();

        if ($type === 'leads') {
            $items = $this->getLeadDetailsForPeriod($startDate, $endDate, $consultantId, $funnelId);

            return response()->json([
                'type' => $type,
                'title' => 'Leads no período',
                'total' => count($items),
                'items' => $items,
            ]);
        }

        $conversions = $this->getConversionsForPeriod($startDate, $endDate, $consultantId, $funnelId);

        if ($type === 'unique_converted_leads') {
            $items = $this->getUniqueConvertedLeadDetails($conversions);

            return response()->json([
                'type' => $type,
                'title' => 'Leads únicos convertidos',
                'total' => count($items),
                'items' => $items,
            ]);
        }

        $items = $this->getWonProposalDetails($conversions);

        return response()->json([
            'type' => $type,
            'title' => 'Propostas ganhas',
            'total' => count($items),
            'items' => $items,
        ]);
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
     * Retorna a query base de leads ativos do CRM.
     */
    private function buildLeadReportBaseQuery(?string $consultantId = null, ?string $funnelId = null)
    {
        $query = DB::table('users')
            ->where(function ($query) {
                $query->where('users.deletado', 'n')->orWhereNull('users.deletado');
            })
            ->where(function ($query) {
                $query->where('users.excluido', 'n')->orWhereNull('users.excluido');
            })
            ->where(function ($query) {
                $query->whereExists(function ($subQuery) {
                    $subQuery->select(DB::raw(1))
                        ->from('matriculas')
                        ->whereColumn('matriculas.id_cliente', 'users.id');
                })
                ->orWhereRaw("JSON_EXTRACT(users.config, '$.stage_id') IS NOT NULL")
                ->orWhereRaw("JSON_EXTRACT(users.preferencias, '$.pipeline.stage_id') IS NOT NULL");
            });

        if ($consultantId || $funnelId) {
            $query->whereExists(function ($subQuery) use ($consultantId, $funnelId) {
                $subQuery->select(DB::raw(1))
                    ->from('matriculas')
                    ->whereColumn('matriculas.id_cliente', 'users.id');

                if ($consultantId) {
                    $subQuery->where('matriculas.id_consultor', $consultantId);
                }

                if ($funnelId) {
                    $subQuery->where('matriculas.funnel_id', $funnelId);
                }
            });
        }

        return $query;
    }

    /**
     * Retorna a query base de conversões (propostas ganhas) com data de ganho resolvida.
     */
    private function buildConvertedLeadReportBaseQuery(?string $consultantId = null, ?string $funnelId = null)
    {
        $gainMetaSubquery = DB::table('matriculameta')
            ->select('matricula_id', DB::raw('MAX(meta_value) as gain_date'))
            ->where('meta_key', 'data_ganho')
            ->groupBy('matricula_id');

        $financialGainSubquery = DB::table('financial_accounts')
            ->selectRaw("CAST(JSON_UNQUOTE(JSON_EXTRACT(config, '$.matricula_id')) AS UNSIGNED) as matricula_id")
            ->selectRaw("MAX(JSON_UNQUOTE(JSON_EXTRACT(config, '$.gain_date'))) as gain_date")
            ->where('type', 'receivable')
            ->where('config->source', 'proposal_gain')
            ->groupBy(DB::raw("CAST(JSON_UNQUOTE(JSON_EXTRACT(config, '$.matricula_id')) AS UNSIGNED)"));

        $query = DB::table('matriculas')
            ->join('users', 'users.id', '=', 'matriculas.id_cliente')
            ->leftJoin('users as consultants', 'consultants.id', '=', 'matriculas.id_consultor')
            ->leftJoinSub($gainMetaSubquery, 'gain_meta', function ($join) {
                $join->on('gain_meta.matricula_id', '=', 'matriculas.id');
            })
            ->leftJoinSub($financialGainSubquery, 'financial_gain', function ($join) {
                $join->on('financial_gain.matricula_id', '=', 'matriculas.id');
            })
            ->where('matriculas.status', 'g')
            ->where(function ($query) {
                $query->where('users.deletado', 'n')->orWhereNull('users.deletado');
            })
            ->where(function ($query) {
                $query->where('users.excluido', 'n')->orWhereNull('users.excluido');
            })
            ->where(function ($query) {
                $query->where('matriculas.deletado', 'n')->orWhereNull('matriculas.deletado');
            })
            ->where(function ($query) {
                $query->where('matriculas.excluido', 'n')->orWhereNull('matriculas.excluido');
            })
            ->whereRaw("COALESCE(gain_meta.gain_date, financial_gain.gain_date) IS NOT NULL")
            ->whereRaw("STR_TO_DATE(COALESCE(gain_meta.gain_date, financial_gain.gain_date), '%Y-%m-%d') >= DATE(users.created_at)");

        if ($consultantId) {
            $query->where('matriculas.id_consultor', $consultantId);
        }

        if ($funnelId) {
            $query->where('matriculas.funnel_id', $funnelId);
        }

        return $query;
    }

    /**
     * Conta leads criados dentro do período informado.
     */
    private function getLeadCountForPeriod(Carbon $startDate, Carbon $endDate, ?string $consultantId = null, ?string $funnelId = null): int
    {
        return (int) $this->buildLeadReportBaseQuery($consultantId, $funnelId)
            ->whereBetween('users.created_at', [$startDate, $endDate])
            ->count();
    }

    /**
     * Retorna a quantidade de leads por mês dentro do período.
     */
    private function getLeadCountsByMonth(Carbon $startDate, Carbon $endDate, ?string $consultantId = null, ?string $funnelId = null): array
    {
        return $this->buildLeadReportBaseQuery($consultantId, $funnelId)
            ->whereBetween('users.created_at', [$startDate, $endDate])
            ->selectRaw("DATE_FORMAT(users.created_at, '%Y-%m') as month_key, COUNT(*) as total")
            ->groupBy('month_key')
            ->pluck('total', 'month_key')
            ->map(fn ($total) => (int) $total)
            ->all();
    }

    /**
     * Lista conversões concluídas no período com seus dias de conversão.
     */
    private function getConversionsForPeriod(Carbon $startDate, Carbon $endDate, ?string $consultantId = null, ?string $funnelId = null)
    {
        return $this->buildConvertedLeadReportBaseQuery($consultantId, $funnelId)
            ->whereRaw(
                "STR_TO_DATE(COALESCE(gain_meta.gain_date, financial_gain.gain_date), '%Y-%m-%d') BETWEEN ? AND ?",
                [$startDate->toDateString(), $endDate->toDateString()]
            )
            ->selectRaw('matriculas.id as matricula_id')
            ->selectRaw('users.id as lead_id')
            ->selectRaw('users.name as lead_name')
            ->selectRaw('matriculas.id_consultor as consultant_id')
            ->selectRaw('consultants.name as consultant_name')
            ->selectRaw('DATE(users.created_at) as lead_created_date')
            ->selectRaw("COALESCE(gain_meta.gain_date, financial_gain.gain_date) as gain_date")
            ->selectRaw('matriculas.total as negotiated_amount')
            ->selectRaw("GREATEST(0, TIMESTAMPDIFF(DAY, DATE(users.created_at), STR_TO_DATE(COALESCE(gain_meta.gain_date, financial_gain.gain_date), '%Y-%m-%d'))) as conversion_days")
            ->orderByRaw("STR_TO_DATE(COALESCE(gain_meta.gain_date, financial_gain.gain_date), '%Y-%m-%d') desc")
            ->get();
    }

    /**
     * Lista os leads captados no período filtrado.
     */
    private function getLeadDetailsForPeriod(Carbon $startDate, Carbon $endDate, ?string $consultantId = null, ?string $funnelId = null): array
    {
        return $this->buildLeadReportBaseQuery($consultantId, $funnelId)
            ->whereBetween('users.created_at', [$startDate, $endDate])
            ->selectRaw('users.id as lead_id')
            ->selectRaw('users.name as lead_name')
            ->selectRaw('DATE(users.created_at) as lead_created_at')
            ->orderBy('users.created_at', 'desc')
            ->get()
            ->map(function ($item) {
                return [
                    'leadId' => (string) $item->lead_id,
                    'leadName' => (string) $item->lead_name,
                    'leadCreatedAt' => (string) $item->lead_created_at,
                ];
            })
            ->values()
            ->all();
    }

    /**
     * Lista os leads únicos convertidos com seus principais dados de conversão.
     */
    private function getUniqueConvertedLeadDetails($conversions): array
    {
        $grouped = $conversions->groupBy('lead_id');
        $uniqueLeadConversions = $this->getUniqueLeadConversions($conversions)->keyBy('lead_id');

        return $uniqueLeadConversions
            ->map(function ($item, $leadId) use ($grouped) {
                $leadConversions = $grouped->get($leadId, collect());

                return [
                    'leadId' => (string) $item->lead_id,
                    'leadName' => (string) $item->lead_name,
                    'leadCreatedAt' => (string) $item->lead_created_date,
                    'gainDate' => (string) $item->gain_date,
                    'conversionDays' => (int) $item->conversion_days,
                    'consultantName' => $item->consultant_name ? (string) $item->consultant_name : null,
                    'proposalsWonCount' => (int) $leadConversions->count(),
                ];
            })
            ->sortByDesc('gainDate')
            ->values()
            ->all();
    }

    /**
     * Lista todas as propostas ganhas do período filtrado.
     */
    private function getWonProposalDetails($conversions): array
    {
        return $conversions
            ->sortByDesc('gain_date')
            ->values()
            ->map(function ($item) {
                return [
                    'leadId' => (string) $item->lead_id,
                    'leadName' => (string) $item->lead_name,
                    'matriculaId' => (string) $item->matricula_id,
                    'leadCreatedAt' => (string) $item->lead_created_date,
                    'gainDate' => (string) $item->gain_date,
                    'conversionDays' => (int) $item->conversion_days,
                    'consultantName' => $item->consultant_name ? (string) $item->consultant_name : null,
                    'negotiatedAmount' => round((float) ($item->negotiated_amount ?? 0), 2),
                ];
            })
            ->all();
    }

    /**
     * Consolida o desempenho por consultor no período.
     */
    private function buildConsultantBreakdown($conversions, Carbon $startDate, Carbon $endDate, ?string $consultantId = null, ?string $funnelId = null): array
    {
        $groupedByConsultant = $conversions->groupBy(function ($item) {
            return $item->consultant_name ?: 'Sem consultor';
        });

        return $groupedByConsultant
            ->map(function ($items, $consultantName) use ($startDate, $endDate, $consultantId, $funnelId) {
                $firstItem = $items->first();
                $currentConsultantId = $firstItem->consultant_id ?? null;
                $leadCount = $this->getLeadCountForPeriod(
                    $startDate,
                    $endDate,
                    $currentConsultantId ? (string) $currentConsultantId : $consultantId,
                    $funnelId
                );
                $uniqueLeadConversions = $this->getUniqueLeadConversions($items);

                return [
                    'consultantId' => $currentConsultantId ? (string) $currentConsultantId : null,
                    'consultantName' => (string) $consultantName,
                    'leadsCount' => $leadCount,
                    'uniqueConvertedLeadsCount' => (int) $uniqueLeadConversions->count(),
                    'proposalsWonCount' => (int) $items->count(),
                    'conversionRate' => $leadCount > 0
                        ? round(($uniqueLeadConversions->count() / $leadCount) * 100, 2)
                        : 0,
                    'averageConversionDays' => $uniqueLeadConversions->count() > 0
                        ? round((float) $uniqueLeadConversions->avg(fn ($item) => (int) $item->conversion_days), 1)
                        : 0,
                ];
            })
            ->sortByDesc('uniqueConvertedLeadsCount')
            ->values()
            ->all();
    }

    /**
     * Consolida os indicadores principais de um período.
     */
    private function buildGeneralConversionSummary(int $leadCount, $conversions): array
    {
        $proposalWinsCount = (int) $conversions->count();
        $uniqueLeadConversions = $this->getUniqueLeadConversions($conversions);
        $uniqueConvertedLeadsCount = (int) $uniqueLeadConversions->count();
        $days = $uniqueLeadConversions
            ->pluck('conversion_days')
            ->map(fn ($value) => (int) $value)
            ->sort()
            ->values();

        $averageDays = $days->count() > 0 ? round((float) $days->avg(), 1) : 0;
        $medianDays = 0;

        if ($days->count() > 0) {
            $middle = intdiv($days->count(), 2);
            $medianDays = $days->count() % 2 === 0
                ? round((((int) $days[$middle - 1]) + ((int) $days[$middle])) / 2, 1)
                : (int) $days[$middle];
        }

        return [
            'leadsCount' => $leadCount,
            'conversionsCount' => $proposalWinsCount,
            'proposalsWonCount' => $proposalWinsCount,
            'uniqueConvertedLeadsCount' => $uniqueConvertedLeadsCount,
            'conversionRate' => $leadCount > 0 ? round(($uniqueConvertedLeadsCount / $leadCount) * 100, 2) : 0,
            'proposalWinRate' => $leadCount > 0 ? round(($proposalWinsCount / $leadCount) * 100, 2) : 0,
            'averageConversionDays' => $averageDays,
            'medianConversionDays' => $medianDays,
            'fastestConversionDays' => $days->count() > 0 ? (int) $days->first() : null,
            'slowestConversionDays' => $days->count() > 0 ? (int) $days->last() : null,
        ];
    }

    /**
     * Monta a série mensal de leads e conversões.
     */
    private function buildMonthlyConversionSeries(Carbon $startDate, Carbon $endDate, array $leadCountsByMonth, $conversions): array
    {
        $conversionGroups = $conversions->groupBy(function ($item) {
            return substr((string) $item->gain_date, 0, 7);
        });

        $series = [];
        $cursor = $startDate->copy()->startOfMonth();
        $endMonth = $endDate->copy()->startOfMonth();

        while ($cursor->lte($endMonth)) {
            $monthKey = $cursor->format('Y-m');
            $monthConversions = $conversionGroups->get($monthKey, collect());
            $uniqueMonthConversions = $this->getUniqueLeadConversions($monthConversions);
            $leads = (int) ($leadCountsByMonth[$monthKey] ?? 0);
            $proposalWinsCount = (int) $monthConversions->count();
            $uniqueConvertedLeadsCount = (int) $uniqueMonthConversions->count();
            $averageDays = $uniqueConvertedLeadsCount > 0
                ? round((float) $uniqueMonthConversions->avg(fn ($item) => (int) $item->conversion_days), 1)
                : 0;

            $series[] = [
                'month' => $monthKey,
                'label' => $cursor->format('m/Y'),
                'leads' => $leads,
                'conversions' => $proposalWinsCount,
                'proposalsWon' => $proposalWinsCount,
                'uniqueConvertedLeads' => $uniqueConvertedLeadsCount,
                'conversionRate' => $leads > 0 ? round(($uniqueConvertedLeadsCount / $leads) * 100, 2) : 0,
                'proposalWinRate' => $leads > 0 ? round(($proposalWinsCount / $leads) * 100, 2) : 0,
                'averageConversionDays' => $averageDays,
            ];

            $cursor->addMonth();
        }

        return $series;
    }

    /**
     * Agrupa as conversões em faixas de dias.
     */
    private function buildConversionTimeBuckets($conversions): array
    {
        $uniqueLeadConversions = $this->getUniqueLeadConversions($conversions);
        $buckets = [
            '0-7 dias' => ['min' => 0, 'max' => 7, 'count' => 0],
            '8-15 dias' => ['min' => 8, 'max' => 15, 'count' => 0],
            '16-30 dias' => ['min' => 16, 'max' => 30, 'count' => 0],
            '31-60 dias' => ['min' => 31, 'max' => 60, 'count' => 0],
            '61-90 dias' => ['min' => 61, 'max' => 90, 'count' => 0],
            '90+ dias' => ['min' => 91, 'max' => null, 'count' => 0],
        ];

        foreach ($uniqueLeadConversions as $conversion) {
            $days = (int) $conversion->conversion_days;

            foreach ($buckets as $label => $bucket) {
                $max = $bucket['max'];
                if ($days >= $bucket['min'] && ($max === null || $days <= $max)) {
                    $buckets[$label]['count']++;
                    break;
                }
            }
        }

        return collect($buckets)->map(function ($bucket, $label) {
            return [
                'bucket' => $label,
                'count' => (int) $bucket['count'],
            ];
        })->values()->all();
    }

    /**
     * Deduplica conversões por lead preservando a primeira conversão do período.
     */
    private function getUniqueLeadConversions($conversions)
    {
        return $conversions
            ->groupBy('lead_id')
            ->map(function ($items) {
                return $items
                    ->sortBy(function ($item) {
                        return sprintf(
                            '%s-%05d-%010d',
                            (string) ($item->gain_date ?? ''),
                            (int) ($item->conversion_days ?? 0),
                            (int) ($item->matricula_id ?? 0)
                        );
                    })
                    ->first();
            })
            ->filter()
            ->values();
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
            if ($metaKey === null || $metaKey === '' || $metaValue === null) {
                continue;
            }

            if (is_bool($metaValue)) {
                Qlib::update_matriculameta($matriculaId, $metaKey, $metaValue ? '1' : '0');
                continue;
            }

            if (is_array($metaValue)) {
                Qlib::update_matriculameta($matriculaId, $metaKey, json_encode($metaValue, JSON_UNESCAPED_UNICODE));
                continue;
            }

            if ($metaValue !== '') {
                Qlib::update_matriculameta($matriculaId, $metaKey, (string) $metaValue);
            }
        }
    }

    /**
     * extractPublicAdministrationMeta
     * PT-BR: Extrai apenas os campos operacionais enviados no formulário público,
     *        preservando valores falsos explícitos sem sobrescrever campos ausentes.
     * EN: Extracts only operational fields sent by the public form, preserving
     *      explicit false values without overwriting absent fields.
     */
    private function extractPublicAdministrationMeta(Request $request): array
    {
        $booleanFields = [
            'foi_transferido',
            'cma_em_dia',
            'possui_banca',
            'aluno_ciente_taxa_manutencao_alojamento',
            'aluno_ciente_hora_seca',
            'aluno_ciente_headset',
            'aluno_ciente_prazo_estimado',
            'aluno_ciente_limite_c150',
            'aluno_ciente_documentacao_ground_school',
            'aluno_ciente_uniforme',
        ];

        $stringFields = [
            'classe_cma',
        ];

        $meta = [];

        foreach ($booleanFields as $field) {
            if ($request->exists($field)) {
                $meta[$field] = $request->boolean($field);
            }
        }

        foreach ($stringFields as $field) {
            if ($request->exists($field)) {
                $meta[$field] = $request->input($field);
            }
        }

        return $meta;
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
     * getPublicProposalExpirationContext
     * pt-BR: Calcula a data final de validade da proposta pública e informa se ela já expirou.
     * en-US: Computes the public proposal expiry date and tells whether it has already expired.
     */
    private function getPublicProposalExpirationContext(Matricula $matricula): array
    {
        $meta = $this->getAllMatriculaMeta($matricula->id);
        $validityDays = (int) ($meta['validade'] ?? 14);
        $baseDateRaw = $matricula->{Matricula::CREATED_AT} ?? null;
        $timezone = env('APP_TIMEZONE', config('app.timezone', 'America/Sao_Paulo'));

        if (!$baseDateRaw || $validityDays <= 0) {
            return [
                'is_expired' => false,
                'validity_days' => $validityDays > 0 ? $validityDays : 14,
                'valid_until' => null,
                'expiration_message' => null,
            ];
        }

        try {
            $validUntil = Carbon::parse($baseDateRaw)
                ->setTimezone($timezone)
                ->startOfDay()
                ->addDays($validityDays)
                ->endOfDay();
        } catch (\Throwable $exception) {
            return [
                'is_expired' => false,
                'validity_days' => $validityDays,
                'valid_until' => null,
                'expiration_message' => null,
            ];
        }

        $validUntilFormatted = $validUntil->format('d/m/Y');
        $isExpired = now($timezone)->greaterThan($validUntil);

        return [
            'is_expired' => $isExpired,
            'validity_days' => $validityDays,
            'valid_until' => $validUntilFormatted,
            'expiration_message' => $isExpired
                ? 'A validade desta proposta expirou em ' . $validUntilFormatted . '. Solicite uma nova proposta para continuar.'
                : null,
        ];
    }

    /**
     * proposalExpiredResponse
     * pt-BR: Retorna uma resposta padronizada quando a proposta pública está vencida.
     * en-US: Returns a standardized response when the public proposal has expired.
     */
    private function proposalExpiredResponse(array $expirationContext)
    {
        return response()->json([
            'error' => $expirationContext['expiration_message'] ?? 'A validade desta proposta expirou. Solicite uma nova proposta para continuar.',
            'message' => $expirationContext['expiration_message'] ?? 'A validade desta proposta expirou. Solicite uma nova proposta para continuar.',
            'code' => 'proposal_expired',
            'is_expired' => true,
            'valid_until' => $expirationContext['valid_until'] ?? null,
        ], 422);
    }

    /**
     * findFinancialIncomeCategoryId
     * pt-BR: Busca uma categoria financeira de receita para usar em lancamentos automaticos.
     * en-US: Finds an income financial category to use in automated postings.
     */
    private function findFinancialIncomeCategoryId(): ?int
    {
        $category = Category::query()
            ->where('entidade', 'financeiro')
            ->where('config->type', 'income')
            ->orderBy('id')
            ->first();

        return $category?->id ? (int) $category->id : null;
    }

    /**
     * syncFinancialGainReceivable
     * pt-BR: Cria ou atualiza a conta principal do ganho e registra a entrada inicial como pagamento parcial.
     * en-US: Creates or updates the main receivable account for a won proposal and records the initial payment entry.
     */
    private function syncFinancialGainReceivable(
        Matricula $matricula,
        ?string $gainDate,
        ?string $negotiatedAmount,
        ?string $initialPaidAmount,
        ?string $gainObservation
    ): ?FinancialAccount
    {
        $amount = (float) ($negotiatedAmount ?? 0);
        if ($amount <= 0 || empty($gainDate)) {
            return null;
        }

        $financialAccountId = Qlib::get_matriculameta($matricula->id, 'financial_gain_account_id');
        $financialAccount = null;

        if ($financialAccountId && is_numeric($financialAccountId)) {
            $financialAccount = FinancialAccount::find((int) $financialAccountId);
        }

        if (!$financialAccount) {
            $financialAccount = FinancialAccount::query()
                ->where('type', 'receivable')
                ->where('config->source', 'proposal_gain')
                ->where('config->matricula_id', (int) $matricula->id)
                ->first();
        }

        $description = 'Crediario da proposta ganha #' . $matricula->id;
        if (!empty($matricula->cliente?->name)) {
            $description .= ' - ' . $matricula->cliente->name;
        }

        $notesParts = array_filter([
            'Lançamento automático gerado ao marcar a proposta como ganho.',
            $gainObservation ?: null,
        ]);

        $payload = [
            'amount' => $amount,
            'type' => 'receivable',
            'customer_name' => $matricula->cliente?->name,
            'client_id' => $matricula->id_cliente,
            'description' => $description,
            'notes' => implode("\n\n", $notesParts),
            'category_id' => $this->findFinancialIncomeCategoryId(),
            'due_date' => $gainDate,
            'payment_method' => 'other',
            'status' => 'pending',
            'payment_date' => null,
            'paid_amount' => 0,
            'installments' => 1,
            'contract_number' => $this->numero_contrato($matricula->id) ?: null,
            'token' => $financialAccount?->token ?: Qlib::token(),
            'excluido' => false,
            'deletado' => false,
            'config' => [
                'source' => 'proposal_gain',
                'matricula_id' => (int) $matricula->id,
                'matricula_status' => 'g',
                'gain_date' => $gainDate,
                'negotiated_amount' => $amount,
                'gain_observation' => $gainObservation,
            ],
        ];

        if ($financialAccount) {
            $financialAccount->fill($payload);
            $financialAccount->save();
        } else {
            $financialAccount = FinancialAccount::create($payload);
        }

        $entryAmount = max(0, (float) ($initialPaidAmount ?? 0));
        $financialAccount->load('payments');
        $initialPayment = $financialAccount->payments->first(function (FinancialAccountPayment $payment) {
            return ($payment->config['source'] ?? null) === 'proposal_gain_initial';
        });

        if ($entryAmount > 0) {
            $paymentPayload = [
                'amount' => min($entryAmount, $amount),
                'payment_date' => $gainDate,
                'payment_method' => 'other',
                'notes' => $gainObservation,
                'created_by' => (string) optional(request()->user())->id,
                'token' => $initialPayment?->token ?: Qlib::token(),
                'config' => [
                    'source' => 'proposal_gain_initial',
                    'matricula_id' => (int) $matricula->id,
                ],
            ];

            if ($initialPayment) {
                $initialPayment->fill($paymentPayload);
                $initialPayment->save();
            } else {
                $financialAccount->payments()->create($paymentPayload);
            }
        } elseif ($initialPayment) {
            $initialPayment->delete();
        }

        $financialAccount->unsetRelation('payments');
        $financialAccount->load('payments');

        $totalPaid = round((float) $financialAccount->payments->sum(fn (FinancialAccountPayment $payment) => (float) $payment->amount), 2);
        $latestPayment = $financialAccount->payments->sortByDesc(function (FinancialAccountPayment $payment) {
            return ($payment->payment_date?->format('Y-m-d') ?? '') . '-' . $payment->id;
        })->first();
        $remainingAmount = max(0, $amount - $totalPaid);

        $financialAccount->paid_amount = $totalPaid;
        $financialAccount->payment_date = $latestPayment?->payment_date;
        $financialAccount->payment_method = $latestPayment?->payment_method ?? 'other';
        $financialAccount->status = $totalPaid <= 0 ? 'pending' : ($remainingAmount <= 0 ? 'paid' : 'partial');
        $financialAccount->save();

        Qlib::update_matriculameta($matricula->id, 'financial_gain_account_id', (string) $financialAccount->id);
        $this->syncMatriculaFinancialGainMeta($matricula->id, $gainDate, $gainObservation, $financialAccount->fresh('payments'));

        return $financialAccount->fresh('payments');
    }

    /**
     * syncMatriculaFinancialGainMeta
     * pt-BR: Atualiza os metadados da matricula com o resumo financeiro do ganho.
     * en-US: Updates enrollment meta with the financial summary of the won proposal.
     */
    private function syncMatriculaFinancialGainMeta(int|string $matriculaId, ?string $gainDate, ?string $gainObservation, FinancialAccount $financialAccount): void
    {
        $paymentsPayload = $financialAccount->payments->map(function (FinancialAccountPayment $payment) {
            return [
                'id' => $payment->id,
                'amount' => (float) $payment->amount,
                'payment_date' => optional($payment->payment_date)->format('Y-m-d'),
                'payment_method' => $payment->payment_method,
                'notes' => $payment->notes,
            ];
        })->values()->all();

        $firstPaymentAmount = count($paymentsPayload) > 0 ? (string) ($paymentsPayload[0]['amount'] ?? 0) : '0';

        $this->persistMatriculaMeta($matriculaId, [
            'data_ganho' => $gainDate,
            'financial_gain_account_id' => (string) $financialAccount->id,
            'valor_negociado_ganho' => (string) $financialAccount->amount,
            'valor_entrada_ganho' => $firstPaymentAmount,
            'valor_pago' => (string) ($financialAccount->paid_amount ?? 0),
            'valor_recebido_ganho' => (string) ($financialAccount->paid_amount ?? 0),
            'saldo_ganho' => (string) $financialAccount->getRemainingAmountAttribute(),
            'financeiro_status_ganho' => (string) $financialAccount->status,
            'observacao_ganho' => $gainObservation,
            'pagamentos_ganho' => json_encode($paymentsPayload),
        ]);
    }

    /**
     * Reconciles proposal gain financial meta with the real receivable account before returning enrollment data.
     */
    private function reconcileFinancialGainMeta(Matricula $matricula, array $meta): array
    {
        $financialAccountId = $meta['financial_gain_account_id'] ?? null;
        $financialAccount = null;

        if ($financialAccountId && is_numeric($financialAccountId)) {
            $financialAccount = FinancialAccount::with('payments')->find((int) $financialAccountId);
        }

        if (!$financialAccount) {
            $financialAccount = FinancialAccount::with('payments')
                ->where('type', 'receivable')
                ->where('config->source', 'proposal_gain')
                ->where('config->matricula_id', (int) $matricula->id)
                ->first();
        }

        if (!$financialAccount) {
            return $meta;
        }

        $gainDate = isset($meta['data_ganho']) ? (string) $meta['data_ganho'] : ($financialAccount->config['gain_date'] ?? null);
        $gainObservation = isset($meta['observacao_ganho']) ? (string) $meta['observacao_ganho'] : ($financialAccount->config['gain_observation'] ?? null);

        $this->syncMatriculaFinancialGainMeta($matricula->id, $gainDate, $gainObservation, $financialAccount);

        return $this->getAllMatriculaMeta($matricula->id);
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
            'id_turma' => ['nullable', 'integer', 'exists:turmas,id'],
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
            'inscricao' => ['nullable', 'numeric'],
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
        // Normalizar valores monetários
        foreach (['desconto','combustivel','subtotal','total', 'inscricao'] as $k) {
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

        // Normalizar id_turma: '0' ou vazio -> null
        if (array_key_exists('id_turma', $data)) {
            $vt = trim((string)$data['id_turma']);
            if ($vt === '' || $vt === '0') {
                $data['id_turma'] = null;
            }
        }

        // Garantir string aparada para id_cliente
        if (array_key_exists('id_cliente', $data)) {
            $data['id_cliente'] = trim((string)$data['id_cliente']);
        }

        // Mapear tag[] para tags (root field agora)
        if (array_key_exists('tag[]', $data)) {
            $tags = $data['tag[]'];
            $data['tags'] = is_array($tags) ? $tags : [$tags];
            unset($data['tag[]']);
        }

        // Nota: campos como 'inscricao', 'consultor', 'token' e 'tags' permanecem no root
        // de $data para que o model Matricula os processe via setters customizados.
        // Isso evita sobrescrever todo o campo JSON 'config' no banco.

        return $data;
    }

    /**
     * Garante pipeline inicial no cadastro do cliente quando a proposta for criada
     * e o cliente ainda não tiver `funnelId` definido.
     * EN: Ensure initial client pipeline when creating a proposal and the client
     * still has no `funnelId` set.
     */
    private function ensureClientDefaultPipelineForProposal(string $clientId, string $actorId, string $ip): void
    {
        $client = User::find($clientId);
        if (!$client) {
            return;
        }

        $config = is_array($client->config)
            ? $client->config
            : (is_string($client->config) ? (json_decode($client->config, true) ?? []) : []);

        $currentFunnelId = $config['funnelId'] ?? null;
        $hasFunnelId = !is_null($currentFunnelId) && trim((string) $currentFunnelId) !== '';

        if ($hasFunnelId) {
            return;
        }

        $this->applyUserStage(
            $client,
            1,
            $actorId,
            $ip,
            'Etapa inicial do cliente definida automaticamente na criação da proposta'
        );
    }

    /**
     * Cria um atendimento automático para registrar a abertura da proposta do cliente.
     * EN: Creates an automatic attendance entry to register proposal creation for the client.
     */
    private function createProposalClientAttendance(string $clientId, Matricula $matricula, User $actor, string $ip): void
    {
        $client = User::find($clientId);
        if (!$client) {
            return;
        }

        $attendance = ClientAttendance::create([
            'client_id' => $client->id,
            'attended_by' => $actor->id,
            'channel' => 'proposal',
            'observation' => 'Atendimento automatico gerado na criacao da proposta',
            'metadata' => [
                'source' => 'proposal_created',
                'matricula_id' => (int) $matricula->id,
                'funnel_id' => $matricula->funnel_id,
                'stage_id' => $matricula->stage_id,
            ],
        ]);

        EventLog::create([
            'entity_type' => 'client_attendance',
            'entity_id' => (string) $attendance->id,
            'action' => 'created',
            'description' => 'Atendimento automatico gerado na criacao da proposta',
            'payload' => [
                'client_id' => (string) $client->id,
                'matricula_id' => (int) $matricula->id,
                'channel' => 'proposal',
                'source' => 'proposal_created',
            ],
            'actor_id' => (string) $actor->id,
            'ip_address' => $ip,
        ]);
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

        if (!empty($validated['id_cliente'])) {
            $this->ensureClientDefaultPipelineForProposal((string) $validated['id_cliente'], (string) $user->id, $request->ip());
        }

        try {
            if (!empty($validated['id_cliente'])) {
                $this->createProposalClientAttendance((string) $validated['id_cliente'], $matricula, $user, $request->ip());
            }
        } catch (\Throwable $e) {}

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
                'curso:id,nome,tipo,config',
                'turma:id,nome',
                'cliente:id,name,email,cpf,celular,genero,config,preferencias,ativo,permission_id,created_at,updated_at,autor',
                'funnel:id,name',
                'stage:id,name,funnel_id',
                'situacao:ID,post_title',
                'responsavel:id,name,email,cpf,celular,genero,config',
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
        $data['responsavel'] = $matricula->responsavel ? $this->mapClientNodeOutput($matricula->responsavel) : null;
        $data['meta'] = $this->reconcileFinancialGainMeta($matricula, $this->getAllMatriculaMeta($matricula['id']));
        $data['consultor'] = $this->mapClientNodeOutput(User::find($matricula['id_consultor']));
        // Parcelamentos via relação Eloquent para manter consistência com sync()
        // Parcelamentos já carregados via relação
        $data['numero_contrato'] = $this->numero_contrato($matricula['id']);
        $data['parcelamentos'] = $matricula->parcelamentos ? $matricula->parcelamentos->toArray() : [];
        //incluir o campo com link publico da proposta
        $link = '/aluno/matricula/'.$matricula['id_cliente'].'_'.Qlib::zerofill($matricula['id'],5).'/1';
        $data['link_orcamento'] = Qlib::qoption('front_url') . $link;
        $data['link_assinatura'] = Qlib::qoption('front_url') . str_replace('matricula','assinatura',$link);
        $data['administration_text'] = $this->buildAdministrationText($data);
        $data['administration_text_available'] = !empty($data['administration_text']);
        return $data;
    }

    /**
     * buildAdministrationText
     * PT-BR: Gera o texto operacional de administração para propostas já matriculadas
     *        em cursos do tipo 2, usando dados da matrícula, cliente e metacampos.
     * EN: Builds the administration operational text for already enrolled proposals
     *      in course type 2, using enrollment, client and meta fields.
     */
    private function buildAdministrationText(array $data): ?string
    {
        if ((string) ($data['curso_tipo'] ?? '') !== '2' || (string) ($data['status'] ?? '') !== 'g') {
            return null;
        }

        $client = is_array($data['cliente'] ?? null) ? $data['cliente'] : [];
        $clientConfig = is_array($client['config'] ?? null) ? $client['config'] : [];
        $meta = is_array($data['meta'] ?? null) ? $data['meta'] : [];
        $proposalMeta = is_array($meta['proposta'] ?? null) ? $meta['proposta'] : [];

        $nomeCompleto = $this->formatAdministrationTextValue($client['name'] ?? $data['cliente_nome'] ?? '');
        $email = $this->formatAdministrationTextValue($client['email'] ?? '');
        $telefone = $this->formatAdministrationTextValue($client['celular'] ?? $clientConfig['celular'] ?? '');
        $cpf = $this->formatAdministrationTextValue($client['cpf'] ?? '');
        $cursoNome = $this->formatAdministrationTextValue($data['curso_nome'] ?? '');
        $turmaNome = $this->formatAdministrationTextValue($data['turma_nome'] ?? '');
        $valorProposta = $this->formatAdministrationMoney($data['total'] ?? null);
        $dataVenda = $this->formatAdministrationDate($meta['data_ganho'] ?? $data['data'] ?? null);
        $quantidadeHoras = $this->resolveAdministrationHours($data);
        $formaPagamento = $this->formatAdministrationTextValue($proposalMeta['forma_pagamento'] ?? '');
        $leadProspectado = $this->formatAdministrationTextValue($proposalMeta['lead_prospectado'] ?? '');
        $vendedor = $this->formatAdministrationTextValue($data['consultor']['name'] ?? $data['autor_name'] ?? '');
        $parcelamentos = is_array($data['parcelamentos'] ?? null) ? $data['parcelamentos'] : [];
        $linkGuru = $this->formatAdministrationTextValue(
            $meta['link_guru']
                ?? $proposalMeta['link_guru']
                ?? $clientConfig['link_guru']
                ?? ''
        );
        $resumoFinanceiro = [
            ' Status financeiro: ' . $this->formatAdministrationFinancialStatus($meta['financeiro_status_ganho'] ?? ''),
            ' Valor negociado: ' . $this->formatAdministrationMoney($meta['valor_negociado_ganho'] ?? $data['total'] ?? null),
            ' Valor de entrada: ' . $this->formatAdministrationMoney($meta['valor_entrada_ganho'] ?? ''),
            ' Valor recebido: ' . $this->formatAdministrationMoney($meta['valor_recebido_ganho'] ?? ($meta['valor_pago'] ?? '')),
            ' Saldo em aberto: ' . $this->formatAdministrationMoney($meta['saldo_ganho'] ?? ''),
            ' Parcelamento(s): ' . $this->formatAdministrationTextValue($this->resolveAdministrationInstallmentsSummary($parcelamentos, $proposalMeta)),
        ];

        $foiTransferido = $this->formatAdministrationBoolean(
            $this->resolveAdministrationField(
                [$meta, $clientConfig],
                ['foi_transferido', 'transferido']
            )
        );
        $cmaEmDia = $this->formatAdministrationBoolean(
            $this->resolveAdministrationField(
                [$meta, $clientConfig],
                ['cma_em_dia', 'cma_dia']
            )
        );
        $classeCma = $this->formatAdministrationTextValue(
            $this->resolveAdministrationField(
                [$meta, $clientConfig],
                ['classe_cma', 'cma_classe']
            )
        );
        $possuiBanca = $this->formatAdministrationBoolean(
            $this->resolveAdministrationField(
                [$meta, $clientConfig],
                ['possui_banca', 'possue_banca', 'banca']
            )
        );

        $informacoesPassadas = [
            'Aluno ciente da taxa de manutenção do alojamento.' => ['aluno_ciente_taxa_manutencao_alojamento', 'ciente_taxa_manutencao_alojamento', 'taxa_manutencao_alojamento'],
            'Aluno ciente da hora seca.' => ['aluno_ciente_hora_seca', 'ciente_hora_seca', 'hora_seca'],
            'Aluno ciente que tem que trazer seu próprio headset.' => ['aluno_ciente_headset', 'ciente_headset', 'headset'],
            'Aluno ciente que o prazo informado para conclusão do curso é um estimado, podendo sofrer variações de acordo com o próprio desempenho do aluno, condições meteorológicas e necessidades de manutenções preventivas e corretivas.' => ['aluno_ciente_prazo_estimado', 'ciente_prazo_estimado', 'prazo_estimado'],
            'Aluno ciente que para voar no C150/C152 deverá ter no máximo 1,90 de altura e 100kg.' => ['aluno_ciente_limite_c150', 'ciente_limite_c150', 'limite_c150'],
            'Aluno ciente e concorda que para início do Ground School e das horas de voo estão condicionados à entrega prévia de todos os documentos pessoais exigidos pela instituição. Para alunos transferidos, será obrigatória, além da documentação de praxe, a apresentação da carta de transferência e dos documentos de títulos correspondentes. O não cumprimento desta exigência impedirá o início das atividades acadêmicas e práticas até que a documentação seja devidamente regularizada.' => ['aluno_ciente_documentacao_ground_school', 'ciente_documentacao_ground_school', 'documentacao_ground_school'],
            'Aluno ciente que é obrigatório o uso de uniforme para realizar as horas práticas de voo (Link para adquirir o uniforme: https://www.reserva.ink/acjf/collections/uniformes).' => ['aluno_ciente_uniforme', 'ciente_uniforme', 'uniforme'],
        ];

        $lines = [
            'Informações da proposta',
            ' -------- ',
            ' Nome completo: ' . $nomeCompleto,
            ' Curso adquirido: ' . $cursoNome,
            ' Quantidade de horas: ' . $quantidadeHoras,
            ' Turma: ' . $turmaNome,
            ' Valor da proposta: ' . $valorProposta,
            ' Link da proposta: ' . $this->formatAdministrationTextValue($data['link_orcamento'] ?? ''),
            ' ID cliente: ' . $this->formatAdministrationTextValue($data['id_cliente'] ?? ''),
            ' ID matrícula: ' . $this->formatAdministrationTextValue($data['id'] ?? ''),
            ' Forma de pagamento: ' . $formaPagamento,
            ' Lead prospectado por SDR: ' . $leadProspectado,
            ' Vendedor: ' . $vendedor,
            ' Data da venda: ' . $dataVenda,
            ' Link do guru: ' . $linkGuru,
            ' ',
            ' Resumo financeiro ',
            ' -------- ',
            ...$resumoFinanceiro,
            ' ',
            ' -------- ',
            ' Nome completo: ' . $nomeCompleto,
            ' Email: ' . $email,
            ' País de origem: ' . $this->formatAdministrationTextValue($clientConfig['pais_origem'] ?? 'Brasil'),
            ' Telefone: ' . $telefone,
            ' Data de nascimento: ' . $this->formatAdministrationDate($clientConfig['nascimento'] ?? $client['nascimento'] ?? null),
            ' CPF: ' . $cpf,
            ' CANAC: ' . $this->formatAdministrationTextValue($clientConfig['canac'] ?? ''),
            ' RG: ' . $this->formatAdministrationTextValue($clientConfig['identidade'] ?? $clientConfig['rg'] ?? ''),
            ' CEP: ' . $this->formatAdministrationTextValue($clientConfig['cep'] ?? ''),
            ' Endereço: ' . $this->formatAdministrationTextValue($clientConfig['endereco'] ?? ''),
            ' Numero: ' . $this->formatAdministrationTextValue($clientConfig['numero'] ?? ''),
            ' Complemento: ' . $this->formatAdministrationTextValue($clientConfig['complemento'] ?? ''),
            ' Bairro: ' . $this->formatAdministrationTextValue($clientConfig['bairro'] ?? ''),
            ' Cidade: ' . $this->formatAdministrationTextValue($clientConfig['cidade'] ?? ''),
            ' Estado: ' . $this->formatAdministrationTextValue($clientConfig['estado'] ?? ''),
            ' nacionalidade: ' . $this->formatAdministrationTextValue($clientConfig['nacionalidade'] ?? ''),
            ' profissao: ' . $this->formatAdministrationTextValue($clientConfig['profissao'] ?? ''),
            ' Sexo: ' . $this->formatAdministrationTextValue($clientConfig['sexo'] ?? $client['genero'] ?? ''),
            ' Altura: ' . $this->formatAdministrationHeight($clientConfig['altura'] ?? ''),
            ' Peso: ' . $this->formatAdministrationWeight($clientConfig['peso'] ?? ''),
            ' ',
            ' Situação atual ',
            ' -------- ',
            ' Foi transferido: ' . $foiTransferido,
            ' CMA em dia: ' . $cmaEmDia,
            ' Classe do CMA: ' . $classeCma,
            ' Possue banca: ' . $possuiBanca,
            ' ',
            ' Informações passadas ',
            ' -------- ',
        ];

        foreach ($informacoesPassadas as $label => $keys) {
            $lines[] = ' ' . $label . ' ' . $this->formatAdministrationBoolean(
                $this->resolveAdministrationField([$meta, $clientConfig], $keys)
            );
            $lines[] = ' ';
        }

        $lines[] = ' Altura: ' . $this->formatAdministrationHeight($clientConfig['altura'] ?? '');
        $lines[] = ' Peso: ' . $this->formatAdministrationWeight($clientConfig['peso'] ?? '');

        return implode("\n", $lines);
    }

    /**
     * formatAdministrationFinancialStatus
     * PT-BR: Traduz o status financeiro interno para um rótulo legível no texto administrativo.
     * EN: Translates the internal financial status into a readable label for the administration text.
     */
    private function formatAdministrationFinancialStatus(mixed $value): string
    {
        $normalized = strtolower(trim((string) $value));

        return match ($normalized) {
            'paid' => 'Pago',
            'partial' => 'Parcial',
            'pending' => 'Pendente',
            'overdue' => 'Vencido',
            'cancelled', 'canceled' => 'Cancelado',
            default => $this->formatAdministrationTextValue($value),
        };
    }

    /**
     * resolveAdministrationInstallmentsSummary
     * PT-BR: Monta um resumo legível dos parcelamentos vinculados ao curso/proposta.
     * EN: Builds a readable summary of installments linked to the course/proposal.
     */
    private function resolveAdministrationInstallmentsSummary(array $parcelamentos, array $proposalMeta = []): string
    {
        $labels = [];

        foreach ($parcelamentos as $parcelamento) {
            if (!is_array($parcelamento)) {
                continue;
            }

            $label = trim((string) (
                $parcelamento['nome']
                ?? $parcelamento['title']
                ?? $parcelamento['titulo']
                ?? $parcelamento['descricao']
                ?? $parcelamento['description']
                ?? ''
            ));

            if ($label !== '') {
                $labels[] = $label;
            }
        }

        if (count($labels) > 0) {
            return implode(' | ', array_values(array_unique($labels)));
        }

        $fallbackKeys = [
            'parcelamento',
            'parcelamentos',
            'parcelamento_nome',
            'parcelamento_descricao',
        ];

        foreach ($fallbackKeys as $key) {
            $value = $proposalMeta[$key] ?? null;
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
            if (is_array($value)) {
                $flat = array_values(array_filter(array_map(function ($item) {
                    if (is_scalar($item)) {
                        return trim((string) $item);
                    }

                    return '';
                }, $value)));

                if (count($flat) > 0) {
                    return implode(' | ', $flat);
                }
            }
        }

        return '';
    }

    /**
     * resolveAdministrationField
     * PT-BR: Procura a primeira chave preenchida em uma lista de fontes de dados.
     * EN: Looks up the first filled key across a list of data sources.
     */
    private function resolveAdministrationField(array $sources, array $keys): mixed
    {
        foreach ($sources as $source) {
            if (!is_array($source)) {
                continue;
            }
            foreach ($keys as $key) {
                if (array_key_exists($key, $source) && $source[$key] !== null && $source[$key] !== '') {
                    return $source[$key];
                }
            }
        }

        return null;
    }

    /**
     * resolveAdministrationHours
     * PT-BR: Resolve a quantidade de horas exibida no texto administrativo a partir
     *        do orçamento, módulo selecionado ou duração do curso.
     * EN: Resolves the hours quantity shown in the administration text from the
     *      budget, selected module or course duration.
     */
    private function resolveAdministrationHours(array $data): string
    {
        $orc = is_array($data['orc'] ?? null) ? $data['orc'] : [];
        $modules = is_array($orc['modulos'] ?? null) ? $orc['modulos'] : [];
        $module = is_array($modules[0] ?? null) ? $modules[0] : [];

        $totalCredits = 0.0;
        foreach ($modules as $currentModule) {
            if (!is_array($currentModule)) {
                continue;
            }

            $stage = strtolower(trim((string) ($currentModule['etapa'] ?? '')));
            $normalizedStage = str_replace([' ', '_'], '', $stage);
            if ($normalizedStage === 'etapa1') {
                continue;
            }

            $credits = $currentModule['limite'] ?? null;
            if ($credits !== null && $credits !== '' && is_numeric($credits)) {
                $totalCredits += (float) $credits;
            }
        }

        if ($totalCredits > 0) {
            return ((int) $totalCredits == $totalCredits)
                ? (string) ((int) $totalCredits)
                : (string) $totalCredits;
        }

        $candidates = [
            $module['limite_pratico'] ?? null,
            $module['h_praticas'] ?? null,
            $module['limite'] ?? null,
            $module['h_teoricas'] ?? null,
            $data['curso']['duracao'] ?? null,
            $data['curso']['carga_horaria'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if ($candidate === null || $candidate === '') {
                continue;
            }

            if (is_numeric($candidate)) {
                $numericCandidate = (float) $candidate;

                return ((int) $numericCandidate == $numericCandidate)
                    ? (string) ((int) $numericCandidate)
                    : (string) $numericCandidate;
            }

            return trim((string) $candidate);
        }

        return '';
    }

    /**
     * formatAdministrationMoney
     * PT-BR: Formata um valor monetário em BRL para o texto administrativo.
     * EN: Formats a monetary amount in BRL for the administration text.
     */
    private function formatAdministrationMoney(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        if (is_numeric($value)) {
            return Qlib::valor_moeda((float) $value, 'R$');
        }

        return trim((string) $value);
    }

    /**
     * formatAdministrationDate
     * PT-BR: Normaliza datas para o padrão dd/mm/aaaa no texto administrativo.
     * EN: Normalizes dates to dd/mm/yyyy for the administration text.
     */
    private function formatAdministrationDate(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        try {
            return Carbon::parse((string) $value)->format('d/m/Y');
        } catch (\Throwable $e) {
            return Qlib::dataExibe((string) $value) ?: trim((string) $value);
        }
    }

    /**
     * formatAdministrationBoolean
     * PT-BR: Converte diferentes representações lógicas para "Sim" ou "Não".
     * EN: Converts multiple boolean-like representations into "Sim" or "Não".
     */
    private function formatAdministrationBoolean(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        if (is_bool($value)) {
            return $value ? 'Sim' : 'Não';
        }

        $normalized = strtolower(trim((string) $value));
        if (in_array($normalized, ['1', 's', 'sim', 'true', 'yes', 'y', 'on'], true)) {
            return 'Sim';
        }

        if (in_array($normalized, ['0', 'n', 'nao', 'não', 'false', 'no', 'off'], true)) {
            return 'Não';
        }

        return trim((string) $value);
    }

    /**
     * formatAdministrationHeight
     * PT-BR: Exibe a altura em centímetros, aceitando entradas em metros ou cm.
     * EN: Displays height in centimeters, accepting meter or cm inputs.
     */
    private function formatAdministrationHeight(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        $number = (float) str_replace(',', '.', preg_replace('/[^\d\.,]/', '', (string) $value));
        if ($number <= 0) {
            return trim((string) $value);
        }

        if ($number < 3) {
            $number *= 100;
        }

        return (string) round($number);
    }

    /**
     * formatAdministrationWeight
     * PT-BR: Exibe o peso com a menor transformação possível para manter leitura natural.
     * EN: Displays weight with minimal transformation to keep natural readability.
     */
    private function formatAdministrationWeight(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        $number = (float) str_replace(',', '.', preg_replace('/[^\d\.,]/', '', (string) $value));
        if ($number <= 0) {
            return trim((string) $value);
        }

        return (string) ((int) $number == $number ? (int) $number : $number);
    }

    /**
     * formatAdministrationTextValue
     * PT-BR: Normaliza valores textuais simples para evitar `null` e espaços extras.
     * EN: Normalizes simple textual values to avoid `null` and extra spaces.
     */
    private function formatAdministrationTextValue(mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        if (is_bool($value)) {
            return $value ? 'Sim' : 'Não';
        }

        return trim((string) $value);
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
        if (is_null($client)) {
            return [];
        }
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
            $expirationContext = $this->getPublicProposalExpirationContext($matricula);
            $data = array_merge($data, $expirationContext);
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
            $matricula = Matricula::where('id', $matricula_id)
                ->where('id_cliente', $client_id)
                ->firstOrFail();
            $expirationContext = $this->getPublicProposalExpirationContext($matricula);
            if (!empty($expirationContext['is_expired'])) {
                return $this->proposalExpiredResponse($expirationContext);
            }
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
                'foi_transferido' => 'nullable|boolean',
                'cma_em_dia' => 'nullable|boolean',
                'classe_cma' => 'nullable|string|max:50',
                'possui_banca' => 'nullable|boolean',
                'aluno_ciente_taxa_manutencao_alojamento' => 'nullable|boolean',
                'aluno_ciente_hora_seca' => 'nullable|boolean',
                'aluno_ciente_headset' => 'nullable|boolean',
                'aluno_ciente_prazo_estimado' => 'nullable|boolean',
                'aluno_ciente_limite_c150' => 'nullable|boolean',
                'aluno_ciente_documentacao_ground_school' => 'nullable|boolean',
                'aluno_ciente_uniforme' => 'nullable|boolean',
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
                $currentConfig['sexo'] = $request->input('sexo');
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
            $ret['exec'] = false;
            if ($matricula) {
                $matConfig = $matricula->config ?? [];
                $matConfig['step1_done'] = true;
                $matConfig['step1_at'] = now()->toDateTimeString();
                $matricula->config = $matConfig;
                $matricula->save();

                $this->persistMatriculaMeta($matricula->id, $this->extractPublicAdministrationMeta($request));

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
                if (is_array($ids) && count($ids)) {
                    $ids = \App\Models\Post::where('post_type', 'contratos')
                        ->whereIn('ID', $ids)
                        ->orderBy('menu_order')
                        ->orderByDesc('ID')
                        ->pluck('ID')
                        ->toArray();
                }

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

                    // Se o contrato for do tipo 'responsavel', não deve aparecer para o aluno
                    if (isset($cont->tipo) && $cont->tipo === 'responsavel') {
                        continue;
                    }

                    //Aplicar shortcodes
                    $cont->conteudo = Qlib::apply_shortcodes($cont->conteudo,$dm);
                    $conteudo = $cont->conteudo??'';
                    $contratos[] = ['id'=>$id,'conteudo'=>$conteudo,'nome'=>$cont->nome,'slug'=>$cont->slug,'tipo'=>$cont->tipo??'geral'];
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
        $ret['exec'] = !empty($contratos_pdf);
        $ret['quantidade_contratos'] = count($contratos_pdf);
        if (!$ret['exec'] && empty($ret['mens'])) {
            $ret['mens'] = 'Nenhum contrato PDF foi gerado para esta matrícula.';
        }
        $ret['contratos_pdf'] = $contratos_pdf;
        return $ret;
    }

    /**
     * Metodo para renderizar os contratos do responsável financeiro de uma matricula
     */
    public function contratos_responsavel($id, $dm = [])
    {
        if (!$id) {
            return response()->json(['error' => 'ID da matrícula é necessário'], 400);
        }
        if (!$dm) {
            $dm = $this->dm($id);
        }

        if (!isset($dm['id_responsavel']) || !$dm['id_responsavel']) {
            return ['error' => 'Responsável financeiro não definido para esta matrícula'];
        }

        $contratos = [];
        if ($dm) {
            // pt-BR: Prioridade 1 - Buscar contratos especificamente marcados como 'responsavel' para este curso/período.
            // en-US: Priority 1 - Look for contracts specifically tagged as 'responsavel' for this course/period.
            $specificResponsibleIds = \App\Models\Post::where('post_type', 'contratos')
                ->where('config->tipo', 'responsavel')
                ->where(function($q) use ($dm) {
                    if (!empty($dm['id_curso'])) {
                        $q->where('config->id_curso', (int)$dm['id_curso']);
                    }
                })
                ->where('post_status', 'publish')
                ->orderBy('menu_order')
                ->pluck('ID')
                ->toArray();

            if (!empty($specificResponsibleIds)) {
                $ids = $specificResponsibleIds;
            } else {
                // pt-BR: Fallback - Buscar ids padrão dos contratos do curso/período.
                $id_periodos = $dm['orc']['modulos'][0]['id'] ?? null;
                try {
                    $d_periodo = (new PeriodoController())->show($id_periodos)->getData()->id_contratos;
                } catch (\Exception $e) {
                    $d_periodo = [];
                }
                $ids = $d_periodo ?? [];
                if (is_array($ids) && count($ids)) {
                    $ids = \App\Models\Post::where('post_type', 'contratos')
                        ->whereIn('ID', $ids)
                        ->orderBy('menu_order')
                        ->orderByDesc('ID')
                        ->pluck('ID')
                        ->toArray();
                }

                if (empty($ids) && !empty($dm['id_curso']) && isset($dm['curso_tipo']) && $dm['curso_tipo'] == 2) {
                    $ids = \App\Models\Post::where('post_type', 'contratos')
                        ->where('config', 'like', '%"id_curso":' . $dm['id_curso'] . '%')
                        ->where('post_status', 'publish')
                        ->orderBy('menu_order')
                        ->orderByDesc('ID')
                        ->pluck('ID')
                        ->toArray();
                }
            }

            if ($ids && count($ids)) {
                $cc = new ContratoController();

                // 1. Mapeia os dados do ALUNO (igual ao método contratos_periodos)
                $dm['aluno'] = $dm['cliente_nome'] ?? '';
                $dm['cpf_aluno'] = $dm['cliente']['cpf'] ?? '';
                $dm['estado_civil'] = $dm['cliente']['estado_civil'] ?? '';
                $dm['nacionalidade'] = $dm['cliente']['nacionalidade'] ?? '';
                $dm['data_nascimento'] = $dm['cliente']['config']['nascimento'] ?? '';
                if ($dm['data_nascimento']) {
                    $dm['data_nascimento'] = date('d/m/Y', strtotime($dm['data_nascimento']));
                }
                $dm['celular'] = $dm['cliente']['config']['celular'] ?? '';
                $dm['telefone'] = $dm['cliente']['config']['telefone'] ?? '';
                if ($dm['celular']) {
                    $dm['celular'] = Qlib::mask($dm['celular'], '(99) 99999-9999');
                }
                if ($dm['telefone']) {
                    $dm['telefone'] = Qlib::mask($dm['telefone'], '(99) 9999-9999');
                }
                $dm['identidade'] = $dm['cliente']['config']['rg'] ?? '';

                // 2. Mapeia os dados do RESPONSÁVEL FINANCEIRO (com prefixo específico)
                $dm['responsavel_nome'] = $dm['responsavel']['name'] ?? '';
                $dm['responsavel_cpf'] = $dm['responsavel']['cpf'] ?? '';
                $dm['responsavel_identidade'] = $dm['responsavel']['config']['rg'] ?? $dm['responsavel']['config']['identidade'] ?? '';
                $dm['responsavel_estado_civil'] = $dm['responsavel']['estado_civil'] ?? '';
                $dm['responsavel_nacionalidade'] = $dm['responsavel']['nacionalidade'] ?? '';

                $dnResp = $dm['responsavel']['config']['nascimento'] ?? '';
                $dm['responsavel_data_nascimento'] = $dnResp ? date('d/m/Y', strtotime($dnResp)) : '';

                $dm['responsavel_celular'] = $dm['responsavel']['config']['celular'] ?? '';
                if ($dm['responsavel_celular']) {
                    $dm['responsavel_celular'] = Qlib::mask($dm['responsavel_celular'], '(99) 99999-9999');
                }

                $dm['responsavel_email'] = $dm['responsavel']['email'] ?? '';
                $dm['responsavel_profissao'] = $dm['responsavel']['config']['profissao'] ?? '';
                $dm['responsavel_endereco'] = $dm['responsavel']['config']['endereco'] ?? '';
                $dm['responsavel_numero'] = $dm['responsavel']['config']['numero'] ?? '';
                $dm['responsavel_bairro'] = $dm['responsavel']['config']['bairro'] ?? '';
                $dm['responsavel_cidade'] = $dm['responsavel']['config']['cidade'] ?? '';
                $dm['responsavel_uf'] = $dm['responsavel']['config']['uf'] ?? '';
                $dm['responsavel_cep'] = $dm['responsavel']['config']['cep'] ?? '';

                $dm['curso'] = $dm['curso_nome'] ?? '';
                $dm['nome_curso'] = $dm['curso'];

                // 3. Tokens legados e gerais
                $dm['responsavel_cpf'] = $dm['responsavel']['cpf'] ?? '';

                $testemunhas = $this->testemunhas();
                $dm['nome_testemunha1'] = $testemunhas[0]['name'] ?? '';
                $dm['cpf_testemunha1'] = $testemunhas[0]['cpf'] ?? '';
                $dm['nome_testemunha2'] = $testemunhas[1]['name'] ?? '';
                $dm['cpf_testemunha2'] = $testemunhas[1]['cpf'] ?? '';
                $dm['data_contrato_aceito'] = Qlib::dataLocal();

                $assinar = $this->helper_assinar($testemunhas);
                if (is_array($assinar) && count($assinar)) {
                    $dm = array_merge($dm, $assinar);
                }

                foreach ($ids as $id_contrato) {
                    try {
                        $cont = $cc->show($id_contrato)->getData();
                    } catch (\Exception $e) {
                        continue;
                    }

                    // Se estamos buscando contratos para o responsável, garantimos que sejam do tipo correspondente
                    // Ou se for um fallback e o contrato for explicitamente do aluno, ignoramos
                    if (isset($cont->tipo) && $cont->tipo === 'geral' && !empty($specificResponsibleIds)) {
                        continue;
                    }

                    // Se for o fallback, mas houver outros contratos de responsável, filtramos os de aluno
                    // para manter a lista limpa e focada no fiador
                    if (isset($cont->tipo) && $cont->tipo === 'geral') {
                         // opcional: decidir se o fallback de aluno deve aparecer.
                         // O usuário pediu para "respeitar o tipo", então se for 'geral', ignora se estivermos num contexto de responsável.
                         continue;
                    }

                    $cont->conteudo = Qlib::apply_shortcodes($cont->conteudo, $dm);
                    $conteudo = $cont->conteudo ?? '';
                    $contratos[] = ['id' => $id_contrato, 'conteudo' => $conteudo, 'nome' => $cont->nome, 'slug' => $cont->slug, 'tipo' => $cont->tipo ?? 'responsavel'];
                }
            }
            return $contratos;
        }
        return ['error' => 'Matrícula não encontrada'];
    }

    /**
     * Metodo para gerar um arquivos pdf estatico com os contratos do responsável financeiro
     */
    public function contratos_responsavel_pdf($id, $dm = [])
    {
        $ret['exec'] = false;
        $contratos_pdf = [];
        if (!$id) {
            return response()->json(['error' => 'ID da matrícula é necessário'], 400);
        }
        if (!$dm) {
            $dm = $this->dm($id);
        }

        $contratos = $this->contratos_responsavel($id, $dm);

        if (isset($contratos['error'])) {
            return response()->json($contratos, 400);
        }

        if ($contratos) {
            $token = $dm['token'] ?? '';
            $slug_periodo = $dm['orc']['modulos'][0]['slug'] ?? '';
            $pasta = 'contratos/responsavel/' . $slug_periodo;
            $id_matricula = $id;

            if (is_array($contratos)) {
                $campo_meta = 'contrato_responsavel_pdf';
                Qlib::update_matriculameta($id_matricula, $campo_meta, Qlib::lib_array_json([]));
                foreach ($contratos as $k => $cont) {
                    $conteudo = $cont['conteudo'] ?? '';
                    $titulo = $cont['slug'] ?? '';
                    $dados = [
                        'html' => $conteudo,
                        'titulo' => $campo_meta,
                        'nome_aquivo_savo' => 'resp_' . $titulo . '_' . $id_matricula . '_' . $k,
                        'id_matricula' => $id_matricula,
                        'token' => $token,
                        'short_code' => 'resp_' . $titulo . '_' . $id_matricula,
                        'pasta' => $pasta,
                        'f_exibe' => 'server',
                    ];
                    $contratos_pdf[] = (new PdfController)->convert_html($dados);
                }
            }
            $ret['exec'] = true;
            $ret['contratos_pdf'] = $contratos_pdf;
            // Salva o log do evento
            try {
                EventLog::create([
                    'entity_type' => 'matricula',
                    'entity_id' => (string)$id,
                    'action' => 'responsible_contracts_generated',
                    'description' => 'Contratos do responsável financeiro gerados com sucesso.',
                    'payload' => $contratos_pdf,
                    'actor_id' => (string)auth()->id(),
                    'ip_address' => request()->ip(),
                ]);
            } catch (\Throwable $e) {
            }
        } else {
            $ret['exec'] = false;
            $ret['mens'] = 'Erro ao gerar os contratos do responsável';
        }

        return response()->json($ret);
    }

    /**
     * testar_envio_link_assinatura_zapguru
     * pt-BR: Dispara manualmente o envio dos links de assinatura para o Zapguru,
     * reutilizando o mesmo método usado ao final do fluxo `send_to_zapSing()`.
     */
    public function testar_envio_link_assinatura_zapguru(Request $request, $id)
    {
        $dm = $this->dm($id);
        if (!$dm || !isset($dm['id'])) {
            return response()->json([
                'exec' => false,
                'mens' => 'Matrícula não encontrada para testar o envio do link de assinatura.',
            ], 404);
        }

        $tk_periodo = (string)($request->input('tk_periodo') ?? '');
        $ret = (new ZapsingController())->enviar_link_assinatura($id, $tk_periodo);

        if (!is_array($ret)) {
            $ret = [
                'exec' => false,
                'mens' => 'A integração retornou uma resposta inválida ao testar o envio do link.',
                'response' => $ret,
            ];
        }

        \Log::info('testar_envio_link_assinatura_zapguru:', [
            'id_matricula' => $id,
            'tk_periodo' => $tk_periodo,
            'response' => $ret,
        ]);

        return response()->json($ret);
    }

    /**
     * Metodo para enviar o contrato do responsavel para zapsing
     */
    public function enviar_zapsign_responsavel(Request $request, $id)
    {
        $dm = $this->dm($id);
        if (!$dm || !isset($dm['id_responsavel']) || !$dm['id_responsavel']) {
            return response()->json(['error' => 'Responsável financeiro não definido para esta matrícula'], 400);
        }

        $id_matricula = (int)$id;
        $ret['exec'] = false;

        // Verifica se ja tem os links do contrato criados para o responsavel
        $contratosMeta = Qlib::get_matriculameta($id_matricula, 'contrato_responsavel_pdf');
        $contratos = false;
        if (is_string($contratosMeta)) {
            $contratos = json_decode($contratosMeta, true);
        }

        if (!is_array($contratos) || empty($contratos)) {
            // Tenta gerar se não existir
            $gerar = $this->contratos_responsavel_pdf($id_matricula, $dm);
            $resGerar = $gerar->getData(true);
            if (isset($resGerar['exec']) && $resGerar['exec']) {
                $contratos = $resGerar['contratos_pdf'];
            }
        }

        if (!is_array($contratos) || empty($contratos)) {
            return response()->json(['error' => 'Não foi possível gerar os PDFs para o responsável financeiro'], 500);
        }

        $responsavel = $dm['responsavel'];
        $nome = $responsavel['name'] ?? '';
        $email = $responsavel['email'] ?? '';
        $cpf = $responsavel['cpf'] ?? '';

        $signers = [
            "name" => $nome,
            "email" => $email,
            "cpf" => $cpf,
            "send_automatic_email" => true,
            "send_automatic_whatsapp" => false,
            "auth_mode" => "CPF",
            "order_group" => 1,
        ];

        $zpc = new ZapsingController;
        $signersList = $zpc->signers_matricula($signers);

        // Primeiro PDF vira o envelope principal
        $mainPdf = $contratos[0]['url_pdf'] ?? $contratos[0]['url'];

        $name = $nome . ' (RESPONSÁVEL) * ' . @$dm['curso_nome'] . ' - ' . @$dm['id'];
        $externar_id = $id . '_' . $dm['id_responsavel'] . '_resp';

        $body = [
            "name" => trim($name),
            "url_pdf" => $mainPdf,
            "external_id" => $externar_id,
            "folder_path" => '/CRM/Responsavel',
            "signers" => $signersList,
        ];

        $enviar = $zpc->post([
            "endpoint" => 'docs',
            "body" => $body,
        ]);

        if (isset($enviar['exec']) && $enviar['exec']) {
            $responseZapsign = $enviar['response'] ?? [];
            $token_doc = $responseZapsign['token'] ?? false;

            // Grava o processamento
            Qlib::update_matriculameta($id_matricula, 'enviar_envelope_responsavel', json_encode($responseZapsign));
            Qlib::update_matriculameta($id_matricula, 'processo_assinatura_responsavel', json_encode($responseZapsign));

            // Envia os demais contratos como anexos
            if (count($contratos) > 1) {
                $anexos = array_slice($contratos, 1);
                foreach ($anexos as $anexo) {
                    $linkAnexo = $anexo['url_pdf'] ?? $anexo['url'] ?? false;
                    $nomeAnexo = $anexo['nome_contrato'] ?? 'Anexo';
                    if ($linkAnexo && $token_doc) {
                        $zpc->enviar_anexo($token_doc, $linkAnexo, $nomeAnexo);
                    }
                }
            }

            $ret['exec'] = true;
            $ret['mens'] = 'Contrato do responsável enviado com sucesso para ZapSign.';
            $ret['response'] = $responseZapsign;

            // Event log
            try {
                EventLog::create([
                    'entity_type' => 'matricula',
                    'entity_id' => (string)$id,
                    'action' => 'zapsign_responsible_sent',
                    'description' => 'Contrato enviado para o responsável financeiro via ZapSign.',
                    'payload' => $responseZapsign,
                    'actor_id' => (string)auth()->id(),
                    'ip_address' => $request->ip(),
                ]);
            } catch (\Throwable $e) {
            }
        } else {
            $ret['mens'] = 'Falha ao enviar para ZapSign: ' . ($enviar['error'] ?? 'Erro desconhecido');
        }

        return response()->json($ret);
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

            $dm = $this->dm($matricula_id);
            $aluno = $this->contratos_periodos($matricula_id, $dm);
            $responsavel = [];

            // Se houver responsável financeiro, busca os contratos dele também
            if (isset($dm['id_responsavel']) && $dm['id_responsavel']) {
                $resResp = $this->contratos_responsavel($matricula_id, $dm);
                if (is_array($resResp) && !isset($resResp['error'])) {
                    $responsavel = $resResp;
                }
            }

            return response()->json([
                'aluno' => is_array($aluno) ? $aluno : [],
                'responsavel' => $responsavel
            ]);

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
            $request->validate([
                'foi_transferido' => 'nullable|boolean',
                'cma_em_dia' => 'nullable|boolean',
                'classe_cma' => 'nullable|string|max:50',
                'possui_banca' => 'nullable|boolean',
                'aluno_ciente_taxa_manutencao_alojamento' => 'nullable|boolean',
                'aluno_ciente_hora_seca' => 'nullable|boolean',
                'aluno_ciente_headset' => 'nullable|boolean',
                'aluno_ciente_prazo_estimado' => 'nullable|boolean',
                'aluno_ciente_limite_c150' => 'nullable|boolean',
                'aluno_ciente_documentacao_ground_school' => 'nullable|boolean',
                'aluno_ciente_uniforme' => 'nullable|boolean',
            ]);

            $matricula = \App\Models\Matricula::findOrFail($matricula_id);
            $expirationContext = $this->getPublicProposalExpirationContext($matricula);
            if (!empty($expirationContext['is_expired'])) {
                return $this->proposalExpiredResponse($expirationContext);
            }

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
            $this->persistMatriculaMeta($matricula->id, $this->extractPublicAdministrationMeta($request));

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
     * Envia mensagem via API ChatGuru para o cliente com celular registrado.
     * PT-BR: Envia mensagem via API ChatGuru com link de assinatura da proposta para o cliente cadastrado.
     * EN: Sends a WhatsApp message via ChatGuru API with signature link to the registered client.
     */
    public function enviarWhatsapp(Request $request, $id)
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

        $dm = $this->dm($id);
        $cliente = $dm['cliente'] ?? [];
        $nome = $cliente['name'] ?? ($dm['cliente_nome'] ?? 'Cliente');

        // Resolve phone number
        $zgc = new ZapguruController();
        $telefonezap = $zgc->get_telefonezap_by_id_matricula($id);
        if (empty($telefonezap)) {
            $telefonezap = $cliente['celular'] ?? ($cliente['config']['celular'] ?? '');
        }

        // Clean formatting to keep only digits
        $cleanPhone = preg_replace('/\D/', '', (string)$telefonezap);
        if (empty($cleanPhone)) {
            return response()->json(['error' => 'Celular do cliente não cadastrado ou inválido para envio via API.'], 400);
        }

        // Prepend Brazil country code if not present for typical 10-11 digit numbers
        if (strlen($cleanPhone) <= 11 && !str_starts_with($cleanPhone, '55')) {
            $cleanPhone = '55' . $cleanPhone;
        }

        $text = $request->input('mensagem');
        if (empty($text)) {
            $linkAssinatura = $dm['link_assinatura'] ?? '';
            $text = "Olá, *{nome}*! Segue o link para visualizar e assinar a sua proposta comercial: " . $linkAssinatura;
        }

        // Replace template placeholder if present
        $text = str_replace('{nome}', $nome, $text);

        // Dispatch via ZapguruController
        $res = $zgc->enviar_mensagem([
            'celular_completo' => $cleanPhone,
            'nome' => $nome,
            'text' => $text,
            'dialog_id' => $request->input('dialog_id', '') ?: false,
        ]);

        if (isset($res['exec']) && $res['exec']) {
            // Save Event Log inside proposal history
            try {
                EventLog::create([
                    'entity_type' => 'matricula',
                    'entity_id' => (string)$id,
                    'action' => 'whatsapp_guru_proposal_sent',
                    'description' => "Mensagem de proposta enviada via WhatsApp (ChatGuru) para {$cleanPhone}.",
                    'payload' => [
                        'phone' => $cleanPhone,
                        'message' => $text,
                        'response' => $res['response'] ?? null
                    ],
                    'actor_id' => (string)auth()->id(),
                    'ip_address' => $request->ip(),
                ]);
            } catch (\Throwable $e) {
                Log::error('Erro ao salvar EventLog para WhatsApp Guru: ' . $e->getMessage());
            }

            return response()->json([
                'success' => true,
                'message' => 'Mensagem enviada com sucesso via ChatGuru API!',
                'response' => $res['response'] ?? null,
            ]);
        }

        $errorMsg = $res['response']['description'] ?? $res['error'] ?? 'Erro desconhecido na API do ChatGuru';
        return response()->json([
            'success' => false,
            'error' => 'Erro ao enviar mensagem via ChatGuru API: ' . $errorMsg,
            'response' => $res['response'] ?? null,
        ], 500);
    }

    /**
     * Atualiza rapidamente o status da matrícula.
     * EN: Quickly updates the enrollment status.
     */
    public function updateStatusRapid(Request $request, string $id)
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

        $validator = Validator::make($request->all(), [
            'status' => ['required', 'string', Rule::in(['a', 'g', 'p'])],
            'gain_date' => ['nullable', 'date'],
            'negotiated_amount' => ['nullable', 'numeric'],
            'paid_amount' => ['nullable', 'numeric'],
            'gain_observation' => ['nullable', 'string'],
            'loss_date' => ['nullable', 'date'],
            'loss_reason' => ['nullable', 'string', 'max:255'],
            'loss_observation' => ['nullable', 'string'],
        ]);
        if ($validator->fails()) {
            return response()->json([
                'message' => 'Erro de validação',
                'errors' => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();
        $oldStatus = (string) ($matricula->status ?? 'a');
        $newStatus = (string) $validated['status'];
        $gainDate = isset($validated['gain_date']) ? (string) $validated['gain_date'] : null;
        $negotiatedAmount = isset($validated['negotiated_amount'])
            ? (string) $validated['negotiated_amount']
            : (isset($validated['paid_amount']) ? (string) $validated['paid_amount'] : null);
        $paidAmount = isset($validated['paid_amount']) ? (string) $validated['paid_amount'] : '0';
        $gainObservation = isset($validated['gain_observation']) ? trim((string) $validated['gain_observation']) : null;
        $lossDate = isset($validated['loss_date']) ? (string) $validated['loss_date'] : null;
        $lossReason = isset($validated['loss_reason']) ? trim((string) $validated['loss_reason']) : null;
        $lossObservation = isset($validated['loss_observation']) ? trim((string) $validated['loss_observation']) : null;
        $matriculadoSituacaoId = Qlib::get_post_id_by_slug('mat') ?? null;

        if ($newStatus === 'g') {
            $gainValidator = Validator::make($request->all(), [
                'gain_date' => ['required', 'date'],
                'negotiated_amount' => ['required', 'numeric', 'gt:0'],
                'paid_amount' => ['nullable', 'numeric', 'min:0'],
                'gain_observation' => ['nullable', 'string'],
            ]);

            if ($gainValidator->fails()) {
                return response()->json([
                    'message' => 'Erro de validação',
                    'errors' => $gainValidator->errors(),
                ], 422);
            }

            if ((float) $paidAmount > (float) $negotiatedAmount) {
                return response()->json([
                    'message' => 'Erro de validação',
                    'errors' => [
                        'paid_amount' => ['A entrada inicial nao pode ser maior que o valor negociado'],
                    ],
                ], 422);
            }
        }

        if ($newStatus === 'p') {
            $lossValidator = Validator::make($request->all(), [
                'loss_date' => ['required', 'date'],
                'loss_reason' => ['required', 'string', 'max:255'],
                'loss_observation' => ['nullable', 'string'],
            ]);

            if ($lossValidator->fails()) {
                return response()->json([
                    'message' => 'Erro de validação',
                    'errors' => $lossValidator->errors(),
                ], 422);
            }
        }

        $shouldSaveMatricula = false;
        if ($oldStatus !== $newStatus) {
            $matricula->status = $newStatus;
            $shouldSaveMatricula = true;
        }

        if ($newStatus === 'g' && (int) $matricula->situacao_id !== $matriculadoSituacaoId) {
            $matricula->situacao_id = $matriculadoSituacaoId;
            $shouldSaveMatricula = true;
        }

        if ($shouldSaveMatricula) {
            $matricula->save();
        }

        if ($oldStatus !== $newStatus) {
            try {
                $payload = [
                    'from_status' => $oldStatus,
                    'from_status_label' => $this->getMatriculaStatusLabel($oldStatus),
                    'to_status' => $newStatus,
                    'to_status_label' => $this->getMatriculaStatusLabel($newStatus),
                ];

                if ($newStatus === 'g') {
                    $payload['gain_date'] = $gainDate;
                    $payload['negotiated_amount'] = $negotiatedAmount;
                    $payload['paid_amount'] = $paidAmount;
                    $payload['gain_observation'] = $gainObservation;
                    $payload['situacao_id'] = $matriculadoSituacaoId;
                    $payload['situacao_label'] = 'Matriculado';
                }

                if ($newStatus === 'p') {
                    $payload['loss_date'] = $lossDate;
                    $payload['loss_reason'] = $lossReason;
                    $payload['loss_observation'] = $lossObservation;
                }

                EventLog::create([
                    'entity_type' => 'matricula',
                    'entity_id' => (string) $matricula->id,
                    'action' => 'status_changed',
                    'description' => 'Status da matrícula alterado',
                    'payload' => $payload,
                    'actor_id' => (string) $user->id,
                    'ip_address' => $request->ip(),
                ]);
            } catch (\Throwable $e) {}
        }

        if ($newStatus === 'g') {
            try {
                $financialAccount = $this->syncFinancialGainReceivable(
                    $matricula->fresh(['cliente']),
                    $gainDate,
                    $negotiatedAmount,
                    $paidAmount,
                    $gainObservation
                );

                if ($financialAccount) {
                    EventLog::create([
                        'entity_type' => 'matricula',
                        'entity_id' => (string) $matricula->id,
                        'action' => 'financial_receivable_synced',
                        'description' => 'Conta a receber paga lançada no financeiro para a proposta ganha',
                        'payload' => [
                            'financial_account_id' => $financialAccount->id,
                            'amount' => $financialAccount->amount,
                            'negotiated_amount' => $financialAccount->amount,
                            'paid_amount' => $financialAccount->paid_amount,
                            'remaining_amount' => $financialAccount->getRemainingAmountAttribute(),
                            'payment_date' => $financialAccount->payment_date,
                            'status' => $financialAccount->status,
                            'type' => $financialAccount->type,
                        ],
                        'actor_id' => (string) $user->id,
                        'ip_address' => $request->ip(),
                    ]);
                }
            } catch (\Throwable $e) {
                Log::error('Erro ao sincronizar financeiro da proposta ganha', [
                    'matricula_id' => $matricula->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }

        if ($newStatus === 'p') {
            $this->persistMatriculaMeta($matricula->id, [
                'data_perda' => $lossDate,
                'motivo_perda' => $lossReason,
                'observacao_perda' => $lossObservation,
            ]);
        }

        $out = $this->mapOutputFields($matricula->toArray());
        $out['meta'] = $this->getAllMatriculaMeta($matricula->id);
        return response()->json($out);
    }

    /**
     * Retorna o rótulo legível do status da matrícula.
     * EN: Returns the readable label for an enrollment status.
     */
    private function getMatriculaStatusLabel(?string $status): string
    {
        return match ($status) {
            'g' => 'Ganho',
            'p' => 'Perda',
            default => 'Atendimento',
        };
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
        $mainPdf = isset($dm['meta']['proposta_pdf']) ? $dm['meta']['proposta_pdf'] : null;
        $useProposalAsMain = false;

        if ($mainPdf) {
            $useProposalAsMain = true;
            $link_base = $mainPdf;
        } elseif (isset($contratos[0]['url']) && ($link_c = $contratos[0]['url'])) {
            $link_base = $link_c;
        } else {
            $link_base = false;
        }

        if ($link_base) {
            // Se houver link base (proposta ou primeiro contrato), envia o envelope principal
            $enviar = $this->enviar_envelope($id, $dm, $link_base);
            // $enviar = (new \App\Http\Controllers\api\ZapsingController)->enviar_envelope($id??'');
            if($tk_periodo){
                if($enviar['exec'] == true){
                    $campo_processamento = 'enviar_envelope_'.$tk_periodo;
                    $ret['exec'] = true;
                    $ret['mens'] = 'Matricula de id '.$id_matricula.' processada para envio (Período: '.$tk_periodo.')';
                    //gravar o processamento em campo
                    $ret['save_process'] = Qlib::update_matriculameta($id,$campo_processamento,Qlib::lib_array_json($enviar));
                    // Se usamos a proposta como principal, enviamos TODOS os contratos como anexos.
                    // Se usamos o primeiro contrato como principal, removemos ele da lista antes de enviar os demais anexos.
                    if (is_array($contratos)) {
                        if (!$useProposalAsMain) {
                            array_shift($contratos);
                        }
                        $token_doc = isset($enviar['response']['token']) ? $enviar['response']['token'] : false;
                        if ($token_doc && !empty($contratos)) {
                            $ret['anexos'] = $this->enviar_contratos_anexos($contratos, $id, $dm, $tk_periodo);
                        }
                    } else {
                        $ret['exec'] = false;
                        $ret['mens'] = 'Lista de contratos inválidos';
                        $ret['color'] = 'danger';

                    }
                }
            }else{
                if($enviar['exec'] == true){
                    $ret['exec'] = true;
                    $ret['mens'] = 'Matricula de id '.$id_matricula.' processada para envio.';
                    //gravar o processamento em campo
                    $ret['save_process'] = Qlib::update_matriculameta($id,'enviar_envelope',Qlib::lib_array_json($enviar));
                    // Se usamos a proposta como principal, enviamos TODOS os contratos como anexos.
                    // Se usamos o primeiro contrato como principal, removemos ele da lista antes de enviar os demais anexos.
                    if (is_array($contratos)) {
                        if (!$useProposalAsMain) {
                            array_shift($contratos);
                        }
                        $token_doc = isset($enviar['response']['token']) ? $enviar['response']['token'] : false;
                        if ($token_doc && !empty($contratos)) {
                            $ret['anexos'] = $this->enviar_contratos_anexos($contratos, $id, $dm);
                        }
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
                    $ret['enviar_link_assinatura'] = (new ZapsingController())->enviar_link_assinatura($id, (string)$tk_periodo);
                }
            }
        }
        \Log::info('send_to_zapSing:', $ret);
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
            $nome = $cliente['name']?? $cliente['nome'] ?? '';
            $email = $cliente['email']?? $cliente['email'] ?? '';
            $cpf = $cliente['cpf']?? $cliente['cpf'] ?? '';
            // $celular = $cliente['celular']?? $cliente['celular'] ?? '';
            $tipo_curso = $dm['curso_tipo']?? $dm['curso_tipo'] ?? '';
            $periodo = $dm['orc']['modulos'][0]['nome']?? $dm['orc']['modulos'][0]['nome'] ?? '';
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
                \Log::error('Erro ao criar log de evento zapsign_send_request: ' . $th->getMessage());
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
                \Log::error('Erro ao criar log de evento zapsign_send_response: ' . $th->getMessage());
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
            $campo_envelope = $tk_periodo ? 'enviar_envelope_'.$tk_periodo : 'enviar_envelope';
            $denv_p = Qlib::get_matriculameta($id, $campo_envelope);

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
        $preferences = is_array($user->preferencias) ? $user->preferencias : (is_string($user->preferencias) ? (json_decode($user->preferencias, true) ?? []) : []);
        if (!isset($preferences['pipeline']) || !is_array($preferences['pipeline'])) {
            $preferences['pipeline'] = [];
        }
        $preferences['pipeline']['stage_id'] = $newStageId;
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
        $user->preferencias = $preferences;
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
        $raw_id = $id_matricula;
        $id_matricula = trim((string)$id_matricula);

        // Log de depuração para entender o que está chegando
        \App\Models\EventLog::create([
            'entity_type' => 'matricula',
            'entity_id'   => $id_matricula ?: '0',
            'action'      => 'debug_download',
            'description' => "Processando baixa de arquivo. ID Recebido: '{$raw_id}', Pasta: '{$pasta}', Nome: '{$nome_arquivo}'",
            'actor_id'    => '1',
        ]);

        $num=null;
        $nome_arquivo = $nome_arquivo?$nome_arquivo:'assinado';
        $nome_arquivo = Qlib::createSlug($nome_arquivo);
        $disk = 'public';

        // Caminho físico (sempre o mesmo no storage)
        $caminhoRelativo = 'pdfs/termos/' . ($id_matricula ?: '0');
        if($pasta){
            $caminhoRelativo .= '/' . trim((string)$pasta);
        }
        $caminhoSalvar = $caminhoRelativo . '/' . $nome_arquivo . '.pdf';

        if(Storage::disk($disk)->exists($caminhoSalvar)){
            $num='-'.time();
        }
        $caminhoSalvar = $caminhoRelativo . '/' . $nome_arquivo . $num . '.pdf';

        $ret = Qlib::download_file($url,$caminhoSalvar,$disk);
        $ret['url'] = $url;
        $ret['id_matricula'] = $id_matricula;

        if($ret['exec']){
            $isTenant = false;
            if (function_exists('tenant') && tenant('id')) {
                $isTenant = true;
            } elseif (strpos($_SERVER['HTTP_HOST'] ?? '', 'api-crm.') !== false) {
                $isTenant = true;
            }

            if ($isTenant) {
                $baseUrl = rtrim(env('APP_URL', (isset($_SERVER['HTTPS']) ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? 'localhost')), '/');
                $link = $baseUrl . '/tenancy/assets/' . $caminhoSalvar;
            } else {
                $link = Storage::disk($disk)->url($caminhoSalvar);
            }
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

				$previsao_consumo = 0;
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
							$preco_litro = (float)Qlib::precoDbdase($p_litro);
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
