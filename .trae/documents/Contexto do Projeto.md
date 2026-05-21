# Contexto do Projeto

## Visão Geral

Este repositório é um monorepo do CRM Aero com duas aplicações principais:

- `backend/`: aplicação Laravel responsável pela API, autenticação, regras de negócio, multi-tenant, geração de PDFs e parte de uma interface via Inertia.
- `frontend/`: SPA principal em React/Vite/TypeScript, usada como painel administrativo e para telas públicas.

O núcleo operacional atual do produto parece estar concentrado na SPA em `frontend/`, consumindo a API tenant-aware do Laravel.

O sistema gera **propostas de orçamento** para pacotes de horas (cursos práticos) e planos de formação (formação completa de pilotos), gerenciando 4 tipos de cursos: teóricos, práticos, mistos e planos de formação.

## Stack Principal

### Backend

- Laravel 12
- PHP 8.2
- Laravel Sanctum (token-based API auth)
- Inertia.js (SSR, uso menor)
- Stancl Tenancy v3.9 (multi-tenancy por domínio/subdomínio)
- Barryvdh Laravel Snappy para PDF (via wkhtmltopdf)
- maatwebsite/excel (planilhas)

Arquivo de referência:

- `backend/composer.json`

### Frontend Principal

- React 18
- Vite 5 (dev server na porta 3000, host: true)
- TypeScript
- React Router DOM v6
- TanStack React Query v5
- Tailwind CSS 3 + shadcn-ui (Radix UI primitives)
- react-hook-form + zod (formulários)
- Recharts (gráficos)
- @dnd-kit (drag and drop)
- @xyflow/react (diagramas de fluxo)

Arquivo de referência:

- `frontend/package.json`
- `frontend/vite.config.ts`
- `frontend/tailwind.config.ts`
- `frontend/components.json`

### Frontend Embutido no Backend

Existe também uma interface React menor dentro do backend via Inertia:

- `backend/resources/js/app.tsx`
- `backend/resources/js/pages/`

## Arquitetura Geral

### Estrutura de Alto Nível

- `backend/`: API, domínio de negócio, jobs, eventos, listeners, middlewares, models, migrations, seeders e rotas.
- `frontend/`: páginas, componentes, hooks, contexts e serviços para consumo da API.
- `.trae/documents/`: documentação auxiliar do projeto.

### Multi-Tenant

O sistema é preparado para multi-tenancy por domínio/subdomínio usando `stancl/tenancy`.

Observações relevantes:

- O backend possui rotas tenant-aware.
- O frontend consome endpoints ajustados ao tenant.
- Há configuração dedicada de tenancy no backend.

Arquivos de referência:

- `backend/config/tenancy.php`
- `backend/routes/tenant.php`

## Pontos de Entrada

### Backend

- `backend/public/index.php`: entrada HTTP da aplicação Laravel.
- `backend/bootstrap/app.php`: bootstrap do framework, registro de rotas e middlewares.

### Frontend SPA

