<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Preview Fundo A4</title>
    <style>
        /* Configuração de página A4 sem margens para validação visual */
        @page { size: A4; margin: 0; }

        html, body { height: 100%; }
        body { margin: 0; padding: 0; }

        .page {
            width: 210mm;
            height: 297mm;
            margin: 0;
            background-color: #ffffff;
            background-repeat: no-repeat;
            background-position: center center;
            background-image: url('{{ $background_url ?? "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='2480' height='3508'%3E%3Crect width='100%25' height='100%25' fill='%231b1b18'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='120' fill='white'%3EA4 Background%3C/text%3E%3C/svg%3E" }}');
            background-size: 100% 100%; /* preencher página inteira */
            position: relative;
        }

        .page-inner { position: absolute; inset: 0; padding: 15mm; }
        .title { font-family: Arial, sans-serif; font-size: 18px; margin: 0 0 8mm; }
        .text { font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5; }
    </style>
</head>
<body>
    <div class="page">
        <div class="page-inner">
            <h1 class="title">Validação de Fundo A4 Full‑Bleed</h1>
            <p class="text">
                Esta página usa <code>background-size: 100% 100%</code> e margens 0 para garantir que a imagem
                de fundo ocupe toda a área da A4. Use o parâmetro <code>?bg=URL</code> para testar diferentes imagens.
            </p>
        </div>
    </div>
</body>
</html>