# CRM Aero v2 — Frontend

SPA principal do CRM Aero, painel administrativo e telas públicas.

## Stack

- React 18
- Vite
- TypeScript
- React Router DOM
- TanStack React Query
- Tailwind CSS
- Radix UI / shadcn-ui
- React Hook Form + Zod

## Como rodar

```bash
cp .env.example .env
npm install
npm run dev
```

## Build

```bash
npm run build
npm run lint
```

## Estrutura

- `src/pages/` — páginas organizadas por módulo (school, financial, crm, etc.)
- `src/services/` — serviços de API (BaseApiService + serviços específicos)
- `src/components/` — componentes reutilizáveis (shadcn/ui + custom)
- `src/hooks/` — hooks customizados
- `src/lib/` — utilitários (masks, formatters, etc.)
- `src/types/` — tipos TypeScript

## Módulos

- CRM / Vendas
- Escola (cursos, turmas, matrículas, rescisões)
- Propostas
- Financeiro
- Oficina
- CMS
- Admin / Configurações
