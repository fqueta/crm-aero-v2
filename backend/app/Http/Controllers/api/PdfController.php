<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\Matricula;
use App\Models\Parcelamento;
use App\Models\Post;
use App\Models\Curso;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\View;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Carbon\Carbon;
use App\Models\User;
use App\Services\Qlib;
use Barryvdh\Snappy\Facades\SnappyPdf;
use Spatie\Browsershot\Browsershot;
use App\Jobs\GeraPdfPropostasPnlJob;
use App\Jobs\GeraPdfcontratosPnlJob;
use App\Jobs\SendPeriodosZapsingJob;
use Illuminate\Support\Facades\Bus;

class PdfController extends Controller
{
    /**
     * Converte uma URL de imagem em Data URI (base64) para embutir no CSS.
     * EN: Convert an image URL into a Data URI (base64) for CSS embedding.
     */
    private function buildDataUriFromUrl(?string $url, int $timeoutSeconds = 3): ?string
    {
        if (empty($url)) {
            return null;
        }
        // Se já for data URI, retorna como está
        if (str_starts_with($url, 'data:')) {
            return $url;
        }
        try {
            $response = Http::timeout($timeoutSeconds)->get($url);
            if (!$response->ok()) {
                return null;
            }
            $bytes = $response->body();
            if ($bytes === '' || $bytes === null) {
                return null;
            }
            $mime = 'image/png';
            // Tenta detectar MIME real
            $info = @getimagesizefromstring($bytes);
            if (is_array($info) && isset($info['mime']) && is_string($info['mime'])) {
                $mime = $info['mime'];
            }
            return 'data:' . $mime . ';base64,' . base64_encode($bytes);
        } catch (\Throwable $e) {
            return null;
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
     * Normaliza HTML para desenvolvimento local reescrevendo hosts não resolvíveis.
     * EN: Normalize HTML for local development by rewriting unresolved hosts.
     */
    private function rewriteLocalDevHosts(string $html): string
    {
        try {
            $replacements = [
                'http://api-crm.localhost:8002' => 'http://127.0.0.1:8002',
                'https://api-crm.localhost:8002' => 'http://127.0.0.1:8002',
            ];
            $html = str_replace(array_keys($replacements), array_values($replacements), $html);
        } catch (\Throwable $e) {
            // silencioso
        }
        return $html;
    }

    /**
     * Gera um PDF com a listagem de componentes (post_type=componentes) aplicando filtros.
     * Generate a PDF listing of components (post_type=componentes) applying filters.
     *
     * Filtros aceitos: search, tipo_conteudo (slug/ID), id_curso, ativo (s/n), ordenar.
     * Retorna metadados e a URL pública do PDF gerado.
     */
    public function componentes(Request $request)
    {
        $query = Post::query()->where('post_type', 'componentes')->where('deletado', '!=', 's');

        // Filtro: tipo_conteudo pode ser slug (guid) ou ID (resolve para post_name)
        if ($request->filled('tipo_conteudo')) {
            $tipo = (string) $request->input('tipo_conteudo');
            if (is_numeric($tipo)) {
                $tipoPost = Post::query()
                    ->where('post_type', 'tipo_conteudo')
                    ->find((int) $tipo);
                if ($tipoPost) {
                    $query->where('guid', $tipoPost->post_name);
                } else {
                    $query->where('guid', $tipo);
                }
            } else {
                $query->where('guid', $tipo);
            }
        }

        // Filtro: id_curso em config.id_curso
        if ($request->filled('id_curso')) {
            $query->where('config->id_curso', (int)$request->integer('id_curso'));
        }

        // Filtro: ativo ('s'/'n') mapeado para publish/draft
        if ($request->filled('ativo')) {
            $ativo = strtolower((string)$request->input('ativo'));
            if (in_array($ativo, ['s', 'n'])) {
                $query->where('post_status', $ativo === 's' ? 'publish' : 'draft');
            }
        }

        // Filtro: ordenar (menu_order)
        if ($request->filled('ordenar')) {
            $query->where('menu_order', $request->integer('ordenar'));
        }

        if ($request->filled('search')) {
            $query->where('post_title', 'like', '%' . $request->string('search') . '%');
        }

        $items = $query->orderBy('menu_order')->orderByDesc('ID')->get([
            'ID as id',
            'post_title as nome',
            'post_status',
            'menu_order as ordenar',
            'post_name as short_code',
            'post_name as slug',
            'guid as tipo_conteudo',
            'config',
            'created_at',
            'updated_at',
        ]);

        // enriquecer campos auxiliares
        $items = $items->map(function ($item) {
            $item->ativo = ($item->post_status === 'publish') ? 's' : 'n';
            unset($item->post_status);

            // Nome do tipo de conteúdo
            if (!empty($item->tipo_conteudo)) {
                $ct = Post::query()
                    ->where('post_type', 'tipo_conteudo')
                    ->where('post_name', $item->tipo_conteudo)
                    ->first();
                $item->tipo_conteudo_nome = $ct?->post_title;
            } else {
                $item->tipo_conteudo_nome = null;
            }

            // Nome do curso
            $idCurso = is_array($item->config) ? ($item->config['id_curso'] ?? null) : null;
            if (!empty($idCurso)) {
                $curso = Curso::find($idCurso);
                $item->curso_nome = $curso?->nome;
            } else {
                $item->curso_nome = null;
            }

            // Galeria IDs
            $item->galeria = is_array($item->config) ? ($item->config['galeria'] ?? []) : [];

            return $item;
        });

        // Renderiza HTML via Blade
        $html = View::make('pdf.components', [
            'items' => $items,
            'filters' => $request->all(),
            'generatedAt' => now(),
        ])->render();

        // Gera nome do arquivo e caminho
        $slug = 'relatorio-componentes-' . now()->format('Ymd-His');
        $filename = $slug . '.pdf';
        $relative = 'uploads/' . $filename; // caminho relativo
        $absolute = storage_path('app/public/' . $relative);

        // Garantir diretório via Storage (public/uploads/matriculas)
        // Function-level intent: ensure upload path exists using Laravel's disk API
        $disk = Storage::disk('public');
        $disk->makeDirectory('uploads/matriculas');

        // Geração do PDF com Browsershot
        // PT: Usa condição de carregamento mais leve para evitar timeout por assets externos.
        // EN: Use lighter wait condition to avoid timeouts due to external assets.
        Browsershot::html($html)
            ->format('A4')
            ->margins(10, 10, 10, 10)
            ->setOption('waitUntil', 'load')
            ->timeout(60000)
            ->save($absolute);

        // Metadados do arquivo
        $mime = 'application/pdf';
        $size = file_exists($absolute) ? filesize($absolute) : null;

        // Cria registro em posts como files_uload
        $post = new Post();
        $post->post_type = 'files_uload';
        $post->post_title = 'Relatório de Componentes';
        $post->post_name = Str::slug($slug);
        $post->post_status = 'publish';
        $post->menu_order = 0;
        $post->post_content = 'Relatório gerado automaticamente';
        $post->guid = $relative; // persistimos caminho relativo
        $post->post_mime_type = $mime;
        $post->post_value1 = $size;
        $user = $request->user();
        $post->post_author = $user && !empty($user->id) ? $user->id : 0;
        $post->save();

        // URL pública resolvida
        $publicUrl = function_exists('tenant_asset') ? tenant_asset($relative) : asset($relative);

        return response()->json([
            'data' => [
                'id' => $post->ID,
                'nome' => $post->post_title,
                'slug' => $post->post_name,
                'url' => $publicUrl,
                'mime' => $mime,
                'size' => $size,
                'ativo' => 's',
                'ordenar' => 0,
                'descricao' => $post->post_content,
            ]
        ], 201);
    }

    /**
     * Resolve as páginas de fundo e extras baseadas no tipo de curso e galeria.
     */
    private function resolveBackgroundPages(Request $request, array $matricula, bool $skipExtras): array
    {
        $backgroundUrl = $request->input('background_url') ?? '';
        $extraPages = [];

        // Determina o shortcode baseado no tipo de curso (2 = Prático, 4 = Teórico/Plano)
        // Default para 'fundo_proposta_plano' se não for tipo 2
        $shortcode = ($matricula['curso_tipo'] ?? null) == 2
            ? 'fundo_proposta_pratico'
            : 'fundo_proposta_plano';

        $galerias = Qlib::get_post_by_shortcode($shortcode, $matricula['id_curso']);

        $listaPaginas = [];
        // Normaliza o retorno de Qlib
        if (is_array($galerias)) {
            $listaPaginas = isset($galerias['galeria']) && is_array($galerias['galeria']) ? $galerias['galeria'] : [];
        } elseif (is_object($galerias)) {
            $listaPaginas = isset($galerias->galeria) && is_array($galerias->galeria) ? $galerias->galeria : [];
        }

        // Processa páginas extras raw do request ou da galeria
        $extraPagesRaw = [];
        if (is_array($listaPaginas) && !empty($listaPaginas)) {
            foreach ($listaPaginas as $key => $item) {
                $extraPagesRaw[$key]['html'] = $item['description'] ?? '';
                $extraPagesRaw[$key]['title'] = $item['nome'] ?? '';
                $extraPagesRaw[$key]['background_url'] = $item['public_url'] ?? '';
            }
        } else {
            $extraPagesRaw = $request->input('extra_pages', []);
        }

        if (is_string($extraPagesRaw)) {
            $decoded = json_decode($extraPagesRaw, true);
            if (is_array($decoded)) {
                $extraPagesRaw = $decoded;
            }
        }

        if (is_array($extraPagesRaw)) {
            foreach ($extraPagesRaw as $page) {
                if (is_string($page)) {
                    $extraPages[] = ['html' => $page];
                } elseif (is_array($page) && isset($page['html']) && is_string($page['html'])) {
                    $extraPages[] = [
                        'title' => $page['title'] ?? null,
                        'html' => $page['html'],
                        'background_url' => $page['background_url'] ?? null,
                        'background_data_uri' => $page['background_data_uri'] ?? null,
                    ];
                }
            }
        }

        // Aplica fundos da galeria
        $galleryBackgrounds = [];
        if (!$skipExtras) {
            foreach ($listaPaginas as $item) {
                $arr = is_array($item) ? $item : (is_object($item) ? (array)$item : []);
                $pub = $arr['public_url'] ?? null;
                $nome = $arr['nome'] ?? null;
                if (is_string($pub) && $pub !== '') {
                    $galleryBackgrounds[] = [
                        'url' => $pub,
                        'title' => $nome,
                    ];
                }
            }
        }

        $defaultBgPos = $request->input('background_position');
        $defaultBgFit = $request->input('background_fit', 'contain');

        if (!$skipExtras && !empty($galleryBackgrounds)) {
            // Primeiro fundo vai para a capa
            $backgroundUrl = $galleryBackgrounds[0]['url'];

            // Demais viram páginas extras
            foreach ($galleryBackgrounds as $idx => $gb) {
                $extraPages[$idx] = [
                    'title' => $gb['title'] ?? null,
                    'html' => '',
                    'background_url' => $gb['url'],
                    'background_data_uri' => null,
                    'background_position' => is_string($defaultBgPos ?? null) ? $defaultBgPos : null,
                    'background_fit' => is_string($defaultBgFit ?? null) ? $defaultBgFit : null,
                ];
            }
        }

        // Garante estrutura mínima (Capa + Orçamento)
        if (count($extraPages) < 2) {
            // Página 0 (capa)
            array_unshift($extraPages, [
                'title' => null,
                'html' => '',
                'background_url' => $backgroundUrl ?: null,
                'background_data_uri' => null,
                'background_position' => is_string($defaultBgPos ?? null) ? $defaultBgPos : null,
                'background_fit' => is_string($defaultBgFit ?? null) ? $defaultBgFit : null,
            ]);
            // Página 1 (orçamento)
            array_splice($extraPages, 1, 0, [[
                'title' => null,
                'html' => '',
                'background_url' => null,
                'background_data_uri' => null,
            ]]);
        }

        return ['extraPages' => $extraPages, 'backgroundUrl' => $backgroundUrl];
    }

    /**
     * Gera um PDF para um registro de matrícula específico e salva no servidor.
     * EN: Generate and save a PDF for a specific enrollment record on the server.
     */
    public function matricula(Request $request, string $id)
    {
        // Ajuste de tempo de execução
        @set_time_limit(300);
        @ini_set('max_execution_time', '300');

        if ($request->boolean('regenerate_all')) {
            Bus::chain([
                new GeraPdfPropostasPnlJob($id),
                new GeraPdfcontratosPnlJob($id),
            ])->dispatch();

            return response()->json([
                'message' => 'Processo de regeneração iniciado em background.',
                'exec' => true
            ]);
        }

        if ($request->boolean('send_zapsign')) {
            SendPeriodosZapsingJob::dispatch($id);
            return response()->json([
                'message' => 'Envio para Zapsign iniciado em background.',
                'exec' => true
            ]);
        }

        // Busca dados da matrícula
        $matricula = (new MatriculaController)->dm($id);

        // Configurações de execução
        $fastDev = $request->boolean('fast_dev', env('PDF_FAST_DEV', false));
        $skipExtras = $request->boolean('skip_extra_pages', env('PDF_SKIP_EXTRA_PAGES', false));
        $force = $request->boolean('force', false);
        $cacheTtl = (int)($request->input('cache_ttl', env('PDF_CACHE_TTL', 300)));

        $token = $matricula['id_cliente'] . '_' . Qlib::zerofill($matricula['id'], 5) . '/1';
        $meta = $this->getAllMatriculaMeta($matricula['id']);

        // Dados auxiliares
        $dataCadastro = $matricula['data'] ? Carbon::parse($matricula['data']) : now();
        $validadeDias = (int)($meta['validade'] ?? 0);
        $validadeData = (clone $dataCadastro)->addDays($validadeDias);
        $subtotalFormatado = number_format((float)$matricula['subtotal'], 2, ',', '.');
        $totalFormatado = number_format((float)$matricula['total'], 2, ',', '.');
        $cta_url = Qlib::getFrontUrl() . '/aluno/assinatura/' . $token ?? '';

        // Resolve páginas e fundos (Refatorado)
        $resolvedPages = $this->resolveBackgroundPages($request, $matricula, $skipExtras);
        $extraPages = $resolvedPages['extraPages'];
        $backgroundUrl = $resolvedPages['backgroundUrl'];

        // Renderiza HTML
        $html = View::make('pdf.matricula', [
            'cliente_nome' => $matricula['cliente']['name'] ?? ($matricula['cliente']['nome'] ?? ''),
            'cliente_email' => $matricula['cliente']['email'] ?? '',
            'cliente_telefone' => $matricula['cliente']['celular'] ?? '',
            'cliente_zapsint' => Qlib::zerofill($matricula['id'], 5),
            'consultor_nome' => $matricula['consultor']['name'] ?? ($matricula['consultor']['nome'] ?? ''),
            'data_formatada' => $dataCadastro->format('d/m/Y'),
            'validade_formatada' => $validadeData->format('d/m/Y'),
            'desconto' => $matricula['desconto'],
            'subtotal_formatado' => $subtotalFormatado,
            'total_formatado' => $totalFormatado,
            'orc' => is_array($matricula['orc']) ? $matricula['orc'] : [],
            'generatedAt' => now(),
            'background_url' => $backgroundUrl,
            'background_data_uri' => null,
            'background_position' => $request->input('background_position'),
            'background_fit' => $request->input('background_fit', 'contain'),
            'cta_url' => $cta_url,
            'cta_text' => (string)$request->input('cta_text', ''),
            'extra_pages' => $extraPages,
            'matricula' => $matricula,
        ])->render();

        if ($request->boolean('debug_html')) {
            return response($html, 200)->header('Content-Type', 'text/html; charset=UTF-8');
        }

        // Configuração do arquivo
        $clienteSlug = Str::slug((string)($matricula['cliente_nome'] ?? 'cliente'));
        $clienteSlug = Str::limit($clienteSlug, 40, '');
        $cursoId = (string)($matricula['id_curso'] ?? 'curso');
        $slug = 'matricula-' . $matricula['id'] . '-' . $cursoId . '-' . $clienteSlug;
        $filename = $slug . '.pdf';
        $relative = 'uploads/matriculas/' . $filename;
        $absolute = storage_path('app/public/' . $relative);
        $noStore = $request->boolean('no_store', true);

        // Limpeza de versões antigas
        $disk = Storage::disk('public');
        if (!$fastDev) {
            try {
                foreach ($disk->files('uploads/matriculas') as $path) {
                    if ($path !== $relative && Str::startsWith($path, 'uploads/matriculas/matricula-' . $matricula['id'] . '-')) {
                        $disk->delete($path);
                    }
                }
            } catch (\Throwable $e) {}
        }

        if (!is_dir(dirname($absolute))) {
            mkdir(dirname($absolute), 0775, true);
        }

        // Verificação de cache
        $shouldGenerate = true;
        if (!$noStore && !$force && $disk->exists($relative) && $cacheTtl > 0) {
            try {
                $mtime = @filemtime($disk->path($relative));
                if (is_int($mtime) && (time() - $mtime) <= $cacheTtl) {
                    $shouldGenerate = false;
                }
            } catch (\Throwable $e) {}
        }

        if ($shouldGenerate && $force && $disk->exists($relative)) {
            try { $disk->delete($relative); } catch (\Throwable $e) {}
        }

        // Geração do PDF
        $engine = strtolower((string)($request->input('engine', env('PDF_ENGINE', 'wkhtmltopdf'))));

        if ($engine === 'browsershot') {
            try {
                if ($shouldGenerate) {
                    $shot = Browsershot::html($html)
                        ->format('A4')
                        ->margins(0, 0, 0, 0)
                        ->emulateMedia('print')
                        ->timeout(60000)
                        ->setOption('printBackground', true)
                        ->setOption('scale', 1)
                        ->setOption('preferCSSPageSize', true)
                        ->setOption('waitUntil', 'load');

                    if ($noStore) {
                        return response($shot->pdf(), 200)->header('Content-Type', 'application/pdf');
                    } else {
                        $shot->save($absolute);
                    }
                }
            } catch (\Throwable $e) {
                \Log::warning('Browsershot PDF generation failed, falling back to wkhtmltopdf', [
                    'matricula_id' => $matricula['id'] ?? null,
                    'exception' => $e->getMessage(),
                ]);
                $engine = 'wkhtmltopdf';
            }
        }

        if ($engine !== 'browsershot') {
            try {
                $binary = env('WKHTML_PDF_BINARY');
                if (is_string($binary) && $binary !== '') {
                    config(['snappy.pdf.binary' => $binary]);
                }
                $headerHtml = View::make('pdf.header')->render();
                $footerHtml = View::make('pdf.footer')->render();

                if ($shouldGenerate) {
                    $pdf = SnappyPdf::loadHTML($html)
                        ->setOption('encoding', 'utf-8')
                        ->setOption('enable-local-file-access', true)
                        ->setOption('load-error-handling', 'ignore')
                        ->setPaper('a4')
                        ->setOption('page-width', '210mm')
                        ->setOption('page-height', '297mm')
                        ->setOption('zoom', '1.0')
                        ->setOption('header-html', $headerHtml)
                        ->setOption('margin-top', 10)
                        ->setOption('margin-bottom', 10)
                        ->setOption('margin-left', 10)
                        ->setOption('margin-right', 10)
                        ->setOption('disable-smart-shrinking', true)
                        ->setOption('footer-spacing', '0')
                        ->setOption('print-media-type', true)
                        ->setOption('background', true)
                        ->setOption('replace', [
                            '{PAGE_NUM}' => '{PAGE_NUM}',
                            '{PAGE_COUNT}' => '{PAGE_COUNT}'
                        ])
                        ->setOption('footer-html', $footerHtml)
                        ->setTimeout(300);

                    if ($noStore) {
                        return $pdf->inline($filename);
                    } else {
                        $knp = app('snappy.pdf');
                        // Opções repetidas para garantir compatibilidade Knp
                        $opts = $pdf->getOptions();
                        // Ajuste manual de margens para Knp se necessário, ou usar generateFromHtml direto do wrapper se possível
                        // Mas o wrapper SnappyPdf do Barryvdh já facilita. Vamos usar save() do wrapper se possível, mas o código original usava generateFromHtml do Knp.
                        // Mantendo lógica original de usar Knp direto para garantir options
                        $knp->generateFromHtml($html, $absolute, $opts);
                    }
                }
            } catch (\Throwable $e) {
                \Log::error('Snappy PDF generation failed', [
                    'matricula_id' => $matricula['id'] ?? null,
                    'exception' => $e->getMessage(),
                ]);
                if (!$noStore && !$disk->exists($relative)) {
                    return response()->json(['message' => 'Falha ao gerar o PDF', 'error' => $e->getMessage()], 500);
                }
            }
        }

        // Finalização (Persistência e Log)
        $mime = 'application/pdf';
        $size = $noStore ? null : ($disk->exists($relative) ? $disk->size($relative) : null);

        if (!$noStore) {
            $post = Post::where('post_type','files_uload')->where('guid',$relative)->first() ?? new Post();
            $post->post_type = 'files_uload';
            $post->post_title = 'PDF Matrícula #' . Qlib::zerofill($matricula['id'], 6);
            $post->post_name = Str::slug($slug);
            $post->post_status = 'publish';
            $post->menu_order = 0;
            $post->post_content = 'PDF de matrícula gerado automaticamente';
            $post->guid = $relative;
            $post->post_mime_type = $mime;
            $post->post_value1 = $size;
            $user = $request->user();
            $post->post_author = $user && !empty($user->id) ? $user->id : 0;
            $post->save();

            $publicUrl = function_exists('tenant_asset') ? tenant_asset($relative) : asset($relative);
            $publicUrl = rtrim((string)$publicUrl, ", \t\n\r\0\x0B");
            $saveLink = Qlib::update_matriculameta($matricula['id'], 'proposta_pdf', $publicUrl);

            // Event Log
            if (class_exists('App\Models\EventLog')) {
                try {
                    $existingLog = \App\Models\EventLog::where('entity_type', 'matricula')
                        ->where('entity_id', $matricula['id'])
                        ->where('action', 'proposta_generated')
                        ->where('created_at', '>=', now()->subMinutes(1))
                        ->first();

                    if (!$existingLog) {
                        \App\Models\EventLog::create([
                            'entity_type' => 'matricula',
                            'entity_id' => $matricula['id'],
                            'action' => 'proposta_generated',
                            'description' => 'PDF da proposta gerado/regenerado',
                            'payload' => [
                                'url' => $publicUrl,
                                'generated_by' => $user->id ?? 'system',
                                'force' => $force,
                                'engine' => $engine
                            ],
                            'actor_id' => $user->id ?? null,
                        ]);
                    }
                } catch (\Throwable $e) {}
            }

            return response()->json([
                'data' => [
                    'id' => $post->ID,
                    'nome' => $post->post_title,
                    'slug' => $post->post_name,
                    'url' => $publicUrl . (str_contains($publicUrl, '?') ? '&' : '?') . 'v=' . time(),
                    'mime' => $mime,
                    'save_link' => $saveLink,
                    'size' => $size,
                    'ativo' => 's',
                    'ordenar' => 0,
                    'descricao' => $post->post_content,
                ]
            ], 201);
        }

        // Se chegou aqui com noStore e engine != browsershot (que já retornou), algo falhou ou é wkhtmltopdf inline (já retornado)
        return response()->json(['message' => 'PDF gerado sem persistência'], 200);
    }
    /**
     * Converte HTML em PDF e salva no disco público.
     *
     * - Quando `f_exibe = 'pdf'`: faz streaming inline sem salvar.
     * - Quando `f_exibe = 'server'` e há `id_matricula`: salva em
     *   `storage/app/public/{pasta}/{id_matricula}/{slug}.pdf` via `disk('public')`
     *   e grava a URL pública no meta `{short_code}_pdf` da matrícula.
     *
     * Parâmetros em `$config`:
     * - `f_exibe`: 'pdf' | 'server'
     * - `html`: HTML a ser renderizado
     * - `nome_aquivo_savo`: nome base do arquivo
     * - `titulo`: título no template
     * - `pasta`: subpasta base para o armazenamento
     * - `id_matricula`: ID da matrícula
     * - `short_code`: prefixo para gravar meta da matrícula
     */
    public function convert_html($config=[]){
        $f_exibe = isset($config['f_exibe']) ? $config['f_exibe'] : 'pdf';
        $html = isset($config['html']) ? $config['html'] : '';
        $nome_aquivo_savo = isset($config['nome_aquivo_savo']) ? $config['nome_aquivo_savo'] : '';
        $titulo = isset($config['titulo']) ? $config['titulo'] : '';
        // $token = isset($config['id_matricula']) ? $config['id_matricula'] : '';
        $pasta = isset($config['pasta']) ? $config['pasta'] : '';
        $id_matricula = isset($config['id_matricula']) ? $config['id_matricula'] : null;
        $short_code = isset($config['short_code']) ? $config['short_code'] : false;
        // $nome_aquivo_savo='arquivo',$titulo='Arquivo'
        // dd($config);
        $ret['exec'] = '';
        $html = view('pdf.template_default', ['titulo'=>$titulo,'conteudo'=>trim($html)])->render();
        $headerHtml = View::make('pdf.header')->render();
        $footerHtml = View::make('pdf.footer')->render();
        if(isset($_GET['tes'])){
            return $headerHtml.$html.$footerHtml;
        }
        $pdf = SnappyPdf::loadHTML($html)
                ->setPaper('a4')
                ->setOption('header-html', $headerHtml)
                ->setOption('margin-top', 25)
                ->setOption('margin-bottom', 13)
                ->setOption('margin-left', 0)
                ->setOption('margin-right', 0)
                ->setOption('disable-smart-shrinking', true)
                ->setOption('footer-spacing', '0')
                ->setOption('print-media-type', true)
                ->setOption('background', true)
                ->setOption('replace', [
                    '{PAGE_NUM}' => '{PAGE_NUM}',
                    '{PAGE_COUNT}' => '{PAGE_COUNT}'
                ])
                ->setOption('footer-html', $footerHtml);
        if($f_exibe=='pdf'){
            return $pdf->stream($nome_aquivo_savo.'.pdf');
        }elseif($f_exibe=='server' && $id_matricula){
            try {
                // Function-level comment: Align disk config with matrícula method (public disk + relative path under uploads).
                // PT: Usa o mesmo disco e padrão de caminho do método matrícula: disco 'public', caminho relativo sob 'uploads/'.
                // EN: Use the same disk and path pattern as matrícula: 'public' disk, relative path under 'uploads/'.
                $disk = Storage::disk('public');
                $baseFolder = trim($pasta,'/');
                $slug = Qlib::createSlug($nome_aquivo_savo);
                $filename = $slug.'.pdf';
                // Caminho relativo compatível com matrícula (armazenado sob uploads/...)
                $relative = 'uploads/'.$baseFolder.'/'.$id_matricula.'/'.$filename;
                // Caminho absoluto seguindo a convenção storage_path('app/public/'.relative)
                $absolute = storage_path('app/public/'.$relative);
                // Garantir diretório (mesma estratégia do método matrícula)
                if (!is_dir(dirname($absolute))) {
                    @mkdir(dirname($absolute), 0775, true);
                }
                // Gera binário e grava via disco público com caminho relativo
                $pdfbin = $pdf->output();
                $ret['ger_arquivo'] = $disk->put($relative, $pdfbin);
                if ($disk->exists($relative) && $short_code && $id_matricula) {
                    // URL pública compatível (tenant_asset/asset do caminho relativo), igual ao método matrícula
                    $url = function_exists('tenant_asset') ? tenant_asset($relative) : asset($relative);
                    $campo_meta = $config['titulo'];
                    // busca dados meta enteriormente salvo
                    $meta = Qlib::get_matriculameta($id_matricula, $campo_meta);
                    $nomoarquivo = ucfirst(str_replace(['_','-',' '],[' ',' ',' '],$nome_aquivo_savo));
                    // dd($nomoarquivo);
                    // se não existir, cria
                    if(!$meta){
                        $data_salv = [
                            ['nome_arquivo'=>$filename,'url'=>$url,'nome_contrato'=>$nomoarquivo]
                        ];
                        $ret['salvo'] = Qlib::update_matriculameta($id_matricula, $campo_meta, json_encode($data_salv));
                        $ret['url'] = $url;
                        if($ret['salvo']){
                            $ret['exec'] = true;
                        }
                        return $ret;
                    }
                    // se existir, atualiza
                    if($meta){
                        // decodifica meta
                        $meta = json_decode($meta, true);
                        // adiciona novo registro
                        $meta[] = ['nome_arquivo'=>$filename,'url'=>$url,'nome_contrato'=>$nomoarquivo];
                        $ret['salvo'] = Qlib::update_matriculameta($id_matricula, $campo_meta, json_encode($meta));
                        $ret['url'] = $url;
                        if($ret['salvo']){
                            $ret['exec'] = true;
                        }
                    }
                }
            } catch (\Throwable $th) {
                $ret['error'] = $th->getMessage();
            }
        }
        if(!$id_matricula){
            $ret['mens'] = 'ID de matrícula inválido';
        }
        return $ret;
    }
}
