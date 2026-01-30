<?php

namespace App\Listeners;

use App\Events\WebhookReceived;
use App\Jobs\RunWorkflowAction;
use App\Models\WorkflowRule;

class WebhookReceivedListener
{
    public function handle(WebhookReceived $event): void
    {
        $rules = WorkflowRule::where('source_type', 'webhook')
            ->where('event', 'received')
            ->where('isActive', true)
            ->orderBy('order', 'asc')
            ->get();

        foreach ($rules as $rule) {
            $filters = is_array($rule->filters) ? $rule->filters : [];
            if (isset($filters['endpoint1']) && $filters['endpoint1'] !== $event->endpoint1) {
                continue;
            }
            if (isset($filters['endpoint2'])) {
                $f2 = (string)$filters['endpoint2'];
                $e2 = (string)($event->endpoint2 ?? '');
                if ($f2 !== $e2) {
                    continue;
                }
            }
            if (isset($filters['path']) && isset($event->payload['path'])) {
                if ((string)$filters['path'] !== (string)$event->payload['path']) {
                    continue;
                }
            }
            foreach ($rule->actions()->where('isActive', true)->orderBy('order', 'asc')->get() as $action) {
                $ctx = [
                    'source' => 'webhook',
                    'endpoint1' => $event->endpoint1,
                    'endpoint2' => $event->endpoint2,
                    'headers' => $event->headers,
                    'payload' => $event->payload,
                    'ip' => $event->ip,
                ];
                RunWorkflowAction::dispatch($action->id, $ctx);
            }
        }
    }
}
