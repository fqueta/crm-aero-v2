<?php

namespace App\Services\ScheduledCommunication\Strategies;

use App\Contracts\ScheduledCommunicationChannelStrategy;
use App\Models\ScheduledCommunication;
use App\Services\BrevoService;
use App\Services\Qlib;

class BrevoEmailScheduledCommunicationStrategy implements ScheduledCommunicationChannelStrategy
{
    /**
     * supports
     * pt-BR: Verifica se o agendamento deve ser processado como e-mail via Brevo.
     * en-US: Checks whether the communication should be processed as a Brevo email.
     */
    public function supports(ScheduledCommunication $communication): bool
    {
        return $communication->channel === 'email'
            && in_array((string) ($communication->provider ?: 'brevo'), ['brevo', 'email'], true);
    }

    /**
     * send
     * pt-BR: Envia o e-mail transacional usando o serviço Brevo do projeto.
     * en-US: Sends the transactional email using the project's Brevo service.
     */
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
        $safeMessage = nl2br(e($message));

        $logoUrl = Qlib::qoption('email_logo_url');
        $emailName = Qlib::qoption('email_nome') ?: 'CRM Aeroclube';
        $logoHtml = $logoUrl
            ? '<img src="' . e($logoUrl) . '" alt="' . e($emailName) . '" style="max-height:40px;display:block;">'
            : e($emailName);

        $html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>' . e($subject) . '</title></head>'
            . '<body style="margin:0;background:#f5f6fa;font-family:Arial,Helvetica,sans-serif;">'
            . '<div style="max-width:620px;margin:24px auto;padding:0 12px;">'
            . '<div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">'
            . '<div style="background:#073b5b;padding:16px 20px;color:#ffffff;font-size:18px;font-weight:700;text-align:center;">' . $logoHtml . '</div>'
            . '<div style="padding:20px;color:#111827;">'
            . ($recipientName !== '' ? '<p style="margin-top:0;">Ol&aacute;, ' . e($recipientName) . '.</p>' : '')
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
