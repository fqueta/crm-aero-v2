<?php

namespace App\Listeners;

use App\Events\StageChanged;
use App\Jobs\RunWorkflowAction;
use App\Models\WorkflowRule;

class StageChangedListener
{
    public function handle(StageChanged $event): void
    {
        $rules = WorkflowRule::where('source_type', $event->entityType)
            ->where('event', 'stage_changed')
            ->where('isActive', true)
            ->orderBy('order', 'asc')
            ->get();

        foreach ($rules as $rule) {
            $filters = is_array($rule->filters) ? $rule->filters : [];
            if (isset($filters['stage_id']) && (int)$filters['stage_id'] !== (int)$event->toStageId) {
                continue;
            }
            if (isset($filters['funnel_id']) && isset($event->context['funnel_id']) && (int)$filters['funnel_id'] !== (int)$event->context['funnel_id']) {
                continue;
            }
            foreach ($rule->actions()->where('isActive', true)->orderBy('order', 'asc')->get() as $action) {
                $ctx = [
                    'entityType' => $event->entityType,
                    'entityId' => $event->entityId,
                    'fromStageId' => $event->fromStageId,
                    'toStageId' => $event->toStageId,
                    'actorId' => $event->actorId,
                    'ip' => $event->ip,
                ];
                RunWorkflowAction::dispatch($action->id, $ctx);
            }
        }
    }
}
