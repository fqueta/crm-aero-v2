<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rescisoes', function (Blueprint $table) {
            $table->enum('status', ['pending', 'sent', 'signed', 'cancelled'])->default('pending')->after('obs');
        });
    }

    public function down(): void
    {
        Schema::table('rescisoes', function (Blueprint $table) {
            $table->dropColumn('status');
        });
    }
};
