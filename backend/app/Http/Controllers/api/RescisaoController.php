<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\Rescisao;
use App\Models\Matricula;
use App\Models\Post;
use App\Models\User;
use App\Services\PermissionService;
use App\Http\Controllers\api\MatriculaController;
use App\Http\Controllers\api\PdfController;
use App\Services\Qlib;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;


class RescisaoController extends Controller
{
    protected PermissionService $permissionService;

    public function __construct()
    {
        $this->permissionService = new PermissionService();
    }

    /**
     * List terminations with pagination and search.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        // if (!$this->permissionService->isHasPermission('view')) {
        //     return response()->json(['error' => 'Acesso negado'], 403);
        // }

        $perPage = (int) $request->input('per_page', 10);
        $orderBy = $request->input('order_by', 'created_at');
        $order = $request->input('order', 'desc');

        $query = Rescisao::with(['matricula.cliente', 'matricula.curso'])->orderBy($orderBy, $order);

        // Search by student name or matricula ID
        if ($search = $request->input('search')) {
            $query->where(function($q) use ($search) {
                $q->whereHas('matricula.cliente', function($cQ) use ($search) {
                    $cQ->where('name', 'like', "%{$search}%");
                })->orWhere('matricula_id', $search);
            });
        }

        $rescisoes = $query->paginate($perPage);
        return response()->json($rescisoes);
    }

    /**
     * Retrieve a specific termination.
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        // if (!$this->permissionService->isHasPermission('view')) {
        //     return response()->json(['error' => 'Acesso negado'], 403);
        // }

        $rescisao = Rescisao::with(['matricula.cliente', 'matricula.curso'])->find($id);
        if (!$rescisao) {
            return response()->json(['error' => 'Rescisão não encontrada'], 404);
        }

        // Auto-generate public token if missing
        $config = $rescisao->config ?? [];
        if (!isset($config['token']) || empty($config['token'])) {
            $config['token'] = (string) \Illuminate\Support\Str::uuid();
            $rescisao->config = $config;
            $rescisao->save();
        }

        return response()->json([
            'data' => $rescisao,
            'message' => 'Rescisão encontrada',
        ], 200);
    }

    /**
     * Public show by token — no auth required.
     */
    public function publicShow($token)
    {
        $rescisao = Rescisao::with(['matricula.cliente', 'matricula.curso'])
            ->where('config->token', $token)
            ->first();

        if (!$rescisao) {
            return response()->json(['error' => 'Rescisão não encontrada'], 404);
        }

        $termoHtml = $this->buildTermoHtml($rescisao);

        return response()->json([
            'data' => $rescisao,
            'termo_html' => $termoHtml,
        ], 200);
    }

