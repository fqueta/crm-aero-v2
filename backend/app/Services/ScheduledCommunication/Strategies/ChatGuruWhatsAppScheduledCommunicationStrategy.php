<?php

namespace App\Services\ScheduledCommunication\Strategies;

use App\Contracts\ScheduledCommunicationChannelStrategy;
use App\Http\Controllers\api\ZapguruController;
use App\Models\ScheduledCommunication;

class ChatGuruWhatsAppScheduledCommunicationStrategy implements ScheduledCommunicationChannelStrategy
{
    /**
     * supports
     * pt-BR: Verifica se o agendamento deve ser processado como WhatsApp via ChatGuru.
     * en-US: Checks whether the communication should be processed as a ChatGuru WhatsApp message.
     */
    public function supports(ScheduledCommunication $communication): bool
    {
        return $communication->channel === 'whatsapp'
            && in_array((string) ($communication->provider ?: 'chatguru'), ['chatguru', 'whatsapp'], true);
    }

    /**
     * send
     * pt-BR: Envia a mensagem de WhatsApp usando a integracao existente do projeto.
     * en-US: Sends the WhatsApp message using the project's existing integration.
     */
    public function send(ScheduledCommunication $communication): array
    {
        $recipientPhone = preg_replace('/\D/', '', (string) $communication->recipient_phone);
        if ($recipientPhone === '') {
            return [
                'success' => false,
                'error' => 'Destinatário sem celular cadastrado para envio via WhatsApp.',
            ];
        }

        if (strlen($recipientPhone) <= 11 && !str_starts_with($recipientPhone, '55')) {
            $recipientPhone = '55' . $recipientPhone;
        }

        $zapguru = new ZapguruController();
        $response = $zapguru->enviar_mensagem([
            'celular_completo' => $recipientPhone,
            'nome' => $communication->recipient_name ?: 'Cliente',
            'text' => (string) ($communication->message ?? ''),
        ]);

        return [
            'success' => (bool) ($response['exec'] ?? false),
            'provider_message_id' => $response['response']['id'] ?? null,
            'error' => $response['response']['description'] ?? $response['error'] ?? null,
            'response' => $response,
        ];
    }
}
