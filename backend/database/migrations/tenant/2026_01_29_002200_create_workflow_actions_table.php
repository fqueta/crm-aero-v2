<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflow_actions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('rule_id')->index();
            $table->string('type', 40)->index(); // notify|webhook|update_field|create_task|log|custom
            $table->json('payload')->nullable(); // e.g., { url, headers, bodyTemplate } or { field, value }
            $table->integer('order')->default(0)->index();
            $table->boolean('isActive')->default(true)->index();
            $table->json('retry_policy')->nullable(); // { maxAttempts, backoffSeconds }
            $table->timestamps();

            $table->foreign('rule_id')->references('id')->on('workflow_rules')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_actions');
    }
};