    public function signTermo($token)
    {
        $rescisao = Rescisao::with(['matricula.cliente'])
            ->where('config->token', $token)
            ->first();

        if (!$rescisao || !$rescisao->matricula || !$rescisao->matricula->cliente) {
            return response()->json(['error' => 'Rescisão ou matrícula não encontrada'], 404);
        }

        $matricula = $rescisao->matricula;
        $cliente = $matricula->cliente;

        $nomeArquivo = 'termo_rescisao_' . $rescisao->id . '_' . date('Ymd');
        $pasta = 'rescisoes';

        // 1. Generate termo PDF
        $termoHtml = $this->buildTermoHtml($rescisao);
        $pdfConfig = [
            'html' => $termoHtml,
            'nome_aquivo_savo' => $nomeArquivo,
            'titulo' => 'Termo de Rescisão',
            'pasta' => $pasta,
            'id_matricula' => $matricula->id,
            'short_code' => 'termo_rescisao',
            'use_header_footer' => false,
            'f_exibe' => 'server',
        ];
        $pdfResult = (new PdfController())->convert_html($pdfConfig);

        if (!$pdfResult['exec'] ?? false) {
            return response()->json(['error' => 'Erro ao gerar PDF: ' . ($pdfResult['error'] ?? '')], 500);
        }

        $pdfUrl = $pdfResult['url'] ?? null;
        if (!$pdfUrl) {
            return response()->json(['error' => 'URL do PDF não gerada'], 500);
        }

        // 2. Send to ZapSign
        $nomeContratada = User::where('token', 'id_contatada')->first();
        $signers = [];
        $signers[] = [
            "name" => $cliente->name,
            "email" => $cliente->email,
            "cpf" => $cliente->cpf,
            "send_automatic_email" => true,
            "send_automatic_whatsapp" => false,
            "auth_mode" => "CPF",
            "order_group" => 1,
        ];
        if ($nomeContratada) {
            $signers[] = [
                "name" => $nomeContratada->name,
                "email" => $nomeContratada->email,
                "cpf" => $nomeContratada->cpf,
                "send_automatic_email" => true,
                "send_automatic_whatsapp" => false,
                "auth_mode" => "CPF",
                "order_group" => 2,
            ];
        }

        $zapsignPayload = [
            "name" => 'Termo de Rescisão - ' . $cliente->name . ' #' . $rescisao->id,
            "url_pdf" => $pdfUrl,
            "external_id" => 'resc_' . $rescisao->id . '_' . $matricula->id,
            "folder_path" => '/CRM/Rescisoes',
            "signers" => $signers,
            "lang" => "pt-br",
            "signature_order_active" => true,
        ];

        $zapsignResponse = (new \App\Http\Controllers\api\ZapsingController())->post([
            "endpoint" => 'docs',
            "body" => $zapsignPayload,
        ]);

        if (!$zapsignResponse['exec'] ?? false) {
            return response()->json(['error' => 'Erro ao enviar para ZapSign'], 500);
        }

        // Save zapsign data and pdf url in rescison config
        $rescisaoConfig = $rescisao->config ?? [];
        $rescisaoConfig['zapsign_token'] = $zapsignResponse['response']['token'] ?? null;
        $rescisaoConfig['zapsign_data'] = $zapsignResponse;
        $rescisaoConfig['pdf_url'] = $pdfUrl;
        $rescisao->config = $rescisaoConfig;
        $rescisao->status = Rescisao::STATUS_SENT;
        $rescisao->save();

        try {
            \App\Models\EventLog::create([
                'entity_type' => 'rescisao',
                'entity_id'   => (string)$rescisao->id,
                'action'      => 'zapsign_sent',
                'description' => 'Rescisão enviada para assinatura digital (ZapSign)',
                'payload'     => [
                    'status' => $rescisao->status,
                    'zapsign_token' => $rescisaoConfig['zapsign_token'],
                    'pdf_url' => $pdfUrl,
                ],
                'actor_id'    => '1',
                'ip_address'  => request()->ip(),
            ]);
        } catch (\Throwable $e) {
            // Don't break the main flow
        }

        $signUrl = $zapsignResponse['response']['signers'][0]['sign_url'] ?? null;

        return response()->json([
            'exec' => true,
            'sign_url' => $signUrl,
            'pdf_url' => $pdfUrl,
        ], 200);
    }

