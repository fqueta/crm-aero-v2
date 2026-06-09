# Contexto do Projeto

## Resumo

O `crm-aero-v2` e um monorepo focado em operacao comercial, escolar e administrativa de um aeroclube/escola de aviacao.

O sistema combina:

- CRM para captacao e acompanhamento de clientes
- gestao de cursos, turmas e matriculas
- geracao de propostas e contratos
- fluxos financeiros
- operacao/oficina
- CMS e integracoes externas

## Objetivo de Negocio

O produto centraliza a jornada do aluno e do cliente desde o primeiro contato comercial ate:

- criacao da proposta
- definicao de parcelamento
- aprovacao/assinatura
- matricula
- acompanhamento operacional
- rescisao, quando aplicavel

O sistema tambem da suporte a equipe administrativa com modulos de configuracao, CMS, workflows e integracoes.

## Arquitetura

### Backend

Aplicacao Laravel multi-tenant responsavel por:

- API principal
- autenticacao e autorizacao
- regras de negocio
- modelos e persistencia
- geracao de PDFs
- jobs e filas
- webhooks e integracoes

Local principal:

- `backend/`

### Frontend principal

SPA React usada como painel administrativo e para telas publicas especificas.

Local principal:

- `frontend/`

### Frontend embutido no backend

Existe tambem uma interface menor com Inertia dentro do backend.

Locais principais:

- `backend/resources/js/`
- `backend/resources/views/`

## Multi-Tenancy

O sistema usa `stancl/tenancy` e trabalha com tenants identificados por dominio/subdominio.

Isso impacta diretamente:

- conexao com banco
- assets publicos
- rotas tenant-aware
- links publicos de proposta, PDF e rescisao

Arquivos importantes:

- `backend/config/tenancy.php`
- `backend/routes/tenant.php`
- `backend/app/Providers/TenancyServiceProvider.php`

## Modulos de Negocio

### CRM e Comercial

Responsavel por:

- clientes
- atendimentos
- funis
- etapas
- workflows
- metricas
- tracking

Entidades e controllers relevantes:

- `Client`
- `ClientAttendance`
- `Funnel`
- `Stage`
- `Workflow`
- `WorkflowRule`
- `WorkflowAction`
- `backend/app/Http/Controllers/api/ClientController.php`
- `backend/app/Http/Controllers/api/FunnelController.php`
- `backend/app/Http/Controllers/api/WorkflowController.php`

### Escola

Modulo central do produto.

Abrange:

- cursos
- turmas
- matriculas
- contratos
- periodos
- situacoes
- parcelamentos
- responsaveis
- rescisao de contratos

Controllers relevantes:

- `backend/app/Http/Controllers/api/CursoController.php`
- `backend/app/Http/Controllers/api/TurmaController.php`
- `backend/app/Http/Controllers/api/MatriculaController.php`
- `backend/app/Http/Controllers/api/ContratoController.php`
- `backend/app/Http/Controllers/api/PeriodoController.php`
- `backend/app/Http/Controllers/api/ParcelamentoController.php`
- `backend/app/Http/Controllers/api/RescisaoController.php`

### Tipos de Curso

O sistema trabalha com 4 grandes categorias:

1. Cursos teoricos
2. Cursos praticos
3. Cursos mistos
4. Planos de formacao

Os planos de formacao agrupam etapas/cursos em uma jornada maior de formacao do aluno.

### Propostas e PDFs

As propostas sao parte critica do fluxo de matricula.

Capacidades relevantes:

- edicao de proposta
- visualizacao publica
- aprovacao e assinatura
- geracao de PDF
- persistencia do link do PDF no metacampo `proposta_pdf`

Arquivos-chave:

- `backend/app/Http/Controllers/api/PdfController.php`
- `backend/resources/views/pdf/matricula.blade.php`
- `frontend/src/pages/ProposalsEdit.tsx`
- `frontend/src/pages/ProposalsView.tsx`

### Financeiro

O modulo financeiro cobre:

- categorias financeiras
- contas
- pagamentos
- visao geral
- relatorios

Arquivos relevantes:

- `backend/app/Http/Controllers/api/FinancialAccountController.php`
- `backend/app/Http/Controllers/api/FinancialOverviewController.php`