- `frontend/index.html`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx` — providers (QueryClient, Theme, Auth, UserPrefs, Tooltip) + todas as rotas

## Rotas e Exposição da API

### Backend

As rotas estão distribuídas principalmente em:

- `backend/routes/api.php`
- `backend/routes/tenant.php`
- `backend/routes/web.php`
- `backend/routes/auth.php`
- `backend/routes/settings.php`
- `backend/routes/console.php`

### Padrões observados

- Base path: `/api/v1/` com middleware de tenant (`InitializeTenancyByDomain`, `PreventAccessFromCentralDomains`)
- Rotas públicas para autenticação, redefinição de senha e visualização/aprovação/assinatura de proposta.
- Rotas autenticadas com `auth:sanctum` e middleware de usuário ativo.
- Uso extensivo de `Route::apiResource(...)` para CRUD dos módulos principais.

### Endpoints da API (visão detalhada)

**Rotas públicas (sem auth):**
| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/api/v1/login` | Login |
| POST | `/api/v1/register` | Registro |
| POST | `/api/v1/forgot-password` | Solicitar reset de senha |
| POST | `/api/v1/reset-password` | Resetar senha com token |
| GET | `/api/v1/user/validate-token/{token}` | Validar token |
| GET | `/api/v1/proposal/{client_id}/{matricula_id}` | Visualizar proposta pública |
| POST | `/api/v1/proposal/{client_id}/{matricula_id}/sign` | Assinar proposta |
| POST | `/api/v1/proposal/{client_id}/{matricula_id}/approve` | Aprovar proposta |
| GET | `/api/v1/proposal/{client_id}/{matricula_id}/contracts-html` | HTML dos contratos |
| POST | `/api/v1/tracking/whatsapp-contact` | Rastreamento de contato WhatsApp |
| ANY | `/api/v1/webhook/{endp1}` e `/{endp1}/{endp2}` | Endpoints de webhook |

**Rotas autenticadas (`auth:sanctum` + `auth.active`):**

| Módulo | Recursos |
|---|---|
| **Usuários & Auth** | `/user`, `/user/profile`, `/user/can`, `/logout`, `/users` (apiResource) |
| **Clientes** | `/clients` (apiResource com soft delete/restore), `/clients/{id}/attendances` |
| **Responsáveis** | `/responsaveis` (apiResource) |
| **Funis & Etapas** | `/funnels` (apiResource + toggle-active + reorder), `/stages` (apiResource + reorder dentro de funnel) |
| **Workflows** | `/workflows`, `/workflow-rules`, `/workflow-actions` (apiResource), `/workflow/metrics` |
| **Escola - Cursos** | `/cursos` (também `/courses`) — apiResource |
| **Escola - Turmas** | `/turmas` (também `/classes`) — apiResource |
| **Escola - Matrículas** | `/matriculas` (apiResource + etapa/status rápido + gerar-contratos + enviar-zapsign) |
| **Escola - Contratos/Períodos/Situações** | `/contratos`, `/periodos`, `/situacoes-matricula` (apiResource) |
| **Escola - Parcelamentos** | `/parcelamentos` (apiResource), `/simulador-combustivel/{id_matricula}` |
| **Financeiro** | `/financial/categories`, `/financial/accounts` (apiResource), `/financial/accounts-payable/*`, `/financial/accounts-receivable/*`, `/financial/overview` |
| **Relatórios** | `/reports/general-conversion`, `/reports/user-access`, `/financial/reports/won-proposals` |
| **Produtos & Serviços** | `/products`, `/services`, `/categories` (+ tree), `/product-units`, `/service-units` |
| **Oficina** | `/service-orders` (apiResource + status), `/aircraft`, `/aeronaves` |
| **CMS** | `/tipos-conteudo`, `/componentes` (+ duplicate), `/uploads`, `/paginas` |
| **Configurações** | `/permissions`, `/menus`, `/integracoes`, `/options`, `/dashboard-metrics`, `/event-logs`, `/tracking` |
| **PDF** | `/pdf/matriculas/{id}`, `/pdf/componentes` |
| **Importação** | `/import` |

## Módulos de Negócio Identificados

### CRM e Comercial

- Clientes (Client, ClientAttendance)
- Leads
- Funis (Funnel, Stage)
- Propostas
- Workflows (Workflow, WorkflowRule, WorkflowAction)
- Métricas comerciais (DashboardMetric)
- Tracking de eventos (TrackingEvent)
- EventLog (auditoria)

Controllers relacionados:

- `ClientController`
- `ClientAttendanceController`
- `FunnelController`
- `StageController`
- `WorkflowController`
- `WorkflowRuleController`
- `WorkflowActionController`
- `TrackingEventController`
- `EventLogController`

### Escola

O sistema gerencia 4 tipos de cursos:

1. **Cursos Teóricos** — aulas em solo, disciplinas teóricas (ex: formações teóricas, legislação, navegação)
2. **Cursos Práticos** — horas de voo, instrução prática em aeronave
3. **Cursos Mistos** — combinação de teoria + prática em um mesmo curso
4. **Planos de Formação** — pacotes estruturados que agrupam múltiplos cursos (teóricos e/ou práticos) em uma jornada de formação completa (ex: PP — Piloto Privado, PC — Piloto Comercial, IFR — Voo por Instrumentos)

A arquitetura usa o model `Curso` para representar todos os tipos, com um campo `tipo` (ou lógica similar) para diferenciar teórico, prático, misto ou plano de formação. Propostas de orçamento são geradas tanto para pacotes de horas (cursos práticos avulsos) quanto para planos de formação completos.

- Cursos (Curso) — 4 tipos: teórico, prático, misto, plano de formação
- Turmas (Turma)
- Matrículas (Matricula)
- Contratos (Post com post_type=contratos)
- Períodos (Post com post_type=periodos)
- Situações de matrícula (Post com post_type=situacao_matricula)
- Parcelamentos (Parcelamento, MatriculaParcelamento)
- Responsáveis (Client com permission_id=8)
- Interessados

Controllers relacionados:

- `MatriculaController`
- `CursoController`
- `TurmaController`
- `ContratoController`
- `PeriodoController`
- `ParcelamentoController`
- `SituacaoMatriculaController`

### Financeiro

- Categorias financeiras (FinancialCategory)
- Contas financeiras unificadas (FinancialAccount — contas a pagar + receber)
- Pagamentos de contas (FinancialAccountPayment)
- Visão geral financeira
- Relatórios de propostas ganhas e conversão

Controllers relacionados:

- `FinancialCategoryController`
- `FinancialAccountController`
- `FinancialOverviewController`

### Oficina e Operação

- Ordens de serviço (ServiceOrder, ServiceOrderItem)
- Serviços (Service)
- Produtos (Product, ProductUnit)
- Categorias hierárquicas (Category)
- Aeronaves (Aircraft, Aeronave)

Controllers relacionados:

- `ServiceOrderController`
- `ServiceController`
- `ProductController`
- `CategoryController`
- `AircraftController`
- `AeronaveController`

### CMS e Integrações

- Tipos de conteúdo
- Componentes
- Páginas
- Uploads
- Webhooks
- Integrações externas (ZapSign, WhatsApp/Brevo, etc.)

Controllers relacionados:

- `ContentTypeController`
- `ComponentController`
- `PaginaController`
- `UploadController`
- `WebhookController`
- `ApiCredentialController`
- `ZapsingController`
- `ZapguruController`

## Frontend Principal

O frontend principal está centralizado em `frontend/src/` e segue uma divisão por responsabilidade:

- `pages/`: ~90 páginas da aplicação
- `components/`: ~23 pastas de componentes por domínio
- `hooks/`: hooks customizados
- `contexts/`: AuthContext, ThemeContext, UserPrefsContext
- `services/`: ~45 arquivos de serviço de API (um por entidade de domínio)
- `lib/`: utilitários, máscaras, definições de menu, zapsign
- `types/`: definições de tipos TypeScript por domínio
- `integrations/`: módulos de integração com terceiros
- `styles/`: CSS de impressão

Arquivos-chave:

- `frontend/src/App.tsx` — providers + todas as rotas
- `frontend/src/contexts/AuthContext.tsx` — login, logout, permissões, menu
- `frontend/src/services/BaseApiService.ts` — classe base abstrata para chamadas API (URL tenant-aware, headers de auth, tratamento de erros)
- `frontend/src/lib/menu.ts` — definição do menu lateral padrão
- `frontend/src/lib/menuPermissions.ts` — filtragem de menu por permissões

## Rotas Completas da SPA (App.tsx)

### Rotas Públicas (sem auth)