    protected function buildTermoHtml($rescisao)
    {
        $component = Post::where('post_type', 'componentes')
            ->where('post_name', 'termo_rescisao')
            ->where('post_status', 'publish')
            ->first();

        if (!$component) {
            return '<p>Componente "termo_rescisao" não encontrado.</p>';
        }

        $content = $component->post_content;

        $matricula = $rescisao->matricula;
        $cliente = $matricula?->cliente;

        $endereco = $this->formatClienteEndereco($cliente);

        $contratoNum = (new MatriculaController)->numero_contrato($rescisao->matricula_id);

        $meses = ['JANEIRO','FEVEREIRO','MARÇO','ABRIL','MAIO','JUNHO','JULHO','AGOSTO','SETEMBRO','OUTUBRO','NOVEMBRO','DEZEMBRO'];
        $mesNum = (int)date('m', strtotime($rescisao->data_rescisao));
        $mesExt = $meses[$mesNum - 1] ?? '';

        $config = $rescisao->config ?? [];
        $aeronaves = $config['aeronaves'] ?? [];
        $totalHorasVoadas = 0;
        $totalHorasValor = 0;
        foreach ($aeronaves as $ac) {
            $totalHorasVoadas += (float)($ac['quantidade'] ?? 0);
            $totalHorasValor += (float)($ac['total'] ?? 0);
        }
        $horasRestantes = max(0, (int)$rescisao->horas_compradas - (int)$totalHorasVoadas);

        $replacements = [
            'numero_contrato' => $contratoNum,
            'nome_aluno' => $cliente->name ?? '',
            'canac' => $cliente->config['canac'] ?? '',
            'cpf' => $cliente->cpf ?? '',
            'endereco' => $endereco,
            'valor_inicial' => 'R$ ' . number_format((float)$rescisao->valor_inicial, 2, ',', '.'),
            'valor_pago_ate_rescisao' => 'R$ ' . number_format((float)$rescisao->valor_pago, 2, ',', '.'),
            'tabela_multa' => $this->buildTabelaMulta($rescisao),
            'tabela_matricula' => $this->buildTabelaMatricula($rescisao),
            'tabela_horas_voadas' => $this->buildTabelaHorasVoadas($aeronaves, $totalHorasVoadas, $totalHorasValor),
            'tabela_alojamento' => $this->buildTabelaAlojamento($rescisao),
            'tabela_resumo' => $this->buildTabelaResumo($rescisao, $totalHorasValor),
            'previsao_pagamento' => $this->buildPrevisaoPagamento($rescisao),
            'assinatura' => $this->buildAssinatura($cliente),
            'dia' => date('d', strtotime($rescisao->data_rescisao)),
            'mes' => $mesExt,
            'ano' => date('Y', strtotime($rescisao->data_rescisao)),
        ];

        $search = [];
        $replace = [];
        foreach ($replacements as $key => $val) {
            $search[] = '{' . $key . '}';
            $replace[] = (string)$val;
        }

        return str_replace($search, $replace, $content);
    }

    protected function buildTabelaMulta($rescisao): string
    {
        $multa = (float)$rescisao->multa_rescisoria;
        $pct = 30;
        return '
        <table style="width:100%;border-collapse:collapse;margin:10px 0">
            <tr>
                <td style="padding:8px;border:1px solid #ccc;"><strong>Multa Rescisória</strong></td>
                <td style="padding:8px;border:1px solid #ccc;text-align:right;">' . $pct . ',00%</td>
                <td style="padding:8px;border:1px solid #ccc;text-align:right;">R$ ' . number_format($multa, 2, ',', '.') . '</td>
            </tr>
        </table>';
    }

    protected function buildTabelaMatricula($rescisao): string
    {
        $valor = (float)$rescisao->valor_matricula;
        return '
        <table style="width:100%;border-collapse:collapse;margin:10px 0">
            <tr>
                <td style="padding:8px;border:1px solid #ccc;"><strong>Matrícula</strong></td>
                <td style="padding:8px;border:1px solid #ccc;text-align:right;">R$ ' . number_format($valor, 2, ',', '.') . '</td>
            </tr>
        </table>';
    }

