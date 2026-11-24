# Guia de Atualização em Produção (VPS + CWP Panel + Apache)
## Módulo: Programa de Instrução (Página Pública + Edição por IA) + RAG Nativo + Novos Shortcodes de Contrato

Este documento contém as instruções passo a passo para o **agente de produção** aplicar esta atualização com segurança em um VPS gerenciado por **CWP Panel (Control Web Panel)** com **Apache**.

---

## 1. Resumo Técnico da Atualização

- **Novas tabelas (por banco tenant):**
  - `instruction_programs` — Programas de Instrução (PI), controle de revisão, MGR e padrões contratuais.
  - `instruction_program_revisions` — Histórico imutável de revisões (Snapshot/Memento).
  - `ai_knowledge_chunks` — Base vetorial/lexical RAG armazenada nativamente no MySQL do tenant (sem serviço externo).
- **Novas rotas públicas (sem login):**
  - Frontend SPA: `/programas-instrucao` e `/programa-instrucao/:slug`
  - API Tenant:
    - `GET /api/v1/instruction-programs/public`
    - `GET /api/v1/instruction-programs/public/{slug}`
    - `POST /api/v1/instruction-programs/public/{slug}/chat` (com rate limit `throttle:20,1`)
- **Novas rotas autenticadas (Admin):**
  - CRUD + revisões + edição por IA: `/api/v1/instruction-programs*`
  - Reindexação RAG: `POST /api/v1/ai/rag/reindex`
  - Padrões institucionais de contratos: `GET/PUT /api/v1/settings/contract-defaults`
- **Menu lateral:** novo item **Programas de Instrução** (`/school/instruction-programs`) em `backend/database/seeders/data/menu_crm.json` e `frontend/src/lib/menu.ts`.
- **Shortcodes de contrato:** ~28 novos shortcodes do Quadro da Contratação injetados automaticamente em `MatriculaController::injectTabelaParcelas()` via `ContractContextFacade` e registrados no autocomplete de Contratos.

---

## 2. Variáveis de Ambiente do VPS (Ajuste antes de executar)

Defina no shell SSH do VPS os caminhos reais da conta CWP:

```bash
export CWP_USER="SEU_USUARIO_CWP"
export APP_DIR="/home/${CWP_USER}/crm-aero-v2"           # Raiz do repositório git
export BACKEND_DIR="${APP_DIR}/backend"
export FRONTEND_DIR="${APP_DIR}/frontend"
export PUBLIC_HTML="/home/${CWP_USER}/public_html"      # DocumentRoot do frontend SPA no CWP
export PHP_BIN="$(which php82 || which php || echo /usr/local/bin/php)"
```

> **Atenção no CWP:** confirme que `$PHP_BIN -v` retorna **PHP 8.2 ou superior** (exigido pelo Laravel 12). Se o PHP padrão do sistema for mais antigo, use o binário do PHP-FPM/Switcher do CWP (ex.: `/opt/alt/php82/usr/bin/php` ou `/opt/alt/php83/usr/bin/php`).

---

## 3. Backup Obrigatório (Antes do Deploy)

```bash
BACKUP_DIR="/home/${CWP_USER}/backups/deploy_$(date +%Y%m%d_%H%M%S)"
mkdir -p "${BACKUP_DIR}"

# 1. Backup do .env
cp "${BACKEND_DIR}/.env" "${BACKUP_DIR}/.env.bak"

# 2. Backup dos bancos (central + tenants) — ajuste usuário/senha se necessário
# mysqldump -u root -p --all-databases --single-transaction > "${BACKUP_DIR}/all_databases.sql"
```

---

## 4. Atualização do Código e Backend (Laravel)

```bash
cd "${APP_DIR}"

# 1. Atualizar código
git fetch --all
git pull origin main   # ajuste o nome da branch de produção se diferente

# 2. Instalar dependências PHP (sem dev)
cd "${BACKEND_DIR}"
${PHP_BIN} $(which composer) install --no-dev --optimize-autoloader --no-interaction

# 3. Rodar migrations dos TENANTS (cria instruction_programs, instruction_program_revisions e ai_knowledge_chunks)
${PHP_BIN} artisan tenants:migrate --force

# 4. (Opcional — se o menu lateral vier da tabela `menus` do banco)
# Atualize o menu dos tenants com o novo item "Programas de Instrução":
# ${PHP_BIN} artisan tenants:seed --class=MenuSeeder --force

# 5. Limpar e recriar caches do Laravel
${PHP_BIN} artisan optimize:clear
${PHP_BIN} artisan config:cache
${PHP_BIN} artisan route:cache
${PHP_BIN} artisan view:cache

# 6. Garantir permissões corretas para o usuário da conta CWP / Apache
chown -R ${CWP_USER}:${CWP_USER} "${BACKEND_DIR}/storage" "${BACKEND_DIR}/bootstrap/cache"
chmod -R 775 "${BACKEND_DIR}/storage" "${BACKEND_DIR}/bootstrap/cache"
```

### Verificação rápida das migrations no tenant

```bash
cd "${BACKEND_DIR}"
${PHP_BIN} artisan tenants:run "migrate:status" | grep -E "instruction_programs|ai_knowledge_chunks"
```

As duas migrations abaixo devem constar como `Ran`:
- `2026_11_24_100000_create_instruction_programs_tables`
- `2026_11_24_100100_create_ai_knowledge_chunks_table`

---

## 5. Build e Publicação do Frontend (React / Vite)

