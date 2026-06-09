# Debug Session: course-type-4-pdf

Status: OPEN

## Contexto
- Sintoma: no ambiente dev, a geração de proposta PDF falha para curso do tipo `4`.
- Erro atual exibido: `wkhtmltopdf exec fallback failed. Exit code: 1. Output: ...`.
- Escopo inicial: rota pública `/api/v1/pdf/propostas/public/{clientId}/{matriculaId}`.

## Hipóteses
1. O comando montado para o `wkhtmltopdf` está ficando com quoting inválido para algum asset/caminho específico do curso tipo `4`.
2. O HTML gerado para o curso tipo `4` referencia imagens/arquivos que o `wkhtmltopdf` não consegue carregar.
3. O conteúdo específico do curso tipo `4` produz um HTML que falha no `wkhtmltopdf`, mas sem stderr útil.
4. O fallback com `exec()` está executando, porém o comando precisa de escape diferente no Windows para essa proposta.
5. Existe dado/configuração específica do curso tipo `4` quebrando apenas esse fluxo.

## Plano
1. Coletar o comando/log exato da falha para o curso tipo `4`.
2. Comparar o HTML e os assets gerados com um curso que funciona.
3. Confirmar qual hipótese se sustenta.
4. Aplicar a correção mínima baseada na evidência.
5. Validar novamente e depois limpar os artefatos.

## Evidências
- HTML estável localizado: `storage/tenantapi-crm/app/tmp/wkhtmltopdf-html/matricula-7-128-queta-programador.html`.
- O mesmo HTML gerou PDF com sucesso manualmente no PowerShell para:
  - `manual-matricula-7.pdf`
  - `matricula-7-128-queta-programador.pdf`
- Logo, a hipótese de HTML inválido e a hipótese de caminho de saída inválido perdem força.
- O erro exibido pela rota atual vem do fallback em `generateWithWkhtmltopdf()` ao executar `exec($command . ' 2>&1', ...)`.
- Causa provável atual: diferença de shell/escaping entre a execução via PHP `exec()` no Windows e a execução manual no PowerShell.
