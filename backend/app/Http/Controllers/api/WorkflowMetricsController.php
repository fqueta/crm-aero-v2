<?php

namespace App\Http\Controllers\api;

use App\Http\Controllers\Controller;
use App\Models\EventLog;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class WorkflowMetricsController extends Controller
{
    protected PermissionService $permissionService;
    public function __construct()
    {
        $this->permissionService = new PermissionService();
    }

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user || !$this->permissionService->isHasPermission('view')) {
            return response()->json(['error' => 'Acesso negado'], 403);
        }
        $sinceHours = (int)$request->input('hours', 24);
        $since = Carbon::now()->subHours($sinceHours);
        $base = EventLog::query()->where('entity_type', 'workflow')->where('created_at', '>=', $since);
        $total = (clone $base)->count();
        $successWebhooks = (clone $base)->where('action', 'webhook_called')->count();
        $actionLogs = (clone $base)->where('action', 'action_log')->count();
        $errors = (clone $base)->where('action', 'action_error')->count();
        return response()->json([
            'window_hours' => $sinceHours,
            'total_events' => $total,
            'webhook_called' => $successWebhooks,
            'action_log' => $actionLogs,
            'action_error' => $errors,
        ]);
    }
}
