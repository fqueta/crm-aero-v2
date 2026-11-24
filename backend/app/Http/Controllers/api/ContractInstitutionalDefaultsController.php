<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Services\Ai\Rag\RagIndexerService;
use App\Services\Ai\Rag\Sources\InstitutionalRulesKnowledgeSource;
use App\Services\Contracts\Strategies\InstitutionalRulesShortcodeStrategy;
use App\Services\Qlib;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ContractInstitutionalDefaultsController extends Controller
{
    public function show(): JsonResponse
    {
        $raw = Qlib::qoption(InstitutionalRulesKnowledgeSource::OPTION_KEY);
        $decoded = is_array($raw) ? $raw : (is_string($raw) ? json_decode($raw, true) : []);
        $data = [];

        foreach (InstitutionalRulesShortcodeStrategy::KEYS as $key) {
            $data[$key] = is_array($decoded) && isset($decoded[$key]) ? (string) $decoded[$key] : '';
        }

        return response()->json([
            'data' => $data,
        ]);
    }

    public function update(Request $request, RagIndexerService $indexer): JsonResponse
    {
        $rules = [];
        foreach (InstitutionalRulesShortcodeStrategy::KEYS as $key) {
            $rules[$key] = 'nullable|string|max:2000';
        }
        $validated = $request->validate($rules);

        $payload = [];
        foreach (InstitutionalRulesShortcodeStrategy::KEYS as $key) {
            $payload[$key] = isset($validated[$key]) ? trim((string) $validated[$key]) : '';
        }

        $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
        $optKey = InstitutionalRulesKnowledgeSource::OPTION_KEY;

        $exists = DB::table('options')->where('url', $optKey)->exists();
        if ($exists) {
            DB::table('options')->where('url', $optKey)->update([
                'value' => $json,
                'updated_at' => now(),
            ]);
        } else {
            DB::table('options')->insert([
                'url' => $optKey,
                'name' => 'Padrões Institucionais de Contratos',
                'value' => $json,
                'ativo' => 's',
                'excluido' => 'n',
                'deletado' => 'n',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        // Atualiza base RAG institucional best-effort
        try {
            $indexer->indexSource('institutional_rules');
        } catch (\Throwable $e) {
        }

        return response()->json([
            'message' => 'Configurações institucionais de contratos salvas com sucesso.',
            'data' => $payload,
        ]);
    }
}
