<?php

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class StageChanged
{
    use Dispatchable, SerializesModels;

    public string $entityType;
    public string $entityId;
    public ?int $fromStageId;
    public int $toStageId;
    public string $actorId;
    public string $ip;
    public array $context;

    public function __construct(string $entityType, string $entityId, ?int $fromStageId, int $toStageId, string $actorId, string $ip, array $context = [])
    {
        $this->entityType = $entityType;
        $this->entityId = $entityId;
        $this->fromStageId = $fromStageId;
        $this->toStageId = $toStageId;
        $this->actorId = $actorId;
        $this->ip = $ip;
        $this->context = $context;
    }
}
