<?php
try {
    $pdo = new PDO('mysql:host=127.0.0.1;port=3306', 'root', '');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("CREATE DATABASE IF NOT EXISTS crm_aero_v2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    file_put_contents('db_debug.log', "Database Created Successfully\n");
} catch (PDOException $e) {
    file_put_contents('db_debug.log', "Database Creation Failed: " . $e->getMessage() . "\n");
} catch (Throwable $t) {
    file_put_contents('db_debug.log', "Critical Error: " . $t->getMessage() . "\n");
}
