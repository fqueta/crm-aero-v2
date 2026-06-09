# CRM Aero v2

Monorepo do CRM Aero com backend Laravel multi-tenant e frontend React para operação comercial, escola, financeiro, oficina, CMS e integrações.

## Visão Geral

Este repositório contém duas aplicações principais:

- `backend/`: API Laravel responsável por autenticação, regras de negócio, multi-tenancy, geração de PDFs, filas, integrações e uma interface menor com Inertia.
- `frontend/`: SPA principal em React/Vite/TypeScript usada como painel administrativo e também para algumas telas públicas.

O sistema atende um contexto de aeroclube/escola de aviação, com foco em:

- CRM comercial e funil de vendas
- cursos, turmas e matrículas
- propostas, contratos e PDFs
- parcelamentos e financeiro
- oficina e operação
- CMS, webhooks e integrações

## Stack

### Backend

- PHP 8.2
- Laravel 12
- Laravel Sanctum
- Stancl Tenancy v3
- Inertia.js
- Snappy / `wkhtmltopdf`
- Browsershot / Puppeteer
- Pest

### Frontend principal

- React
- Vite
- TypeScript
- React Router DOM
- TanStack React Query
- Tailwind CSS
- Radix UI / shadcn-ui
- React Hook Form
- Zod

## Estrutura do Repositório

```text
crm-aero-v2/
├── backend/                    # API Laravel, tenancy, jobs, pdf, migrations, seeders
├── frontend/                   # SPA React principal
├── .trae/documents/            # Documentação auxiliar usada no projeto
├── AGENTS.md                   # Regras/contexto usados pelo agente
├── FUTURE.md                   # Anotações futuras
└── CONTEXTO_DO_PROJETO.md      # Documento de contexto funcional e arquitetural
```

## Principais Módulos

- CRM: clientes, atendimentos, funis, etapas, workflows e métricas
- Escola: cursos, turmas, matrículas, contratos, períodos, situações e rescisões
- Propostas: edição, visualização, geração de PDF, aprovação e assinatura
- Financeiro: categorias, contas, pagamentos e visão geral
- Oficina: ordens de serviço, aeronaves, produtos e serviços
- CMS: componentes, páginas, tipos de conteúdo e uploads
- Integrações: ZapSign, Brevo, webhooks e rastreamento

## Requisitos

### Backend

- PHP 8.2+
- Composer
- MySQL
- Node.js e npm
- `wkhtmltopdf`
- Google Chrome ou Chromium

### Frontend

- Node.js 18+
- npm

## Configuração Local

### 1. Backend

```bash
cd backend
cp .env.example .env
composer install
npm install
php artisan key:generate
```

Depois configure manualmente:

- banco de dados principal
- tenancy/domínios
- fila
- caminhos de PDF, se necessário:
  - `WKHTML_PDF_BINARY`
  - `CHROME_PATH`
  - `NODE_PATH`
  - `NPM_PATH`

### 2. Frontend

```bash
cd frontend
cp .env.example .env
npm install
```

## Como Rodar

### Backend em modo desenvolvimento

```bash
cd backend
composer dev
```

Esse comando sobe:

- servidor Laravel
- listener de fila
- Vite do frontend embutido do backend

### Frontend principal

```bash
cd frontend
npm run dev
```

## Comandos Úteis

### Backend

```bash
cd backend
php artisan serve
php artisan queue:work
php artisan test
php artisan migrate
php artisan db:seed
php artisan pail
```

### Frontend

```bash
cd frontend
npm run dev
npm run build
npm run lint
```

## Multi-Tenancy

O backend usa `stancl/tenancy` com isolamento por domínio/subdomínio.

Arquivos importantes:

- `backend/config/tenancy.php`
- `backend/routes/tenant.php`
- `backend/app/Providers/TenancyServiceProvider.php`

Ao trabalhar localmente, confirme:

- domínio do tenant
- banco do tenant
- assets tenant-aware
- URLs públicas usadas na geração de PDFs

## PDF e Propostas

O projeto possui fluxo de proposta com geração de PDF para matrículas.

Pontos relevantes:

- controller principal: `backend/app/Http/Controllers/api/PdfController.php`
- view Blade do PDF: `backend/resources/views/pdf/matricula.blade.php`
- job relacionado: `backend/app/Jobs/GeraPdfPropostasPnlJob.php`

Motores suportados:

- `wkhtmltopdf` via Snappy
- `Browsershot` via Chrome/Puppeteer

## Arquivos-Chave para Onboarding

- `backend/composer.json`
- `backend/routes/api.php`
- `backend/routes/tenant.php`
- `backend/config/tenancy.php`
- `backend/app/Http/Controllers/api/PdfController.php`
- `backend/app/Http/Controllers/api/MatriculaController.php`
- `frontend/package.json`
- `frontend/src/App.tsx`
- `frontend/src/services/BaseApiService.ts`
- `CONTEXTO_DO_PROJETO.md`

## Documentação Relacionada

- `CONTEXTO_DO_PROJETO.md`
- `backend/README-deploy.md`
- `.trae/documents/Contexto do Projeto.md`
- `.trae/documents/Endpoint rápido para mudança de etapa da matrícula.md`
- `.trae/documents/Workflows Personalizáveis com Gatilhos e Ações.md`

## Observações

- O repositório contém uma SPA principal em `frontend/` e uma interface menor via Inertia em `backend/resources/js/`.
- Há customizações específicas de ambiente para PDF no Windows e em produção.
- Parte do comportamento do sistema depende de seeders, permissões e dados tenant específicos.
