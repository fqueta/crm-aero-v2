# Contexto do Projeto — Importação de dados legados + Rescisão de Contratos (School Termination)

## Importação de dados (ImportController)

`backend/app/Http/Controllers/api/ImportController.php`

### Bugfixes aplicados

| Bug | Causa | Fix |
|-----|-------|-----|
| `imported_count: 0` para `clientes` | `importData()` não tinha `elseif ($importType === 'clientes')` — `importClientes()` era dead code | Adicionado dispatch para `clientes` em `ImportController.php:94` |
| `imported_count: 0` para `matriculas` | API legada não retorna `cpf_aluno` no export de matrículas → CPF é sempre null → `continue` | Fallback: buscar user por `config->legacy_client_id` quando CPF não disponível |

### Fluxo corrigido — Matrículas

1. **Importar clientes primeiro** (`import_type: clientes`): armazena `config->legacy_client_id` no User
2. **Importar matrículas** (`import_type: matriculas`): tenta buscar user por:
   - `cpf_aluno` (se existir no payload) → `findOrCreateUser()`
   - Fallback: `User::where('config->legacy_client_id', $item['id_cliente'])` → first()

### Payload da API legada — Matrículas

`GET /api/v1/matriculas/exportar?tipo_curso=4&formato=json`

```json
{"exec":true,"status":200,"total":389,"data":[
  {"id":2388,"id_cliente":1896,"id_curso":97,"id_turma":"563",
   "data":"2022-01-21","aluno":"Pedro veras","Descricao":null,
   "status":4,"config":null,"valor":129600,"situacao":"a",
   "data_matricula":"2023-01-11 00:00:00","contrato":"",
   "parcelamento":36,"valor_parcela":3600,"token":"61eae54fb33eb",
   "tag":"[\"lead_quente\"]","obs":"...","atualizado":"...",
   "historico":"..."}
]}
```

Campos **ausentes** (todos tratados com `?? null`/`?? 0`): `cpf_aluno`, `orc`, `nome_curso`, `desconto`, `combustivel`, `subtotal`, `total`, `metacampos`, `reg_inscricao`, `reg_pagamento`, `rescisao`, `orc_encerrado`

### Endpoint de importação

`POST /api/v1/import` — corpo esperado:
```json
{
  "url": "https://api.aeroclubejf.com.br/api/v1/{recurso}/exportar?tipo_curso=4&formato=json",
  "method": "GET",
  "headers": [{"key": "Authorization", "value": "Bearer {token}"}, {"key": "Accept", "value": "application/json"}],
  "import_type": "clientes|matriculas|contratos|turmas"
}
```

## Contexto do Projeto — Rescisão de Contratos (School Termination)

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

## Proposta — PDF de Orçamento (4 páginas configuráveis)

### Contexto
O PDF do orçamento (proposta) tem 4 páginas de conteúdo, geradas pela view `backend/resources/views/pdf/matricula.blade.php` no loop `@foreach($extras as $idx => $p)`:

| Índice | Página | Conteúdo |
|--------|--------|----------|
| 0 | **Capa** | Título, dados do cliente (nome, tel, email, curso), CTA "ACEITO A PROPOSTA" |
| 1 | **Orçamento** | Módulos agrupados por etapa, taxas, totais, simulação de combustível |
| 2 | **Observações** | `obs_proposta` do curso ou texto de validade + preview de parcelamento |
| 3 | **Parcelamento** | Tabela de opções de parcelamento com descontos |

### Configuração de exibição por página
Cada curso pode definir quais páginas aparecem no PDF, via campos no `config`:

**Type:** `frontend/src/types/courses.ts` → `CourseConfig`
```typescript
pdf_show_cover?: boolean;   // Capa (default: true)
pdf_show_budget?: boolean;  // Orçamento (default: true)
pdf_show_notes?: boolean;   // Observações (default: true)
pdf_show_payment?: boolean; // Parcelamento (default: true)
```

**UI:** `frontend/src/components/school/CourseForm.tsx` — Card "Páginas do PDF" na aba Configurações, com 4 checkboxes.

### Fluxo dos dados
1. Frontend salva `config.pdf_show_*` como booleano no JSON do curso
2. `PdfController::prepareMatriculaViewData()` lê `curso.config.pdf_show_*` e passa ao template com fallback `true` para retrocompatibilidade
3. Blade `matricula.blade.php` calcula `$pdfShowThisPage` por índice e envolve cada `<div class="page">` em `@if($pdfShowThisPage)`

### Backward compatibility
Cursos existentes sem essas flags exibem todas as 4 páginas normalmente.

