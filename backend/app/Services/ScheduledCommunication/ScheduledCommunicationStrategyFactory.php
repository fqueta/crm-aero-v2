<?php

namespace App\Services\ScheduledCommunication;

use App\Contracts\ScheduledCommunicationChannelStrategy;
use App\Models\ScheduledCommunication;
use RuntimeException;

class ScheduledCommunicationStrategyFactory
{
    /**
     * @param array<int, ScheduledCommunicationChannelStrategy> $strategies
     */
    public function __construct(
        protected array $strategies
    ) {
    }

    /**
     * make
     * pt-BR: Resolve a estratégia adequada para o canal/provedor do agendamento.
     * en-US: Resolves the proper strategy for the communication channel/provider.
     */
    public function make(ScheduledCommunication $communication): ScheduledCommunicationChannelStrategy
    {
        foreach ($this->strategies as $strategy) {
            if ($strategy->supports($communication)) {
                return $strategy;
            }
        }

        throw new RuntimeException('Nenhuma estratégia disponível para o canal informado.');
    }
}