| Rota | Componente | Descrição |
|---|---|---|
| `/` | `LandingPage` | Landing page |
| `/login` | `Login` | Login |
| `/register` | `Register` | Registro |
| `/forgot-password` | `ForgotPassword` | Recuperar senha |
| `/reset-password` | `ResetPassword` | Redefinir senha |
| `/form-client-active/:cpf` | `PublicClientForm` | Formulário público por CPF |
| `/aluno/matricula/:compositeId/1` | `ProposalSignature` | Assinatura de proposta do aluno |
| `/aluno/assinatura/:compositeId/1` | `ProposalSignature` | Alias para assinatura |
| `/aluno/matricula/:compositeId/2` | `ProposalApproval` | Aprovação de proposta |
| `/aluno/matricula/:compositeId/2/aprovado` | `ProposalApproved` | Confirmação pós-aprovação |

### Rotas Protegidas (`/admin/*`)

**Dashboard:**
- `/admin` → `AeroclubeDashboard`
- `/admin/aero-dashboard` → `AeroclubeDashboard`
- `/admin/metrics-dashboard` → `MetricsDashboard`

**CRM / Clientes:**
- `/admin/clients` → `Clients`
- `/admin/clients/create` → `ClientCreate`
- `/admin/clients/:id/view` → `ClientView`
- `/admin/clients/:id/edit` → `ClientEdit`
- `/admin/customers/leads` → `CustomersLeads`
- `/admin/partners` → `Partners`

**Vendas / Propostas:**
- `/admin/sales` → `Sales`
- `/admin/sales/proposals/create` → `ProposalsCreate`
- `/admin/sales/proposals/edit/:id` → `ProposalsEdit`
- `/admin/sales/proposals/view/:id` → `ProposalsView`

**Escola:**
- `/admin/school/courses` → `Courses`
- `/admin/school/courses/create` → `CourseCreate`
- `/admin/school/courses/:id/edit` → `CourseEdit`
- `/admin/school/classes` → `Classes`
- `/admin/school/classes/create` → `ClassCreate`
- `/admin/school/classes/:id/edit` → `ClassEdit`
- `/admin/school/contracts` → `ContractsList`
- `/admin/school/contracts/create` → `ContractCreate`
- `/admin/school/contracts/:id/edit` → `ContractEdit`
- `/admin/school/periods` → `PeriodsList`
- `/admin/school/periods/create` → `PeriodCreate`
- `/admin/school/periods/:id/edit` → `PeriodEdit`
- `/admin/school/periods/:id` → `PeriodDetail`
- `/admin/school/enroll` → `Enroll`
- `/admin/school/interested` → `Interested`
- `/admin/school/enrollment-situation` → `EnrollmentSituationPage`

**Oficina / Operações:**
- `/admin/service-orders` → `ServiceOrders`
- `/admin/service-orders/create` → `CreateServiceOrder`
- `/admin/service-orders/quick-create` → `QuickCreateServiceOrder`
- `/admin/service-orders/update/:id` → `UpdateServiceOrder`
- `/admin/service-orders/show/:id` → `ShowServiceOrder`
- `/admin/aircrafts` → `Aircraft`
- `/admin/aircrafts/:id` → `AircraftView`
- `/admin/services` → `Services`
- `/admin/services/:id` → `ServiceView`
- `/admin/products` → `Products`
- `/admin/products/create` → `ProductCreate`
- `/admin/products/:id/edit` → `ProductEdit`
- `/admin/products/:id` → `ProductView`
- `/admin/categories` → `Categories`

**Financeiro:**
- `/admin/financial` → `Financial`
- `/admin/financial/categories` → `FinancialCategories`

**Relatórios:**
- `/admin/reports/relatorio-vendas` → `WonProposalsReport`
- `/admin/reports/relatorio-geral` → `GeneralConversionReport`
- `/admin/reports/financial` → `WonProposalsReport`
- `/admin/reports/relatorio-acessos` → `UserAccessReport` (apenas superadmin)