    protected function buildTabelaHorasVoadas(array $aeronaves, float $totalQtd, float $totalValor): string
    {
        $linhas = '';
        foreach ($aeronaves as $ac) {
            $nome = $ac['nome'] ?? '';
            $rate = (float)($ac['hora_rescisao'] ?? 0);
            $qtd = (float)($ac['quantidade'] ?? 0);
            $total = (float)($ac['total'] ?? 0);
            $linhas .= '
            <tr>
                <td style="padding:8px;border:1px solid #ccc;">' . htmlspecialchars($nome) . '</td>
                <td style="padding:8px;border:1px solid #ccc;text-align:right;">R$ ' . number_format($rate, 2, ',', '.') . '</td>
                <td style="padding:8px;border:1px solid #ccc;text-align:right;">' . number_format($qtd, 1) . '</td>
                <td style="padding:8px;border:1px solid #ccc;text-align:right;">R$ ' . number_format($total, 2, ',', '.') . '</td>
            </tr>';
        }
        return '
        <table style="width:100%;border-collapse:collapse;margin:10px 0">
            <thead>
                <tr style="background:#f5f5f5;">
                    <th style="padding:8px;border:1px solid #ccc;text-align:left;">Aeronave</th>
                    <th style="padding:8px;border:1px solid #ccc;text-align:right;">Valor</th>
                    <th style="padding:8px;border:1px solid #ccc;text-align:right;">Horas</th>
                    <th style="padding:8px;border:1px solid #ccc;text-align:right;">Valor</th>
                </tr>
            </thead>
            <tbody>' . $linhas . '
                <tr style="font-weight:bold;background:#f9f9f9;">
                    <td style="padding:8px;border:1px solid #ccc;">Totais</td>
                    <td style="padding:8px;border:1px solid #ccc;"></td>
                    <td style="padding:8px;border:1px solid #ccc;text-align:right;">' . number_format($totalQtd, 1) . '</td>
                    <td style="padding:8px;border:1px solid #ccc;text-align:right;">R$ ' . number_format($totalValor, 2, ',', '.') . '</td>
                </tr>
            </tbody>
        </table>';
    }

    protected function buildTabelaAlojamento($rescisao): string
    {
        $dias = (int)$rescisao->dias_alojamento;
        $preco = (float)$rescisao->preco_diaria;
        $total = (float)$rescisao->valor_alojamento;
        if ($dias <= 0) return '';
        return '
        <table style="width:100%;border-collapse:collapse;margin:10px 0">
            <thead>
                <tr style="background:#f5f5f5;">
                    <th style="padding:8px;border:1px solid #ccc;text-align:left;">Alojamento</th>
                    <th style="padding:8px;border:1px solid #ccc;text-align:right;">Preço da Diária</th>
                    <th style="padding:8px;border:1px solid #ccc;text-align:right;">Qtd de Diárias</th>
                    <th style="padding:8px;border:1px solid #ccc;text-align:right;">Total de alojamento</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding:8px;border:1px solid #ccc;"></td>
                    <td style="padding:8px;border:1px solid #ccc;text-align:right;">R$ ' . number_format($preco, 2, ',', '.') . '</td>
                    <td style="padding:8px;border:1px solid #ccc;text-align:right;">' . $dias . '</td>
                    <td style="padding:8px;border:1px solid #ccc;text-align:right;">R$ ' . number_format($total, 2, ',', '.') . '</td>
                </tr>
            </tbody>
        </table>';
    }

    protected function buildTabelaResumo($rescisao, float $totalHorasValor): string
    {
        $pago = (float)$rescisao->valor_pago;
        $multa = (float)$rescisao->multa_rescisoria;
        $matricula = (float)$rescisao->valor_matricula;
        $alojamento = (float)$rescisao->valor_alojamento;
        $saldo = (float)$rescisao->saldo_final;

        return '
        <table style="width:100%;border-collapse:collapse;margin:10px 0">
            <thead>
                <tr style="background:#f5f5f5;">
                    <th style="padding:8px;border:1px solid #ccc;text-align:left;" colspan="2">Resumo</th>
                </tr>
            </thead>
            <tbody>
                <tr><td style="padding:8px;border:1px solid #ccc;">Valor pago até a recisão</td><td style="padding:8px;border:1px solid #ccc;text-align:right;">R$ ' . number_format($pago, 2, ',', '.') . '</td></tr>
                <tr><td style="padding:8px;border:1px solid #ccc;">Multa Rescisória</td><td style="padding:8px;border:1px solid #ccc;text-align:right;">- R$ ' . number_format($multa, 2, ',', '.') . '</td></tr>
                <tr><td style="padding:8px;border:1px solid #ccc;">Matrícula</td><td style="padding:8px;border:1px solid #ccc;text-align:right;">- R$ ' . number_format($matricula, 2, ',', '.') . '</td></tr>
                <tr><td style="padding:8px;border:1px solid #ccc;">Valor Total Horas Voadas</td><td style="padding:8px;border:1px solid #ccc;text-align:right;">- R$ ' . number_format($totalHorasValor, 2, ',', '.') . '</td></tr>
                <tr><td style="padding:8px;border:1px solid #ccc;">Valor Total Alojamento</td><td style="padding:8px;border:1px solid #ccc;text-align:right;">- R$ ' . number_format($alojamento, 2, ',', '.') . '</td></tr>
                <tr style="font-weight:bold;background:#f0f0f0;">
                    <td style="padding:8px;border:1px solid #ccc;">Total geral</td>
                    <td style="padding:8px;border:1px solid #ccc;text-align:right;">R$ ' . number_format($saldo, 2, ',', '.') . '</td>
                </tr>
            </tbody>
        </table>';
    }