```bash
cd "${FRONTEND_DIR}"

# 1. Instalar dependências e gerar build de produção
npm ci
npm run build

# 2. Publicar build no DocumentRoot do CWP (preservando .htaccess e pasta da API se estiver no mesmo diretório)
rsync -av --delete \
  --exclude='.htaccess' \
  --exclude='api' \
  --exclude='storage' \
  "${FRONTEND_DIR}/dist/" "${PUBLIC_HTML}/"

chown -R ${CWP_USER}:${CWP_USER} "${PUBLIC_HTML}"
```

> Se o frontend e o backend estiverem em subdomínios separados no CWP (ex.: `crm.dominio.com.br` para SPA e `api.dominio.com.br` para Laravel `backend/public`), publique `dist/` apenas no `DocumentRoot` do domínio do SPA.

---

## 6. Ajustes no Apache / CWP Panel

### 6.1 Fallback SPA no `.htaccess` (Frontend)
Garanta que o `.htaccess` no `DocumentRoot` do frontend redirecione as novas rotas públicas (`/programas-instrucao` e `/programa-instrucao/*`) para `index.html`, sem interceptar `/api`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Não interceptar chamadas de API nem arquivos/diretórios reais
  RewriteRule ^api/ - [L]
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # SPA Fallback (inclui /programa-instrucao/:slug e /programas-instrucao)
  RewriteRule ^ index.html [L]
</IfModule>
```

### 6.2 Timeout de PHP-FPM / Apache para IA e Reindexação RAG
Chamadas de edição por IA (`/ai-edit`) e reindexação RAG (`/ai/rag/reindex`) fazem requisições HTTP para Gemini/OpenAI. No CWP (**PHP Settings > PHP-FPM / php.ini** e vHost do Apache):
- `max_execution_time = 90` (mínimo recomendado: 60s)
- `memory_limit = 256M` (ou `512M` se houver muitos Programas de Instrução)
- Se usar Apache com `ProxyPassMatch` / `mod_proxy_fcgi`, garanta `ProxyTimeout 90` no vHost.

Após alterar vHost/PHP-FPM no CWP:
```bash
httpd -t && systemctl reload httpd
# Se usar PHP-FPM:
# systemctl reload php-fpm82
```

### 6.3 Rate Limit do Chat Público (`throttle:20,1`)
Se houver Cloudflare, Nginx Reverse Proxy ou Varnish na frente do Apache no CWP:
- Certifique-se de que o Apache/Laravel confia nos cabeçalhos `X-Forwarded-For` (`TRUSTED_PROXIES=*` ou IP do proxy no `TrustProxies`), para que o limite de 20 req/min seja aplicado por IP de cada visitante e não pelo IP do proxy.

---

## 7. Checklist Pós-Deploy (No Painel Admin)

1. **Chave de IA:** acesse `/admin/settings/integrations` e confirme que **Gemini** ou **OpenAI** está com chave válida configurada.
2. **Padrões Institucionais:** acesse `/admin/settings/system` → aba **Contratos & Canais**, preencha MGR padrão, tabela/data-base de tarifas, regras de escala e os 4 canais oficiais (`escala`, `secretaria`, `qualidade`, `privacidade`) e salve.
3. **Primeiro Programa de Instrução:** acesse `/admin/school/instruction-programs`, crie o PI (ex.: `PPAP`, revisão `001F`), vincule ao curso correspondente e clique em **Publicar Nova Revisão**.
4. **Reindexar RAG:** clique no botão **Reindexar RAG (IA)** em `/admin/school/instruction-programs` para garantir que tanto o PI quanto as regras institucionais estejam vetorizados em `ai_knowledge_chunks`.
5. **Contratos:** em `/admin/school/contracts`, valide no editor que as novas categorias (`📘 Programa de Instrução`, `Turma & Vigência`, `Tarifas & Aeronave`, `Escala & Canais`) e o autocomplete `{` estão listando os novos shortcodes.

---

## 8. Smoke Tests de Validação em Produção

Substitua `https://SEU_DOMINIO` e `SLUG_DO_PI`:

```bash
# 1. API pública de listagem de Programas de Instrução (deve retornar HTTP 200)
curl -i -s "https://SEU_DOMINIO/api/v1/instruction-programs/public" | head -n 20

# 2. API pública de um PI específico (deve retornar HTTP 200 com JSON do PI)
curl -i -s "https://SEU_DOMINIO/api/v1/instruction-programs/public/SLUG_DO_PI" | head -n 20

# 3. Chat RAG público (deve retornar success: true e resposta baseada no PI)
curl -s -X POST "https://SEU_DOMINIO/api/v1/instruction-programs/public/SLUG_DO_PI/chat" \
  -H "Content-Type: application/json" \
  -d '{"message":"Qual é a revisão vigente deste Programa de Instrução?"}'

# 4. Página pública SPA (deve retornar HTTP 200 com HTML do app)
curl -I -s "https://SEU_DOMINIO/programa-instrucao/SLUG_DO_PI" | head -n 10
```

Verificar logs de erro após os testes:
```bash
tail -n 50 "${BACKEND_DIR}/storage/logs/laravel.log"
```

---

## 9. Plano de Rollback (Em caso de falha crítica)

```bash
cd "${APP_DIR}"
git log -n 5 --oneline
# Reverter para o commit anterior estável:
# git checkout <COMMIT_ANTERIOR>

cd "${BACKEND_DIR}"
${PHP_BIN} artisan optimize:clear
${PHP_BIN} artisan config:cache
${PHP_BIN} artisan route:cache

# (Apenas se precisar remover as tabelas novas dos tenants):
# ${PHP_BIN} artisan tenants:rollback --step=2 --force
```
