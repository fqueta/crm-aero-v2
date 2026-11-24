<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('instruction_programs')) {
            Schema::create('instruction_programs', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('curso_id')->nullable()->index();
                $table->string('title');
                $table->string('slug')->unique();
                $table->string('code', 60)->nullable()->index(); // Ex: PPAP, PC, INVA
                $table->string('current_revision', 40)->default('001');
                $table->date('revision_date')->nullable();
                $table->string('mgr_revision', 60)->nullable();
                $table->date('mgr_date')->nullable();
                $table->enum('status', ['draft', 'published', 'archived'])->default('draft')->index();
                $table->boolean('is_public')->default(true)->index();
                $table->text('summary')->nullable();
                $table->longText('content_html')->nullable();
                $table->json('contract_defaults')->nullable();
                $table->string('created_by', 64)->nullable();
                $table->string('updated_by', 64)->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (!Schema::hasTable('instruction_program_revisions')) {
            Schema::create('instruction_program_revisions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('instruction_program_id')->index();
                $table->string('revision_code', 40);
                $table->date('revision_date')->nullable();
                $table->string('mgr_revision', 60)->nullable();
                $table->date('mgr_date')->nullable();
                $table->longText('content_html')->nullable();
                $table->json('contract_defaults')->nullable();
                $table->text('change_notes')->nullable();
                $table->boolean('edited_by_ai')->default(false);
                $table->string('created_by', 64)->nullable();
                $table->timestamps();

                $table->foreign('instruction_program_id', 'fk_ip_revisions_program')
                    ->references('id')
                    ->on('instruction_programs')
                    ->onDelete('cascade');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('instruction_program_revisions');
        Schema::dropIfExists('instruction_programs');
    }
};