### Arquivos alterados
| Arquivo | Descrição |
|---------|----------|
| `frontend/src/types/courses.ts` | CourseConfig: 4 campos `pdf_show_*` |
| `frontend/src/components/school/CourseForm.tsx` | Zod, defaults, applyInitialData, UI checkboxes |
| `backend/app/Http/Controllers/api/PdfController.php` | Leitura das flags no config do curso |
| `backend/resources/views/pdf/matricula.blade.php` | Condicional `@if($pdfShowThisPage)` no loop de páginas |

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
| `frontend/src/types/courses.ts` | Campos `pdf_show_*` no CourseConfig |
| `frontend/src/components/school/CourseForm.tsx` | Card "Páginas do PDF" no formulário de cursos |
| `backend/app/Http/Controllers/api/PdfController.php` | Leitura de `config.pdf_show_*` |
| `backend/resources/views/pdf/matricula.blade.php` | Condicional de exibição por página |
| `frontend/src/pages/settings/SystemSettings.tsx` | `handleSaveAppearanceSettings` agora persiste `email_logo_url` no backend via `POST /options/all` |
| `frontend/src/services/systemSettingsService.ts` | Add `email_logo_url?: string` ao `AdvancedSystemSettings` |
| `backend/app/Services/ScheduledCommunication/Strategies/BrevoEmailScheduledCommunicationStrategy.php` | Lê `email_logo_url` de `Qlib::qoption()` e usa como `<img>` no template de e-mail (fallback: texto "CRM Aeroclube") |

## Logo em E-mails (Brevo)

### Fluxo
1. Usuário faz upload da logo em `/admin/settings/system` (Card "Identidade Visual")
2. Ao salvar (`handleSaveAppearanceSettings`), a logo (base64 data URI) é enviada para `POST /options/all` como `email_logo_url`
3. Opção fica persistida na tabela `options` (url = `email_logo_url`, value = base64 da logo)
4. `BrevoEmailScheduledCommunicationStrategy` lê `Qlib::qoption('email_logo_url')` e insere `<img>` no header do e-mail
5. Se `email_logo_url` não existir, fallback para o texto "CRM Aeroclube"

### Arquivos alterados
| Arquivo | Descrição |
|---------|-----------|
| `frontend/src/pages/settings/SystemSettings.tsx` | `handleSaveAppearanceSettings` agora async, salva logo no backend |
| `frontend/src/services/systemSettingsService.ts` | Interface `AdvancedSystemSettings` + campo `email_logo_url` |
| `backend/app/Services/ScheduledCommunication/Strategies/BrevoEmailScheduledCommunicationStrategy.php` | Import `Qlib`, usa `qoption('email_logo_url')` no HTML |

### Campo "Nome do Remetente"
- Opção `email_nome` na tabela `options` (url = `email_nome`)
- Configurável em `/admin/settings/system` → card "Identidade Visual" → campo "Nome do Remetente (E-mail)"
- Lido por `BrevoEmailScheduledCommunicationStrategy` via `Qlib::qoption('email_nome')`
- Fallback: "CRM Aeroclube"

### Arquivos alterados (E-mail Nome)
| Arquivo | Descrição |
|---------|-----------|
| `frontend/src/pages/settings/SystemSettings.tsx` | Add `emailNome` no state, campo input no card Identidade Visual, salva `email_nome` no backend |
| `frontend/src/services/systemSettingsService.ts` | Add `email_nome?: string` ao `AdvancedSystemSettings` |
| `backend/app/Services/ScheduledCommunication/Strategies/BrevoEmailScheduledCommunicationStrategy.php` | Lê `email_nome` de `Qlib::qoption()`, usa como texto/label da logo (fallback: "CRM Aeroclube") |

### Observações
- A logo é armazenada como base64 data URI no banco (coluna `value` do tipo `text` na tabela `options`)
- Para logos muito grandes (>64KB), pode ser necessário alterar a coluna para `mediumtext` ou fazer upload do arquivo com URL
- Alguns clientes de e-mail (Outlook) podem não renderizar base64 em `<img>`. Se necessário, usar uma URL pública da logo

## Webhook Brevo (Event Tracking)

### Endpoint
`POST /webhook/brevo` — rota pública (sem autenticação), registrada em `tenant.php` e `api.php`.

### Fluxo
1. Brevo envia eventos de tracking para `https://{dominio}/api/v1/webhook/brevo`
2. `WebhookController::processBrevoWebhook()` localiza `ScheduledCommunication` por `provider_message_id`
3. Acumula eventos no `metadata.tracking` (array) e atualiza `metadata.summary`
4. Eventos de falha (`hard_bounce`, `soft_bounce`, `blocked`, `complaint`, etc.) alteram status para `failed`
5. Eventos de sucesso (`delivered`, `opened`, `click`) são armazenados sem alterar status

### Payload Brevo
```json
{
  "event": "delivered|unique_opened|click|hard_bounce|soft_bounce|complaint|blocked|invalid_email",
  "email": "cliente@email.com",
  "message-id": "<messageid@smtp-relay.mailin.fr>",
  "date": "2026-07-09 07:41:34",
  "subject": "...",
  "link": "https://...",
  "device_used": "DESKTOP|MOBILE|TABLET"
}
```

### Frontend (ScheduledCommunicationsPage)
- Coluna "Tracking" com ícones visuais:
  - ✅ (verde) = entregue (`delivered`)
  - 👁️ (azul) = visualizado (`opened`/`unique_opened`)
  - 🖱️ (roxo) = clicou (`click`/`unique_click`)
  - ⏳ (cinza) = aguardando confirmação
- Metadados são exibidos apenas para canal `email`

### Arquivos alterados/criados
| Arquivo | Descrição |
|---------|-----------|
| `backend/app/Http/Controllers/api/WebhookController.php` | Add `processBrevoWebhook()` + `use App\Models\ScheduledCommunication` + case `brevo` no switch |
| `frontend/src/pages/ScheduledCommunications.tsx` | Add coluna "Tracking" com ícones de evento, função `getTrackingSummary()` |