    protected function buildPrevisaoPagamento($rescisao): string
    {
        $saldo = (float)$rescisao->saldo_final;
        if ($saldo >= 0) {
            return '<p>O valor de R$ ' . number_format($saldo, 2, ',', '.') . ' será reembolsado ao contratante em até 90 (noventa) dias úteis, contados após 30 (trinta) dias da solicitação formal do pedido de rescisão, em 12 (doze) parcelas mensais ou em uma única parcela ao final da 12º parcela, a critério da CONTRATADA.</p>';
        }
        return '<p>O contratante possui um débito de R$ ' . number_format(abs($saldo), 2, ',', '.') . ' a ser pago à escola.</p>';
    }

    protected function buildAssinatura($cliente): string
    {
        $nome = $cliente->name ?? '________________________';
        return '
        <div style="text-align:center;">
            <div style="display:inline-block;width:250px;margin:0 20px;">
                <div style="border-top:1px solid #000;padding-top:5px;margin-bottom:20px;">
                    <p style="margin:0;">' . htmlspecialchars($nome) . '</p>
                    <p style="margin:0;font-size:12px;">Aluno(a)</p>
                </div>
            </div>
            <div style="display:inline-block;width:250px;margin:0 20px;">
                <div style="border-top:1px solid #000;padding-top:5px;margin-bottom:20px;">
                    <p style="margin:0;">Aeroclube de Juiz de Fora</p>
                    <p style="margin:0;font-size:12px;">Contratada</p>
                </div>
            </div>
            <div style="display:inline-block;width:250px;margin:0 20px;">
                <div style="border-top:1px solid #000;padding-top:5px;margin-bottom:20px;">
                    <p style="margin:0;">Testemunha</p>
                </div>
            </div>
        </div>';
    }

    protected function formatClienteEndereco($cliente): string
    {
        if (!$cliente) return '';
        $config = $cliente->config ?? [];
        $parts = [
            $config['endereco'] ?? '',
            $config['numero'] ?? '',
            $config['bairro'] ?? '',
            $config['cidade'] ?? '',
            $config['estado'] ?? '',
        ];
        $cep = $config['cep'] ?? '';
        $end = implode(', ', array_filter($parts));
        if ($cep) $end .= ' - CEP: ' . $cep;
        return $end ?: $cliente->endereco ?? '';
    }

