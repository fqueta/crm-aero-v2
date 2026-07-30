<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
// Correct import
use App\Http\Controllers\api\MatriculaController;

class GeraPdfcontratosPnlJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 600;
    public $tries = 3;

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
        try {
            // Log do Início
            if (class_exists('App\Models\EventLog')) {
                \App\Models\EventLog::create([
                    'entity_type' => 'matricula',
                    'entity_id' => $this->id_matricula,
                    'action' => 'contratos_generated',
                    'description' => 'Iniciando geração dos PDFs de Contratos/Períodos em segundo plano...',
                    'payload' => ['job' => get_class($this)],
                    'actor_id' => null,
                ]);
            }

            $controller = new MatriculaController();
            $response = $controller->contratos_periodos_pdf($this->id_matricula);

            // Log de Sucesso
            if (class_exists('App\Models\EventLog') && !empty($response['exec'])) {
                \App\Models\EventLog::create([
                    'entity_type' => 'matricula',
                    'entity_id' => $this->id_matricula,
                    'action' => 'contratos_generated',
                    'description' => 'PDFs dos Contratos gerados com sucesso pelo Job.',
                    'payload' => ['response_payload' => $response],
                ]);
            } elseif (class_exists('App\Models\EventLog')) {
                \App\Models\EventLog::create([
                    'entity_type' => 'matricula',
                    'entity_id' => $this->id_matricula,
                    'action' => 'contratos_error',
                    'description' => $response['mens'] ?? 'Nenhum contrato PDF foi gerado pelo Job.',
                    'payload' => ['response_payload' => $response],
                ]);
            }

        } catch (\Throwable $e) {
            \Log::error("Error generating Contract PDF for Matricula ID: {$this->id_matricula}: " . $e->getMessage());
            
            if (class_exists('App\Models\EventLog')) {
                \App\Models\EventLog::create([
                    'entity_type' => 'matricula',
                    'entity_id' => $this->id_matricula,
                    'action' => 'contratos_error',
                    'description' => 'Falha ao gerar PDFs dos Contratos: ' . $e->getMessage(),
                    'payload' => ['error' => $e->getMessage()],
                ]);
            }

            throw $e;
        }
    }
}
