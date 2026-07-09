<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('scheduled_communications', function (Blueprint $table) {
            $table->id();
            $table->string('client_id', 36)->nullable()->index();
            $table->unsignedBigInteger('matricula_id')->nullable()->index();
            $table->string('channel', 40)->index();
            $table->string('provider', 40)->nullable()->index();
            $table->string('status', 30)->default('scheduled')->index();
            $table->string('recipient_name')->nullable();
            $table->string('recipient_email')->nullable()->index();
            $table->string('recipient_phone', 30)->nullable()->index();
            $table->string('subject')->nullable();
            $table->text('message')->nullable();
            $table->timestamp('scheduled_at')->index();
            $table->timestamp('processed_at')->nullable()->index();
            $table->timestamp('sent_at')->nullable()->index();
            $table->timestamp('cancelled_at')->nullable();
            $table->unsignedSmallInteger('attempts')->default(0);
            $table->unsignedSmallInteger('max_attempts')->default(3);
            $table->string('created_by', 36)->nullable()->index();
            $table->string('provider_message_id')->nullable();
            $table->text('last_error')->nullable();
            $table->json('metadata')->nullable();
            $table->json('payload')->nullable();
            $table->timestamps();

            $table->foreign('matricula_id')
                ->references('id')
                ->on('matriculas')
                ->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('scheduled_communications');
    }
};
