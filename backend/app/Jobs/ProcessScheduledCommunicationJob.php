<?php

namespace App\Jobs;

use App\Models\ScheduledCommunication;
use App\Services\ScheduledCommunication\ScheduledCommunicationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessScheduledCommunicationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 120;
    public $tries = 3;

    public function __construct(
        protected int $scheduledCommunicationId
    ) {
    }

    /**
     * handle
     * pt-BR: Carrega o agendamento novamente e delega o processamento ao serviço de domínio.
     * en-US: Reloads the scheduled communication and delegates processing to the domain service.
     */
    public function handle(ScheduledCommunicationService $service): void
    {
        $communication = ScheduledCommunication::find($this->scheduledCommunicationId);
        if (!$communication) {
            return;
        }

        $service->process($communication);
    }
}
