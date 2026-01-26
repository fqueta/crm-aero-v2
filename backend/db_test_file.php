<?php
try {
    $pdo = new PDO('mysql:host=127.0.0.1;port=3306', 'root', '');
    file_put_contents('db_debug.log', "Connection Successful\n");
} catch (PDOException $e) {
    file_put_contents('db_debug.log', "Connection Failed: " . $e->getMessage() . "\n");
} catch (Throwable $t) {
    file_put_contents('db_debug.log', "Critical Error: " . $t->getMessage() . "\n");
}
