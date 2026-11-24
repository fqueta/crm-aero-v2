<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('ai_knowledge_chunks')) {
            Schema::create('ai_knowledge_chunks', function (Blueprint $table) {
                $table->id();
                $table->string('source_type', 60)->index(); // instruction_program, institutional_rules, contract_template
                $table->unsignedBigInteger('source_id')->nullable()->index();
                $table->unsignedBigInteger('curso_id')->nullable()->index();
                $table->string('title');
                $table->string('section_title')->nullable();
                $table->unsignedInteger('chunk_index')->default(0);
                $table->text('content');
                $table->char('content_hash', 64)->index();
                $table->longText('embedding')->nullable(); // JSON array de floats
                $table->string('embedding_provider', 30)->default('none')->index(); // gemini, openai, none
                $table->boolean('is_public')->default(false)->index();
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->index(['source_type', 'source_id'], 'idx_ai_chunks_source');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_knowledge_chunks');
    }
};
