<?php

namespace App\Jobs;

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
        // Verify via Controller method, which handles duplication checks too
        try {
            $zapsingController = new \App\Http\Controllers\api\ZapsingController();
            $response = $zapsingController->enviar_envelope($id_matricula);

            if (isset($response['exec']) && $response['exec']) {
                \Log::info("ZapSign Envelope sent successfully for Matricula ID: $id_matricula");
            } else {
                // If mens is populated, log it. If specific "already sent", maybe info, else error.
                // Assuming controller returns 'mens'
                $msg = isset($response['mens']) ? $response['mens'] : 'Unknown result';
                
                if (strpos($msg, 'Envelope já enviado') !== false) {
                     \Log::info("ZapSign: $msg (Matricula ID: $id_matricula)");
                } else {
                     \Log::error("ZapSign Error: $msg (Matricula ID: $id_matricula)");
                     // throw new \Exception($msg); // Uncomment if retry behavior is desired
                }
            }

        } catch (\Throwable $e) {
            \Log::error("Job SendPeriodosZapsingJob Failed: " . $e->getMessage());
        }
    }
}
