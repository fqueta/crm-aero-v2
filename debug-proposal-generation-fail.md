# Debug Session: proposal-generation-fail

Status: OPEN

## Symptom
- A geracao da proposta/PDF nao esta acontecendo apos acionar o fluxo de gerar proposta.

## Initial Hypotheses
- H1: O job `GeraPdfPropostasPnlJob` executa, mas nao persiste `meta.proposta_pdf` no registro.
- H2: A renderizacao/geracao do PDF falha dentro do job por erro silencioso ou excecao nao observada.
- H3: O job recebe um `id`/payload incorreto e nao encontra a matricula/proposta esperada.
- H4: O storage/disco/caminho do PDF esta incorreto ou sem permissao de escrita.
- H5: O backend salva o PDF, mas o frontend consulta outro campo/meta e por isso aparenta nao ter gerado.

## Plan
- Ler o fluxo de frontend para identificar endpoint e expectativa de retorno.
- Ler controller/service/job relacionados a geracao da proposta.
- Instrumentar pontos minimos de observacao no backend.
- Reproduzir o fluxo e coletar evidencias.
- Confirmar causa raiz e propor correcao minima.
