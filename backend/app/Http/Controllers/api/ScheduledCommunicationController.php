<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\ScheduledCommunication;
use App\Services\PermissionService;
use App\Services\ScheduledCommunication\ScheduledCommunicationService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ScheduledCommunicationController extends Controller
{
    protected PermissionService $permissionService;

    public function __construct(
        protected ScheduledCommunicationService $service
    ) {
        $this->permissionService = new PermissionService();
    }

    /**
     * index
     * pt-BR: Lista os agendamentos com filtros operacionais para o painel de acompanhamento.
     * en-US: Lists scheduled communications with operational filters for the tracking panel.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user || !$this->permissionService->isHasPermission('view')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $perPage = (int) $request->input('per_page', 20);
        $search = trim((string) $request->input('search', ''));

        $query = ScheduledCommunication::with([
            'client:id,name,email',
            'matricula:id,id_cliente,id_curso,total,subtotal',
            'matricula.cliente:id,name,email',
            'matricula.curso:id,nome,titulo',
            'creator:id,name',
        ])->orderByDesc('scheduled_at');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('channel')) {
            $query->where('channel', $request->input('channel'));
        }

        if ($request->filled('matricula_id')) {
            $query->where('matricula_id', $request->input('matricula_id'));
        }

        if ($request->filled('client_id')) {
            $query->where('client_id', $request->input('client_id'));
        }

        if ($request->filled('scheduled_from')) {
            $query->where('scheduled_at', '>=', Carbon::parse((string) $request->input('scheduled_from'))->startOfDay());
        }

        if ($request->filled('scheduled_to')) {
            $query->where('scheduled_at', '<=', Carbon::parse((string) $request->input('scheduled_to'))->endOfDay());
        }

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder->where('recipient_name', 'like', '%' . $search . '%')
                    ->orWhere('recipient_email', 'like', '%' . $search . '%')
                    ->orWhere('subject', 'like', '%' . $search . '%')
                    ->orWhere('message', 'like', '%' . $search . '%')
                    ->orWhere('id', is_numeric($search) ? (int) $search : 0)
                    ->orWhereHas('matricula.cliente', function ($subQuery) use ($search) {
                        $subQuery->where('name', 'like', '%' . $search . '%')
                            ->orWhere('email', 'like', '%' . $search . '%');
                    });
            });
        }

        return response()->json($query->paginate($perPage));
    }

    /**
     * store
     * pt-BR: Cria agendamentos em lote para as propostas selecionadas.
     * en-US: Creates scheduled communications in batch for the selected proposals.
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user || !$this->permissionService->isHasPermission('create')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $validated = $request->validate([
            'channel' => 'required|string|in:email,manual',
            'subject' => 'nullable|string|max:255',
            'message' => 'required|string',
            'scheduled_at' => 'required|date',
            'matricula_ids' => 'required|array|min:1',
            'matricula_ids.*' => 'required|integer',
            'recipient_email' => 'nullable|email|max:255',
            'recipient_name' => 'nullable|string|max:255',
            'signature_link' => 'nullable|string|max:1000',
            'app_url' => 'nullable|string|max:255',
            'max_attempts' => 'nullable|integer|min:1|max:10',
            'tags' => 'nullable|array',
            'tags.*' => 'nullable|string|max:50',
            'create_attendance_log' => 'nullable|boolean',
        ]);

        $result = $this->service->scheduleBatch(
            $validated['matricula_ids'],
            $validated,
            $user,
            (string) $request->ip()
        );

        return response()->json([
            'message' => 'Agendamentos processados com sucesso.',
            'data' => $result['created'],
            'summary' => [
                'created_count' => count($result['created']),
                'skipped_count' => count($result['skipped']),
                'skipped' => $result['skipped'],
            ],
        ], 201);
    }

    /**
     * show
     * pt-BR: Retorna um agendamento específico com seus relacionamentos principais.
     * en-US: Returns a single scheduled communication with its main relationships.
     */
    public function show(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user || !$this->permissionService->isHasPermission('view')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $communication = ScheduledCommunication::with([
            'client:id,name,email',
            'matricula:id,id_cliente,id_curso,total,subtotal',
            'matricula.cliente:id,name,email',
            'matricula.curso:id,nome,titulo',
            'creator:id,name',
        ])->findOrFail($id);

        return response()->json($communication);
    }

    /**
     * cancel
     * pt-BR: Cancela um agendamento pendente ou com falha.
     * en-US: Cancels a pending or failed scheduled communication.
     */
    public function cancel(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user || !$this->permissionService->isHasPermission('edit')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $communication = ScheduledCommunication::findOrFail($id);
        $communication = $this->service->cancel($communication, $user, (string) $request->ip());

        return response()->json([
            'message' => 'Agendamento cancelado com sucesso.',
            'data' => $communication,
        ]);
    }

    /**
     * retry
     * pt-BR: Reenfileira um agendamento para nova tentativa.
     * en-US: Requeues a scheduled communication for another attempt.
     */
    public function retry(Request $request, int $id)
    {
        $user = $request->user();
        if (!$user || !$this->permissionService->isHasPermission('edit')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $validated = $request->validate([
            'scheduled_at' => 'nullable|date',
        ]);

        $communication = ScheduledCommunication::findOrFail($id);
        $scheduledAt = !empty($validated['scheduled_at'])
            ? Carbon::parse((string) $validated['scheduled_at'])
            : null;

        $communication = $this->service->retry($communication, $scheduledAt, $user, (string) $request->ip());

        return response()->json([
            'message' => 'Agendamento reenfileirado com sucesso.',
            'data' => $communication,
        ]);
    }

    /**
     * destroy
     * pt-BR: Remove permanentemente um agendamento.
     * en-US: Permanently deletes a scheduled communication.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$this->permissionService->isHasPermission('delete')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }

        $communication = ScheduledCommunication::findOrFail($id);
        $communication->delete();

        return response()->json(['message' => 'Agendamento removido com sucesso.']);
    }
}
