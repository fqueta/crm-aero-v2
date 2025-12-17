<!DOCTYPE html>
<html>
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <style>
        body {
            margin: 0;
            /* padding: 0; */
            padding-bottom: 7px;
            /* background-color: #f1f1f1; */
        }
        .header {
            margin: 0 0 10px 0;
            padding: 0;
            width: 100%;
        }
        .header img {
            display: block; /* Remove espaços abaixo da imagem */
            width: 100%; /* Ou tamanho fixo conforme necessário */
            height: auto;
        }
        .header-info {
            font-size: 9pt;
            color: #555;
            margin-top: 5px;
        }

    </style>
</head>
<body>
    <div class="header">
        <!-- Imagem do cabeçalho -->
        <img src="https://crm.aeroclubejf.com.br/enviaImg/uploads/ead/67fd5bad5a8ee/67fd7dffaa524.png" alt="" >

        <!-- Informações adicionais (opcional) -->
        {{-- <div class="header-info">
            Relatório Gerado em: {{ now()->format('d/m/Y H:i') }}
        </div> --}}
    </div>
</body>
</html>
