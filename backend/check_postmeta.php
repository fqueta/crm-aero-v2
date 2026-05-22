<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

// Localiza o tenant api-crm
$tenant = \App\Models\Tenant::find('api-crm');
if ($tenant) {
    tenancy()->initialize($tenant);
    echo "Tenant inicializado com sucesso!\n";
    
    // Lista postmeta
    try {
        $rows = \Illuminate\Support\Facades\DB::table('postmeta')->get();
        echo "Total de registros em postmeta: " . count($rows) . "\n";
        foreach ($rows as $r) {
            echo "ID: {$r->id} | Post ID: {$r->post_id} | Key: {$r->meta_key} | Value: {$r->meta_value}\n";
        }
    } catch (\Throwable $e) {
        echo "Erro ao ler postmeta: " . $e->getMessage() . "\n";
    }
} else {
    echo "Tenant 'api-crm' nao encontrado.\n";
}
