<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('workflows', function (Blueprint $table) {
            if (!Schema::hasColumn('workflows', 'name')) {
                $table->string('name')->index();
            }
            if (!Schema::hasColumn('workflows', 'description')) {
                $table->text('description')->nullable();
            }
            if (!Schema::hasColumn('workflows', 'funnel_id')) {
                $table->unsignedBigInteger('funnel_id')->nullable()->index();
                $table->foreign('funnel_id')->references('id')->on('funnels')->onDelete('set null');
            }
            if (!Schema::hasColumn('workflows', 'isActive')) {
                $table->boolean('isActive')->default(true)->index();
            }
            if (!Schema::hasColumn('workflows', 'settings')) {
                $table->json('settings')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('workflows', function (Blueprint $table) {
            if (Schema::hasColumn('workflows', 'settings')) {
                $table->dropColumn('settings');
            }
            if (Schema::hasColumn('workflows', 'isActive')) {
                $table->dropColumn('isActive');
            }
            if (Schema::hasColumn('workflows', 'funnel_id')) {
                $table->dropForeign(['funnel_id']);
                $table->dropColumn('funnel_id');
            }
            if (Schema::hasColumn('workflows', 'description')) {
                $table->dropColumn('description');
            }
            if (Schema::hasColumn('workflows', 'name')) {
                $table->dropColumn('name');
            }
        });
    }
};
