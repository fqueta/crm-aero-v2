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
     * Gera um PDF para um registro de matrícula específico e salva no servidor.
     * EN: Generate and save a PDF for a specific enrollment record on the server.
     */
    public function matricula(Request $request, string $id)
    {
        // Ajuste de tempo de execução para evitar fatal error (Windows Pipes 60s)
        // Function-level note: increase PHP max execution time for heavy PDF rendering.
        @set_time_limit(300);
        @ini_set('max_execution_time', '300');

        // Buscar matrícula com curso, turma e cliente
        $matricula = Matricula::join('cursos', 'matriculas.id_curso', '=', 'cursos.id')
            ->join('turmas', 'matriculas.id_turma', '=', 'turmas.id')
            ->leftJoin('users', 'matriculas.id_cliente', '=', 'users.id')
            ->select('matriculas.*', 'cursos.nome as curso_nome','cursos.tipo as curso_tipo', 'turmas.nome as turma_nome', 'users.name as cliente_nome')
            ->findOrFail($id);
        // Function-level comment: Fast dev toggles and caching.
        // PT: Atalhos de performance no ambiente de desenvolvimento.
        // - fast_dev: pula conversões pesadas e limpeza; favorece velocidade.
        // - skip_extra_pages: não gera páginas extras (galeria/request).
        // - force: força regerar PDF mesmo havendo cache recente.
        // - cache_ttl: tempo (segundos) para considerar PDF válido.
        $fastDev = $request->boolean('fast_dev', env('PDF_FAST_DEV', false));
        $skipExtras = $request->boolean('skip_extra_pages', env('PDF_SKIP_EXTRA_PAGES', false));
        $force = $request->boolean('force', false);
        $cacheTtl = (int)($request->input('cache_ttl', env('PDF_CACHE_TTL', 300)));
        $token = $matricula->id_cliente . '_' . $matricula->id;

        // Metacampos
        $meta = $this->getAllMatriculaMeta($matricula->id);

        // Dados do cliente e consultor
        $cliente = $matricula->id_cliente ? User::find($matricula->id_cliente) : null;
        $consultor = $matricula->id_consultor ? User::find($matricula->id_consultor) : null;
        $cliente_email = $cliente?->email ?? null;
        $cliente_telefone = $cliente->telefone ?? ($cliente->phone ?? null);
        $cliente_zapsint = $matricula->id ?? null;
        $cliente_zapsint = Qlib::zerofill($cliente_zapsint, 5);
        // Datas formatadas
        $dataCadastro = $matricula->data ? Carbon::parse($matricula->data) : now();
        $validadeDias = (int)($meta['validade'] ?? 0);
        $validadeData = (clone $dataCadastro)->addDays($validadeDias);

        // Números formatados
        $subtotalFormatado = number_format((float)$matricula->subtotal, 2, ',', '.');
        $totalFormatado = number_format((float)$matricula->total, 2, ',', '.');
        $desconto = $matricula->desconto;

        // Renderiza HTML via Blade usando os dados do método show()
        // background_url: imagem de fundo opcional para personalizar o PDF
        // EN: background_url: optional background image to customize the PDF
        // Comentário: Determina fundos por página a partir da galeria do componente
        // e do parâmetro opcional 'background_url'. Quando existe galeria, ela tem prioridade.
        $backgroundUrl = $request->input('background_url') ?? '';
        // Function-level comment: Prefer direct URL for backgrounds instead of Data URI.
        // PT: Usamos diretamente a URL do fundo; não geramos base64/Data URI.
        // EN: Use background URL directly; do not generate base64/Data URI.
        $backgroundDataUri = null;
        // PT: Páginas extras dinâmicas (array de blocos HTML com fundo opcional).
        // EN: Dynamic extra pages (array of HTML blocks with optional background).
        // Função: Permite enviar páginas adicionais com título e HTML, e, opcionalmente,
        //         um fundo específico por página via 'background_url' ou 'background_data_uri'.
        // Lista de páginas via shortcode 'fundo_proposta_plano'
        $listaPaginas = [];
        $galerias  = Qlib::get_post_by_shortcode('fundo_proposta_plano', $matricula->id_curso);
        // Normaliza o retorno de Qlib (array/objeto) para obter a lista
        if (is_array($galerias)) {
            $listaPaginas = isset($galerias['galeria']) && is_array($galerias['galeria']) ? $galerias['galeria'] : [];
        } elseif (is_object($galerias)) {
            $listaPaginas = isset($galerias->galeria) && is_array($galerias->galeria) ? $galerias->galeria : [];
        }
        $extraPages = [];
        // Function-level comment: Ensure extraPagesRaw is initialized to avoid undefined variable errors.
        // PT: Inicializa $extraPagesRaw para garantir existência antes de uso.
        // EN: Initialize $extraPagesRaw to ensure it exists before usage.
        $extraPagesRaw = [];
        if(is_array($listaPaginas)){
            foreach($listaPaginas as $key => $item){
                $extraPagesRaw[$key]['html'] = $item['description'] ?? '';
                $extraPagesRaw[$key]['title'] = $item['nome'] ?? '';
                $extraPagesRaw[$key]['background_url'] = $item['public_url'] ?? '';
            }
        }else{
            $extraPagesRaw = $request->input('extra_pages', []);
        }
        // dd($extraPagesRaw);
        if (is_string($extraPagesRaw)) {
            // PT: Permite enviar como JSON string.
            // EN: Allow passing as JSON string.
            $decoded = json_decode($extraPagesRaw, true);
            if (is_array($decoded)) { $extraPagesRaw = $decoded; }
        }
        // if ($skipExtras) {
        //     $extraPagesRaw = [];
        // }
        if (is_array($extraPagesRaw)) {
            foreach ($extraPagesRaw as $page) {
                if (is_string($page)) {
                    // Apenas HTML.
                    $extraPages[] = ['html' => $page];
                } elseif (is_array($page) && isset($page['html']) && is_string($page['html'])) {
                    $pBackgroundUrl = $page['background_url'] ?? null;
                    // Performance: não gerar data URI automaticamente; se vier no request, mantemos
                    $pBackgroundDataUri = $page['background_data_uri'] ?? null;
                    $extraPages[] = [
                        'title' => $page['title'] ?? null,
                        'html' => $page['html'],
                        'background_url' => $pBackgroundUrl,
                        'background_data_uri' => $pBackgroundDataUri,
                    ];
                }
            }
        }
        // Aplica fundos por página vindos da galeria (public_url)
        // 1º item vira fundo da primeira página; demais viram páginas extras com fundo específico.
        $galleryBackgrounds = [];
        if (!$skipExtras) foreach ($listaPaginas as $item) {
            $arr = is_array($item) ? $item : (is_object($item) ? (array)$item : []);
            $pub = $arr['public_url'] ?? null;
            $nome = $arr['nome'] ?? null;
            if (is_string($pub) && $pub !== '') {
                $galleryBackgrounds[] = [
                    'url' => $pub,
                    // Performance: não gerar data URI aqui; browser lida com URL
                    'data_uri' => null,
                    'title' => $nome,
                ];
            }
        }
        // dd($galleryBackgrounds);
        if (!$skipExtras && !empty($galleryBackgrounds)) {
            // Function-level comment: Read optional defaults for background focus/fit from request.
            // PT: Lê defaults opcionais para posição e ajuste do fundo.
            // EN: Read optional defaults for background position and fit.
            $defaultBgPos = $request->input('background_position');
            // Function-level comment: Default to 'contain' globally when not specified.
            // PT: Usa 'contain' como padrão global quando não informado.
            // EN: Use 'contain' as global default when not provided.
            $defaultBgFit = $request->input('background_fit', 'contain');
            // Primeiro fundo aplicado na página principal
            $backgroundUrl = $galleryBackgrounds[0]['url'];
            $backgroundDataUri = null;
            // Demais viram páginas extras sem conteúdo, apenas fundo
            foreach ($galleryBackgrounds as $idx => $gb) {
                $extraPages[$idx] = [
                    'title' => $gb['title'] ?? null,
                    'html' => '',
                    'background_url' => $gb['url'],
                    'background_data_uri' => null,
                    // Function-level comment: Apply defaults for background positioning and fit if provided.
                    'background_position' => is_string($defaultBgPos ?? null) ? $defaultBgPos : null,
                    'background_fit' => is_string($defaultBgFit ?? null) ? $defaultBgFit : null,
                ];
            }
        }

        // Function-level comment: Data URI conversion disabled globally.
        // PT: Conversão para base64/Data URI desativada; wkhtmltopdf tem 'enable-local-file-access'.
        // EN: Data URI conversion disabled; wkhtmltopdf uses 'enable-local-file-access'.
        $cta_url = Qlib::getFrontUrl() . '/aluno/matricula/' . $token ?? '';

        $html = View::make('pdf.matricula', [
            'cliente_nome' => $matricula->cliente_nome,
            'cliente_email' => $cliente_email,
            'cliente_telefone' => $cliente_telefone,
            'cliente_zapsint' => $cliente_zapsint,
            'consultor_nome' => $consultor?->name,
            'data_formatada' => $dataCadastro->format('d/m/Y'),
            'validade_formatada' => $validadeData->format('d/m/Y'),
            'desconto' => $desconto,
            'subtotal_formatado' => $subtotalFormatado,
            'total_formatado' => $totalFormatado,
            'orc' => is_array($matricula->orc) ? $matricula->orc : [],
            'generatedAt' => now(),
            'background_url' => $backgroundUrl,
            'background_data_uri' => $backgroundDataUri,
            // Function-level comment: Pass defaults for first-page background focus/fit.
            // PT: Repassa parâmetros com default 'contain' para evitar cortes.
            // EN: Pass parameters with default 'contain' to avoid cropping.
            'background_position' => $request->input('background_position'),
            'background_fit' => $request->input('background_fit', 'contain'),
            // Function-level comment: Allow customizing CTA link/text via request.
            // PT: Permite informar 'cta_url' e 'cta_text' na query para testes/ajustes.
            // EN: Allow 'cta_url' and 'cta_text' in the query for testing/adjustment.
            //token matricula = id_cliente+_+id_curso
            'cta_url' => $cta_url,
            'cta_text' => (string)$request->input('cta_text', ''),
            'extra_pages' => $extraPages,
        ])->render();
        // Modo de depuração opcional: retorna o HTML renderizado sem gerar PDF
        // Optional debug mode: return rendered HTML without generating PDF
        if ($request->boolean('debug_html')) {
            return response($html, 200)->header('Content-Type', 'text/html; charset=UTF-8');
        }
        // Gera nome do arquivo e caminho, incluindo cliente e curso, SEM timestamp.
        // PT: Usamos um nome estável para sobrescrever a mesma proposta.
        // EN: Use a stable filename to overwrite the same proposal.
        $clienteSlug = Str::slug((string)($matricula->cliente_nome ?? 'cliente'));
        $clienteSlug = Str::limit($clienteSlug, 40, ''); // evitar nomes muito longos
        $cursoId = (string)($matricula->id_curso ?? 'curso');
        $slug = 'matricula-' . $matricula->id . '-' . $cursoId . '-' . $clienteSlug;
        $filename = $slug . '.pdf';
        $relative = 'uploads/matriculas/' . $filename; // caminho relativo
        $absolute = storage_path('app/public/' . $relative);
        // dd($absolute);
        // Function-level comment: Allow generating without persisting files.
        // PT: Permite gerar PDF sem salvar em disco via query ?no_store=1 (default: true).
        // EN: Allow generating PDF without saving to disk via ?no_store=1 (default: true).
        $noStore = $request->boolean('no_store', true);

        // Limpar versões antigas com timestamp para esta matrícula (best-effort)
        // EN: Clean up older timestamped versions for this enrollment (best-effort)
        $disk = Storage::disk('public');
        if (!$fastDev) {
            try {
                foreach ($disk->files('uploads/matriculas') as $path) {
                    if ($path !== $relative && Str::startsWith($path, 'uploads/matriculas/matricula-' . $matricula->id . '-')) {
                        // Function-level comment: Remove debug dump and quietly delete old files.
                        // PT: Remove dd() e apaga versões antigas sem interromper a geração.
                        // EN: Remove dd() and delete old versions without interrupting generation.
                        $disk->delete($path);
                    }
                }
            } catch (\Throwable $e) {
                // silencioso: não bloquear a geração do PDF
            }
        }

        // Garantir diretório
        if (!is_dir(dirname($absolute))) {
            mkdir(dirname($absolute), 0775, true);
        }

        // Function-level comment: Choose PDF engine via request or env.
        // PT: Permite escolher o engine ('wkhtmltopdf' ou 'browsershot') por query (?engine=...) ou env PDF_ENGINE.
        // EN: Allow selecting engine ('wkhtmltopdf' or 'browsershot') via query (?engine=...) or env PDF_ENGINE.
        $engine = strtolower((string)($request->input('engine', env('PDF_ENGINE', 'wkhtmltopdf'))));
        // Function-level comment: Skip generation if cached and fresh.
        // PT: Se já existe e está dentro do TTL, não reprocessa (a menos que force).
        // EN: If file exists and is fresh within TTL, skip regeneration (unless force).
        $shouldGenerate = true;
        if (!$noStore) {
            // Apenas considera cache quando for persistir em disco.
            if (!$force && $disk->exists($relative) && $cacheTtl > 0) {
                try {
                    $mtime = @filemtime($disk->path($relative));
                    if (is_int($mtime) && (time() - $mtime) <= $cacheTtl) {
                        $shouldGenerate = false;
                    }
                } catch (\Throwable $e) {
                    // Continua gerando se não for possível obter mtime.
                }
            }
        }
        // Function-level comment: Engine selection without interrupting execution flow.
        // PT: Remove debug (dd) para não interromper a geração do PDF.
        // EN: Remove debug (dd) to avoid interrupting PDF generation.
        $pdfBinary = null; // conteúdo binário do PDF quando no_store ou para resposta direta
        if ($engine === 'browsershot') {
            try {
                // Function-level comment: Generate PDF using Chromium (Browsershot) with full-bleed and print media.
                // PT: Usa Browsershot com A4, margens 0 e fundo ativo.
                // EN: Use Browsershot with A4, zero margins, and print background.
                if ($shouldGenerate) {
                    $shot = Browsershot::html($html)
                        ->format('A4')
                        ->margins(0, 0, 0, 0)
                        ->emulateMedia('print')
                        ->timeout(60000)
                        ->setOption('printBackground', true)
                        // Function-level comment: Lock PDF scale and respect CSS page size to avoid zoom.
                        // PT: Fixa escala em 1 e usa tamanho de página do CSS (@page) para evitar zoom.
                        // EN: Fix scale to 1 and use CSS page size (@page) to avoid zoom.
                        ->setOption('scale', 1)
                        ->setOption('preferCSSPageSize', true)
                        ->setOption('waitUntil', 'load');
                    if ($noStore) {
                        $pdfBinary = $shot->pdf();
                    } else {
                        $shot->save($absolute);
                    }
                }
            } catch (\Throwable $e) {
                \Log::warning('Browsershot PDF generation failed, falling back to wkhtmltopdf', [
                    'matricula_id' => $matricula->id ?? null,
                    'exception' => $e->getMessage(),
                ]);
                $engine = 'wkhtmltopdf'; // fallback
            }
        }

        if ($engine !== 'browsershot') {
            // Geração do PDF com Snappy (wkhtmltopdf), salvando via Storage::put
            // PT: Usa wkhtmltopdf para evitar timeouts do Chromium em Windows.
            // EN: Use wkhtmltopdf to avoid Chromium timeouts on Windows.
            try {
                // Function-level comment: Configure wkhtmltopdf binary from env (WKHTML_PDF_BINARY) for Windows.
                $binary = env('WKHTML_PDF_BINARY');
                if (is_string($binary) && $binary !== '') {
                    config(['snappy.pdf.binary' => $binary]);
                }
                $headerHtml = View::make('pdf.header')->render();
                $footerHtml = View::make('pdf.footer')->render();

                if ($shouldGenerate) {
                   // if(isset($_GET['tes'])){
                    //     return $headerHtml.$html.$footerHtml;
                    // }
                    // Function-level comment: Build wkhtmltopdf with header/footer and stable scale.
                    // PT: Monta wkhtmltopdf com cabeçalho/rodapé e escala estável 1:1.
                    // EN: Build wkhtmltopdf with header/footer and stable 1:1 scale.
                    $pdfBinary = SnappyPdf::loadHTML($html)
                        ->setOption('encoding', 'utf-8')
                        ->setOption('enable-local-file-access', true)
                        ->setPaper('a4')
                        ->setOption('page-width', '210mm')
                        ->setOption('page-height', '297mm')
                        ->setOption('zoom', '1.0')
                        // Function-level comment: Ensure links remain enabled (do not disable).
                        // PT: Não desabilita links internos/externos (padrão do wkhtmltopdf é permitir links).
                        // EN: Keep internal/external links enabled (wkhtmltopdf allows links by default).
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
                        ->output();
                    if (!$noStore) {
                        // Grava o PDF pelo disco público
                        $disk->put($relative, $pdfBinary);
                        $absolute = $disk->path($relative);
                    }
                }
            } catch (\Throwable $e) {
                \Log::error('Snappy PDF generation failed', [
                    'matricula_id' => $matricula->id ?? null,
                    'exception' => $e->getMessage(),
                ]);
                if (!$noStore && !$disk->exists($relative)) {
                    return response()->json([
                        'message' => 'Falha ao gerar o PDF da matrícula',
                        'error' => $e->getMessage(),
                    ], 500);
                }
            }
        }

        // Metadados do arquivo
        $mime = 'application/pdf';
        $size = $noStore ? ($pdfBinary ? strlen($pdfBinary) : null) : ($disk->exists($relative) ? $disk->size($relative) : null);

        // Upsert registro em posts como files_uload
        if ($noStore) {
            // Function-level comment: Stream PDF inline without caching.
            // PT: Retorna o PDF em streaming, sem salvar e sem cache.
            // EN: Stream the PDF inline, without saving and without cache.
            return response($pdfBinary, 200)
                ->header('Content-Type', $mime)
                ->header('Content-Disposition', 'inline; filename="' . $filename . '"')
                ->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
                ->header('Pragma', 'no-cache')
                ->header('Expires', '0');
        }

        // Persistente: mantém comportamento anterior (salva e retorna metadados JSON)
        $post = Post::where('post_type','files_uload')->where('guid',$relative)->first() ?? new Post();
        $post->post_type = 'files_uload';
        $post->post_title = 'PDF Matrícula #' . Qlib::zeroFill($matricula->id, 6);
        $post->post_name = Str::slug($slug);
        $post->post_status = 'publish';
        $post->menu_order = 0;
        $post->post_content = 'PDF de matrícula gerado automaticamente';
        $post->guid = $relative; // persistimos caminho relativo
        $post->post_mime_type = $mime;
        $post->post_value1 = $size;
        $user = $request->user();
        $post->post_author = $user && !empty($user->id) ? $user->id : 0;
        $post->save();
        // URL pública
        $publicUrl = function_exists('tenant_asset') ? tenant_asset($relative) : asset($relative);
        //Gravar campo meta com o link do PDF
        $saveLink = Qlib::update_matriculameta($matricula->id, 'proposta_pdf', $publicUrl);

        return response()->json([
            'data' => [
                'id' => $post->ID,
                'nome' => $post->post_title,
                'slug' => $post->post_name,
                'url' => $publicUrl,
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