**Configurações:**
- `/admin/settings/users` → `Users`
- `/admin/settings/users/create` → `UserCreate`
- `/admin/settings/users/edit/:id` → `UserEdit`
- `/admin/settings/users/view/:id` → `UserView`
- `/admin/settings/permissions` → `Permissions`
- `/admin/settings/user-profiles` → `UserProfiles`
- `/admin/settings/system` → `SystemSettings`
- `/admin/settings/stages` → `Stages`
- `/admin/settings/metrics` → `Metrics`
- `/admin/settings/table-installment` → `TableInstallment`
- `/admin/settings/aircrafts` → `AircraftsSettings`
- `/admin/settings/integrations` → `Integrations`
- `/admin/settings/integrations/new` → `IntegrationsNew`
- `/admin/settings/integrations/:id/edit` → `IntegrationsEdit`
- `/admin/settings/workflows` → `Workflows`
- `/admin/settings/rules` → `WorkflowRules`
- `/admin/settings/actions` → `WorkflowActions`
- `/admin/settings/workflows/designer` → `WorkflowDesigner`
- `/admin/settings/import-data` → `ImportData`

**CMS / Site:**
- `/admin/site/conteudo-site` → `SiteComponentsList`
- `/admin/site/conteudo-site/create` → `SiteComponentsForm`
- `/admin/site/conteudo-site/:id/edit` → `SiteComponentsForm`

**Loja de Pontos:**
- `/lojaderesgatesantenamais/area-cliente` → `ClientArea`
- `/lojaderesgatesantenamais/pontos` → `PointsStore`

## Backend: Camadas Importantes

Dentro de `backend/app/`, as principais camadas observadas são:

- `Http/Controllers/`
- `Models/`
- `Services/`
- `Jobs/`
- `Events/`
- `Listeners/`
- `Middleware/`
- `Requests/`

Isso indica uma separação relativamente clara entre entrada HTTP, domínio persistido, serviços de apoio e automações assíncronas.

## Banco e Evolução de Schema

O backend possui:

- migrations globais;
- migrations específicas para tenant em `backend/database/migrations/tenant/`;
- seeders para dados iniciais, menus, permissões, cursos, turmas, integrações e métricas.

### Models (35+ models Eloquent)

| Model | Descrição |
|---|---|
| **Core / Multi-tenant** | |
| `Tenant`, `Domain` | Multi-tenancy (stancl/tenancy) |
| `User`, `UserMeta` | Usuários e metadados de perfil |
| `PersonalAccessToken` | Tokens Sanctum |
| **CRM / Comercial** | |
| `Client` | Clientes/leads |
| `ClientAttendance` | Registros de atendimento/interação |
| `Funnel` | Funis de vendas/pipelines |
| `Stage` | Etapas dos funis |
| `Workflow`, `WorkflowRule`, `WorkflowAction` | Workflows de automação |
| `EventLog` | Auditoria/eventos |
| `TrackingEvent` | Rastreamento de campanhas/eventos |
| `DashboardMetric` | Métricas customizadas |
| `Post` | Conteúdo genérico (contratos, períodos, situações, páginas, componentes, uploads) |
| **Escola** | |
| `Curso` | Cursos (4 tipos: teórico, prático, misto, plano de formação) |
| `Turma` | Turmas |
| `Matricula` | Matrículas |
| `Parcelamento` | Planos de parcelamento |
| `MatriculaParcelamento` | Pivot matrícula-parcelamento |
| **Financeiro** | |
| `FinancialAccount` | Contas financeiras unificadas (pagar + receber) |
| `FinancialAccountPayment` | Pagamentos de contas |
| `FinancialCategory` | Categorias financeiras |
| **Oficina / Operações** | |
| `Aircraft`, `Aeronave` | Aeronaves |
| `ServiceOrder`, `ServiceOrderItem` | Ordens de serviço |
| `Service` | Catálogo de serviços |
| `Product`, `ProductUnit` | Catálogo de produtos |
| `Category` | Categorias hierárquicas |
| **CMS** | |
| `Post` | Post com `post_type`: `contratos`, `periodos`, `situacao_matricula`, `paginas`, `componentes`, `tipo_conteudo`, `files_uload` |
| `Option` | Configurações do sistema |
| **Permissões / Menu** | |
| `Permission` | Definições de permissão |
| `Menu`, `MenuPermission` | Sistema de menu dinâmico |

