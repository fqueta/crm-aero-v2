<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Orçamento da Matrícula</title>
    <style>
        /* PT: Estilos básicos para o relatório PDF similar à imagem.
           EN: Basic styles to match the provided PDF appearance. */
        :root { --text: #111827; --muted: #6b7280; --border: #e5e7eb; --chip: #f3f4f6; --accent: #ef4444; }
        /* PT: Define tamanho da página A4 e remove margens.
           EN: Set page size to A4 and remove margins. */
        @page { size: A4; margin: 0; }
        /* PT: Reset de body sem definir altura fixa, evitando limitar a paginação.
           EN: Reset body without fixed height to avoid pagination being limited. */
        body { font-family: Arial, Helvetica, sans-serif; color: var(--text); margin: 0; padding: 0; }
        header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
        .client-info { font-size: 12px; line-height: 1.4; }
        .client-info b { font-weight: 700; }
        .meta-info { text-align: right; font-size: 12px; line-height: 1.4; }
        h1 { font-size: 18px; margin: 8px 0 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border-bottom: 1px solid var(--border); padding: 8px; font-size: 12px; }
        th { text-align: left; color: var(--muted); font-weight: 600; }
        tfoot td { font-weight: 700; }
        .right { text-align: right; }
        .muted { color: var(--muted); }
        .accent { color: var(--accent); font-weight: 700; }
        .chips { display: flex; flex-wrap: wrap; gap: 8px; margin: 6px 0 12px; }
        .chip { background: var(--chip); border: 1px solid var(--border); border-radius: 16px; padding: 4px 8px; font-size: 11px; }
        .section-title { font-size: 14px; font-weight: 700; margin: 16px 0 8px; }
        .content-html { font-size: 12px; line-height: 1.55; }
        .check { color: #10b981; font-weight: 700; }
        .footer { margin-top: 18px; font-size: 11px; color: var(--muted); }
        /* PT: Botão de chamada para ação na capa | EN: Cover CTA button */
        .cta-wrap {
            /* Function-level comment: Avoid flex to ensure wkhtmltopdf creates link annotations. */
            /* PT: Evita flex; usa block + text-align para centralizar sem afetar o clique. */
            /* EN: Avoid flex; use block + text-align to center without affecting click. */
            position: static;
            z-index: auto;
            display: block;
            text-align: center;
            margin: 24px 0 0;
        }
        .cta-button {
            /* Function-level comment: Minimal, wkhtmltopdf-friendly anchor for reliable clicking. */
            /* PT: Estilo mínimo e estático para o link ser clicável no PDF. */
            /* EN: Minimal and static styles so the link becomes clickable in PDF. */
            display: inline-block;
            position: static; /* evita camadas/overlays que bloqueiam a anotação do link */
            z-index: auto;
            background-color:  #63b92a;
            color: #fff;
            font-weight: 700;
            border-radius: 8px;
            padding: 10px 14px;
            text-decoration: none;
            cursor: pointer;
            line-height: 20px;
        }
        .cta-button .icon { width: 20px; height: 20px; border-radius: 50%; background: #2c7a0a; display: inline-block; vertical-align: middle; margin-right: 8px; }
        /* PT: Bloco central da capa com alinhamento e espaçamento como na imagem.
           EN: Centered cover block with alignment and spacing to match screenshot. */
        .cover-content {
            position: absolute; inset: 0; padding: 0mm 20mm 28mm;
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            text-align: center; z-index: 2;
            top: 70mm;
        }
        .cover-title { font-size: 42px; line-height: 1.1; margin: 0 0 6px; color: #0f2a5b; font-weight: 800; }
        .cover-subtitle { font-size: 16px; color: #2d6cdf; font-weight: 700; margin: 0 0 12px; }
        .cover-info { font-size: 13px; line-height: 1.7; }
        .cover-info b { font-weight: 700; }
        .cover-cta { margin-top: 12px; }
        /* PT: Container interno por página.
           - Garante altura de uma folha A4 mesmo sem conteúdo (apenas fundo)
           - Força quebra de página entre blocos .page
           EN: Per-page container.
           - Ensures A4 height even with no text (background-only pages)
           - Forces page breaks between .page blocks */
        .page {
            padding: 0; /* full-bleed background (no padding on page container) */
            box-sizing: border-box;
            page-break-inside: avoid;
            height: 297mm; /* A4 height */
            width: 210mm; /* A4 width ensures full-bleed background */
            page-break-after: always;
            break-after: page; /* modern property */
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            position: relative; /* establish containing block for background sizing */
            overflow: hidden; /* ensure absolute bg doesn't overflow */
        }
        /* Function-level comment: Content wrapper inside page to preserve padding without shrinking background. */
        /* PT: Wrapper interno para conteúdo com padding; fundo permanece full-bleed. */
        /* EN: Inner wrapper to provide padding while keeping background full-bleed. */
        .page-inner {
            padding: 24px;
            box-sizing: border-box;
            min-height: 297mm;
            width: 210mm;
            position: relative;
            z-index: 1;
        }
        .page:last-of-type { page-break-after: auto; }
        /* PT: Quebra de página entre containers .page.
           EN: Page break between .page containers. */
        .page + .page { page-break-before: always; break-before: page; }
        @media print {
            .page { page-break-after: always; break-after: page; }
            .page:last-child { page-break-after: auto; }
        }
        /* PT: Preenchedor para páginas extras sem conteúdo textual.
           EN: Filler for extra pages with no textual content. */
        .page-filler { display: block; min-height: 100%; }
        /* PT/EN: Element-based full-bleed background to improve wkhtmltopdf reliability */
        /* PT: Imagem de fundo atrás do conteúdo com z-index.
           - Bleed de 1mm por lado para evitar faixas brancas
           - Posicionada no topo para reduzir cortes em cabeçalhos
           EN: Background image behind content using z-index.
           - 1mm bleed per side to avoid white bands
           - Anchored to top to reduce header cropping */
        .page-bg {
            position: absolute;
            /* Default sem sangria: evita cortes laterais quando usar contain */
            top: 0;
            left: 0;
            width: 210mm;
            height: 297mm;
            object-fit: contain; /* default: sem corte; pode trocar para cover pela arte */
            object-position: top center; /* favor topo da arte */
            z-index: 0;
            pointer-events: none;
        }
        /* Function-level comment: Set page size for Chromium PDF to match CSS mm units. */
        /* PT: Define tamanho da página via CSS para reduzir variações de escala/zoom. */
        /* EN: Set page size via CSS to reduce scale/zoom variance. */
        @page { size: A4; margin: 0; }
        /* Overrides: fine-tune cover centering and link clickability for PDF */
        .cover-content {
            /* Function-level comment: Override positioning to center between header/footer. */
            position: absolute; left: 0; right: 0; top: 170mm; bottom: 26mm;
            padding: 0 20mm; justify-content: center; align-items: center; gap: 6px;
        }
        .cta-button { pointer-events: auto; }
    </style>
</head>
<body>
    @php
        /* Function-level comment: Build a single pages loop where
           0 => cover, 1 => budget, 2..N => controller-provided pages.
           PT: Constrói um único loop de páginas onde
           0 => capa, 1 => orçamento, 2..N => páginas da controller. */
        $extras = is_array($extra_pages ?? null) ? $extra_pages : [];
    @endphp
{{-- {{ dd($extra_pages,$extras); }} --}}
    @foreach($extras as $idx => $p)
        @php
            $pageBg = $p['background_data_uri'] ?? $p['background_url'] ?? null;
            $pageBgStyle = 'page-break-before: always; break-before: page; page-break-after: always; break-after: page; height: 297mm; width: 210mm;';
            if ($pageBg) {
                $bgPos = isset($p['background_position']) && is_string($p['background_position']) ? $p['background_position'] : 'top center';
                $bgFit = isset($p['background_fit']) && is_string($p['background_fit']) ? $p['background_fit'] : 'contain';
                $pageBgStyle .= " background-image: url('" . $pageBg . "'); background-repeat: no-repeat; background-position: " . $bgPos . "; background-size: " . ($bgFit === 'cover' ? 'cover' : 'contain') . ";";
            }
        @endphp
        <div class="page" style="{{ $pageBgStyle }}">
            @if($pageBg)
                <!-- PT/EN: Element-based full-bleed background for wkhtmltopdf reliability -->
                <img class="page-bg" src="{{ $pageBg }}" alt="" />
            @endif
            <div class="page-inner">
                @if($idx === 0)
                    <!-- PT/EN: Page 0 = Cover -->
                    <div class="cover-content">
                        <h1 class="cover-title">Proposta Comercial</h1>
                        <div class="cover-subtitle">Dados relacionados da proposta:</div>
                        <div class="cover-info">
                            <div><b>Cliente:</b> {{ $cliente_nome }} <span class="muted">Nº: {{ $cliente_zapsint ?? '-' }}</span></div>
                            <div><b>Telefone:</b> {{ $cliente_telefone ?? '-' }}</div>
                            <div><b>Email:</b> {{ $cliente_email ?? '-' }}</div>
                            <div><b>Data:</b> {{ $data_formatada }} &nbsp; <b>Validade:</b> {{ $validade_formatada }}</div>
                        </div>
                        @php
                            /* Function-level comment: Resolve CTA URL and text, hiding link if empty.
                               PT: Resolve URL/texto do CTA. Esconde o botão se URL estiver vazia.
                               EN: Resolve CTA URL/text. Hide the button if URL is empty. */
                            $resolvedCtaUrl = trim((string)($cta_url ?? ($cta_link ?? '')));
                            $resolvedCtaUrl = ($resolvedCtaUrl === '' || $resolvedCtaUrl === '#') ? null : $resolvedCtaUrl;
                            $resolvedCtaText = 'ACEITO A PROPOSTA';
                            // dd($resolvedCtaUrl);
                        @endphp
                        @if($resolvedCtaUrl)
                            <div class="cta-wrap cover-cta">
                                <a class="cta-button" href="{{ $resolvedCtaUrl }}" target="_blank">
                                    <span class="icon"></span>{{ $resolvedCtaText }}
                                </a>
                            </div>
                        @endif
                    </div>
                @elseif($idx === 1)
                    <div style="margin-top: 40mm;">
                    <!-- PT/EN: Page 1 = Budget table -->
                        <h1>Orçamento</h1>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Descrição</th>
                                        <th>Etapa</th>
                                        <th class="right">H. Teóricas</th>
                                        <th class="right">H. Práticas</th>
                                        <th class="right">Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @foreach(($orc['modulos'] ?? []) as $m)
                                        <tr>
                                            <td>{{ $m['titulo'] ?? '-' }}</td>
                                            <td class="muted">{{ $m['etapa'] ?? '—' }}</td>
                                            <td class="right">{{ $m['limite'] ?? '0' }}</td>
                                            <td class="right">{{ $m['limite_pratico'] ?? '0' }}</td>
                                            <td class="right">{{ $m['valor'] ?? '0,00' }}</td>
                                        </tr>
                                    @endforeach
                                    @if(isset($desconto) && $desconto !== null)
                                        <tr>
                                            <td class="accent">Desconto de Pontualidade</td>
                                            <td></td>
                                            <td></td>
                                            <td></td>
                                            <td class="right accent">- R$ {{ number_format((float)$desconto, 2, ',', '.') }}</td>
                                        </tr>
                                    @endif
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colspan="4" class="right">Subtotal</td>
                                        <td class="right">R$ {{ $subtotal_formatado }}</td>
                                    </tr>
                                    <tr>
                                        <td colspan="4" class="right">Total do Orçamento</td>
                                        <td class="right">R$ {{ $total_formatado }}</td>
                                    </tr>
                                </tfoot>
                            </table>
                            <div class="section-title">Parceliamento</div>
                            <div class="chips">
                                @php
                                    $orcArr = is_array($orc) ? $orc : (is_string($orc) ? (json_decode($orc, true) ?: []) : []);
                                    $linhas = [];
                                    if (isset($orcArr['parcelamento']) && is_array($orcArr['parcelamento'])) {
                                        $linhasRaw = $orcArr['parcelamento']['linhas'] ?? [];
                                        $linhas = is_array($linhasRaw) ? $linhasRaw : [];
                                    }
                                @endphp
                                @if(!empty($linhas))
                                    @foreach($linhas as $linha)
                                        <span class="chip">Total de Parcelas: {{ $linha['parcelas'] ?? '-' }}</span>
                                        <span class="chip">Valor da Parcela: R$ {{ isset($linha['valor']) ? number_format((float)$linha['valor'], 2, ',', '.') : '-' }}</span>
                                        @if(isset($linha['desconto']))
                                            <span class="chip">Desconto Pontualidade: R$ {{ number_format((float)$linha['desconto'], 2, ',', '.') }}</span>
                                            <span class="chip">Parcela c/ Desconto: R$ {{ number_format(((float)$linha['valor']) - ((float)$linha['desconto']), 2, ',', '.') }}</span>
                                        @endif
                                    @endforeach
                                @else
                                    <span class="chip">Sem dados de parcelamento</span>
                                @endif
                            </div>
                            <div class="content-html">
                                @php
                                    $textoPreview = '';
                                    if (!empty($orcArr) && isset($orcArr['parcelamento']) && is_array($orcArr['parcelamento'])) {
                                        $textoPreview = $orcArr['parcelamento']['texto_preview_html'] ?? '';
                                    }
                                @endphp
                                {!! $textoPreview !!}
                            </div>
                            <div class="footer">Gerado em {{ $generatedAt->format('d/m/Y H:i') }}
                            </div>
                    </div>
                @else
                    <!-- PT/EN: Remaining pages from controller -->
                    @php
                        $hasTitle = !empty($p['title']);
                        $hasHtml = !empty($p['html']);
                    @endphp
                    @if($hasTitle)
                        <h1>{{ $p['title'] }}</h1>
                    @endif
                    {!! $p['html'] ?? '' !!}
                    @if(!$hasTitle && !$hasHtml)
                        <div class="page-filler"></div>
                    @endif
                @endif
            </div>
        </div>
    @endforeach
</body>
</html>
