<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$tenant = \App\Models\Tenant::find('api-crm');
if ($tenant) {
    tenancy()->initialize($tenant);
    echo "Tenant inicializado!\n";

    $postId = 32;
    $rows = \Illuminate\Support\Facades\DB::table('postmeta')
        ->where('post_id', $postId)
        ->select(['meta_key', 'meta_value'])
        ->get();
    echo "Total rows: " . count($rows) . "\n";
    foreach ($rows as $r) {
        var_dump($r);
    }
} else {
    echo "Tenant nao encontrado.\n";
}
