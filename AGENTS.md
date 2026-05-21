# Contexto do Projeto — Rescisão de Contratos (School Termination)

## Pagina Admin
`/admin/school/termination` → `frontend/src/pages/school/Termination.tsx`

### Funcionalidades
- **Lista** — Tabela paginada com historico de rescisoes (aluno, curso, data, valor pago, multa 30%, saldo final)
- **Calculadora** — Aba "Nova Rescisao" com:
  - Combobox de alunos: filtra matriculas com `situacao: 'mat'` (default do service) + `status: 'g'`
  - Dados financeiros: Pago ate Rescisao, Taxa Matricula, Valor Inicial Contrato (com `type="text"` + `currencyApplyMask`)
  - Tabela de horas voadas por aeronave (`step="1"` para incremento unitario)
  - Secao de Alojamento/Darias
  - Painel lateral com Resumo do Distrato (calculo ao vivo)
- **Edicao** — Botao editar (icone lapis) carrega dados da rescisao no formulario, submit chama `PUT /rescisoes/{id}`
- **Exclusao** — Soft-delete (flags `excluido='s'`, `deletado='s'`)

### Botoes por linha na tabela
- Link (copia URL publica para area de transferencia)
- Abrir (abre pagina publica em nova aba)
- PDF (abre PDF da rescissao, se gerado)
- Editar
- Excluir

### Status da Rescisão
- `pending` (Pendente) — acabou de ser criada
- `sent` (Enviado) — enviada para ZapSign
- `signed` (Assinado) — assinada digitalmente
- `cancelled` (Cancelado)

### Campos de moeda (R$)
`frontend/src/lib/masks/currency.ts`
- `currencyApplyMask(value, locale, currency)` — converte digitos para string formatada (ex.: "150000" → "R$ 1.500,00")
- `currencyRemoveMaskToNumber(masked)` — converte string mascarada para numero (ex.: "R$ 1.500,00" → 1500)
- Inputs usam `type="text"` + `inputMode="decimal"` com `toCurrencyInput()` para exibicao

## Backend — RescisaoController
`backend/app/Http/Controllers/api/RescisaoController.php`

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| `index` | `GET /rescisoes` | Lista paginada com search, eager load matricula.cliente/curso |
| `show` | `GET /rescisoes/{id}` | Busca por ID, auto-gera token se ausente |
| `publicShow` | `GET /rescisoes/public/{token}` | **Publico** — busca por `config->token`, retorna `termo_html` |
| `store` | `POST /rescisoes` | Cria rescisao com token UUID no config |
| `update` | `PUT /rescisoes/{id}` | Atualiza, auto-gera token se ausente |
| `destroy` | `DELETE /rescisoes/{id}` | Soft-delete |

### Token Publico
- Gerado automaticamente no `store()` via `Str::uuid()`, salvo em `config.token`
- Auto-gera no `show()` e `update()` se o registro nao tiver token (retrocompatibilidade)
- URL publica: `/solicitar-rescisao/{token}`
- Rota API publica: `GET /api/v1/rescisoes/public/{token}` (registrada em `api.php` e `tenant.php` fora do middleware `auth:sanctum`)

### Termo de Rescisao (Componente HTML)
`backend/database/seeders/tenant/TermoRescisaoSeeder.php`
- Cria componente `post_type='componentes'`, `post_name='termo_rescisao'`, `guid='15'` (Html Code)
- Editavel via `/admin/site/conteudo-site`

#### Shortcodes do template
| Shortcode | Descricao |
|-----------|-----------|
| `{numero_contrato}` | Numero formatado (ID zerofill + mes.ano) |
| `{nome_aluno}` | Nome do cliente |
| `{canac}` | CANAC do cliente (`config.canac`) |
| `{cpf}` | CPF do cliente |
| `{endereco}` | Endereco completo formatado |
| `{valor_inicial}` | Valor inicial do contrato (R$) |
| `{valor_pago_ate_rescisao}` | Valor pago ate a rescisao (R$) |
| `{tabela_multa}` | Tabela HTML com multa rescisoria (30%) |
| `{tabela_matricula}` | Tabela HTML com taxa de matricula |
| `{tabela_horas_voadas}` | Tabela HTML com horas voadas por aeronave |
| `{tabela_alojamento}` | Tabela HTML com dados de alojamento |
| `{tabela_resumo}` | Tabela HTML com resumo financeiro |
| `{previsao_pagamento}` | Texto de previsao de pagamento/reembolso |
| `{assinatura}` | Bloco de assinaturas (aluno, contratada, testemunha) |
| `{dia}`, `{mes}`, `{ano}` | Partes da data da rescisao |

#### Metodos geradores de tabelas HTML (no controller)
- `buildTermoHtml($rescisao)` — metodo principal, busca o componente e aplica todos os shortcodes
- `buildTabelaMulta($rescisao)`
- `buildTabelaMatricula($rescisao)`
- `buildTabelaHorasVoadas($aeronaves, $totalQtd, $totalValor)`
- `buildTabelaAlojamento($rescisao)`
- `buildTabelaResumo($rescisao, $totalHorasValor)`
- `buildPrevisaoPagamento($rescisao)`
- `buildAssinatura($cliente)`
- `formatClienteEndereco($cliente)`

## Pagina Publica
`frontend/src/pages/PublicTerminationRequest.tsx`
- Rota: `/solicitar-rescisao/:token`
- Sem autenticacao
- Exibe o `termo_html` renderizado diretamente (vem do backend com shortcodes resolvidos e tabelas)
- Botao de impressao

## Rotas Publicas (backend)
`backend/routes/api.php` e `backend/routes/tenant.php`
```php
Route::get('rescisoes/public/{token}', [RescisaoController::class, 'publicShow']);
```
Registradas fora do grupo `auth:sanctum`.

## Seeder
`backend/database/seeders/tenant/TermoRescisaoSeeder.php` — registrado em `DatabaseSeeder.php`
Para rodar manualmente:
```
php artisan db:seed --class=Database\\Seeders\\Tenant\\TermoRescisaoSeeder
```

## Arquivos Alterados/Criados
| Arquivo | Descricao |
|---------|-----------|
| `frontend/src/pages/school/Termination.tsx` | Pagina admin de rescisoes |
| `frontend/src/pages/PublicTerminationRequest.tsx` | Pagina publica da rescisao |
| `frontend/src/services/rescisoesService.ts` | Servico API (metodo `getPublicRescisao`) |
| `backend/app/Http/Controllers/api/RescisaoController.php` | Controller com CRUD + metodos publicos |
| `backend/database/seeders/tenant/TermoRescisaoSeeder.php` | Seeder do componente termo_rescisao |
| `backend/database/seeders/DatabaseSeeder.php` | Registro do seeder |
| `backend/routes/api.php` | Rota publica `rescisoes/public/{token}` |
| `backend/routes/tenant.php` | Rota publica `rescisoes/public/{token}` |
