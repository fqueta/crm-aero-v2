<?php

namespace App\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class WebhookReceived
{
    use Dispatchable, SerializesModels;

    public string $endpoint1;
    public ?string $endpoint2;
    public array $payload;
    public array $headers;
    public string $ip;

    public function __construct(string $endpoint1, ?string $endpoint2, array $payload, array $headers, string $ip)
    {
        $this->endpoint1 = $endpoint1;
        $this->endpoint2 = $endpoint2;
        $this->payload = $payload;
        $this->headers = $headers;
        $this->ip = $ip;
    }
}
