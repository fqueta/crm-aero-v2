<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\api\MetricasController;
use App\Http\Controllers\Controller;
use App\Models\ScheduledCommunication;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Response;

/**
 * Controller para gerenciar webhooks
 * Processa requisições de webhooks de diferentes serviços
 */
class WebhookController extends Controller
{
    public function index(Request $request){
        $seg1 = request()->segment(1);
        $seg2 = request()->segment(2);
        $seg3 = request()->segment(3);
        $ret = false;
        // if($seg3=='asaas'){
        //     $ret = (new AsaasController)->webhook($request->all());
        // }elseif($seg3=='zenvia'){
        //     $ret = (new ZenviaController)->salvar_eventos($request);
        // }elseif($seg3=='rd'){
        //     $ret = (new RdstationController)->webhook($request->all());
        // }elseif($seg3=='zapguru'){
            $ret = $this->handleDoubleEndpoint($request, $seg1, $seg2);
        // }elseif($seg3=='zapsing'){
        //     $ret = (new ApiZapsingController)->webhook($request->all());
        // }
        return $ret;
    }

    /**
     * Processar webhook com um endpoint
     *
     * @param Request $request
     * @param string $endp1 Primeiro parâmetro do endpoint
     * @return \Illuminate\Http\JsonResponse
     */
    public function handleSingleEndpoint(Request $request, string $endp1)
    {
        try {
            // Log da requisição recebida
            Log::info('Webhook recebido - Endpoint único', [
                'endpoint' => $endp1,
                'method' => $request->method(),
                'headers' => $request->headers->all(),
                'payload' => $request->all(),
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);

            // Processar webhook baseado no endpoint
            $result = $this->processWebhook($endp1, null, $request);
            try {
                event(new \App\Events\WebhookReceived(
                    $endp1,
                    null,
                    $request->all(),
                    $request->headers->all(),
                    $request->ip()
                ));
            } catch (\Throwable $e) {}

            return response()->json([
                'success' => true,
                'message' => 'Webhook processado com sucesso',
                'endpoint' => $endp1,
                'data' => $result
            ], 200);

        } catch (\Exception $e) {
            Log::error('Erro ao processar webhook - Endpoint único', [
                'endpoint' => $endp1,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao processar webhook',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Processar webhook com dois endpoints
     *
     * @param Request $request
     * @param string $endp1 Primeiro parâmetro do endpoint
     * @param string $endp2 Segundo parâmetro do endpoint
     * @return \Illuminate\Http\JsonResponse
     */
    public function handleDoubleEndpoint(Request $request, string $endp1, string $endp2)
    {
        try {
            // Log da requisição recebida
            Log::info('Webhook recebido - Endpoint duplo', [
                'endpoint1' => $endp1,
                'endpoint2' => $endp2,
                'method' => $request->method(),
                'headers' => $request->headers->all(),
                'payload' => $request->all(),
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent()
            ]);

            // Processar webhook baseado nos endpoints
            $result = $this->processWebhook($endp1, $endp2, $request);
            try {
                event(new \App\Events\WebhookReceived(
                    $endp1,
                    $endp2,
                    $request->all(),
                    $request->headers->all(),
                    $request->ip()
                ));
            } catch (\Throwable $e) {}

            return response()->json([
                'success' => true,
                'message' => 'Webhook processado com sucesso',
                'endpoint1' => $endp1,
                'endpoint2' => $endp2,
                'data' => $result
            ], 200);

        } catch (\Exception $e) {
            Log::error('Erro ao processar webhook - Endpoint duplo', [
                'endpoint1' => $endp1,
                'endpoint2' => $endp2,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Erro ao processar webhook',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Processar lógica específica do webhook baseado nos endpoints
     *
     * @param string $endp1
     * @param string|null $endp2
     * @param Request $request
     * @return array
     */
    private function processWebhook(string $endp1, ?string $endp2, Request $request): array
    {
        $payload = $request->all();
        $headers = $request->headers->all();
        // dd($request->all());
        // Lógica específica baseada nos endpoints
        switch ($endp1) {
            case 'payment':
                return $this->processPaymentWebhook($endp2, $payload, $headers);

            case 'notification':
                return $this->processNotificationWebhook($endp2, $payload, $headers);

            case 'integration':
                return $this->processIntegrationWebhook($endp2, $payload, $headers);

            case 'system':
                return $this->processSystemWebhook($endp2, $payload, $headers);

            case 'metrics':
                return $this->processMetricsWebhook($endp2, $payload, $headers);

            case 'zapsing':
                return $this->processZapsingWebhook($endp1, $endp2, $payload, $headers);
            case 'brevo':
                return $this->processBrevoWebhook($payload, $headers);
            default:
                return $this->processGenericWebhook($endp1, $endp2, $payload, $headers);
        }
    }

    /**
     * Processar webhooks de pagamento
     *
     * @param string|null $endp2
     * @param array $payload
     * @param array $headers
     * @return array
     */
    private function processPaymentWebhook(?string $endp2, array $payload, array $headers): array
    {
        Log::info('Processando webhook de pagamento', [
            'sub_endpoint' => $endp2,
            'payload_keys' => array_keys($payload)
        ]);

        // Implementar lógica específica de pagamento
        return [
            'type' => 'payment',
            'sub_type' => $endp2,
            'processed_at' => now()->toISOString(),
            'payload_received' => !empty($payload)
        ];
    }
    private function processMetricsWebhook(?string $endp2, array $payload, array $headers): array
    {
        Log::info('Processando webhook de métricas', [
            'sub_endpoint' => $endp2,
            'payload_keys' => array_keys($payload)
        ]);
        $proccess = (new MetricasController())->processWebhook($endp2, $payload, $headers);
        // Implementar lógica específica de métricas
        return [
            'type' => 'metrics',
            'sub_type' => $endp2,
            'processed_at' => now()->toISOString(),
            'payload_received' => !empty($payload),
            'data' => $proccess
        ];
    }

    /**
     * Processar webhooks de notificação
     *
     * @param string|null $endp2
     * @param array $payload
     * @param array $headers
     * @return array
     */
    private function processNotificationWebhook(?string $endp2, array $payload, array $headers): array
    {
        Log::info('Processando webhook de notificação', [
            'sub_endpoint' => $endp2,
            'payload_keys' => array_keys($payload)
        ]);

        // Implementar lógica específica de notificação
        return [
            'type' => 'notification',
            'sub_type' => $endp2,
            'processed_at' => now()->toISOString(),
            'payload_received' => !empty($payload)
        ];
    }

    /**
     * Processar webhooks de integração
     *
     * @param string|null $endp2
     * @param array $payload
     * @param array $headers
     * @return array
     */
    private function processIntegrationWebhook(?string $endp2, array $payload, array $headers): array
    {
        Log::info('Processando webhook de integração', [
            'sub_endpoint' => $endp2,
            'payload_keys' => array_keys($payload)
        ]);

        // Implementar lógica específica de integração
        return [
            'type' => 'integration',
            'sub_type' => $endp2,
            'processed_at' => now()->toISOString(),
            'payload_received' => !empty($payload)
        ];
    }

    /**
     * Processar webhooks de sistema
     *
     * @param string|null $endp2
     * @param array $payload
     * @param array $headers
     * @return array
     */
    private function processSystemWebhook(?string $endp2, array $payload, array $headers): array
    {
        Log::info('Processando webhook de sistema', [
            'sub_endpoint' => $endp2,
            'payload_keys' => array_keys($payload)
        ]);

        // Implementar lógica específica de sistema
        return [
            'type' => 'system',
            'sub_type' => $endp2,
            'processed_at' => now()->toISOString(),
            'payload_received' => !empty($payload)
        ];
    }

    /**
     * Processar webhooks genéricos
     *
     * @param string $endp1
     * @param string|null $endp2
     * @param array $payload
     * @param array $headers
     * @return array
     */
    private function processGenericWebhook(string $endp1, ?string $endp2, array $payload, array $headers): array
    {
        Log::info('Processando webhook genérico', [
            'endpoint1' => $endp1,
            'endpoint2' => $endp2,
            'payload_keys' => array_keys($payload)
        ]);

        // Lógica genérica para webhooks não específicos
        return [
            'type' => 'generic',
            'endpoint1' => $endp1,
            'endpoint2' => $endp2,
            'processed_at' => now()->toISOString(),
            'payload_received' => !empty($payload)
        ];
    }

    /**
     * Validar assinatura do webhook (se necessário)
     *
     * @param Request $request
     * @param string $secret
     * @return bool
     */
    private function validateWebhookSignature(Request $request, string $secret): bool
    {
        $signature = $request->header('X-Webhook-Signature');

        if (!$signature) {
            return false;
        }

        $payload = $request->getContent();
        $expectedSignature = hash_hmac('sha256', $payload, $secret);

        return hash_equals($expectedSignature, $signature);
    }

    /**
     * Verificar se o webhook está autorizado
     *
     * @param Request $request
     * @return bool
     */
    private function isAuthorized(Request $request): bool
    {
        // Implementar lógica de autorização se necessário
        // Por exemplo, verificar IP whitelist, tokens, etc.

        $authToken = $request->header('Authorization');
        $webhookToken = $request->header('X-Webhook-Token');

        // Exemplo básico de verificação
        return !empty($authToken) || !empty($webhookToken);
    }
    private function processZapsingWebhook(string $endp1, ?string $endp2, array $payload, array $headers): array
    {
        Log::info('Processando webhook de zapsing', [
            'endpoint1' => $endp1,
            'endpoint2' => $endp2,
            'payload_keys' => array_keys($payload)
        ]);
        // Lógica genérica para webhooks não específicos
        $proccess = (new ZapsingController())->webhook($payload);
        return [
            'type' => 'zapsing',
            'endpoint1' => $endp1,
            'endpoint2' => $endp2,
            'processed_at' => now()->toISOString(),
            'payload_received' => !empty($payload),
            'data' => $proccess
        ];
    }

    /**
     * processBrevoWebhook
     * pt-BR: Processa eventos de tracking do Brevo (abertura, clique, entrega, bounce, etc.)
     * en-US: Processes Brevo tracking events (open, click, delivery, bounce, etc.)
     *
     * Payload Brevo:
     * {
     *   "event": "unique_opened|click|delivered|hard_bounce|soft_bounce|complaint|blocked|invalid_email",
     *   "email": "cliente@email.com",
     *   "message-id": "<202607081346.90685018781@smtp-relay.mailin.fr>",
     *   "date": "2026-07-09 07:41:34",
     *   "subject": "Assunto do e-mail",
     *   "tags": ["tag1","tag2"],
     *   "link": "https://..." (presente em clicks),
     *   "user_agent": "Mozilla/...",
     *   "device_used": "DESKTOP|MOBILE|TABLET",
     *   "ts_epoch": 1783593694690
     * }
     */
    private function processBrevoWebhook(array $payload, array $headers): array
    {
        Log::info('Processando webhook Brevo', [
            'event' => $payload['event'] ?? 'unknown',
            'email' => $payload['email'] ?? 'unknown',
        ]);

        $messageId = $payload['message-id'] ?? null;
        if (!$messageId) {
            return [
                'type' => 'brevo',
                'processed_at' => now()->toISOString(),
                'payload_received' => true,
                'warning' => 'message-id ausente no payload',
            ];
        }

        // Remove angle brackets from message-id for DB lookup
        $cleanMessageId = trim($messageId, '<>');
        $event = $payload['event'] ?? 'unknown';
        $eventDate = $payload['date'] ?? now()->toDateTimeString();

        $communication = ScheduledCommunication::where('provider_message_id', $cleanMessageId)->first();

        if (!$communication) {
            Log::warning('Brevo webhook: ScheduledCommunication não encontrado', [
                'provider_message_id' => $cleanMessageId,
                'event' => $event,
            ]);
            return [
                'type' => 'brevo',
                'processed_at' => now()->toISOString(),
                'payload_received' => true,
                'warning' => 'Nenhum agendamento encontrado para este message-id',
                'provider_message_id' => $cleanMessageId,
            ];
        }

        // Build tracking event entry
        $trackingEvent = [
            'event' => $event,
            'timestamp' => $eventDate,
            'email' => $payload['email'] ?? null,
            'subject' => $payload['subject'] ?? null,
            'ts_epoch' => $payload['ts_epoch'] ?? null,
            'link' => $payload['link'] ?? null,
            'user_agent' => $payload['user_agent'] ?? null,
            'device_used' => $payload['device_used'] ?? null,
            'sending_ip' => $payload['sending_ip'] ?? null,
        ];

        // Merge with existing metadata
        $metadata = $communication->metadata ?? [];
        if (!isset($metadata['tracking'])) {
            $metadata['tracking'] = [];
        }
        $metadata['tracking'][] = $trackingEvent;

        // Update summary fields for quick frontend display
        $summary = $metadata['summary'] ?? [];
        $summary['last_event'] = $event;
        $summary['last_event_at'] = $eventDate;
        $metadata['summary'] = $summary;

        // Update status based on event type
        $statusMap = [
            'delivered' => null, // Keep current status (sent)
            'sent' => null,
            'unique_opened' => null,
            'opened' => null,
            'click' => null,
            'unique_click' => null,
            'hard_bounce' => 'failed',
            'soft_bounce' => 'failed',
            'blocked' => 'failed',
            'invalid_email' => 'failed',
            'complaint' => 'failed',
            'unsubscribed' => 'failed',
            'error' => 'failed',
        ];

        $updateData = ['metadata' => $metadata];
        if (isset($statusMap[$event])) {
            $updateData['status'] = $statusMap[$event];
            $updateData['last_error'] = "Evento Brevo: {$event}";
        }

        $communication->update($updateData);

        Log::info('Brevo webhook processado com sucesso', [
            'communication_id' => $communication->id,
            'provider_message_id' => $cleanMessageId,
            'event' => $event,
        ]);

        return [
            'type' => 'brevo',
            'processed_at' => now()->toISOString(),
            'payload_received' => true,
            'communication_id' => $communication->id,
            'event' => $event,
        ];
    }

}
