<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$tenant = \App\Models\Tenant::find('api-crm');
if ($tenant) {
    tenancy()->initialize($tenant);
    echo "Tenant inicializado!\n";

    $item = \App\Models\ApiCredential::find(32);
    if ($item) {
        echo "ID (capitalized): " . var_export($item->ID, true) . "\n";
        echo "id (lowercase): " . var_export($item->id, true) . "\n";
        echo "Attributes:\n";
        print_r($item->getAttributes());
    } else {
        echo "ApiCredential 32 nao encontrado.\n";
    }
}
