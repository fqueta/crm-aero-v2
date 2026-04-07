<?php

namespace App\Jobs;

use App\Http\Controllers\api\MatriculaController;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class SendPeriodosZapsingJob implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new job instance.
     */
    protected $id_matricula;

    /**
     * Create a new job instance.
     *
     * @param int|string $id_matricula
     */
    public function __construct($id_matricula)
    {
        $this->id_matricula = $id_matricula;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        $id_matricula = $this->id_matricula;

        try {
            // Log do Início
            if (class_exists('App\Models\EventLog')) {
                \App\Models\EventLog::create([
                    'entity_type' => 'matricula',
                    'entity_id' => $id_matricula,
                    'action' => 'ZapSign: Envio Iniciado',
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
                    'action' => 'ZapSign: Envio Concluído',
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
                    'action' => 'ZapSign: Erro no Envio',
                    'description' => 'Falha durante o processo de envio para ZapSign: ' . $e->getMessage(),
                    'payload' => ['error' => $e->getMessage()],
                ]);
            }

            throw $e;
        }
    }
}
