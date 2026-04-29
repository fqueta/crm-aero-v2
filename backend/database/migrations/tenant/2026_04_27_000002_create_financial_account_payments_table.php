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
        Schema::create('financial_account_payments', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('financial_account_id');
            $table->decimal('amount', 10, 2);
            $table->date('payment_date');
            $table->enum('payment_method', ['cash', 'credit_card', 'debit_card', 'bank_transfer', 'pix', 'check', 'other'])->default('cash');
            $table->text('notes')->nullable();
            $table->string('created_by', 100)->nullable();
            $table->string('token', 100)->nullable();
            $table->json('config')->nullable();
            $table->timestamps();

            $table->index('financial_account_id');
            $table->index('payment_date');
            $table->index('payment_method');
            $table->index('created_by');
            $table->index('token');

            $table->foreign('financial_account_id')
                ->references('id')
                ->on('financial_accounts')
                ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('financial_account_payments');
    }
};
