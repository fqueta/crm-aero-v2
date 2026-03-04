<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$host = env('DB_HOST', '127.0.0.1');
$port = env('DB_PORT', 3306);
$user = env('DB_USERNAME', 'root');
$pass = env('DB_PASSWORD', '');

try {
    $pdo = new PDO("mysql:host={$host};port={$port}", $user, $pass);
    file_put_contents('db_debug.log', "Connection Successful\n");
} catch (PDOException $e) {
    file_put_contents('db_debug.log', "Connection Failed: " . $e->getMessage() . "\n");
} catch (Throwable $t) {
    file_put_contents('db_debug.log', "Critical Error: " . $t->getMessage() . "\n");
}
