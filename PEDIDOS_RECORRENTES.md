# Pedidos Recorrentes

## Objetivo

Este documento consolida as principais implementacoes, ajustes, diagnosticos e decisoes tecnicas realizadas ate o momento no projeto `crm-aero-v2`.

O foco aqui e registrar:

- entregas funcionais
- ajustes de interface
- alteracoes em rotas
- evolucoes no fluxo de propostas e PDF
- diagnosticos feitos em desenvolvimento e producao
- documentacao adicionada ao repositorio

## Resumo Executivo

A frente de trabalho concentrou-se em quatro grupos principais:

1. melhorias de usabilidade no frontend administrativo
2. evolucao do fluxo de visualizacao e geracao de propostas em PDF
3. diagnostico e estabilizacao do motor de PDF no ambiente Windows/dev
4. criacao de documentacao tecnica e contextual do projeto

## Entregas Funcionais

### 1. Lista de componentes CMS com duplo clique para editar

Foi adicionada a navegacao por duplo clique na listagem de componentes/CMS, abrindo diretamente a tela de edicao do item selecionado.

Impacto:

- melhora de usabilidade na operacao do CMS
- edicao mais rapida sem depender apenas de menu de acoes

Arquivo relacionado:

- `frontend/src/pages/SiteComponentsList.tsx`

### 2. Botao Visualizar com atualizacao forcada

Na tela de edicao da proposta, o botao `Visualizar` foi ajustado para abrir a pagina seguinte com recarga completa, evitando reutilizacao indevida de estado SPA/cache.

Impacto:

- a tela de visualizacao sempre carrega dados atualizados
- reduz risco de exibir versao antiga da proposta

Arquivo relacionado:

- `frontend/src/pages/ProposalsEdit.tsx`

### 3. Rota para gerar PDF da proposta por cliente e matricula

Foi criada uma rota para gerar o PDF da proposta informando:

- `id_do_cliente`
- `id_matricula`

Inicialmente a rota foi criada em contexto administrativo e depois exposta como rota publica.

Rotas relacionadas:

- rota administrativa inicial
- rota publica final no padrao `/api/v1/pdf/propostas/public/{clientId}/{matriculaId}`

Arquivos relacionados:

- `backend/routes/api.php`
- `backend/routes/tenant.php`
- `backend/app/Http/Controllers/api/PdfController.php`

### 4. Botao Gerar PDF na visualizacao da proposta

Na tela de visualizacao da proposta:

- o botao `Gerar PDF` passou a abrir a rota publica criada
- foi criado um segundo botao para administradores com `permission_id = 1`
- o segundo botao preserva o comportamento de geracao assincrona

Impacto:

- usuarios comuns usam o fluxo publico de abertura/geracao do PDF
- administradores mantem acesso ao fluxo assincrono ja existente

Arquivo relacionado:

- `frontend/src/pages/ProposalsView.tsx`

### 5. Total da proposta fixo no rodape da edicao

Foi adicionado um resumo fixo no rodape da tela de edicao da proposta exibindo o `Total da Proposta` em tempo real.

Impacto:

- melhora de usabilidade
- facilita conferencia do valor sem precisar voltar ao topo ou a secoes intermediarias

Arquivos relacionados:

- `frontend/src/pages/ProposalsEdit.tsx`
- `frontend/src/components/ui/edit-footer-bar.tsx`

## Evolucao do Fluxo de PDF da Proposta

### 1. Uso de Snappy/wkhtmltopdf como engine principal

Foi ajustado o fluxo para priorizar `wkhtmltopdf/snappy` no processo de geracao do PDF da proposta, especialmente no endpoint publico criado para esse fim.

Motivacao:

- preferencia explicita pelo uso de Snappy
- maior previsibilidade do fluxo atual do projeto

Arquivo relacionado:

- `backend/app/Http/Controllers/api/PdfController.php`

### 2. Persistencia do link no metacampo `proposta_pdf`

Apos gerar o PDF, o link resultante passou a ser persistido no metacampo `proposta_pdf`.

Objetivo:

- manter rastreabilidade do ultimo PDF valido gerado
- permitir reutilizacao controlada do link

Arquivo relacionado:

- `backend/app/Http/Controllers/api/PdfController.php`

### 3. Correcao para nao abrir PDF antigo/incorreto

Foi identificado que, em alguns cenarios, o fluxo podia acabar abrindo um PDF antigo sem relacao com a proposta atual.

Correcao aplicada:

- remocao do fallback indevido para link antigo
- abertura apenas do PDF efetivamente gerado para a proposta corrente
- adicao de `force` e timestamp no frontend para evitar cache

Arquivos relacionados:

- `backend/app/Http/Controllers/api/PdfController.php`
- `frontend/src/pages/ProposalsView.tsx`

### 4. Ajustes no `wkhtmltopdf` para ambiente Windows/dev

Foram aplicados varios ajustes tecnicos para estabilizar a geracao no ambiente local Windows:

