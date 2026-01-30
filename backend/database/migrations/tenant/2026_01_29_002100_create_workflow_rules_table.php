<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workflow_rules', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('workflow_id')->index();
            $table->string('source_type', 40)->index(); // service_order|matricula|user|webhook|tracking
            $table->string('event', 40)->index(); // created|updated|stage_changed|custom
            $table->json('filters')->nullable(); // funnel_id, stage_id, etc.
            $table->json('conditions')->nullable();
            $table->integer('order')->default(0)->index();
            $table->boolean('isActive')->default(true)->index();
            $table->timestamps();

            $table->foreign('workflow_id')->references('id')->on('workflows')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workflow_rules');
    }
};
