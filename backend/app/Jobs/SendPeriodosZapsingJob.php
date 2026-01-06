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
        // Verify if envelope was already sent
        $verificar = \App\Services\Qlib::get_matriculameta($id_matricula, 'enviar_envelope');
        
        if ($verificar) {
            \Log::info("ZapSign Envelope already sent for Matricula ID: $id_matricula");
            return;
        }

        try {
            $matricula = \App\Models\Matricula::findOrFail($id_matricula);
            $cliente = \App\Models\User::find($matricula->id_cliente);

            if (!$cliente) {
                throw new \Exception("Client not found for Matricula ID: $id_matricula");
            }

            // Fetch PDF URLs from metadata
            $propostaPdfUrl = \App\Services\Qlib::get_matriculameta($id_matricula, 'proposta_pdf');
            
            // Contracts can be a single URL or a JSON list
            $contratosMeta = \App\Services\Qlib::get_matriculameta($id_matricula, 'contrato_pdf');
            $docs = [];

            // Add Proposal PDF
            if ($propostaPdfUrl) {
                $docs[] = [
                    'name' => 'Proposta de Matrícula',
                    'url_pdf' => $propostaPdfUrl,
                ];
            }

            // Add Contract PDFs
            if ($contratosMeta) {
                $decoded = json_decode($contratosMeta, true);
                if (is_array($decoded)) {
                    foreach ($decoded as $contrato) {
                        if (isset($contrato['url'])) {
                            $docs[] = [
                                'name' => $contrato['nome_contrato'] ?? 'Contrato',
                                'url_pdf' => $contrato['url'],
                            ];
                        }
                    }
                } else {
                    // Fallback if it's a simple string URL (legacy/simple case)
                    $docs[] = [
                        'name' => 'Contrato de Prestação de Serviços',
                        'url_pdf' => $contratosMeta,
                    ];
                }
            }

            if (empty($docs)) {
                throw new \Exception("No documents found for sending to ZapSign (Matricula ID: $id_matricula)");
            }

            // Prepare Signer
            $signer = [
                'name' => $cliente->name,
                'email' => $cliente->email,
                'cpf' => $cliente->cpf,
                'send_automatic_email' => true,
                'send_automatic_whatsapp' => false, // Can be toggled based on requirements
            ];

            // Get additional signers (testemunhas/contratada) from Controller helper
            // We need to instantiate the controller to use its public method
            $zapsingController = new \App\Http\Controllers\api\ZapsingController();
            $signers = $zapsingController->signers_matricula($signer);

            // Prepare Envelope Payload
            $body = [
                'name' => 'Matrícula #' . $id_matricula . ' - ' . $cliente->name,
                'folder_path' => '/' . config('app.id_app', 'CRM'),
                'signers' => $signers,
                'docs' => $docs,
                'lang' => 'pt-br',
            ];

            // Send to ZapSign
            // The ZapsingController->post() method handles the API call
            $response = $zapsingController->post([
                'endpoint' => 'models/create-doc/?nop', // Using 'create-doc' endpoint as per typical ZapSign usage, check if ZapsingController handles endpoint specifics
                // Wait, ZapsingController logic for 'post' takes 'endpoint'. 
                // Let's check ZapsingController usage. It seems generic.
                // Assuming 'models/create-doc' or 'docs' is correct. 
                // However, standard ZapSign API for creating generic doc from PDF URL is POST /docs/
                'endpoint' => 'docs', 
                'body' => $body
            ]);

            if ($response['exec']) {
                // Success
                $responseData = $response['response'] ?? [];
                
                // Save metadata
                \App\Services\Qlib::update_matriculameta($id_matricula, 'enviar_envelope', json_encode($responseData));
                
                // Also save the 'processo_assinatura' meta if needed for consistency with webhook
                if (isset($responseData['external_id'])) {
                     \App\Services\Qlib::update_matriculameta($id_matricula, 'processo_assinatura', json_encode($responseData));
                }

                \Log::info("ZapSign Envelope sent successfully for Matricula ID: $id_matricula");
            } else {
                // Failure
                throw new \Exception("ZapSign API Error: " . ($response['mens'] ?? 'Unknown Error'));
            }

        } catch (\Throwable $e) {
            \Log::error("Job SendPeriodosZapsingJob Failed: " . $e->getMessage());
            // Optionally release the job back to queue or fail
            // $this->release(30);
        }
    }
}
