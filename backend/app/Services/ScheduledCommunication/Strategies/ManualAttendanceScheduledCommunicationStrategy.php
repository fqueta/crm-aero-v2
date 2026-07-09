<?php

namespace App\Services\ScheduledCommunication\Strategies;

use App\Contracts\ScheduledCommunicationChannelStrategy;
use App\Models\ScheduledCommunication;

class ManualAttendanceScheduledCommunicationStrategy implements ScheduledCommunicationChannelStrategy
{
    /**
     * supports
     * pt-BR: Verifica se o agendamento representa uma tarefa interna de atendimento.
     * en-US: Checks whether the communication represents an internal attendance task.
     */
    public function supports(ScheduledCommunication $communication): bool
    {
        return $communication->channel === 'manual';
    }

    /**
     * send
     * pt-BR: Marca a tarefa como executada sem disparo externo.
     * en-US: Marks the task as executed without an external send.
     */
    public function send(ScheduledCommunication $communication): array
    {
        return [
            'success' => true,
            'provider_message_id' => null,
            'response' => [
                'exec' => true,
                'message' => 'Atendimento manual marcado como executado.',
            ],
        ];
    }
}
