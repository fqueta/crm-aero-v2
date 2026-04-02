---
name: "zapsing-brevo-notify"
description: "Sends Brevo emails when Zapsign webhook status='signed' incl. verification link. Invoke when enabling signature-completion notifications."
---

# Zapsign → Brevo Notifier

This skill wires a Zapsign webhook to send transactional emails via Brevo when a document reaches status "signed". It includes the Zapsign verification link (prefers signers[1].sign_url then signers[0].sign_url) and supports HTML layout and Brevo templates.

## When to Invoke
- Add/repair signature-completion notifications
- Migrate this integration to another Laravel API
- Switch notification sender to Brevo (API v3)

## What It Does
1. Adds Brevo service configuration (config/services.php and .env.example)
2. Introduces App\Services\BrevoService for API v3 email sending with:
   - textContent + htmlContent
   - templateId + params (optional)
   - tags support
   - brand logo and styled frame (HTML)
3. Updates Zapsing webhook to call Brevo on status='signed', independent of file download outcome
4. Extracts verification URL from the webhook payload and includes it in the email

## Prerequisites
- Laravel app with Http and Log facades available
- .env configured with at least MAIL_FROM_* or BREVO_SENDER_* and BREVO_API_KEY
- Zapsign webhook routed to a controller action receiving JSON body

## Implementation Steps

### 1) Configure Brevo in services.php

Add the following block to `config/services.php`:

```php
'brevo' => [
    'api_key' => env('BREVO_API_KEY'),
    'api_url' => env('BREVO_API_URL', 'https://api.brevo.com/v3'),
    'sender' => [
        'email' => env('BREVO_SENDER_EMAIL'),
        'name' => env('BREVO_SENDER_NAME', env('MAIL_FROM_NAME', 'CRM Aeroclube')),
    ],
],
```

### 2) Add environment variables

Append to `.env.example`:

```
BREVO_API_KEY=
BREVO_API_URL=https://api.brevo.com/v3
BREVO_SENDER_EMAIL=
BREVO_SENDER_NAME="CRM Aeroclube"
```

In your `.env`, define:
```
BREVO_API_KEY=your_api_key_here
BREVO_API_URL=https://api.brevo.com/v3
BREVO_SENDER_EMAIL=nao_responda@dominio.com
BREVO_SENDER_NAME="Seu Nome"
```

### 3) Create the Brevo service

Create `app/Services/BrevoService.php` with:

