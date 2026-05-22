<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$tenant = \App\Models\Tenant::find('api-crm');
if ($tenant) {
    tenancy()->initialize($tenant);
    
    $user = \App\Models\User::first();
    if ($user) {
        \Illuminate\Support\Facades\Auth::login($user);
        // Bind user to request
        request()->setUserResolver(function() use ($user) {
            return $user;
        });
        
        // Mock route resolver
        $route = new \Illuminate\Routing\Route('GET', 'api/v1/integracoes/{id}', ['as' => 'api.integracoes.show']);
        request()->setRouteResolver(function() use ($route) {
            return $route;
        });
        
        echo "Autenticado como {$user->name} ({$user->email})\n";
    } else {
        echo "Nenhum usuario encontrado.\n";
    }

    $controller = new \App\Http\Controllers\api\ApiCredentialController();
    $resp = $controller->show('32');
    echo "Status code: " . $resp->getStatusCode() . "\n";
    echo "Content:\n" . $resp->getContent() . "\n";
} else {
    echo "Tenant api-crm nao encontrado.\n";
}
