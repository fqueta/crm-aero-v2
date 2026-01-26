<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$tenants = App\Models\Tenant::with('domains')->get();

foreach ($tenants as $tenant) {
    echo "Tenant ID: " . $tenant->id . "\n";
    foreach ($tenant->domains as $domain) {
        echo " - Domain: " . $domain->domain . "\n";
    }
    echo "--------------------------\n";
}