### Oficina e Operacao

O sistema tambem atende a operacao com:

- ordens de servico
- aeronaves
- produtos
- servicos
- categorias

Arquivos relevantes:

- `backend/app/Http/Controllers/api/ServiceOrderController.php`
- `backend/app/Http/Controllers/api/AircraftController.php`
- `backend/app/Http/Controllers/api/ProductController.php`

### CMS e Conteudo

O CMS interno administra:

- componentes
- tipos de conteudo
- paginas
- uploads

Esse modulo e usado inclusive por fluxos de proposta e rescisao.

Arquivos relevantes:

- `backend/app/Http/Controllers/api/ComponentController.php`
- `backend/app/Http/Controllers/api/ContentTypeController.php`
- `backend/app/Http/Controllers/api/PaginaController.php`
- `frontend/src/pages/SiteComponentsList.tsx`

## Integracoes

As integracoes mais visiveis no codigo atual incluem:

- ZapSign / Zapsing
- Brevo
- webhooks customizados
- tracking

Arquivos relevantes:

- `backend/app/Http/Controllers/api/ZapsingController.php`
- `backend/app/Http/Controllers/api/ZapguruController.php`
- `backend/app/Http/Controllers/api/WebhookController.php`
- `backend/app/Services/BrevoService.php`

## Fluxos Importantes

### Fluxo de proposta

Fluxo observado:

1. proposta criada/editada no painel
2. definicao de valores e parcelamento
3. visualizacao da proposta
4. geracao de PDF
5. assinatura/aprovacao publica
6. persistencia do link gerado

### Fluxo de rescisao

Ja existe uma implementacao relevante para rescisao de contratos, incluindo:

- listagem administrativa
- calculadora de rescisao
- pagina publica por token
- renderizacao de termo HTML via componente CMS

Arquivos-chave:

- `frontend/src/pages/school/Termination.tsx`
- `frontend/src/pages/PublicTerminationRequest.tsx`
- `backend/app/Http/Controllers/api/RescisaoController.php`
- `backend/database/seeders/tenant/TermoRescisaoSeeder.php`

## Rotas e Exposicao

O backend distribui a exposicao entre:

- `backend/routes/api.php`
- `backend/routes/tenant.php`
- `backend/routes/web.php`

Padroes observados:

- base `/api/v1/`
- rotas publicas para alguns fluxos de proposta, assinatura, aprovacao, webhooks e rescisao
- rotas autenticadas com `auth:sanctum`
- forte uso de resources REST

## Dados e Persistencia

Pontos importantes sobre dados:

- migrations globais e migrations de tenant
- seeders extensivos para menu, permissoes, cursos, turmas, componentes e integracoes
- uso do model `Post` como estrutura generica para varios tipos de conteudo

Pastas importantes:

- `backend/database/migrations/`
- `backend/database/migrations/tenant/`
- `backend/database/seeders/`

## Estrutura Tecnica Resumida

```text
backend/
  app/
    Http/Controllers/
    Models/
    Services/
    Jobs/
    Events/
    Listeners/
  config/
  routes/
  database/
  resources/

frontend/
  src/
    pages/
    components/
    services/
    contexts/
    hooks/
    lib/
    types/
```

## Arquivos-Chave Para Entender o Sistema

- `backend/composer.json`
- `backend/bootstrap/app.php`
- `backend/routes/api.php`
- `backend/routes/tenant.php`
- `backend/config/tenancy.php`
- `backend/app/Http/Controllers/api/MatriculaController.php`
- `backend/app/Http/Controllers/api/PdfController.php`
- `backend/app/Http/Controllers/api/RescisaoController.php`
- `frontend/package.json`
- `frontend/src/App.tsx`
- `frontend/src/services/BaseApiService.ts`

## Observacoes

- O projeto tem forte dependencia de configuracao por tenant e de dados seedados.
- Parte do comportamento funcional depende de componentes CMS e metacampos em `posts/postmeta`.
- O fluxo de PDF exige atencao especial a ambiente local, engine usada e caminhos de binarios.
- Ha documentacao auxiliar em `.trae/documents/` que complementa este arquivo.
