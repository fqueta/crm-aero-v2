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
    /**
     * Verifica se uma URL pertence ao ambiente local (desenvolvimento).
     */
    private function isLocalUrl(string $url): bool
    {
        try {
            $parsedUrl = parse_url($url);
            $host = $parsedUrl['host'] ?? '';
            $port = isset($parsedUrl['port']) ? ':' . $parsedUrl['port'] : '';
            $fullHost = $host . $port;

            $appUrl = env('APP_URL', 'localhost');
            $parsedAppUrl = parse_url($appUrl);
            $appHost = $parsedAppUrl['host'] ?? '';
            $appFullHost = $appHost . (isset($parsedAppUrl['port']) ? ':' . $parsedAppUrl['port'] : '');

            // Lista estendida de domínios de desenvolvimento
            $localDomains = [
                'localhost', '127.0.0.1', '::1',
                'api-crm.localhost', 'crm.localhost',
                $appHost, $appFullHost, $host, $fullHost
            ];

            return in_array($host, $localDomains) || in_array($fullHost, $localDomains) || empty($host);
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * Retorna o URI de arquivo local (file:///) se a URL apontar para o próprio servidor.
     * Isso ignora a memória pesada de conversão Base64.
     */
    private function getLocalFileUriFromUrl(string $url): ?string
    {
            if ($this->isLocalUrl($url)) {
                $parsedUrl = parse_url($url);
                $path = $parsedUrl['path'] ?? '';
                if ($path) {
                    // Tenta caminho direto na pasta public
                    $filePath = public_path(ltrim($path, '/'));

                    // Se não existir, tenta resolver links simbólicos de storage
                    if (!file_exists($filePath) && str_starts_with($path, '/storage/')) {
                        $relative = substr($path, 9);
                        $filePath = storage_path('app/public/' . $relative);
                    }

                    // Se ainda não existir e tiver 'tenancy/assets', resolve para o storage do tenant
                    if (!file_exists($filePath) && str_contains($path, 'tenancy/assets/')) {
                        $parts = explode('tenancy/assets/', $path);
                        $relative = end($parts);
                        $filePath = storage_path('app/public/' . $relative);
                    }

                    if (file_exists($filePath) && is_file($filePath)) {
                        return 'file:///' . str_replace('\\', '/', $filePath);
                    }
                }
            }
        return null;
    }

    /**
     * Converte uma URL de imagem em Data URI (base64) para embutir no CSS ou Browsershot.
     */
    private function buildDataUriFromUrl(?string $url, int $timeoutSeconds = 3): ?string
    {
        if (empty($url)) {
            return null;
        }
        if (str_starts_with($url, 'data:') || str_starts_with($url, 'file:')) {
            return $url;
        }

        try {
            // Tenta converter arquivo local lendo diretamente do disco (Rápido e evita Deadlock)
            $fileUri = $this->getLocalFileUriFromUrl($url);
            if ($fileUri) {
                $filePath = str_replace('file:///', '', $fileUri);
                $bytes = @file_get_contents($filePath);
                if ($bytes) {
                    $mime = 'image/png';
                    $info = @getimagesizefromstring($bytes);
                    if (is_array($info) && isset($info['mime'])) $mime = $info['mime'];
                    return 'data:' . $mime . ';base64,' . base64_encode($bytes);
                }
            }

            // CRÍTICO: Se a URL for do servidor local e não resolveu para arquivo acima,
            // NUNCA tente fazer Http::get() se estivermos em desenvolvimento para evitar Deadlock.
            if ($this->isLocalUrl($url)) {
                return null;
            }

            $response = Http::timeout($timeoutSeconds)->get($url);
            if (!$response->ok()) {
                return null;
            }
            $bytes = $response->body();
            if (empty($bytes)) {
                return null;
            }
            $mime = 'image/png';
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
            ? 'fundo-proposta-pratico'
            : 'fundo-proposta-plano';

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
     * Handle asynchronous jobs related to PDF matricula generation.
     */
    private function handleAsyncMatriculaJobs(Request $request, string $id): ?\Illuminate\Http\JsonResponse
    {
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

        if ($request->boolean('generate_proposal')) {
            GeraPdfPropostasPnlJob::dispatch($id);
            return response()->json([
                'message' => 'Geração da proposta PDF iniciada em background.',
                'exec' => true
            ]);
        }

        return null;
    }

    /**
     * Get PDF generation configuration for matricula.
     */
    private function getMatriculaPdfConfig(Request $request): array
    {
        $engine = strtolower((string)($request->input('engine', env('PDF_ENGINE', 'wkhtmltopdf'))));
        // Permitimos o engine 'snap' passar mesmo no Windows para podermos identificá-lo no prepareHtml
        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' && env('APP_ENV') === 'local' && $engine !== 'snap') {
            $engine = 'wkhtmltopdf';
        }

        return [
            'fast_dev' => $request->boolean('fast_dev', env('PDF_FAST_DEV', false)),
            'skip_extra_pages' => $request->boolean('skip_extra_pages', env('PDF_SKIP_EXTRA_PAGES', false)),
            'force' => $request->boolean('force', false),
            'cache_ttl' => (int)($request->input('cache_ttl', env('PDF_CACHE_TTL', 300))),
            'no_store' => $request->boolean('no_store', true),
            'engine' => $engine,
            'background_position' => $request->input('background_position'),
            'background_fit' => $request->input('background_fit', 'contain'),
            'cta_text' => (string)$request->input('cta_text', '')
        ];
    }

    /**
     * Prepare data required by the PDF matricula view.
     */
    private function prepareMatriculaViewData(Request $request, array $matricula, array $config): array
    {
        $token = $matricula['id_cliente'] . '_' . Qlib::zerofill($matricula['id'], 5) . '/1';
        $meta = $this->getAllMatriculaMeta($matricula['id']);

        // Function-level comment: Keep PDF validity aligned with the proposal screen,
        // using the current emission date plus the configured validity days.
        $dataEmissao = now();
        $validadeDias = (int)($matricula['validade'] ?? ($meta['validade'] ?? 14));
        if ($validadeDias <= 0) {
            $validadeDias = 14;
        }
        $validadeData = (clone $dataEmissao)->addDays($validadeDias);

        $subtotalFormatado = number_format((float)($matricula['subtotal'] ?? 0), 2, ',', '.');
        $totalFormatado = number_format((float)($matricula['total'] ?? 0), 2, ',', '.');
        $cta_url = Qlib::getFrontUrl() . '/aluno/assinatura/' . $token ?? '';

        $resolvedPages = $this->resolveBackgroundPages($request, $matricula, $config['skip_extra_pages']);
        return [
            'cliente_nome' => $matricula['cliente']['name'] ?? ($matricula['cliente']['nome'] ?? ''),
            'cliente_email' => $matricula['cliente']['email'] ?? '',
            'cliente_telefone' => $matricula['cliente']['celular'] ?? '',
            'cliente_zapsint' => Qlib::zerofill($matricula['id'], 5),
            'consultor_nome' => $matricula['consultor']['name'] ?? ($matricula['consultor']['nome'] ?? ''),
            'data_formatada' => $dataEmissao->format('d/m/Y'),
            'validade_formatada' => $validadeData->format('d/m/Y'),
            'validade_dias' => $validadeDias,
            'desconto' => $matricula['desconto'],
            'subtotal_formatado' => $subtotalFormatado,
            'total_formatado' => $totalFormatado,
            'orc' => is_array($matricula['orc'] ?? null) ? $matricula['orc'] : [],
            'generatedAt' => now(),
            'background_url' => $resolvedPages['backgroundUrl'],
            'background_data_uri' => null,
            'background_position' => $config['background_position'],
            'background_fit' => $config['background_fit'],
            'cta_url' => $cta_url,
            'cta_text' => $config['cta_text'],
            'extra_pages' => $resolvedPages['extraPages'],
            'matricula' => $matricula,
        ];
    }

    /**
     * Render HTML and header/footer for the PDF.
     */
    private function renderMatriculaHtml(array $viewData, string $engine): array
    {
        $html = View::make('pdf.matricula', $viewData)->render();
        $hasBackground = !empty($viewData['background_url']);
        $headerHtml = '';
        $footerHtml = '';

        if (!$hasBackground) {
            $headerHtml = View::make('pdf.header')->render();
            $footerHtml = View::make('pdf.footer')->render();

            // PT: Prepara header/footer para todas as engines para garantir caminhos locais/base64
            $headerHtml = $this->prepareHtml($headerHtml, true, $engine);
            $footerHtml = $this->prepareHtml($footerHtml, true, $engine);
        }
        $html = $this->prepareHtml($html, false, $engine);

        return [
            'body' => $html,
            'header' => $headerHtml,
            'footer' => $footerHtml,
            'hasBackground' => $hasBackground
        ];
    }

    /**
     * Map file info configuration for saving the PDF.
     */
    private function getMatriculaFileInfo(array $matricula): array
    {
        $clienteSlug = Str::slug((string)($matricula['cliente_nome'] ?? 'cliente'));
        $clienteSlug = Str::limit($clienteSlug, 40, '');
        $cursoId = (string)($matricula['id_curso'] ?? 'curso');

        $slug = 'matricula-' . $matricula['id'] . '-' . $cursoId . '-' . $clienteSlug;
        $filename = $slug . '.pdf';
        $relative = 'uploads/matriculas/' . $filename;
        $absolute = storage_path('app/public/' . $relative);

        if (!is_dir(dirname($absolute))) {
            mkdir(dirname($absolute), 0775, true);
        }

        return [
            'slug' => $slug,
            'filename' => $filename,
            'relative' => $relative,
            'absolute' => $absolute
        ];
    }

    /**
     * Cleanup old unneeded PDF matricula variations.
     */
    private function cleanupOldMatriculaPdfs(string $currentRelative, int $matriculaId, bool $fastDev): void
    {
        if ($fastDev) return;

        $disk = Storage::disk('public');
        try {
            foreach ($disk->files('uploads/matriculas') as $path) {
                if ($path !== $currentRelative && Str::startsWith($path, 'uploads/matriculas/matricula-' . $matriculaId . '-')) {
                    $disk->delete($path);
                }
            }
        } catch (\Throwable $e) {}
    }

    /**
     * Check cache constraints to determine if we should generate the PDF.
     */
    private function shouldGenerateMatriculaPdf(string $relative, array $config): bool
    {
        if ($config['no_store'] || $config['force']) {
            return true;
        }

        $disk = Storage::disk('public');
        if ($disk->exists($relative) && $config['cache_ttl'] > 0) {
            try {
                $mtime = @filemtime($disk->path($relative));
                if (is_int($mtime) && (time() - $mtime) <= $config['cache_ttl']) {
                    return false;
                }
            } catch (\Throwable $e) {}
        }
        return true;
    }

    /**
     * Generate PDF using the configured engine. Return JsonResponse if errors or no_store outputs PDF stream inline.
     */
    private function engineGeneratePdf(array $config, array $htmlData, array $fileInfo, array $matricula)
    {
        $engine = $config['engine'];
        if ($engine === 'browsershot') {
            try {
                return $this->generateWithBrowsershot($htmlData, $fileInfo, $config);
            } catch (\Throwable $e) {
                \Log::warning('Browsershot PDF generation failed, falling back to wkhtmltopdf', [
                    'matricula_id' => $matricula['id'] ?? null,
                    'exception' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
                $engine = 'wkhtmltopdf';
            }
        }

        if ($engine !== 'browsershot') {
            try {
                return $this->generateWithWkhtmltopdf($htmlData, $fileInfo, $config);
            } catch (\Throwable $e) {
                \Log::error('Snappy PDF generation failed', [
                    'matricula_id' => $matricula['id'] ?? null,
                    'exception' => $e->getMessage(),
                ]);
                if (!$config['no_store'] && !Storage::disk('public')->exists($fileInfo['relative'])) {
                    return response()->json(['message' => 'Falha ao gerar o PDF', 'error' => $e->getMessage()], 500);
                }
            }
        }

        return null;
    }

    private function generateWithBrowsershot(array $htmlData, array $fileInfo, array $config)
    {
        if (!$htmlData['hasBackground']) {
            $injectedHtml = "<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"UTF-8\">";
            $injectedHtml .= "<style>
                @media print {
                    .pdf-header { position: fixed; top: 0; left: 0; right: 0; height: 35mm; z-index: 1000; }
                    .pdf-footer { position: fixed; bottom: 0; left: 0; right: 0; height: 12mm; z-index: 1000; line-height: 0; font-size: 0; }
                    .header-spacer { height: 35mm; }
                    .footer-spacer { height: 12mm; }
                    table { width: 100%; border-collapse: collapse; }
                    body { margin: 0; padding: 0; }
                }
            </style></head><body>";
            $injectedHtml .= '<div class="pdf-header">' . $htmlData['header'] . '</div>';
            $injectedHtml .= '<div class="pdf-footer">' . $htmlData['footer'] . '</div>';
            $injectedHtml .= '<table>
                <thead><tr><td><div class="header-spacer"></div></td></tr></thead>
                <tbody><tr><td><div class="pdf-content">' . $htmlData['body'] . '</div></td></tr></tbody>
                <tfoot><tr><td><div class="footer-spacer"></div></td></tr></tfoot>
            </table>';
            $injectedHtml .= '</body></html>';
        } else {
            $injectedHtml = "<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"UTF-8\">";
            $injectedHtml .= "<style>
                @media print {
                    .page-bg { position: absolute !important; top: -35mm !important; left: 0 !important; width: 210mm !important; height: 297mm !important; z-index: -1 !important; }
                    .pdf-content { position: relative; z-index: 1; }
                    body { margin: 0; padding: 0; }
                }
            </style></head><body>";
            $injectedHtml .= '<div class="pdf-content">' . $htmlData['body'] . '</div>';
            $injectedHtml .= '</body></html>';
        }
        $shot = Browsershot::html($injectedHtml)
            ->format('A4')
            ->margins($htmlData['hasBackground'] ? 35 : 0, 0, $htmlData['hasBackground'] ? 15 : 0, 0)
            ->emulateMedia('print')
            ->timeout(120000)
            ->noSandbox()
            ->setOption('printBackground', true)
            ->setOption('scale', 1)
            ->setOption('preferCSSPageSize', true)
            ->setOption('waitUntil', 'load');
        if ($chromePath = env('CHROME_PATH')) $shot->setChromePath($chromePath);
        if ($nodePath = env('NODE_PATH')) $shot->setNodeBinary($nodePath);
        if ($npmPath = env('NPM_PATH')) $shot->setNpmBinary($npmPath);
        if ($config['no_store']) {
            return response($shot->pdf(), 200)->header('Content-Type', 'application/pdf');
        } else {
            $shot->save($fileInfo['absolute']);
            return null;
        }
    }

    private function generateWithWkhtmltopdf(array $htmlData, array $fileInfo, array $config)
    {
        if ($binary = env('WKHTML_PDF_BINARY')) {
            config(['snappy.pdf.binary' => $binary]);
        }

        $headerHtml = $htmlData['header'];
        $footerHtml = $htmlData['footer'];
        $bodyHtml = $htmlData['body'];

        /** @var \Barryvdh\Snappy\PdfWrapper $pdf */
        $pdf = app('snappy.pdf.wrapper');
        $pdf->loadHTML($bodyHtml)
            ->setOption('encoding', 'utf-8')
            ->setOption('enable-local-file-access', true)
            ->setOption('load-error-handling', 'ignore')
            ->setOption('load-media-error-handling', 'ignore')
            ->setPaper('a4')
            ->setOption('page-width', '210mm')
            ->setOption('page-height', '297mm')
            ->setOption('zoom', '1.0')
            ->setOption('header-html', $headerHtml)
            ->setOption('margin-top', 0)
            ->setOption('margin-bottom', 0)
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
            ->setOption('footer-html', $footerHtml)
            ->setTimeout(300);

        if ($config['no_store']) {
            return $pdf->inline($fileInfo['filename']);
        } else {
            $knp = app('snappy.pdf');
            $knp->setTimeout(300);
            if (file_exists($fileInfo['absolute'])) {
                @unlink($fileInfo['absolute']);
            }
            $knp->generateFromHtml($bodyHtml, $fileInfo['absolute'], $pdf->getOptions());
            return null;
        }
    }

    /**
     * Persist generated file into files_uload and respond data.
     */
    private function persistAndRespondPdfRecord(Request $request, array $matricula, array $fileInfo, array $config)
    {
        $disk = Storage::disk('public');
        $relative = $fileInfo['relative'];

        $mime = 'application/pdf';
        $size = $disk->exists($relative) ? $disk->size($relative) : null;

        $post = Post::where('post_type','files_uload')->where('guid',$relative)->first() ?? new Post();
        $post->post_type = 'files_uload';
        $post->post_title = 'PDF Matrícula #' . Qlib::zerofill($matricula['id'], 6);
        $post->post_name = Str::slug($fileInfo['slug']);
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
                            'force' => $config['force'],
                            'engine' => $config['engine']
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

    /**
     * Gera um PDF para um registro de matrícula específico e salva no servidor.
     * EN: Generate and save a PDF for a specific enrollment record on the server.
     */
    public function matricula(Request $request, string $id)
    {
        @set_time_limit(300);
        @ini_set('max_execution_time', '300');
        if ($asyncResponse = $this->handleAsyncMatriculaJobs($request, $id)) {
            return $asyncResponse;
        }

        $matricula = (new MatriculaController)->dm($id);
        $config = $this->getMatriculaPdfConfig($request);

        $viewData = $this->prepareMatriculaViewData($request, $matricula, $config);
        $htmlData = $this->renderMatriculaHtml($viewData, $config['engine']);
        if ($request->boolean('debug_html')) {
            return response($htmlData['body'], 200)->header('Content-Type', 'text/html; charset=UTF-8');
        }

        $fileInfo = $this->getMatriculaFileInfo($matricula);

        $this->cleanupOldMatriculaPdfs($fileInfo['relative'], $matricula['id'], $config['fast_dev']);

        $shouldGenerate = $this->shouldGenerateMatriculaPdf($fileInfo['relative'], $config);

        if ($shouldGenerate && $config['force'] && Storage::disk('public')->exists($fileInfo['relative'])) {
            try { Storage::disk('public')->delete($fileInfo['relative']); } catch (\Throwable $e) {}
        }

        if ($shouldGenerate) {
            $pdfResponse = $this->engineGeneratePdf($config, $htmlData, $fileInfo, $matricula);
            if ($pdfResponse !== null) {
                return $pdfResponse;
            }
        }

        if (!$config['no_store']) {
            return $this->persistAndRespondPdfRecord($request, $matricula, $fileInfo, $config);
        }

        return response()->json([
            'message' => 'Falha ao retornar o preview do PDF.',
            'error' => 'A engine de PDF nao devolveu um arquivo inline para visualizacao.',
        ], 500);
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
     * - `use_header_footer`: boolean (opcional)
     */
    public function convert_html($config=[]) {
        $request = request();
        $f_exibe = isset($config['f_exibe']) ? $config['f_exibe'] : 'pdf';
        $html = isset($config['html']) ? $config['html'] : '';
        $nome_aquivo_savo = isset($config['nome_aquivo_savo']) ? $config['nome_aquivo_savo'] : '';
        $titulo = isset($config['titulo']) ? $config['titulo'] : '';
        $pasta = isset($config['pasta']) ? $config['pasta'] : '';
        $id_matricula = isset($config['id_matricula']) ? $config['id_matricula'] : null;
        $short_code = isset($config['short_code']) ? $config['short_code'] : false;

        $ret['exec'] = '';
        $html = view('pdf.template_default', ['titulo' => $titulo, 'conteudo' => trim($html)])->render();
        // PT: Prepara o HTML (inline imagens e corrige hosts)
        // Se explícito em $config ou no request
        $useHeaderFooter = isset($config['use_header_footer']) ? $config['use_header_footer'] : $request->boolean('use_header_footer', true);

        $headerHtml = '';
        $footerHtml = '';
        $engine = strtolower((string)($config['engine'] ?? env('PDF_ENGINE', 'wkhtmltopdf')));
        // PT: Força wkhtmltopdf no ambiente de desenvolvimento Windows (artisan serve)
        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' && env('APP_ENV') === 'local') {
            $engine = 'wkhtmltopdf';
        }

        if ($useHeaderFooter) {
            $headerHtml = View::make('pdf.header')->render();
            $footerHtml = View::make('pdf.footer')->render();

            if ($engine === 'browsershot') {
                $headerHtml = $this->prepareHtml($headerHtml, true, $engine);
                $footerHtml = $this->prepareHtml($footerHtml, true, $engine);
            }
        }
        $html = $this->prepareHtml($html, false, $engine);

        if ($engine === 'browsershot') {
            try {
                if ($useHeaderFooter) {
                    // PT: Para contratos sem fundo próprio, usa técnica de Table + Fixed Header/Footer
                    $injectedHtml = "<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"UTF-8\">";
                    $injectedHtml .= "<style>
                        @media print {
                            .pdf-header { position: fixed; top: 0; left: 0; right: 0; height: 35mm; z-index: 1000; }
                            .pdf-footer { position: fixed; bottom: 0; left: 0; right: 0; height: 12mm; z-index: 1000; line-height: 0; font-size: 0; }
                            .header-spacer { height: 35mm; }
                            .footer-spacer { height: 12mm; }
                            table { width: 100%; border-collapse: collapse; }
                            body { margin: 0; padding: 0; }
                        }
                    </style></head><body>";
                    $injectedHtml .= '<div class="pdf-header">' . $headerHtml . '</div>';
                    $injectedHtml .= '<div class="pdf-footer">' . $footerHtml . '</div>';
                    $injectedHtml .= '<table>
                        <thead><tr><td><div class="header-spacer"></div></td></tr></thead>
                        <tbody><tr><td><div class="pdf-content">' . $html . '</div></td></tr></tbody>
                        <tfoot><tr><td><div class="footer-spacer"></div></td></tr></tfoot>
                    </table>';
                    $injectedHtml .= '</body></html>';
                } else {
                    // PT: Para propostas com fundo, usa margem nativa e 'puxa' o fundo com valor negativo
                    $injectedHtml = "<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"UTF-8\">";
                    $injectedHtml .= "<style>
                        @media print {
                            .page-bg { position: absolute !important; top: -35mm !important; left: 0 !important; width: 210mm !important; height: 297mm !important; z-index: -1 !important; }
                            .pdf-content { position: relative; z-index: 1; }
                            body { margin: 0; padding: 0; }
                        }
                    </style></head><body>";
                    $injectedHtml .= '<div class="pdf-content">' . $html . '</div>';
                    $injectedHtml .= '</body></html>';
                }

                $shot = Browsershot::html($injectedHtml)
                    ->format('A4')
                    ->margins($useHeaderFooter ? 0 : 35, 0, $useHeaderFooter ? 0 : 15, 0)
                    ->emulateMedia('print')
                    ->timeout(120000)
                    ->noSandbox()
                    ->setOption('printBackground', true)
                    ->setOption('waitUntil', 'load');

                $chromePath = env('CHROME_PATH');
                if ($chromePath) {
                    $shot->setChromePath($chromePath);
                }
                $nodePath = env('NODE_PATH');
                if ($nodePath) {
                    $shot->setNodeBinary($nodePath);
                }
                $npmPath = env('NPM_PATH');
                if ($npmPath) {
                    $shot->setNpmBinary($npmPath);
                }

                if ($f_exibe == 'pdf') {
                    return response($shot->pdf(), 200)->header('Content-Type', 'application/pdf');
                } elseif ($f_exibe == 'server' && $id_matricula) {
                    $disk = Storage::disk('public');
                    $baseFolder = trim($pasta, '/');
                    $slug = Qlib::createSlug($nome_aquivo_savo);
                    $filename = $slug . '.pdf';
                    $relative = 'uploads/' . $baseFolder . '/' . $id_matricula . '/' . $filename;
                    $absolute = storage_path('app/public/' . $relative);

                    if (!is_dir(dirname($absolute))) {
                        @mkdir(dirname($absolute), 0775, true);
                    }

                    $shot->save($absolute);
                    $ret['ger_arquivo'] = $disk->exists($relative);

                    if ($ret['ger_arquivo'] && $short_code && $id_matricula) {
                         // ... (segue lógica de meta abaixo)
                    }
                }
            } catch (\Throwable $th) {
                \Log::error('Browsershot convert_html failed, falling back to Snappy', [
                    'error' => $th->getMessage(),
                    'trace' => $th->getTraceAsString()
                ]);
                $engine = 'wkhtmltopdf';
            }
        }

        if ($engine === 'wkhtmltopdf') {
            /** @var \Barryvdh\Snappy\PdfWrapper $pdf */
            $pdf = app('snappy.pdf.wrapper');
            $pdf->loadHTML($html)
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
                ->setOption('load-error-handling', 'ignore')
                ->setOption('load-media-error-handling', 'ignore')
                ->setOption('replace', [
                    '{PAGE_NUM}' => '{PAGE_NUM}',
                    '{PAGE_COUNT}' => '{PAGE_COUNT}'
                ])
                ->setOption('footer-html', $footerHtml)
                ->setTimeout(300);

            if ($f_exibe == 'pdf') {
                return $pdf->stream($nome_aquivo_savo . '.pdf');
            } elseif ($f_exibe == 'server' && $id_matricula) {
                try {
                    $disk = Storage::disk('public');
                    $baseFolder = trim($pasta, '/');
                    $slug = Qlib::createSlug($nome_aquivo_savo);
                    $filename = $slug . '.pdf';
                    $relative = 'uploads/' . $baseFolder . '/' . $id_matricula . '/' . $filename;
                    $absolute = storage_path('app/public/' . $relative);

                    if (!is_dir(dirname($absolute))) {
                        @mkdir(dirname($absolute), 0775, true);
                    }

                    $knp = app('snappy.pdf');
                    $knp->setTimeout(300);
                    // Use the generator directly with options from the wrapper
                    $pdfbin = $knp->getOutputFromHtml($html, $pdf->getOptions());
                    $ret['ger_arquivo'] = $disk->put($relative, $pdfbin);
                } catch (\Throwable $th) {
                     $ret['error'] = $th->getMessage();
                }
            }
        }

        if (isset($ret['ger_arquivo']) && $ret['ger_arquivo'] && $short_code && $id_matricula) {
            try {
                $disk = Storage::disk('public');
                $baseFolder = trim($pasta, '/');
                $slug = Qlib::createSlug($nome_aquivo_savo);
                $filename = $slug . '.pdf';
                $relative = 'uploads/' . $baseFolder . '/' . $id_matricula . '/' . $filename;

                $url = function_exists('tenant_asset') ? tenant_asset($relative) : asset($relative);
                $campo_meta = $config['titulo'];
                $meta = Qlib::get_matriculameta($id_matricula, $campo_meta);
                $nomoarquivo = ucfirst(str_replace(['_', '-', ' '], [' ', ' ', ' '], $nome_aquivo_savo));

                if (!$meta) {
                    $data_salv = [
                        ['nome_arquivo' => $filename, 'url' => $url, 'nome_contrato' => $nomoarquivo]
                    ];
                    $ret['salvo'] = Qlib::update_matriculameta($id_matricula, $campo_meta, json_encode($data_salv));
                    $ret['url'] = $url;
                    if ($ret['salvo']) {
                        $ret['exec'] = true;
                    }
                    return $ret;
                }

                if ($meta) {
                    $meta = json_decode($meta, true);
                    $meta[] = ['nome_arquivo' => $filename, 'url' => $url, 'nome_contrato' => $nomoarquivo];
                    $ret['salvo'] = Qlib::update_matriculameta($id_matricula, $campo_meta, json_encode($meta));
                    $ret['url'] = $url;
                    if ($ret['salvo']) {
                        $ret['exec'] = true;
                    }
                }
            } catch (\Throwable $th) {
                $ret['error'] = $th->getMessage();
            }
        }
        if (!$id_matricula) {
            $ret['mens'] = 'ID de matrícula inválido';
        }
        return $ret;
    }

    /**
     * Auxiliar para preparar o HTML antes da geração do PDF
     */
    private function prepareHtml(string $rawHtml, bool $isTemplate = false, string $engine = 'wkhtmltopdf'): string
    {
        // 1. Converte imagens (tags <img> e background-image CSS)
        // PT: Se engine for wkhtmltopdf, injeta 'file:///' direto.
        $appUrl = env('APP_URL', 'http://localhost');
        $rawHtml = preg_replace_callback(
            '/(src=["\']|url\(["\']?|href=["\'])([^"\'\)\s>]+)(["\']?|\)?)/i',
            function ($m) use ($engine, $appUrl) {
                $attr = $m[1];
                $url = $m[2];
                $suffix = $m[3];

                // PT: Ignora âncoras, data-uris e caminhos que não pareçam ser do app
                if (str_starts_with($url, '#') || str_starts_with($url, 'data:') || str_starts_with($url, 'mailto:') || str_starts_with($url, 'tel:')) {
                    return $m[0];
                }

                // PT: Normaliza URLs relativas para absolutas de desenvolvimento
                if (str_starts_with($url, '/') && !str_starts_with($url, '//')) {
                    $url = rtrim($appUrl, '/') . $url;
                }

                // PT: Se for para o motor 'snap' (frontend), mantemos a URL original (pública) para máxima rapidez.
                if ($engine === 'snap') {
                    // Para o snap, garantimos que qualquer caminho relativo virou absoluto para o navegador encontrar
                    return $attr . $url . $suffix;
                }

                // PT: Tenta converter para caminho local (file:///), que é muito rápido para o wkhtmltopdf no servidor.
                // Mas para o Browsershot, preferimos Base64 pois o Chrome bloqueia file:/// por segurança no modo HTML.
                if ($engine !== 'browsershot') {
                    $fileUri = $this->getLocalFileUriFromUrl($url);
                    if ($fileUri) {
                        return $attr . $fileUri . $suffix;
                    }
                }

                // PT: Para browsershot ou arquivos não resolvidos acima, usamos dataURI (Base64)
                if ($engine === 'browsershot' || str_contains($url, 'google-fonts') || str_contains($url, 'googleapis')) {
                    $dataUri = $this->buildDataUriFromUrl($url, 5);
                    return $dataUri ? $attr . $dataUri . $suffix : $attr . $url . $suffix;
                }

                return $attr . $url . $suffix;
            },
            $rawHtml
        );

        // 2. Reaplica normalização de hosts locais
        $rawHtml = $this->rewriteLocalDevHosts($rawHtml);

        // 3. Se for um template de header/footer do Browsershot, remove tags html/body desnecessárias
        if ($isTemplate) {
            // Extrai o conteúdo do body e as tags de estilo
            $styles = '';
            if (preg_match('/<style>(.*?)<\/style>/is', $rawHtml, $match)) {
                $styles = $match[0];
            }

            // Extrai apenas o conteúdo dentro da div principal ou do body
            $bodyContent = $rawHtml;
            if (preg_match('/<body[^>]*>(.*?)<\/body>/is', $rawHtml, $match)) {
                $bodyContent = $match[1];
            }

            // Limpa tags desnecessárias para o shadow dom do chrome
            $bodyContent = preg_replace('/<(html|head|meta|title)[^>]*>|<\/(html|head|meta|title)>/i', '', $bodyContent);
            $bodyContent = preg_replace('/<body[^>]*>|<\/body>/i', '', $bodyContent);

            // Browsershot exige que o template seja um fragmento com estilos embutidos
            $type = str_contains($rawHtml, 'header') ? 'header' : 'footer';

            // O segredo para esconder o header default do Chrome (título/data) é ter um template válido
            // e forçar as margens. Também inserimos um CSS reset específico do Chrome.
            $rawHtml = '<style>
                #header, #footer { padding: 0 !important; }
                section { width: 100%; }
                .date, .title, .url, .pageNumber, .totalPages { display: none !important; }
            </style>' . $styles . '<div class="'.$type.'" style="width:100% !important; margin:0 !important; padding:0 !important; -webkit-print-color-adjust: exact;">' . $bodyContent . '</div>';
        }

        return $rawHtml;
    }
}