```php
<?php
namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Qlib\Qlib;

class BrevoService
{
    protected static function baseUrl(): string
    {
        return (string) (config('services.brevo.api_url') ?: 'https://api.brevo.com/v3');
    }
    public static function isConfigured(): bool
    {
        $apiKey = config('services.brevo.api_key') ?: env('BREVO_API_KEY');
        $sender = self::senderEmail();
        return !empty($apiKey) && !empty($sender);
    }
    protected static function senderEmail(): string
    {
        $email = config('services.brevo.sender.email');
        if (!empty($email)) return (string)$email;
        $fallback = config('mail.from.address') ?: env('MAIL_FROM_ADDRESS');
        return (string)($fallback ?: '');
    }
    protected static function senderName(): string
    {
        $name = config('services.brevo.sender.name');
        if (!empty($name)) return (string)$name;
        return (string)(config('mail.from.name') ?: 'CRM Aeroclube');
    }
    public static function sendEmail(array $tos, string $subject, string $textContent, array $options = []): array
    {
        $ret = ['exec' => false];
        if (!self::isConfigured()) {
            $ret['mens'] = 'Brevo não configurado';
            Log::warning('BrevoService: configuração ausente (api_key/sender)');
            return $ret;
        }
        $payload = [
            'sender' => ['name' => self::senderName(), 'email' => self::senderEmail()],
            'to' => $tos,
            'subject' => $subject,
            'textContent' => $textContent,
        ];
        if (!empty($options['html'])) $payload['htmlContent'] = (string)$options['html'];
        if (!empty($options['template_id'])) {
            $payload['templateId'] = (int)$options['template_id'];
            if (!empty($options['params']) && is_array($options['params'])) {
                $payload['params'] = $options['params'];
            }
        }
        if (!empty($options['tags']) && is_array($options['tags'])) $payload['tags'] = $options['tags'];
        try {
            $resp = Http::withHeaders([
                'accept' => 'application/json',
                'api-key' => (string) config('services.brevo.api_key'),
            ])->post(self::baseUrl().'/smtp/email', $payload);
            $ret['response'] = Qlib::lib_json_array($resp, true);
            $ret['exec'] = $resp->successful();
        } catch (\Throwable $e) {
            $ret['error'] = $e->getMessage();
            Log::error('BrevoService: erro ao enviar e-mail', ['error' => $e->getMessage()]);
        }
        return $ret;
    }
    public static function notifySignatureCompleted(array $emails, array $data): array
    {
        $tos = array_map(fn ($e) => ['email' => $e], $emails);
        $docName = (string)($data['name'] ?? '');
        $externalId = (string)($data['external_id'] ?? '');
        $verifyUrl = '';
        if (!empty($data['signers']) && is_array($data['signers'])) {
            $preferred = $data['signers'][1]['sign_url'] ?? $data['signers'][0]['sign_url'] ?? '';
            if (!empty($preferred)) {
                $preferred = trim(trim($preferred), " `\"'");
                $verifyUrl = $preferred;
            }
        }
        $subject = 'Assinatura concluída';
        $text = "A assinatura do documento foi concluída.\n";
        if ($docName) $text .= "Documento: {$docName}\n";
        if ($externalId) $text .= "Token: {$externalId}\n";
        if ($verifyUrl) $text .= "Conferência: {$verifyUrl}\n";
        $safeDoc = htmlspecialchars($docName, ENT_QUOTES, 'UTF-8');
        $safeTok = htmlspecialchars($externalId, ENT_QUOTES, 'UTF-8');
        $safeUrl = htmlspecialchars($verifyUrl, ENT_QUOTES, 'UTF-8');
        $brandLogo = isset($data['brand_logo']) ? trim((string)$data['brand_logo'], " `\"'") : '';
        $safeLogo = htmlspecialchars((string)$brandLogo, ENT_QUOTES, 'UTF-8');
        $html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Assinatura concluída</title></head><body style="margin:0;background:#f5f6fa;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:620px;margin:24px auto;padding:0 12px;">
          <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 1px 2px rgba(0,0,0,0.04);overflow:hidden;">
            <div style="background:#073b5b;padding:16px;text-align:center;color:#fff;">'.($safeLogo ? '<img alt="Logo" src="'.$safeLogo.'" style="max-height:42px;vertical-align:middle">' : '<strong>CRM</strong>').'</div>
            <div style="padding:20px;color:#111827;">
              <h2 style="margin:0 0 12px 0;font-size:18px;color:#073b5b;">Assinatura concluída</h2>
              '.($safeDoc ? '<p><strong>Documento:</strong> '.$safeDoc.'</p>' : '').'
              '.($safeTok ? '<p><strong>Token:</strong> '.$safeTok.'</p>' : '').'
              '.($safeUrl ? '<p><strong>Conferência:</strong> <a href="'.$safeUrl.'" target="_blank" style="color:#0ea5e9;text-decoration:none">'.$safeUrl.'</a></p>' : '').'
              <p style="margin-top:16px;color:#6b7280;font-size:12px;">Este e-mail foi gerado automaticamente.</p>
            </div>
          </div>
        </div></body></html>';
        return self::sendEmail($tos, $subject, $text, ['tags' => ['zapsing','webhook','signed'], 'html' => $html]);
    }
}
```

### 4) Hook into the Zapsing webhook

In your webhook controller, after saving webhook data:

```php
use App\Services\BrevoService;
use App\Qlib\Qlib;

// ...
$status = $d['status'] ?? '';
if ($status === 'signed') {
    $emails = Qlib::qoption('zapsing_notify_emails') ?: ['contato@exemplo.com','suporte@exemplo.com'];
    if (is_string($emails)) $emails = \App\Qlib\Qlib::lib_json_array($emails);
    $ret['notify_brevo'] = BrevoService::notifySignatureCompleted($emails, $d);
}
```

This fires regardless of download success, so notifications are not blocked by temporary remote errors.

### 5) Cache refresh

```
php artisan config:clear
php artisan cache:clear
php artisan config:cache
```

## Testing

Send a POST to your webhook endpoint with a payload including:
- `"status": "signed"`
- `signers` array containing `sign_url` (preferably at index 1)

Example cURL:
```bash
curl -X POST http://localhost:8000/api/webhook/zapsing \
  -H "Content-Type: application/json" \
  -d '{"status":"signed","external_id":"TOKEN_123","name":"Contrato X","signers":[{"sign_url":"https://app.zapsign.com.br/verificar/aaa"},{"sign_url":"https://app.zapsign.com.br/verificar/bbb"}]}'
```

Expected:
- HTTP 200 in the webhook
- Email sent via Brevo with document, token and the verification link

## Troubleshooting
- “Brevo não configurado”: defina BREVO_API_KEY e remetente (BREVO_SENDER_EMAIL ou MAIL_FROM_ADDRESS); recarregue o cache de configuração.
- Download 403 de arquivos assinados: não bloqueia envio do e-mail; verifique validade do link S3.
- Link quebrado: verifique se o payload não inclui crases/backticks; sanitização remove caracteres comuns.

