# Deploy & PDF (wkhtmltopdf) – Production Checklist

Este guia cobre deploy em produção e validação da geração de PDF via wkhtmltopdf. Inclui checagens rápidas, comandos úteis e resolução de erros 500.

## Pré-requisitos

- PHP 8.x com opcache habilitado (recomendado)
- Extensões padrão do Laravel
- Binários `wkhtmltopdf` e `wkhtmltoimage` instalados e executáveis
- Acesso SSH ao servidor

## .env (produção)

- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://SEU_DOMINIO`
- `FRONTEND_URL=https://SEU_DOMINIO_FRONT` (se aplicável)
- `WKHTML_PDF_BINARY=/usr/local/bin/wkhtmltopdf` (ou `/usr/bin/wkhtmltopdf` se instalado via pacote)
- `WKHTML_IMG_BINARY=/usr/local/bin/wkhtmltoimage` (ou `/usr/bin/wkhtmltoimage`)

Notas:
- `APP_URL` deve ser apenas o domínio base, sem `/api/v1`.
- Em produção, as variáveis de `WKHTML_*_BINARY` têm prioridade e sobrescrevem fallback.

## Fluxo de Deploy (SSH)

1. Atualizar código
   - `git pull` ou sincronizar arquivos conforme sua estratégia.
2. Instalar dependências
   - `composer install --no-dev --prefer-dist --optimize-autoloader`
3. Migrar base de dados (se necessário)
   - `php artisan migrate --force`
4. Limpar e recachear
   - `php artisan optimize:clear`
   - `php artisan config:clear && php artisan config:cache`
   - `php artisan route:clear && php artisan view:clear`
5. Symlink de storage
   - `php artisan storage:link`
6. Reiniciar serviços (se aplicável)
   - Reiniciar PHP-FPM para atualizar opcache
   - Reiniciar filas: `php artisan queue:restart`

## Validação Rápida do PDF

1. Testar HTML (diagnóstico sem wkhtmltopdf):
   - `curl -i -H "Authorization: Bearer <TOKEN>" "https://SEU_DOMINIO/api/v1/pdf/matriculas/<ID>?debug_html=1"`
2. Gerar PDF final:
   - `curl -i -H "Authorization: Bearer <TOKEN>" "https://SEU_DOMINIO/api/v1/pdf/matriculas/<ID>"`

## Troubleshooting de Erros 500

- Binários ausentes ou sem permissão:
  - `ls -l /usr/local/bin/wkhtmltopdf /usr/local/bin/wkhtmltoimage`
  - `chmod +x /usr/local/bin/wkhtmltopdf /usr/local/bin/wkhtmltoimage`
- Escrita em `storage`:
  - Verifique permissões de `storage/app/public/uploads/matriculas`
  - `php artisan storage:link`
- `APP_URL` incorreto:
  - Deve ser apenas o domínio base; corrigir no `.env` se necessário
- Logs:
  - `tail -n 200 storage/logs/laravel.log`
  - Procure por “Unable to load”, “Permission denied”, “No such file or directory”

## OpCache Reset (alternativa segura)

Se não puder reiniciar PHP-FPM, você pode criar TEMPORARIAMENTE um endpoint para resetar o opcache:

1. Crie `public/opcache_reset.php` (não versionar):

```php
<?php
// Apenas uso temporário, remova após executar.
if (function_exists('opcache_reset')) {
    opcache_reset();
    echo 'OPCACHE_RESET_OK';
} else {
    echo 'OPCACHE_NOT_AVAILABLE';
}
```

2. Acesse `https://SEU_DOMINIO/opcache_reset.php` uma única vez e remova o arquivo.

## Notas de Implementação

- O `PdfController` inicializa `extraPagesRaw` para evitar “Undefined variable $extraPagesRaw” quando fundos de galeria são usados.
- O controller aplica fallback para fundos via Data URI quando URLs HTTP forem bloqueadas pelo `wkhtmltopdf`.

---

# Deploy & PDF (wkhtmltopdf) – Production Checklist (English)

This guide covers production deployment and validating PDF generation via wkhtmltopdf. Includes quick checks, useful commands, and 500 error resolution.

## Prerequisites

- PHP 8.x with opcache enabled (recommended)
- Laravel standard extensions
- `wkhtmltopdf` and `wkhtmltoimage` binaries installed and executable
- SSH access to the server

## .env (production)

- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://YOUR_DOMAIN`
- `FRONTEND_URL=https://YOUR_FRONT_DOMAIN` (if applicable)
- `WKHTML_PDF_BINARY=/usr/local/bin/wkhtmltopdf` (or `/usr/bin/wkhtmltopdf`)
- `WKHTML_IMG_BINARY=/usr/local/bin/wkhtmltoimage` (or `/usr/bin/wkhtmltoimage`)

Notes:
- `APP_URL` must be the base domain only, no `/api/v1`.
- In production, `WKHTML_*_BINARY` env vars take priority over fallback.

## Deployment Flow (SSH)

1. Update code
   - `git pull` or sync files using your strategy.
2. Install dependencies
   - `composer install --no-dev --prefer-dist --optimize-autoloader`
3. Run migrations (if needed)
   - `php artisan migrate --force`
4. Clear and recache
   - `php artisan optimize:clear`
   - `php artisan config:clear && php artisan config:cache`
   - `php artisan route:clear && php artisan view:clear`
5. Storage symlink
   - `php artisan storage:link`
6. Restart services (if applicable)
   - Restart PHP-FPM to refresh opcache
   - Restart queues: `php artisan queue:restart`

## Quick PDF Validation

1. Test HTML (diagnostic without wkhtmltopdf):
   - `curl -i -H "Authorization: Bearer <TOKEN>" "https://YOUR_DOMAIN/api/v1/pdf/matriculas/<ID>?debug_html=1"`
2. Generate final PDF:
   - `curl -i -H "Authorization: Bearer <TOKEN>" "https://YOUR_DOMAIN/api/v1/pdf/matriculas/<ID>"`

## 500 Error Troubleshooting

- Missing or non-executable binaries:
  - `ls -l /usr/local/bin/wkhtmltopdf /usr/local/bin/wkhtmltoimage`
  - `chmod +x /usr/local/bin/wkhtmltopdf /usr/local/bin/wkhtmltoimage`
- Write permissions in `storage`:
  - Check `storage/app/public/uploads/matriculas` write access
  - `php artisan storage:link`
- Incorrect `APP_URL`:
  - Must be the base domain; fix in `.env` if needed
- Logs:
  - `tail -n 200 storage/logs/laravel.log`
  - Look for “Unable to load”, “Permission denied”, “No such file or directory”

## OpCache Reset (safe alternative)

If you can’t restart PHP-FPM, you can TEMPORARILY create an endpoint to reset opcache:

1. Create `public/opcache_reset.php` (do not version):

```php
<?php
// Temporary use only; remove after execution.
if (function_exists('opcache_reset')) {
    opcache_reset();
    echo 'OPCACHE_RESET_OK';
} else {
    echo 'OPCACHE_NOT_AVAILABLE';
}
```

2. Access `https://YOUR_DOMAIN/opcache_reset.php` once and remove the file.

## Implementation Notes

- `PdfController` initializes `extraPagesRaw` to avoid “Undefined variable $extraPagesRaw” when gallery backgrounds are used.
- The controller applies a Data URI fallback for backgrounds when HTTP URLs are blocked by `wkhtmltopdf`.