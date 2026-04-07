<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class GeraPdfPropostasPnlJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $id_matricula;
    /**
     * Timeout em segundos para este job (compatível com processos de PDF pesados).
     * EN: Job timeout in seconds for heavy PDF generation.
     */
    public $timeout = 600;
    /**
     * Número de tentativas em caso de falha transitória.
     * EN: Number of tries for transient failures.
     */
    public $tries = 2;

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
                    'action' => 'Geração de Proposta: Iniciada',
                    'description' => 'Iniciando geração do PDF da Proposta Comercial em segundo plano (Job)...',
                    'payload' => ['job' => get_class($this)],
                    'actor_id' => null,
                ]);
            }

            // Instantiate the controller
            $controller = new \App\Http\Controllers\api\PdfController();

            // Create a mock request with desired parameters
            $request = new \Illuminate\Http\Request();
            $request->merge([
                'force' => true,      // Force regeneration if needed
                'no_store' => false,  // Save to disk
                'debug_html' => false // Generate actual PDF
            ]);

            // Call the matricula method to generate the PDF
            $response = $controller->matricula($request, $this->id_matricula);

             // Log de Sucesso
             if (class_exists('App\Models\EventLog')) {
                \App\Models\EventLog::create([
                    'entity_type' => 'matricula',
                    'entity_id' => $this->id_matricula,
                    'action' => 'Geração de Proposta: Concluída',
                    'description' => 'PDF da Proposta Comercial gerado com sucesso pelo Job.',
                    'payload' => ['response_payload' => $response],
                ]);
            }

        } catch (\Throwable $e) {
            \Log::error("Error generating PDF Proposal for Matricula ID: {$this->id_matricula}: " . $e->getMessage());
            
             if (class_exists('App\Models\EventLog')) {
                \App\Models\EventLog::create([
                    'entity_type' => 'matricula',
                    'entity_id' => $this->id_matricula,
                    'action' => 'Geração de Proposta: Erro',
                    'description' => 'Falha ao gerar PDF da Proposta Comercial: ' . $e->getMessage(),
                    'payload' => ['error' => $e->getMessage()],
                ]);
            }

            throw $e;
        }
    }
}
