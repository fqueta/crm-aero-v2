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
            $controller = new MatriculaController();
            $controller->contratos_periodos_pdf($this->id_matricula);
        } catch (\Throwable $e) {
            \Log::error("Error generating Contract PDF for Matricula ID: {$this->id_matricula}: " . $e->getMessage());
        }
    }
}
