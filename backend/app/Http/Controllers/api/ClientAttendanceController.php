<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientAttendance;
use App\Models\EventLog;
use App\Services\PermissionService;
use Illuminate\Http\Request;

class ClientAttendanceController extends Controller
{
    protected PermissionService $permissionService;

    public function __construct()
    {
        $this->permissionService = new PermissionService();
    }

    /**
     * Atualiza o pipeline do cliente e registra auditoria do movimento de stage.
     * EN: Updates client pipeline and records audit entries for stage changes.
     */
    private function applyClientPipelineStage(Client $client, int $newStageId, ?int $funnelId, string $actorId, string $ip, array $context = []): void
    {
        $config = is_array($client->config)
            ? $client->config
            : (is_string($client->config) ? (json_decode($client->config, true) ?? []) : []);
        $preferencias = is_array($client->preferencias)
            ? $client->preferencias
            : (is_string($client->preferencias) ? (json_decode($client->preferencias, true) ?? []) : []);

        $oldStageId = isset($config['stage_id']) && trim((string) $config['stage_id']) !== ''
            ? (int) $config['stage_id']
            : null;

        $config['stage_id'] = $newStageId;
        if (!is_null($funnelId)) {
            $config['funnelId'] = $funnelId;
        }

        if (!isset($preferencias['pipeline']) || !is_array($preferencias['pipeline'])) {
            $preferencias['pipeline'] = [];
        }
        $preferencias['pipeline']['stage_id'] = $newStageId;

        $client->config = $config;
        $client->preferencias = $preferencias;
        $client->save();

        EventLog::create([
            'entity_type' => 'user',
            'entity_id' => (string) $client->id,
            'action' => 'stage_changed',
            'description' => 'Etapa do cliente alterada via atendimento',
            'payload' => array_merge([
                'from_stage_id' => $oldStageId,
                'to_stage_id' => $newStageId,
            ], $context),
            'actor_id' => $actorId,
            'ip_address' => $ip,
        ]);

        event(new \App\Events\StageChanged(
            'user',
            (string) $client->id,
            $oldStageId,
            $newStageId,
            $actorId,
            $ip,
            $context
        ));
    }

    /**
     * Lista atendimentos de um cliente específico, com paginação opcional.
     *
     * Parâmetros:
     * - per_page: número de itens por página (default: 10)
     * - channel: filtra pelo canal do atendimento (opcional)
     */
    /**
     * @param string $clientId ID do cliente (pode ser inteiro, UUID/ULID)
     */
    public function index(Request $request, string $clientId)
    {
        // Verifica autenticação e permissão
        $user = request()->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('view')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        // Confirma que o cliente existe
        $client = Client::findOrFail($clientId);

        $perPage = (int) $request->input('per_page', 10);
        $query = ClientAttendance::with(['attendant:id,name'])
            ->where('client_id', $client->id)
            ->orderBy('created_at', 'desc');

        if ($request->filled('channel')) {
            $query->where('channel', $request->input('channel'));
        }

        $attendances = $query->paginate($perPage);

        return response()->json($attendances);
    }

    /**
     * Registra um novo atendimento para o cliente.
     *
     * Payload:
     * - channel (opcional): ex.: phone, email, presencial
     * - observation (opcional): texto livre sobre o atendimento
     * - metadata (opcional): objeto/array JSON com metadados livres
     * - stage_id/stageId (opcional): se presente, atualiza o estágio do cliente
     * - funnelId (opcional): se presente junto ao stage_id, persiste como referência de funil
     *
     * Observações:
     * - Caso seja solicitado atualizar o estágio do cliente, será verificada a permissão de 'edit'.
     * - A atualização do estágio respeita o padrão do método de update do ClientController,
     *   persistindo em `config.stage_id` e refletindo em `preferencias.pipeline.stage_id`.
     */
    /**
     * @param string $clientId ID do cliente (pode ser inteiro, UUID/ULID)
     */
    public function store(Request $request, string $clientId)
    {
        // Verifica autenticação e permissão
        $user = request()->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        if (!$this->permissionService->isHasPermission('create')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        // Confirma que o cliente existe
        $client = Client::findOrFail($clientId);

        // Validação
        $validated = $request->validate([
            'channel' => 'nullable|string|max:50',
            'observation' => 'nullable|string',
            'metadata' => 'nullable|array',
            // Aceita stage em snake ou camel
            'stage_id' => 'nullable|integer',
            'stageId' => 'nullable|integer',
            'funnelId' => 'nullable|integer',
        ]);

        // Cria o registro de atendimento
        $attendance = ClientAttendance::create([
            'client_id' => $client->id,
            'attended_by' => $user->id,
            'channel' => $validated['channel'] ?? null,
            'observation' => $validated['observation'] ?? null,
            'metadata' => $validated['metadata'] ?? null,
        ]);
        $attendance->load(['attendant:id,name']);

        EventLog::create([
            'entity_type' => 'client_attendance',
            'entity_id' => (string) $attendance->id,
            'action' => 'created',
            'description' => 'Atendimento do cliente registrado',
            'payload' => [
                'client_id' => (string) $client->id,
                'channel' => $validated['channel'] ?? null,
                'metadata' => $validated['metadata'] ?? null,
            ],
            'actor_id' => (string) $user->id,
            'ip_address' => $request->ip(),
        ]);

        // Atualiza estágio do cliente se solicitado na requisição
        $stageUpdate = false;
        $stageIdFromReq = $request->input('stage_id');
        if ($stageIdFromReq === null) {
            $stageIdFromReq = $request->input('stageId');
        }
        if ($stageIdFromReq !== null) {
            if ($this->permissionService->isHasPermission('edit')) {
                $funnelId = $request->filled('funnelId') ? (int) $request->input('funnelId') : null;
                $this->applyClientPipelineStage(
                    $client,
                    (int) $stageIdFromReq,
                    $funnelId,
                    (string) $user->id,
                    $request->ip(),
                    [
                        'source' => 'client_attendance',
                        'attendance_id' => (string) $attendance->id,
                    ]
                );
                $stageUpdate = true;
            } else {
                $stageUpdate = false;
            }
        }

        return response()->json([
            'message' => 'Atendimento registrado com sucesso',
            'data' => $attendance,
            'stage_update' => $stageUpdate,
        ], 201);
    }
}
