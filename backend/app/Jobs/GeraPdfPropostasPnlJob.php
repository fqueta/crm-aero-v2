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
            $controller->matricula($request, $this->id_matricula);
            
            // Optional: Log success
            // \Log::info("PDF Proposal generated for Matricula ID: {$this->id_matricula}");
            
        } catch (\Throwable $e) {
            \Log::error("Error generating PDF Proposal for Matricula ID: {$this->id_matricula}: " . $e->getMessage());
            // Optionally rethrow to fail the job
            // throw $e; 
        }
    }
}
