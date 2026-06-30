<?php
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
$m = \App\Models\Matricula::whereHas('curso', function($q) { $q->where('tipo', 4); })->whereNotNull('config')->first();
echo json_encode(is_string($m->config) ? json_decode($m->config) : $m->config);
