<?php

use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Stancl\Tenancy\Database\Models\Domain;

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

/**
 * Verifica se o banco físico do tenant já existe no servidor central.
 * EN: Checks whether the physical tenant database already exists on the central server.
 */
function tenantDatabaseExists(string $databaseName): bool
{
    $result = DB::select('SHOW DATABASES LIKE ?', [$databaseName]);
    return !empty($result);
}

/**
 * Cria o registro do tenant sem disparar eventos de criação de banco quando ele já existe.
 * EN: Creates the tenant row without dispatching database creation events when the DB already exists.
 */
function createTenantRecordWithoutEvents(string $tenantId): Tenant
{
    $now = now();

    DB::table('tenants')->insert([
        'id' => $tenantId,
        'name' => $tenantId,
        'config' => json_encode([], JSON_UNESCAPED_UNICODE),
        'ativo' => 's',
        'autor' => null,
        'excluido' => 'n',
        'reg_excluido' => null,
        'deletado' => 'n',
        'reg_deletado' => null,
        'created_at' => $now,
        'updated_at' => $now,
        'data' => json_encode(['slug' => $tenantId], JSON_UNESCAPED_UNICODE),
    ]);

    return Tenant::findOrFail($tenantId);
}

try {
    $tenantId = 'api-crm';
    $tenantDomain = 'api-crm.localhost';
    $tenantDatabase = 'aeroclu_' . $tenantId;

    $tenant = Tenant::find($tenantId);
    if (!$tenant) {
        if (tenantDatabaseExists($tenantDatabase)) {
            echo "Database '$tenantDatabase' already exists. Creating only the tenant record...\n";
            $tenant = createTenantRecordWithoutEvents($tenantId);
            echo "Tenant record created without database provisioning.\n";
        } else {
            echo "Creating tenant '$tenantId' and provisioning database...\n";
            $tenant = Tenant::create([
                'id' => $tenantId,
                'name' => $tenantId,
                'ativo' => 's',
                'excluido' => 'n',
                'deletado' => 'n',
                'data' => ['slug' => $tenantId],
                'config' => [],
            ]);
            echo "Tenant created.\n";
        }
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