    /**
     * Create a new termination.
     */
    public function store(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        // if (!$this->permissionService->isHasPermission('create')) {
        //     return response()->json(['error' => 'Acesso negado'], 403);
        // }

        $validator = Validator::make($request->all(), [
            'matricula_id'     => 'required|exists:matriculas,id',
            'data_rescisao'    => 'required|date',
            'valor_pago'       => 'required|numeric',
            'valor_matricula'  => 'required|numeric',
            'valor_inicial'    => 'required|numeric',
            'horas_compradas'  => 'required|integer',
            'horas_voadas'     => 'required|numeric',
            'multa_rescisoria' => 'required|numeric',
            'dias_alojamento'  => 'required|integer',
            'preco_diaria'     => 'required|numeric',
            'valor_alojamento' => 'required|numeric',
            'saldo_final'      => 'required|numeric',
            'config'           => 'nullable|array',
            'obs'              => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Erro de validação',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();

        $rescisao = DB::transaction(function() use ($validated, $user) {
            // Generate unique token for public access
            $config = $validated['config'] ?? [];
            $config['token'] = (string) \Illuminate\Support\Str::uuid();
            $validated['config'] = $config;
            $validated['status'] = Rescisao::STATUS_PENDING;

            $rescisao = Rescisao::create($validated);

            // Automatically update related Matricula to show it is terminated
            // e.g. finding a Post matching 'Rescindido' situation if it exists, or just storing inside config.
            $matricula = Matricula::find($validated['matricula_id']);
            if ($matricula) {
                $config = $matricula->config ?? [];
                $config['rescisao_id'] = $rescisao->id;
                $config['data_rescisao'] = $validated['data_rescisao'];

                // If there's an 'excluido' situation post we can also assign it, or just set status
                $matricula->update([
                    'config' => $config,
                    // If school allows custom situation logic:
                    // we could search for situacao_id that matches 'Rescindido' or set one here.
                ]);
            }

            return $rescisao;
        });

        try {
            \App\Models\EventLog::create([
                'entity_type' => 'rescisao',
                'entity_id'   => (string)$rescisao->id,
                'action'      => 'created',
                'description' => 'Rescisão criada para matrícula #' . $rescisao->matricula_id,
                'payload'     => ['status' => $rescisao->status, 'matricula_id' => $rescisao->matricula_id],
                'actor_id'    => (string)$user->id,
                'ip_address'  => $request->ip(),
            ]);
        } catch (\Throwable $e) {
            // Don't break the main flow
        }

        return response()->json([
            'data' => $rescisao,
            'message' => 'Rescisão cadastrada com sucesso',
            'status' => 201
        ], 201);
    }

    /**
     * Update a termination.
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        // if (!$this->permissionService->isHasPermission('edit')) {
        //     return response()->json(['error' => 'Acesso negado'], 403);
        // }

        $rescisao = Rescisao::find($id);
        if (!$rescisao) {
            return response()->json(['error' => 'Rescisão não encontrada'], 404);
        }

        $validator = Validator::make($request->all(), [
            'data_rescisao'    => 'sometimes|required|date',
            'valor_pago'       => 'sometimes|required|numeric',
            'valor_matricula'  => 'sometimes|required|numeric',
            'valor_inicial'    => 'sometimes|required|numeric',
            'horas_compradas'  => 'sometimes|required|integer',
            'horas_voadas'     => 'sometimes|required|numeric',
            'multa_rescisoria' => 'sometimes|required|numeric',
            'dias_alojamento'  => 'sometimes|required|integer',
            'preco_diaria'     => 'sometimes|required|numeric',
            'valor_alojamento' => 'sometimes|required|numeric',
            'saldo_final'      => 'sometimes|required|numeric',
            'config'           => 'nullable|array',
            'obs'              => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Erro de validação',
                'errors'  => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();

        // Ensure token exists in config
        $mergedConfig = array_merge($rescisao->config ?? [], $validated['config'] ?? []);
        if (!isset($mergedConfig['token']) || empty($mergedConfig['token'])) {
            $mergedConfig['token'] = (string) \Illuminate\Support\Str::uuid();
        }
        $validated['config'] = $mergedConfig;

        $rescisao->update($validated);

        return response()->json([
            'data' => $rescisao,
            'message' => 'Rescisão atualizada com sucesso',
        ], 200);
    }

    /**
     * Delete a termination (soft delete).
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        // if (!$this->permissionService->isHasPermission('delete')) {
        //     return response()->json(['error' => 'Acesso negado'], 403);
        // }

        $rescisao = Rescisao::find($id);
        if (!$rescisao) {
            return response()->json(['error' => 'Rescisão não encontrada'], 404);
        }

        $rescisao->update([
            'excluido'     => 's',
            'deletado'     => 's',
            'excluido_por' => (string)$user->id,
            'deletado_por' => (string)$user->id,
        ]);

        return response()->json([
            'message' => 'Rescisão excluída com sucesso',
        ], 200);
    }
}
