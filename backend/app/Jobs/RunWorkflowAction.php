<?php

namespace App\Jobs;

use App\Models\WorkflowAction;
use App\Models\Matricula;
use App\Models\User;
use App\Models\EventLog;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;

class RunWorkflowAction implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $actionId;
    public array $eventContext;

    public function __construct(int $actionId, array $eventContext)
    {
        $this->actionId = $actionId;
        $this->eventContext = $eventContext;
    }

    public function handle(): void
    {
        $action = WorkflowAction::find($this->actionId);
        if (!$action || !$action->isActive) {
            return;
        }
        $type = $action->type;
        $payload = is_array($action->payload) ? $action->payload : [];
        try {
            switch ($type) {
                case 'log':
                    EventLog::create([
                        'entity_type' => 'workflow',
                        'entity_id' => (string)$action->id,
                        'action' => 'action_log',
                        'description' => 'Workflow action log',
                        'payload' => ['event' => $this->eventContext, 'payload' => $payload],
                    ]);
                    break;
                case 'update_field':
                    $this->handleUpdateField($payload);
                    break;
                case 'update_entity_fields':
                    $this->handleUpdateEntityFields($payload);
                    break;
                case 'webhook':
                    $this->handleWebhook($payload);
                    break;
                default:
                    Log::info('RunWorkflowAction: tipo não suportado', ['type' => $type]);
            }
        } catch (\Throwable $e) {
            EventLog::create([
                'entity_type' => 'workflow',
                'entity_id' => (string)$action->id,
                'action' => 'action_error',
                'description' => 'Erro ao executar ação do workflow',
                'payload' => [
                    'event' => $this->eventContext,
                    'payload' => $payload,
                    'error' => ['message' => $e->getMessage()],
                ],
            ]);
            throw $e;
        }
    }

    private function handleUpdateField(array $payload): void
    {
        $entityType = $payload['entity_type'] ?? $this->eventContext['entityType'] ?? null;
        $entityId = $payload['entity_id'] ?? $this->eventContext['entityId'] ?? null;
        $field = $payload['field'] ?? null;
        $value = $payload['value'] ?? null;
        if (!$entityType || !$entityId || !$field) return;
        switch ($entityType) {
            case 'matricula':
                $matricula = Matricula::find($entityId);
                if ($matricula) {
                    $matricula->{$field} = $value;
                    $matricula->save();
                }
                break;
            case 'user':
                $user = User::find($entityId);
                if ($user) {
                    $cfg = is_array($user->config) ? $user->config : (is_string($user->config) ? (json_decode($user->config, true) ?? []) : []);
                    $cfg[$field] = $value;
                    $user->config = $cfg;
                    $user->save();
                }
                break;
        }
    }

    private function handleWebhook(array $payload): void
    {
        $method = strtoupper((string)($payload['method'] ?? 'POST'));
        $base = (string)($payload['base_url'] ?? '');
        $pathTpl = (string)($payload['path_template'] ?? '');
        $url = trim($base, '/') . '/' . ltrim($this->resolveTemplate($pathTpl, $this->eventContext), '/');
        if (!$base && isset($payload['url'])) {
            $url = (string)$payload['url'];
        }
        $headers = is_array($payload['headers'] ?? null) ? $payload['headers'] : [];
        $bodyTpl = $payload['body_template'] ?? null;
        $body = is_array($payload['body'] ?? null) ? $payload['body'] : ['event' => $this->eventContext];
        if (is_array($bodyTpl)) {
            $body = $this->resolveStructureTemplates($bodyTpl, $this->eventContext);
        }
        $timeout = (int)($payload['timeout'] ?? 10);
        try {
            $req = Http::withHeaders($headers)->timeout($timeout);
            switch ($method) {
                case 'GET':
                    $req->get($url, is_array($body) ? $body : []);
                    break;
                case 'PUT':
                    $req->put($url, $body);
                    break;
                case 'PATCH':
                    $req->patch($url, $body);
                    break;
                case 'DELETE':
                    $req->delete($url, $body);
                    break;
                default:
                    $req->post($url, $body);
            }
            EventLog::create([
                'entity_type' => 'workflow',
                'entity_id' => (string)$this->actionId,
                'action' => 'webhook_called',
                'payload' => ['url' => $url, 'body' => $body],
            ]);
        } catch (\Throwable $e) {
            Log::warning('Webhook action failed', ['url' => $url, 'error' => $e->getMessage()]);
            throw $e;
        }
    }

    private function handleUpdateEntityFields(array $payload): void
    {
        $entityType = $payload['entity_type'] ?? null;
        $idSource = $payload['id_source'] ?? 'context';
        $idPath = $payload['id_path'] ?? null;
        $mappings = is_array($payload['mappings'] ?? null) ? $payload['mappings'] : [];
        if (!$entityType || !$idPath || empty($mappings)) return;
        $idVal = $idSource === 'payload'
            ? $this->getByPath($this->eventContext['payload'] ?? [], (string)$idPath)
            : $this->getByPath($this->eventContext, (string)$idPath);
        if (!$idVal) return;
        switch ($entityType) {
            case 'matricula':
                $matricula = Matricula::find($idVal);
                if (!$matricula) return;
                foreach ($mappings as $map) {
                    $field = $map['target_field'] ?? null;
                    $path = $map['path'] ?? null;
                    if (!$field || !$path) continue;
                    $val = $this->getByPath($this->eventContext['payload'] ?? [], (string)$path);
                    $matricula->{$field} = $val;
                }
                $matricula->save();
                break;
            case 'user':
                $user = User::find($idVal);
                if (!$user) return;
                $cfg = is_array($user->config) ? $user->config : (is_string($user->config) ? (json_decode($user->config, true) ?? []) : []);
                foreach ($mappings as $map) {
                    $field = $map['target_field'] ?? null;
                    $path = $map['path'] ?? null;
                    if (!$field || !$path) continue;
                    $val = $this->getByPath($this->eventContext['payload'] ?? [], (string)$path);
                    $cfg[$field] = $val;
                }
                $user->config = $cfg;
                $user->save();
                break;
        }
    }

    private function getByPath($data, string $path)
    {
        if (!is_array($data)) return null;
        $segments = preg_split('/\\./', $path);
        $cur = $data;
        foreach ($segments as $seg) {
            if (is_array($cur) && array_key_exists($seg, $cur)) {
                $cur = $cur[$seg];
            } else {
                return null;
            }
        }
        return $cur;
    }

    private function resolveTemplate(string $tpl, array $ctx): string
    {
        return preg_replace_callback('/\\{\\{\\s*([^}]+)\\s*\\}\\}/', function($m) use ($ctx) {
            $key = trim($m[1]);
            // suporta payload.* e context keys
            if (str_starts_with($key, 'payload.')) {
                return (string)($this->getByPath($ctx['payload'] ?? [], substr($key, 8)) ?? '');
            }
            return (string)($this->getByPath($ctx, $key) ?? '');
        }, $tpl);
    }

    private function resolveStructureTemplates(array $structure, array $ctx): array
    {
        $out = [];
        foreach ($structure as $k => $v) {
            if (is_array($v)) {
                $out[$k] = $this->resolveStructureTemplates($v, $ctx);
            } elseif (is_string($v)) {
                $out[$k] = $this->resolveTemplate($v, $ctx);
            } else {
                $out[$k] = $v;
            }
        }
        return $out;
    }
}