## Estrutura de Diretórios Detalhada

```
crm-aero-v2/
├── backend/
│   ├── app/
│   │   ├── Http/Controllers/    # api/, admin/, Auth/, Settings/
│   │   ├── Models/              # 35+ models Eloquent
│   │   ├── Services/            # Brevo, Escola, Menu, Permission, Qlib
│   │   ├── Middleware/          # Middleware customizado
│   │   ├── Jobs/                # Jobs de fila
│   │   ├── Events/              # Eventos
│   │   └── Listeners/           # Listeners de evento
│   ├── config/                  # tenancy, snappy, menu, sanctum, cors, etc.
│   ├── routes/                  # api, tenant, web, auth, settings, console
│   ├── database/
│   │   ├── migrations/          # Globais + tenant/
│   │   └── seeders/
│   ├── resources/               # Views + Inertia JS
│   └── public/                  # index.php
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx             # Entry point React
│   │   ├── App.tsx              # Providers + rotas
│   │   ├── pages/               # ~90 páginas
│   │   │   ├── auth/            # Login, Register, Forgot/Reset Password
│   │   │   ├── school/          # Courses, Classes, Contracts, Periods, Enroll, etc.
│   │   │   ├── settings/        # Users, Permissions, Workflows, Integrations, etc.
│   │   │   ├── financial/       # Dashboard financeiro
│   │   │   ├── reports/         # WonProposals, GeneralConversion, UserAccess
│   │   │   └── loja/            # ClientArea, PointsStore
│   │   ├── components/          # ~23 pastas de componentes por domínio
│   │   ├── contexts/            # AuthContext, ThemeContext, UserPrefsContext
│   │   ├── services/            # ~45 serviços de API (um por entidade)
│   │   ├── lib/                 # Utilitários, máscaras, menu, zapsign
│   │   ├── hooks/               # Hooks customizados
│   │   ├── types/               # Tipos TypeScript por domínio
│   │   ├── integrations/       # Módulos de integração
│   │   ├── docs/                # CRM_REPORTING_METRICS, REDIRECT_SYSTEM
│   │   └── styles/              # CSS de impressão
│   ├── dist/                    # Build de produção
│   ├── tailwind.config.ts
│   ├── vite.config.ts
│   ├── components.json          # shadcn-ui config
│   └── tsconfig.json
│
└── .trae/
    ├── documents/               # Documentação do projeto
    └── skills/                  # Skills customizadas
```

O sistema se comporta como uma plataforma integrada com os seguintes pilares:

- CRM comercial para aquisição e relacionamento;
- gestão escolar para cursos, turmas e matrículas;
- financeiro para contas e acompanhamento de recebimentos;
- operação/oficina para serviços e ordens;
- CMS e integrações para automações e conteúdo.

## Arquivos-Chave para Onboarding

Para entender rapidamente o sistema, começar por:

- `backend/composer.json`
- `backend/bootstrap/app.php`
- `backend/routes/api.php`
- `backend/routes/tenant.php`
- `backend/config/tenancy.php`
- `frontend/package.json`
- `frontend/src/main.tsx`
- `frontend/src/App.tsx`

## Observação

Este documento consolida apenas o reconhecimento inicial do sistema. Ele pode ser expandido depois com:

- fluxo de autenticação;
- fluxo de proposta para matrícula;
- fluxo financeiro;
- mapa de permissões e menus;
- integrações externas e webhooks.
