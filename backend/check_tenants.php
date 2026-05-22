<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$tenants = \App\Models\Tenant::with('domains')->get();
echo "Total tenants: " . count($tenants) . "\n";
foreach ($tenants as $t) {
    echo "Tenant ID: {$t->id}\n";
    echo "Domains:\n";
    foreach ($t->domains as $d) {
        echo "  - {$d->domain}\n";
    }
}
