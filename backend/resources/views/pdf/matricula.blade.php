@php
    $tipo = $matricula['curso']['tipo'] ?? null;
    $curso = $matricula['curso_nome'] ?? null;
    $turma = $matricula['turma_nome'] ?? null;
@endphp
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
        @page {
            size: A4;
            margin-top: 10mm;
            margin-bottom: 10mm;
            margin-left: 0;
            margin-right: 0;
        }
        /* PT: Reset de body sem definir altura fixa, evitando limitar a paginação.
           EN: Reset body without fixed height to avoid pagination being limited. */
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: var(--text); margin: 0; padding: 0; }

        /* Novos Estilos para o Layout Moderno */
        .brand-header {
            background-color: #0f2a5b;
            color: #fff;
            padding: 15px 30px;
            display: -webkit-box; /* wkhtmltopdf flex support */
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: -24px -24px 20px -24px; /* Compensate page-inner padding */
        }
        .brand-title {
            font-size: 24px;
            font-weight: 800;
            text-align: right;
            width: 100%;
            text-transform: uppercase;
        }

        .blue-pill-bar {
            background-color: #4472c4; /* Lighter blue */
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: 700;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
            font-size: 14px;
        }

        .styled-table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin-bottom: 0;
            font-size: 12px;
        }

        .styled-table thead tr {
            background-color: #0f2a5b;
            color: #ffffff;
            text-align: left;
        }

        .styled-table th {
            padding: 8px 12px;
            font-weight: 700;
            border: none;
        }
        /* Arredondar cantos superiores da tabela */
        .styled-table thead tr th:first-child { border-top-left-radius: 12px; }
        .styled-table thead tr th:last-child { border-top-right-radius: 12px; }

        .styled-table td {
            padding: 8px 12px;
            border: none;
            /* border-bottom: 1px solid #e5e7eb; */
        }

        /* Zebra Striping */
        .styled-table tbody tr:nth-child(odd) { background-color: #ffffff; }
        .styled-table tbody tr:nth-child(even) { background-color: #f3f4f6; }

        .green-footer-bar {
            background-color: #00b050; /* Green */
            color: white;
            padding: 6px 16px;
            border-radius: 0 0 12px 12px;
            text-align: right;
            font-weight: 700;
            font-size: 13px;
            margin-bottom: 20px;
        }

        /* Helpers */
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .font-bold { font-weight: 700; }

        /* Legado */
        header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
        .client-info { font-size: 12px; line-height: 1.4; }
        .client-info b { font-weight: 700; }
        .meta-info { text-align: right; font-size: 12px; line-height: 1.4; }
        h1 { font-size: 18px; margin: 8px 0 12px; }
        /* table { width: 100%; border-collapse: collapse; margin-top: 8px; } */
        /* th, td { border-bottom: 1px solid var(--border); padding: 8px; font-size: 12px; } */
        /* th { text-align: left; color: var(--muted); font-weight: 600; } */
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
            /* height: 297mm;  <-- REMOVIDO para permitir que o conteúdo flua naturalmente */
            min-height: 297mm; /* Garante altura mínima de A4 */
            width: 210mm; /* A4 width ensures full-bleed background */
            page-break-after: always;
            break-after: page; /* modern property */
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            position: relative; /* establish containing block for background sizing */
            overflow: visible; /* <-- ALTERADO para visible para não cortar conteúdo */
        }
        /* Function-level comment: Content wrapper inside page to preserve padding without shrinking background. */
        /* PT: Wrapper interno para conteúdo com padding; fundo permanece full-bleed. */
        /* EN: Inner wrapper to provide padding while keeping background full-bleed. */
        .page-inner {
            padding: 24px;
            padding-top: 40px; /* Aumentado para forçar espaçamento no topo */
            padding-bottom: 30px;
            box-sizing: border-box;
            min-height: 297mm;
            width: 210mm;
            position: relative;
            z-index: 1;
        }

        /* Força margem superior em elementos que quebram página */
        @media print {
            .section-title, .styled-table, .chips, div[style*="page-break-inside: avoid"] {
                margin-top: 30px;
            }
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
                    <div style="margin-top: 10mm;">
                        <!-- HEADER BAR REMOVIDO -->

                        @php
                            $modulos = $orc['modulos'] ?? [];
                            $groupedModules = [];
                            $hasModules = count($modulos) > 0;
                            if ($hasModules) {
                                foreach ($modulos as $m) {
                                    $etapaKey = $m['etapa'] ?? 'Outros';
                                    $keyLower = strtolower(str_replace(' ', '', $etapaKey));
                                    if ($keyLower === 'etapa1') $etapaKey = 'Etapa 1';
                                    elseif ($keyLower === 'etapa2') $etapaKey = 'Etapa 2';
                                    elseif ($keyLower === 'etapa3') $etapaKey = 'Etapa 3';
                                    $groupedModules[$etapaKey][] = $m;
                                }

                                // Simulação de Combustível (Etapa 3 Virtual)
                                $simulacaoCombustivel = (new \App\Http\Controllers\api\MatriculaController)->simuladorCombustivel(null, ['orc' => $orc]);
                                if ($simulacaoCombustivel['exec'] && $simulacaoCombustivel['valor'] > 0) {
                                    $groupedModules['Etapa 3'] = [[
                                        'nome' => 'Simulação de Combustível',
                                        'valor' => $simulacaoCombustivel['valor'],
                                        'etapa' => 'Etapa 3',
                                        'is_simulacao' => true
                                    ]];
                                }

                                ksort($groupedModules);
                            }
                            // Helper para formatar valor se nao existir
                            if (!function_exists('fmt_valor')) {
                                function fmt_valor($v) {
                                    return App\Services\Qlib::valor_moeda($v, 'R$');
                                }
                            }
                            $inscricaoVal = (float)($matricula['curso']['inscricao'] ?? 0);
                        @endphp

                        <!-- MATRICULA BAR -->
                        @if($inscricaoVal > 0)
                            <div class="blue-pill-bar">
                                <span>Matrícula</span>
                                <span>{{ fmt_valor($inscricaoVal) }}</span>
                            </div>
                        @endif

                        @if($hasModules)
                            @foreach($groupedModules as $stageName => $stageModules)
                                @php
                                    $isEtapa1 = ($stageName === 'Etapa 1');
                                    // Verifica se é Etapa 3 ou se contém "combustível" no nome para aplicar layout específico
                                    $isEtapaCombustivel = (stripos($stageName, 'Etapa 3') !== false || stripos($stageName, 'combustível') !== false);

                                    $stageSubtotal = 0;
                                    foreach($stageModules as $sm) {
                                        $stageSubtotal += (float)($sm['valor'] ?? 0);
                                    }
                                    $footerText = ($stageSubtotal == 0) ? 'GRATUITO' : fmt_valor($stageSubtotal);
                                @endphp

                                @if($isEtapaCombustivel)
                                    <!-- Layout Especial para Etapa de Combustível -->
                                    <table class="styled-table" style="margin-top: 20px;">
                                        <thead>
                                            <tr>
                                                <th style="background-color: #003366; color: white; padding: 10px;">{{ $stageName }}</th>
                                                <th style="background-color: #003366; color: white; text-align: center;">Conteúdo</th>
                                                <th style="background-color: #003366; color: white; text-align: right;">Valor</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td colspan="3" style="padding: 15px; text-align: justify; line-height: 1.5;">
                                                    O custo estimado de combustível para esta proposta é de <b>{{ fmt_valor($stageSubtotal) }}</b>. É importante notar que este valor é uma estimativa e pode variar conforme os preços do combustível no momento do abastecimento. O cálculo final será baseado no preço vigente na data em que o combustível for abastecido, sendo assim, esse valor pode variar.
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    <div style="background-color: #003366; color: white; padding: 10px; text-align: right; font-weight: bold; font-size: 13px; margin-bottom: 20px; border-radius: 0 0 4px 4px;">
                                        VALOR TOTAL COM ESTIMADO DE COMBUSTÍVEL: &nbsp; {{ fmt_valor($matricula['total'] ?? 0) }}
                                    </div>
                                @else
                                    <!-- Layout Padrão para Outras Etapas -->
                                    <table class="styled-table">
                                        <thead>
                                            <tr>
                                                @if($isEtapa1)
                                                    <th style="width: 50px; text-align: center;">{{ $stageName }}</th>
                                                    <th>Conteúdo</th>
                                                    <th>Aula</th>
                                                @else
                                                    <th style="width: 80px; text-align: center;">{{ $stageName }}</th>
                                                    <th>Conteúdo</th>
                                                    <th>Aeronave</th>
                                                    <th class="text-center">Créditos</th>
                                                    <th class="text-right">Valor</th>
                                                @endif
                                            </tr>
                                        </thead>
                                        <tbody>
                                            @foreach($stageModules as $idx => $m)
                                                <tr>
                                                    @if($isEtapa1)
                                                        <td class="text-center">{{ $loop->iteration }}</td>
                                                        <td>{{ $m['nome'] ?? $m['titulo'] ?? '-' }}</td>
                                                        <td>Ground School</td>
                                                    @else
                                                        <td class="text-center">{{ $loop->iteration + 7 }}</td>
                                                        <td>{{ $m['nome'] ?? $m['titulo'] ?? '-' }}</td>
                                                        <td>{{ $m['aircraft_name'] ?? $m['aviao_nome'] ?? '-' }}</td>
                                                        <td class="text-center">{{ $m['limite'] ?? 0 }}</td>
                                                        <td class="text-right">{{ fmt_valor($m['valor']) }}</td>
                                                    @endif
                                                </tr>
                                            @endforeach
                                        </tbody>
                                    </table>

                                    @if(!$isEtapa1)
                                        <div class="green-footer-bar">
                                            @if(stripos($stageName, 'Etapa 2') !== false)
                                                Subtotal: &nbsp; <span style="color: #000;">{{ $footerText }}</span><br>
                                                TOTAL {{ strtoupper($stageName) }}: &nbsp; {{ $footerText }}
                                            @else
                                                {{ $stageName }}: &nbsp;&nbsp; {{ $footerText }}
                                            @endif
                                        </div>
                                    @else
                                        <div style="margin-bottom: 20px;"></div>
                                    @endif
                                @endif
                            @endforeach

                            {{-- Resumo Geral estilo Tabela Limpa --}}
                            <div style="margin-top: 30px;">
                                <table class="styled-table" style="width: 100%; border-top: 1px solid #ddd;">
                                    <thead>
                                        <tr style="background-color: #f9f9f9;">
                                            <th style="color: #000; background-color: transparent; text-align: left; padding: 10px;">Descrição</th>
                                            <th style="color: #000; background-color: transparent; text-align: right; padding: 10px;">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <!-- Matrícula -->
                                        @if($inscricaoVal > 0)
                                        <tr>
                                            <td style="padding: 10px; border-bottom: 1px solid #eee;">Matrícula</td>
                                            <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">{{ fmt_valor($inscricaoVal) }}</td>
                                        </tr>
                                        @endif

                                        <!-- Totais por Etapa (exceto combustível que é separado) -->
                                        @foreach($groupedModules as $stageName => $stageModules)
                                            @php
                                                if (stripos($stageName, 'combustível') !== false || stripos($stageName, 'Etapa 3') !== false) continue;
                                                $sTotal = array_reduce($stageModules, function($carry, $item){ return $carry + (float)($item['valor']??0); }, 0);
                                            @endphp
                                            <tr>
                                                <td style="padding: 10px; border-bottom: 1px solid #eee;">{{ $stageName }}</td>
                                                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">{{ fmt_valor($sTotal) }}</td>
                                            </tr>
                                        @endforeach

                                        <!-- Taxas -->
                                        @php
                                            // Garante que $taxas e $totalTaxas existam neste escopo, caso não tenham sido definidos acima ou perdidos
                                            if (!isset($taxas)) {
                                                $cursoConfig = $matricula['curso']['config'] ?? [];
                                                if (is_string($cursoConfig)) $cursoConfig = json_decode($cursoConfig, true);
                                                $taxas = $cursoConfig['taxas'] ?? [];
                                            }
                                            if (!isset($totalTaxas)) {
                                                $totalTaxas = 0;
                                                foreach($taxas as $t) { $totalTaxas += (float)($t['valor'] ?? 0); }
                                            }
                                        @endphp
                                        @foreach($taxas as $taxa)
                                            <tr>
                                                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #777;">{{ $taxa['titulo'] ?? 'Taxa' }}</td>
                                                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: #777;">{{ fmt_valor($taxa['valor'] ?? 0) }}</td>
                                            </tr>
                                        @endforeach

                                        <!-- Total Taxas -->
                                        @if($totalTaxas > 0)
                                            <tr>
                                                <td style="padding: 10px; border-bottom: 1px solid #eee; color: #cc0000; font-weight: bold;">Total de taxas não inclusas no orçamento:</td>
                                                <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; color: #cc0000; font-weight: bold;">{{ fmt_valor($totalTaxas) }}</td>
                                            </tr>
                                        @endif

                                        <!-- Total Final -->
                                        <tr>
                                            <td style="padding: 15px 10px; color: #00b050; font-weight: 800; font-size: 14px; text-transform: uppercase;">TOTAL DA PROPOSTA A VISTA:</td>
                                            <td style="padding: 15px 10px; text-align: right; color: #00b050; font-weight: 800; font-size: 14px;">
                                                {{-- Calcula total sem combustível para exibir aqui, se necessário, ou usa total formatado geral --}}
                                                {{-- Se houver combustível, o total geral com ele já foi exibido acima. Aqui seria o total "fixo" ou o total final mesmo? --}}
                                                {{-- Assumindo total final da proposta (sem combustível extra se ele for apenas estimado, ou com ele se fizer parte do total) --}}
                                                {{-- Pela imagem, parece ser o total das etapas fixas + taxas --}}
                                                @php
                                                    $totalSemCombustivel = $inscricaoVal + $totalTaxas;
                                                    foreach($groupedModules as $stageName => $stageModules) {
                                                        if (stripos($stageName, 'combustível') !== false || stripos($stageName, 'Etapa 3') !== false) continue;
                                                        $totalSemCombustivel += array_reduce($stageModules, function($carry, $item){ return $carry + (float)($item['valor']??0); }, 0);
                                                    }
                                                    if(isset($desconto) && (float)$desconto > 0) $totalSemCombustivel -= (float)$desconto;
                                                @endphp
                                                {{ fmt_valor($totalSemCombustivel) }}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                                <div style="text-align: right; font-size: 10px; color: #999; margin-top: 5px;">*{{ $matricula['curso_nome'] ?? '' }}</div>
                            </div>

                             <div style="margin-top: 30px; padding: 12px; border: 1px solid #bfdbfe; background-color: #eff6ff; border-radius: 6px; font-size: 11px; color: #1e3a8a; page-break-inside: avoid; break-inside: avoid;">
                                @php
                                    // Recupera observações personalizadas do curso ou usa padrão
                                    $cursoConfig = $matricula['curso']['config'] ?? [];
                                    if (is_string($cursoConfig)) $cursoConfig = json_decode($cursoConfig, true);
                                    $obsProposta = $cursoConfig['obs_proposta'] ?? null;
                                @endphp

                                @if(!empty($obsProposta))
                                    {!! $obsProposta !!}
                                @else
                                    @php
                                        // Tenta pegar a validade do meta da matrícula, senão 7 dias padrão
                                        $diasValidade = isset($meta['validade']) && is_numeric($meta['validade']) ? (int)$meta['validade'] : 7;
                                    @endphp
                                     <p style="font-weight: 700; margin: 0 0 4px;">Observações Importantes</p>
                                     <p style="margin: 0 0 4px;">Este orçamento possui validade de {{ $diasValidade }} ({{ \App\Services\Qlib::convert_number_to_words($diasValidade) }}) dias. O valor apresentado poderá ser pago:</p>
                                     <ul style="margin: 0 0 4px; padding-left: 16px;">
                                         <li>À vista, <strong>com desconto</strong> (já aplicado se houver);</li>
                                         <li>Parcelado em até 12x no cartão de crédito.</li>
                                     </ul>
                                 @endif
                            </div>
                        @endif
                            <div class="section-title" style="page-break-inside: avoid; break-inside: avoid; margin-top: 30px;">Parcelamento</div>
                            <div class="chips" style="page-break-inside: avoid; break-inside: avoid;">
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
                                            <span class="chip">Desconto: R$ {{ number_format((float)$linha['desconto'], 2, ',', '.') }}</span>
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
