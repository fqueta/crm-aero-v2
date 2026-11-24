<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\InstructionProgram;
use App\Models\InstructionProgramRevision;
use App\Services\Ai\AiChatService;
use App\Services\Ai\InstructionProgramAiEditorService;
use App\Services\Ai\Rag\RagIndexerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class InstructionProgramController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = InstructionProgram::query()->with('curso:id,nome');

        if ($search = trim((string) $request->input('search', ''))) {
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%")
                    ->orWhere('current_revision', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('curso_id')) {
            $query->where('curso_id', (int) $request->input('curso_id'));
        }

        $perPage = min(100, max(5, (int) $request->input('per_page', 15)));
        $items = $query->orderByDesc('updated_at')->paginate($perPage);

        return response()->json($items);
    }

    public function show(int $id): JsonResponse
    {
        $program = InstructionProgram::with(['curso:id,nome,config', 'revisions' => fn ($q) => $q->limit(25)])
            ->findOrFail($id);

        return response()->json([
            'data' => $this->appendSignatureFlags($program),
        ]);
    }

    public function store(Request $request, RagIndexerService $indexer): JsonResponse
    {
        $validated = $this->validatePayload($request);
        $userId = $request->user()?->id ? (string) $request->user()->id : null;

        $slug = $this->resolveUniqueSlug($validated['slug'] ?? $validated['title']);

        $program = InstructionProgram::create(array_merge($validated, [
            'slug' => $slug,
            'current_revision' => $validated['current_revision'] ?? '001',
            'status' => $validated['status'] ?? 'draft',
            'is_public' => $validated['is_public'] ?? true,
            'created_by' => $userId,
            'updated_by' => $userId,
        ]));

        $this->syncCourseSignatureFlags($program, $request);

        if ($program->status === 'published') {
            $program->createRevisionSnapshot('Publicação inicial', false, $userId);
            $this->safeIndexProgram($indexer, $program->id);
        }

        return response()->json([
            'message' => 'Programa de Instrução criado com sucesso.',
            'data' => $this->appendSignatureFlags($program->load('curso:id,nome,config')),
        ], 201);
    }

    public function update(Request $request, int $id, RagIndexerService $indexer): JsonResponse
    {
        $program = InstructionProgram::findOrFail($id);
        $validated = $this->validatePayload($request, $program->id);
        $userId = $request->user()?->id ? (string) $request->user()->id : null;

        if (!empty($validated['slug']) && $validated['slug'] !== $program->slug) {
            $validated['slug'] = $this->resolveUniqueSlug($validated['slug'], $program->id);
        }

        $program->fill(array_merge($validated, [
            'updated_by' => $userId,
        ]));
        $program->save();

        $this->syncCourseSignatureFlags($program, $request);

        if (!empty($request->boolean('create_revision'))) {
            $program->createRevisionSnapshot(
                $request->input('change_notes'),
                (bool) $request->boolean('edited_by_ai'),
                $userId
            );
        }

        if ($program->status === 'published') {
            $this->safeIndexProgram($indexer, $program->id);
        } else {
            try {
                $indexer->removeSource('instruction_program', $program->id);
            } catch (\Throwable $e) {
            }
        }

        return response()->json([
            'message' => 'Programa de Instrução atualizado com sucesso.',
            'data' => $this->appendSignatureFlags($program->fresh(['curso:id,nome,config', 'revisions'])),
        ]);
    }

    public function destroy(int $id, RagIndexerService $indexer): JsonResponse
    {
        $program = InstructionProgram::findOrFail($id);
        $program->delete();

        try {
            $indexer->removeSource('instruction_program', $id);
        } catch (\Throwable $e) {
        }

        return response()->json([
            'message' => 'Programa de Instrução excluído com sucesso.',
        ]);
    }

    /**
     * Publica uma nova revisão imutável (Snapshot) e atualiza o índice RAG.
     */
    public function publishRevision(Request $request, int $id, RagIndexerService $indexer): JsonResponse
    {
        $program = InstructionProgram::findOrFail($id);

        $validated = $request->validate([
            'revision_code' => 'required|string|max:40',
            'revision_date' => 'nullable|date',
            'mgr_revision' => 'nullable|string|max:60',
            'mgr_date' => 'nullable|date',
            'change_notes' => 'nullable|string|max:2000',
            'edited_by_ai' => 'nullable|boolean',
            'content_html' => 'nullable|string',
            'contract_defaults' => 'nullable|array',
        ]);

        $userId = $request->user()?->id ? (string) $request->user()->id : null;

        $program->current_revision = $validated['revision_code'];
        $program->revision_date = $validated['revision_date'] ?? now()->format('Y-m-d');
        if (array_key_exists('mgr_revision', $validated)) {
            $program->mgr_revision = $validated['mgr_revision'];
        }
        if (array_key_exists('mgr_date', $validated)) {
            $program->mgr_date = $validated['mgr_date'];
        }
        if (array_key_exists('content_html', $validated) && $validated['content_html'] !== null) {
            $program->content_html = $validated['content_html'];
        }
        if (array_key_exists('contract_defaults', $validated) && is_array($validated['contract_defaults'])) {
            $program->contract_defaults = $validated['contract_defaults'];
        }
        $program->status = 'published';
        $program->updated_by = $userId;
        $program->save();

        $revision = $program->createRevisionSnapshot(
            $validated['change_notes'] ?? 'Nova revisão publicada',
            (bool) ($validated['edited_by_ai'] ?? false),
            $userId
        );

        $ragReport = $this->safeIndexProgram($indexer, $program->id);

        return response()->json([
            'message' => 'Revisão publicada com sucesso.',
            'data' => $program->fresh(['curso:id,nome', 'revisions']),
            'revision' => $revision,
            'rag' => $ragReport,
        ]);
    }

    public function revisions(int $id): JsonResponse
    {
        $program = InstructionProgram::findOrFail($id);

        return response()->json([
            'data' => $program->revisions()->get(),
        ]);
    }

    public function restoreRevision(Request $request, int $id, int $revisionId, RagIndexerService $indexer): JsonResponse
    {
        $program = InstructionProgram::findOrFail($id);
        $revision = InstructionProgramRevision::where('instruction_program_id', $program->id)
            ->findOrFail($revisionId);

        $userId = $request->user()?->id ? (string) $request->user()->id : null;

        $program->current_revision = $revision->revision_code;
        $program->revision_date = $revision->revision_date;
        $program->mgr_revision = $revision->mgr_revision;
        $program->mgr_date = $revision->mgr_date;
        $program->content_html = $revision->content_html;
        $program->contract_defaults = $revision->contract_defaults;
        $program->updated_by = $userId;
        $program->save();

        if ($program->status === 'published') {
            $this->safeIndexProgram($indexer, $program->id);
        }

        return response()->json([
            'message' => "Revisão {$revision->revision_code} restaurada com sucesso.",
            'data' => $program->fresh(['curso:id,nome', 'revisions']),
        ]);
    }

    /**
     * Edição assistida por IA (retorna proposta + diff/metadados para confirmação do admin).
     */
    public function aiEdit(Request $request, int $id, InstructionProgramAiEditorService $editor): JsonResponse
    {
        $program = InstructionProgram::findOrFail($id);

        $validated = $request->validate([
            'instruction' => 'required|string|max:4000',
            'history' => 'nullable|array',
            'draft' => 'nullable|array',
        ]);

        try {
            $proposal = $editor->proposeEdit(
                $program,
                $validated['instruction'],
                $validated['history'] ?? [],
                $validated['draft'] ?? []
            );

            return response()->json([
                'success' => true,
                'data' => $proposal,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Reindexa toda a base RAG (Programas de Instrução + Regras Institucionais).
     */
    public function reindexRag(RagIndexerService $indexer): JsonResponse
    {
        try {
            $report = $indexer->indexAll();

            return response()->json([
                'success' => true,
                'message' => 'Base de conhecimento RAG reindexada com sucesso.',
                'data' => $report,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Falha ao reindexar RAG: ' . $e->getMessage(),
            ], 500);
        }
    }

    // ==================== ROTAS PÚBLICAS ====================

    public function publicIndex(): JsonResponse
    {
        $programs = InstructionProgram::query()
            ->with('curso:id,nome')
            ->where('status', 'published')
            ->where('is_public', true)
            ->orderBy('title')
            ->get([
                'id',
                'curso_id',
                'title',
                'slug',
                'code',
                'current_revision',
                'revision_date',
                'mgr_revision',
                'mgr_date',
                'summary',
                'updated_at',
            ]);

        return response()->json([
            'data' => $programs,
        ]);
    }

    public function publicShow(string $slug): JsonResponse
    {
        $program = InstructionProgram::query()
            ->with([
                'curso:id,nome',
                'revisions' => fn ($q) => $q->select([
                    'id',
                    'instruction_program_id',
                    'revision_code',
                    'revision_date',
                    'mgr_revision',
                    'mgr_date',
                    'change_notes',
                    'created_at',
                ])->limit(15),
            ])
            ->where('slug', $slug)
            ->where('status', 'published')
            ->where('is_public', true)
            ->first();

        if (!$program) {
            return response()->json([
                'message' => 'Programa de Instrução não encontrado ou não publicado.',
            ], 404);
        }

        return response()->json([
            'data' => $program,
        ]);
    }

    public function publicChat(Request $request, string $slug, AiChatService $chatService): JsonResponse
    {
        $validated = $request->validate([
            'message' => 'required|string|max:1000',
            'history' => 'nullable|array|max:12',
        ]);

        $program = InstructionProgram::query()
            ->where('slug', $slug)
            ->where('status', 'published')
            ->where('is_public', true)
            ->first();

        if (!$program) {
            return response()->json([
                'success' => false,
                'message' => 'Programa de Instrução não encontrado.',
            ], 404);
        }

        try {
            $result = $chatService->publicProgramChat(
                $program,
                $validated['message'],
                $validated['history'] ?? []
            );

            return response()->json([
                'success' => true,
                'data' => $result,
            ]);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage(),
            ], 500);
        }
    }

    protected function validatePayload(Request $request, ?int $ignoreId = null): array
    {
        return $request->validate([
            'curso_id' => 'nullable|integer',
            'title' => 'required|string|max:255',
            'slug' => 'nullable|string|max:255',
            'code' => 'nullable|string|max:60',
            'current_revision' => 'nullable|string|max:40',
            'revision_date' => 'nullable|date',
            'mgr_revision' => 'nullable|string|max:60',
            'mgr_date' => 'nullable|date',
            'status' => 'nullable|in:draft,published,archived',
            'is_public' => 'nullable|boolean',
            'summary' => 'nullable|string|max:2000',
            'content_html' => 'nullable|string',
            'contract_defaults' => 'nullable|array',
        ]);
    }

    protected function resolveUniqueSlug(string $source, ?int $ignoreId = null): string
    {
        $base = Str::slug($source) ?: 'programa-instrucao';
        $slug = $base;
        $counter = 2;

        while (
            InstructionProgram::withTrashed()
                ->where('slug', $slug)
                ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
                ->exists()
        ) {
            $slug = "{$base}-{$counter}";
            $counter++;
        }

        return $slug;
    }

    protected function safeIndexProgram(RagIndexerService $indexer, int $programId): ?array
    {
        try {
            return $indexer->indexSource('instruction_program', $programId);
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * Anexa ao JSON do PI as flags de exibição/aceite configuradas no curso vinculado.
     */
    protected function appendSignatureFlags(InstructionProgram $program): array
    {
        $arr = $program->toArray();
        $cursoConfig = $program->curso?->config ?? [];
        if (is_string($cursoConfig)) {
            $cursoConfig = json_decode($cursoConfig, true) ?? [];
        }
        $arr['signature_show_pi_link'] = !empty($cursoConfig['signature_show_pi_link']);
        $arr['signature_require_pi_acceptance'] = !empty($cursoConfig['signature_require_pi_acceptance']);
        if (isset($arr['curso']) && is_array($arr['curso'])) {
            unset($arr['curso']['config']);
        }

        return $arr;
    }

    /**
     * Sincroniza os switches de exibição/aceite na assinatura diretamente no config do curso vinculado.
     */
    protected function syncCourseSignatureFlags(InstructionProgram $program, Request $request): void
    {
        if (!$program->curso_id) {
            return;
        }
        if (!$request->has('signature_show_pi_link') && !$request->has('signature_require_pi_acceptance')) {
            return;
        }

        try {
            $curso = \App\Models\Curso::find((int) $program->curso_id);
            if (!$curso) {
                return;
            }
            $cfg = is_array($curso->config)
                ? $curso->config
                : (is_string($curso->config) ? (json_decode($curso->config, true) ?? []) : []);

            if ($request->has('signature_show_pi_link')) {
                $cfg['signature_show_pi_link'] = $request->boolean('signature_show_pi_link');
            }
            if ($request->has('signature_require_pi_acceptance')) {
                $reqAcc = $request->boolean('signature_require_pi_acceptance');
                $cfg['signature_require_pi_acceptance'] = $reqAcc;
                if ($reqAcc) {
                    $cfg['signature_show_pi_link'] = true;
                }
            }
            if (empty($cfg['signature_show_pi_link'])) {
                $cfg['signature_require_pi_acceptance'] = false;
            }

            $curso->config = $cfg;
            $curso->save();
        } catch (\Throwable $e) {
        }
    }
}
