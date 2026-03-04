<?php
require __DIR__ . '/../vendor/autoload.php';
$app = require_once __DIR__ . '/../bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$host = env('DB_HOST', '127.0.0.1');
$port = env('DB_PORT', 3306);
$user = env('DB_USERNAME', 'root');
$pass = env('DB_PASSWORD', '');

$pdo = new PDO("mysql:host={$host};port={$port}", $user, $pass);
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$stmt = $pdo->query("SHOW DATABASES LIKE 'aeroclu_%'");
$databases = $stmt->fetchAll(PDO::FETCH_COLUMN);

echo implode(PHP_EOL, $databases) . PHP_EOL;
