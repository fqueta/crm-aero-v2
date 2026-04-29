<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        DB::statement("
            ALTER TABLE financial_accounts
            MODIFY COLUMN status ENUM('pending', 'partial', 'paid', 'overdue', 'cancelled')
            NOT NULL DEFAULT 'pending'
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("UPDATE financial_accounts SET status = 'pending' WHERE status = 'partial'");
        DB::statement("
            ALTER TABLE financial_accounts
            MODIFY COLUMN status ENUM('pending', 'paid', 'overdue', 'cancelled')
            NOT NULL DEFAULT 'pending'
        ");
    }
};
