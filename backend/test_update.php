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
        request()->setUserResolver(function() use ($user) {
            return $user;
        });
        
        $route = new \Illuminate\Routing\Route('PUT', 'api/v1/integracoes/{id}', ['as' => 'api.integracoes.update']);
        request()->setRouteResolver(function() use ($route) {
            return $route;
        });
        
        echo "Autenticado como {$user->name} ({$user->email})\n";
    }

    // Set request data
    $requestData = [
        'name' => 'ZapGuru',
        'active' => true,
        'config' => [
            'url' => 'https://s4.chatguru.app/api/v1',
            'user' => 'admin',
        ],
        'meta' => [
            ['key' => 'phone_id', 'value' => '9999999'],
            ['key' => 'new_meta_key', 'value' => 'new_value'],
        ]
    ];
    
    $request = request();
    $request->merge($requestData);
    
    $controller = new \App\Http\Controllers\api\ApiCredentialController();
    $resp = $controller->update($request, '32');
    echo "Status code: " . $resp->getStatusCode() . "\n";
    echo "Content:\n" . $resp->getContent() . "\n";
    
    // Check DB rows after update
    $rows = \Illuminate\Support\Facades\DB::table('postmeta')->where('post_id', 32)->get();
    echo "Rows in DB after update:\n";
    foreach ($rows as $r) {
        echo "Key: {$r->meta_key} | Value: {$r->meta_value}\n";
    }
}
