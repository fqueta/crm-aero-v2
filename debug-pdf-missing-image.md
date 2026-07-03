# Debug Session: pdf-missing-image

Status: OPEN

## Contexto
- Sintoma: o PDF da proposta esta sendo gerado, mas continua sem imagem.
- Ambiente observado: desenvolvimento local no Windows.
- Escopo inicial: fluxo de geracao em `backend/app/Http/Controllers/api/PdfController.php` e template `backend/resources/views/pdf/matricula.blade.php`.

## Hipoteses
1. A URL/caminho da imagem nao esta chegando preenchida na view do PDF.
2. A view esta recebendo a imagem, mas o HTML final nao a renderiza por condicao/template.
3. O `wkhtmltopdf` esta ignorando a imagem por caminho local/URL inacessivel.
4. A imagem esta sendo filtrada por alguma validacao de extensao/tipo e acaba descartada.
5. O PDF gerado tem imagem apenas em uma parte do fluxo, mas o endpoint atual usa outro conjunto de dados/template.

## Plano
1. Ler o fluxo que monta `background_url`, logo e assets do PDF.
2. Instrumentar logs minimos para capturar os valores reais usados na geracao.
3. Reproduzir a geracao e coletar evidencia.
4. Confirmar ou rejeitar as hipoteses.
5. Aplicar a correcao minima baseada em evidencia e validar novamente.

## Evidencias
- Pendente.
