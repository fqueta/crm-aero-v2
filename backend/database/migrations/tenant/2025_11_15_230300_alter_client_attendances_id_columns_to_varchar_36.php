<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Upgrades client_attendances foreign key fields to VARCHAR(36) for UUIDs.
     * Atualiza os campos client_id e attended_by para VARCHAR(36) (UUID).
     */
    public function up(): void
    {
        // Drop indexes if present to avoid conflicts during type change
        try { 
            Schema::table('client_attendances', function ($table) {
                $table->dropIndex(['client_id']);
            });
        } catch (\Throwable $e) {}
        try { 
            Schema::table('client_attendances', function ($table) {
                $table->dropIndex(['attended_by']);
            });
        } catch (\Throwable $e) {}

        // Widen columns to VARCHAR(36)
        Schema::table('client_attendances', function ($table) {
            $table->string('client_id', 36)->change();
            $table->string('attended_by', 36)->change();
        });

        // Recreate indexes
        Schema::table('client_attendances', function ($table) {
            $table->index('client_id');
            $table->index('attended_by');
        });
    }

    /**
     * Reverts fields back to VARCHAR(26) (ULID) if needed.
     * Reverte para VARCHAR(26) caso necessário.
     */
    public function down(): void
    {
        try { 
            Schema::table('client_attendances', function ($table) {
                $table->dropIndex(['client_id']);
            });
        } catch (\Throwable $e) {}
        try { 
            Schema::table('client_attendances', function ($table) {
                $table->dropIndex(['attended_by']);
            });
        } catch (\Throwable $e) {}

        Schema::table('client_attendances', function ($table) {
            $table->string('client_id', 26)->change();
            $table->string('attended_by', 26)->change();
        });

        Schema::table('client_attendances', function ($table) {
            $table->index('client_id');
            $table->index('attended_by');
        });
    }
};