- nao enviar `header-html` e `footer-html` vazios
- ignorar fundos que nao sejam imagem valida
- simplificar renderizacao do fundo no template PDF
- estabilizar a geracao em disco antes da chamada ao binario

Arquivos relacionados:

- `backend/app/Http/Controllers/api/PdfController.php`
- `backend/resources/views/pdf/matricula.blade.php`

### 5. Correcao definitiva no fallback local Windows

Foi confirmado que o problema principal no dev/Windows nao era o HTML da proposta, mas a forma de execucao do `wkhtmltopdf` via PHP/Symfony Process para certos cenarios.

Ajuste realizado:

- mudanca do caminho de execucao do fallback local
- gravacao de HTML estavel em disco
- uso de estrategia de execucao que funcionou corretamente no ambiente local

Resultado:

- o fluxo voltou a gerar PDF corretamente no dev para os casos analisados
- o link gerado continuou sendo persistido em `proposta_pdf`

Arquivo relacionado:

- `backend/app/Http/Controllers/api/PdfController.php`

## Diagnosticos Realizados

### 1. Producao com erro de permissao em `storage/framework/views`

Foi analisado um erro em producao durante a geracao/renderizacao da proposta:

- `file_put_contents(.../storage/framework/views/...): Failed to open stream: Permission denied`

Conclusao:

- o problema nao era o PDF em si
- a causa provavel era permissao de escrita do Laravel nas pastas:
  - `storage/`
  - `storage/framework/views`
  - `bootstrap/cache`

Encaminhamento sugerido:

- revisar `owner`, grupo e permissoes no servidor
- limpar caches do Laravel apos ajuste

### 2. Investigacao do curso tipo 4 no dev

Foi aberto um diagnostico especifico para um caso onde propostas de `tipo de curso 4` ainda falham no dev com:

- `wkhtmltopdf exec fallback failed. Exit code: 1`

Evidencia atual:

- o HTML gerado parece valido
- a geracao manual do PDF via PowerShell funcionou
- a falha parece concentrada na forma como o comando e invocado pela aplicacao

Documento de apoio:

- `debug-course-type-4-pdf.md`

Status:

- investigacao em andamento

### 3. Investigacao anterior do fluxo de geracao de proposta

Tambem foi mantido um registro auxiliar de depuracao do fluxo de geracao de proposta em:

- `debug-proposal-generation-fail.md`

Esse arquivo serve como historico tecnico de hipoteses e evidencias usadas durante a estabilizacao da geracao de PDF.

## Melhorias de Documentacao

### 1. README principal do projeto

Foi criado um `README.md` na raiz com:

- visao geral do monorepo
- stack
- estrutura de pastas
- requisitos
- setup local
- comandos uteis
- visao geral de multi-tenancy
- resumo do fluxo de PDF

Arquivo:

- `README.md`

### 2. Documento de contexto do projeto

Foi criado um documento consolidando o contexto funcional e arquitetural do sistema.

Conteudo:

- objetivo de negocio
- arquitetura
- multi-tenancy
- modulos de negocio
- fluxo de proposta
- fluxo de rescisao
- arquivos-chave

Arquivo:

- `CONTEXTO_DO_PROJETO.md`

### 3. Este documento de historico

Este arquivo foi criado para complementar os dois anteriores com uma visao temporal/pratica do que foi feito.

Arquivo:

- `PEDIDOS_RECORRENTES.md`

## Arquivos Mais Relevantes Alterados ou Tocadas no Processo

### Backend

- `backend/app/Http/Controllers/api/PdfController.php`
- `backend/resources/views/pdf/matricula.blade.php`
- `backend/routes/api.php`
- `backend/routes/tenant.php`

### Frontend

- `frontend/src/pages/ProposalsEdit.tsx`
- `frontend/src/pages/ProposalsView.tsx`
- `frontend/src/pages/SiteComponentsList.tsx`
- `frontend/src/components/ui/edit-footer-bar.tsx`

### Documentacao

- `README.md`
- `CONTEXTO_DO_PROJETO.md`
- `PEDIDOS_RECORRENTES.md`
- `debug-proposal-generation-fail.md`
- `debug-course-type-4-pdf.md`

## Pendencias e Pontos de Atencao

- concluir a investigacao do erro do `tipo de curso 4` no dev
- validar todos os cenarios de proposta com a engine principal `wkhtmltopdf`
- revisar setup e permissoes de producao para evitar falhas de escrita em `storage/framework/views`
- decidir se o fluxo publico de PDF deve sempre regenerar ou se deve reutilizar `proposta_pdf` em cenarios controlados

## Observacao Final

Nem todas as alteracoes listadas aqui necessariamente aparecem como modificacoes locais atuais no `git status`, porque parte delas pode ja ter sido salva, commitada, ajustada em outra etapa ou apenas diagnosticada/documentada durante a sessao de trabalho.

Este documento deve ser atualizado conforme novas entregas e correcoes avancem.
