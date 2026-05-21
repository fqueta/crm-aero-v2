<?php
 
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('rescisoes', function (Blueprint $table) {
            $table->id();
            
            // FK references matriculas.id
            $table->unsignedBigInteger('matricula_id');
            
            // Core fields for calculation
            $table->date('data_rescisao');
            $table->decimal('valor_pago', 12, 2)->default(0.00);
            $table->decimal('valor_matricula', 12, 2)->default(0.00);
            $table->decimal('valor_inicial', 12, 2)->default(0.00);
            $table->integer('horas_compradas')->default(0);
            $table->decimal('horas_voadas', 12, 2)->default(0.00); // total calculated value of flown hours
            $table->decimal('multa_rescisoria', 12, 2)->default(0.00);
            
            // Lodging fields
            $table->integer('dias_alojamento')->default(0);
            $table->decimal('preco_diaria', 12, 2)->default(100.00);
            $table->decimal('valor_alojamento', 12, 2)->default(0.00);
            
            // Final balance result
            $table->decimal('saldo_final', 12, 2)->default(0.00);
            
            // Arbitrary details breakdown (e.g. aircraft flown quantities, prices)
            $table->json('config')->nullable();
            
            // General observations
            $table->longText('obs')->nullable();
            
            // Custom soft delete / lixeira columns standard in this system
            $table->enum('excluido', ['n', 's'])->default('n');
            $table->enum('deletado', ['n', 's'])->default('n');
            $table->text('excluido_por')->nullable();
            $table->text('deletado_por')->nullable();
            
            $table->timestamps();
            
            // Foreign key relation
            $table->foreign('matricula_id')->references('id')->on('matriculas')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('rescisoes');
    }
};
