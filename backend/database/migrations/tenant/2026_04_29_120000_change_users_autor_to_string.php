<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Altera a coluna `users.autor` para string, permitindo UUID do usuário autenticado.
     */
    public function up(): void
    {
        DB::statement('ALTER TABLE users MODIFY autor VARCHAR(64) NULL');
    }

    /**
     * Reverte a coluna `users.autor` para inteiro.
     */
    public function down(): void
    {
        DB::statement('ALTER TABLE users MODIFY autor INT NULL');
    }
};
