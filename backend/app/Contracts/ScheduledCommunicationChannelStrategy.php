<?php

namespace App\Contracts;

use App\Models\ScheduledCommunication;

interface ScheduledCommunicationChannelStrategy
{
    /**
     * supports
     * pt-BR: Informa se a estratégia atende o canal/provedor do agendamento.
     * en-US: Informs whether the strategy supports the channel/provider of the communication.
     */
    public function supports(ScheduledCommunication $communication): bool;

    /**
     * send
     * pt-BR: Executa o processamento do agendamento e retorna o resultado padronizado.
     * en-US: Executes the scheduled communication processing and returns a normalized result.
     *
     * @return array{success: bool, provider_message_id?: string|null, error?: string|null, response?: mixed}
     */
    public function send(ScheduledCommunication $communication): array;
}
