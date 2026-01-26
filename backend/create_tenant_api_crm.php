<?php

use App\Models\Tenant;
use Stancl\Tenancy\Database\Models\Domain;

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

try {
    $tenantId = 'api-crm';
    $tenantDomain = 'api-crm.localhost'; 

    $tenant = Tenant::find($tenantId);
    if (!$tenant) {
        echo "Creating tenant '$tenantId'...\n";
        $tenant = Tenant::create([
            'id' => $tenantId,
            'ativo' => 's',
            'excluido' => 'n',
            'deletado' => 'n',
            'data' => [],
            'config' => [],
        ]);
        echo "Tenant created.\n";
    } else {
        echo "Tenant '$tenantId' already exists.\n";
    }

    // Check if domain exists
    $hasDomain = false;
    foreach ($tenant->domains as $domain) {
        if ($domain->domain === $tenantDomain) {
            $hasDomain = true;
            break;
        }
    }

    if (!$hasDomain) {
        echo "Creating domain '$tenantDomain'...\n";
        $tenant->domains()->create([
            'domain' => $tenantDomain
        ]);
        echo "Domain created successfully.\n";
    } else {
        echo "Domain '$tenantDomain' already exists.\n";
    }

} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString();
}
