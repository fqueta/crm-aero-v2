#!/usr/bin/env bash
# Purpose: Quick production diagnostics for PDF generation via wkhtmltopdf
# Usage:
#   export TOKEN="<YOUR_BEARER_TOKEN>"
#   export BASE_URL="https://your.domain"
#   export MATRICULA_ID="2"
#   bash scripts/prod_pdf_diagnostics.sh

set -euo pipefail

echo "== PDF Diagnostics (wkhtmltopdf) =="
echo "BASE_URL=${BASE_URL:-unset}"
echo "MATRICULA_ID=${MATRICULA_ID:-unset}"

if [[ -z "${BASE_URL:-}" ]] || [[ -z "${TOKEN:-}" ]] || [[ -z "${MATRICULA_ID:-}" ]]; then
  echo "[ERROR] Please export TOKEN, BASE_URL and MATRICULA_ID before running." >&2
  exit 1
fi

echo "\n-- Checking binaries --"
for bin in /usr/local/bin/wkhtmltopdf /usr/bin/wkhtmltopdf /usr/local/bin/wkhtmltoimage /usr/bin/wkhtmltoimage; do
  if [[ -x "$bin" ]]; then
    echo "Found executable: $bin"
    "$bin" --version || true
  fi
done

echo "\n-- Fixing permissions (best-effort) --"
for bin in /usr/local/bin/wkhtmltopdf /usr/local/bin/wkhtmltoimage; do
  if [[ -e "$bin" ]]; then
    chmod +x "$bin" || true
  fi
done

echo "\n-- Laravel cache & links --"
php artisan optimize:clear || true
php artisan config:clear && php artisan config:cache || true
php artisan route:clear && php artisan view:clear || true
php artisan storage:link || true

echo "\n-- Tail last errors --"
tail -n 100 storage/logs/laravel.log || true

echo "\n-- Validate HTML (debug mode) --"
curl -i -H "Authorization: Bearer ${TOKEN}" "${BASE_URL}/api/v1/pdf/matriculas/${MATRICULA_ID}?debug_html=1" || true

echo "\n-- Generate PDF --"
curl -i -H "Authorization: Bearer ${TOKEN}" "${BASE_URL}/api/v1/pdf/matriculas/${MATRICULA_ID}" || true

echo "\nDone. Review output above for any errors or warnings."