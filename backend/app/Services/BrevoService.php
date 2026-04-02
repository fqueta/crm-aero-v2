<?php
namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use App\Services\Qlib;

/**
 * Serviço para envio de e-mails via Brevo API v3
 */
class BrevoService
{
    /**
     * Retorna a URL base da API
     */
    protected static function baseUrl(): string
    {
        return (string) (config('services.brevo.api_url') ?: 'https://api.brevo.com/v3');
    }

    /**
     * Verifica se o Brevo está configurado
     */
    public static function isConfigured(): bool
    {
        $apiKey = config('services.brevo.api_key') ?: env('BREVO_API_KEY');
        $sender = self::senderEmail();
        return !empty($apiKey) && !empty($sender);
    }

    /**
     * Retorna o e-mail do remetente
     */
    protected static function senderEmail(): string
    {
        $email = config('services.brevo.sender.email');
        if (!empty($email)) return (string)$email;
        $fallback = config('mail.from.address') ?: env('MAIL_FROM_ADDRESS');
        return (string)($fallback ?: '');
    }

    /**
     * Retorna o nome do remetente
     */
    protected static function senderName(): string
    {
        $name = config('services.brevo.sender.name');
        if (!empty($name)) return (string)$name;
        return (string)(config('mail.from.name') ?: 'CRM Aeroclube');
    }

    /**
     * Envia um e-mail via Brevo API
     */
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

    /**
     * Notifica conclusão da assinatura com link de conferência
     */
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
