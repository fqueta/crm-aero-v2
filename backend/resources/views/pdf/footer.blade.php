<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #ffffff;
        }
        .footer-container {
            width: 100%;
            margin: 0;
            padding: 5px 0 5px 0;
            /* border-top: 1px solid #ddd; */
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 7pt;
        }
        .footer-left, .footer-all {
            width: 100%;
        }
        .footer-right {
            width: 40%;
            text-align: right;
            float: right;
            padding-right: 30px
        }
        .footer-logo {
            height: 25px;
            max-width: 100%;
        }
        .footer-container img {
            display: block; /* Remove espaços abaixo da imagem */
            width: 100%; /* Ou tamanho fixo conforme necessário */
            height: auto;
        }
    </style>
</head>
<body>
    <div class="footer-container">
        {{-- <div class="footer-left">
            <img src="{{ public_path('images/left-footer-logo.png') }}" class="footer-logo">
        </div> --}}

        {{-- <div class="footer-right">
            Documento gerado em: {{ now()->format('d/m/Y H:i') }} pelo CRM Aeroclubejf<br>
        </div> --}}
        <img src="https://crm.aeroclubejf.com.br/enviaImg/uploads/ead/67f8242bbaf7a/67fd80f044fb2.png" class="footer-logo">
    </div>
</body>
</html>
