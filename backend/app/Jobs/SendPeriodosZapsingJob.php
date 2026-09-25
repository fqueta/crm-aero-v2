<?php

namespace App\Jobs;

use App\Http\Controllers\api\MatriculaController;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SendPeriodosZapsingJob implements ShouldQueue
{
    use Queueable;

    public $timeout = 300;
    public $tries = 3;

    protected $id_matricula;

    /**
     * Host da request que originou o dispatch (contexto HTTP). Restaurado no worker
     * para que eventuais URLs (re)geradas usem o domínio do tenant ativo e não o APP_URL.
     */
    protected $originHost;

    /**
     * Create a new job instance.
     *
     * @param int|string $id_matricula
     */
    public function __construct($id_matricula, ?string $originHost = null)
    {
        $this->id_matricula = $id_matricula;
        $this->originHost = $originHost ?? \App\Services\Qlib::captureRequestHost();
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $prevHost = \App\Services\Qlib::$assetHostOverride;
        \App\Services\Qlib::$assetHostOverride = $this->originHost ?: $prevHost;
        try {
            $this->handleJob();
        } finally {
            \App\Services\Qlib::$assetHostOverride = $prevHost;
        }
    }

    /**
     * Envio efetivo do envelope para o ZapSign.
     */
    protected function handleJob(): void
    {
        $id_matricula = $this->id_matricula;

        try {
            // Log do Início
            if (class_exists('App\Models\EventLog')) {
                \App\Models\EventLog::create([
                    'entity_type' => 'matricula',
                    'entity_id' => $id_matricula,
                    'action' => 'zapsign_send_request',
                    'description' => 'Iniciando processo de envio de documentos para assinatura via ZapSign...',
                    'payload' => ['job' => get_class($this)],
                ]);
            }

            $MatriculaController = new \App\Http\Controllers\api\MatriculaController();
            $response = $MatriculaController->send_to_zapSing($id_matricula);

            // Log de Sucesso
            if (class_exists('App\Models\EventLog')) {
                \App\Models\EventLog::create([
                    'entity_type' => 'matricula',
                    'entity_id' => $id_matricula,
                    'action' => 'zapsign_send_response',
                    'description' => 'Processo de envio para o ZapSign finalizado com sucesso.',
                    'payload' => ['response' => $response],
                ]);
            }

        } catch (\Throwable $e) {
            \Log::error("Job SendPeriodosZapsingJob Failed: " . $e->getMessage());
            
            if (class_exists('App\Models\EventLog')) {
                \App\Models\EventLog::create([
                    'entity_type' => 'matricula',
                    'entity_id' => $id_matricula,
                    'action' => 'zapsign_error',
                    'description' => 'Falha durante o processo de envio para ZapSign: ' . $e->getMessage(),
                    'payload' => ['error' => $e->getMessage()],
                ]);
            }

            throw $e;
        }
    }
}
