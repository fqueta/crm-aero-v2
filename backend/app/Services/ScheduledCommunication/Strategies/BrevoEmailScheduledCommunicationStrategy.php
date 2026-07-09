<?php

namespace App\Services\ScheduledCommunication\Strategies;

use App\Contracts\ScheduledCommunicationChannelStrategy;
use App\Models\ScheduledCommunication;
use App\Services\BrevoService;
use App\Services\Qlib;

class BrevoEmailScheduledCommunicationStrategy implements ScheduledCommunicationChannelStrategy
{
    public function supports(ScheduledCommunication $communication): bool
    {
        return $communication->channel === 'email'
            && in_array((string) ($communication->provider ?: 'brevo'), ['brevo', 'email'], true);
    }

    public function send(ScheduledCommunication $communication): array
    {
        $recipientEmail = trim((string) $communication->recipient_email);
        if ($recipientEmail === '') {
            return [
                'success' => false,
                'error' => 'Destinatário sem e-mail cadastrado para envio.',
            ];
        }

        $recipientName = trim((string) $communication->recipient_name);
        $subject = trim((string) $communication->subject);
        $message = (string) ($communication->message ?? '');
        $isHtml = $message !== strip_tags($message);
        $safeMessage = $isHtml ? $message : nl2br(e($message));

        $hasLogo = Qlib::qoption('email_logo_url');
        $emailName = Qlib::qoption('email_nome') ?: 'CRM Aeroclube';
        $logoHtml = $hasLogo
            ? '<img src="' . url('/api/v1/email-logo') . '" alt="' . e($emailName) . '" style="max-height:40px;display:block;">'
            : e($emailName);

        $signatureLink = $communication->payload['signature_link'] ?? null;
        $hasButtonShortcode = str_contains($message, '{botao_ver_proposta}');
        $ctaHtml = '';
        $buttonHtml = '';
        
        if ($signatureLink) {
            $buttonHtml = '<div style="text-align:center;margin:24px 0;">'
                . '<a href="' . e($signatureLink) . '" style="display:inline-block;padding:12px 32px;background:#073b5b;color:#ffffff;text-decoration:none;border-radius:6px;font-size:16px;font-weight:600;">Ver Proposta</a>'
                . '</div>';
                
            if (!$hasButtonShortcode) {
                // Se não tem o shortcode, anexa no topo (comportamento legado)
                $ctaHtml = $buttonHtml
                    . '<p style="text-align:center;color:#6b7280;font-size:13px;">Ou utilize o link abaixo:</p>'
                    . '<p style="text-align:center;"><a href="' . e($signatureLink) . '" style="color:#073b5b;word-break:break-all;">' . e($signatureLink) . '</a></p>';
            }
        }

        if ($hasButtonShortcode) {
            $safeMessage = str_replace('{botao_ver_proposta}', $buttonHtml, $safeMessage);
        }

        $html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' . e($subject) . '</title></head>'
            . '<body style="margin:0;background:#f5f6fa;font-family:Arial,Helvetica,sans-serif;">'
            . '<div style="max-width:620px;margin:24px auto;padding:0 12px;">'
            . '<div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">'
            . '<div style="background:#073b5b;padding:16px 20px;color:#ffffff;font-size:18px;font-weight:700;text-align:center;">' . $logoHtml . '</div>'
            . '<div style="padding:20px;color:#111827;">'
            . $ctaHtml
            . '<div style="font-size:14px;line-height:1.7;">' . $safeMessage . '</div>'
            . '<p style="margin-top:24px;color:#6b7280;font-size:12px;">Este e-mail foi enviado automaticamente pelo CRM.</p>'
            . '</div></div></div></body></html>';

        $response = BrevoService::sendEmail(
            [[
                'email' => $recipientEmail,
                'name' => $recipientName !== '' ? $recipientName : null,
            ]],
            $subject !== '' ? $subject : 'Atendimento agendado',
            $message,
            [
                'html' => $html,
                'tags' => ['scheduled-communication', 'proposal-signature'],
            ]
        );

        return [
            'success' => (bool) ($response['exec'] ?? false),
            'provider_message_id' => $response['response']['messageId'] ?? null,
            'error' => $response['mens'] ?? $response['error'] ?? null,
            'response' => $response,
        ];
    }
}
