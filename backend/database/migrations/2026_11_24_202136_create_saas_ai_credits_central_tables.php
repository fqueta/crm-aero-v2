<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations on central database connection.
     */
    public function up(): void
    {
        // 1. Configurações de gateways centrais do SaaS (ex: Asaas Central para recarga de créditos)
        if (!Schema::hasTable('saas_gateways')) {
            Schema::create('saas_gateways', function (Blueprint $table) {
                $table->id();
                $table->string('gateway', 50)->unique();
                $table->text('api_key')->nullable();
                $table->string('environment', 20)->default('production');
                $table->string('webhook_token', 255)->nullable();
                $table->boolean('is_active')->default(true);
                $table->json('config')->nullable();
                $table->timestamps();
            });
        }

        // 2. Carteira de créditos de IA por tenant
        if (!Schema::hasTable('saas_ai_credit_wallets')) {
            Schema::create('saas_ai_credit_wallets', function (Blueprint $table) {
                $table->id();
                $table->string('tenant_id', 100)->unique();
                $table->integer('monthly_allowance')->default(0);  // Créditos mensais inclusos (0 = avulso)
                $table->integer('monthly_used')->default(0);       // Consumo no ciclo atual
                $table->integer('purchased_balance')->default(0);   // Créditos avulsos comprados (saldo perpétuo)
                $table->timestamp('cycle_start_at')->nullable();
                $table->timestamp('cycle_ends_at')->nullable();
                $table->timestamps();

                $table->index('tenant_id');
            });
        }

        // 3. Compras de pacotes avulsos de créditos de IA via Asaas Central (PIX)
        if (!Schema::hasTable('saas_ai_credit_purchases')) {
            Schema::create('saas_ai_credit_purchases', function (Blueprint $table) {
                $table->id();
                $table->string('tenant_id', 100);
                $table->string('package_slug', 50);
                $table->integer('credits');
                $table->decimal('price', 10, 2);
                $table->enum('status', ['pending', 'paid', 'canceled', 'failed'])->default('pending');
                $table->string('payment_gateway', 30)->default('asaas');
                $table->string('payment_gateway_ref', 100)->nullable()->index();
                $table->text('pix_qr_code')->nullable();
                $table->text('pix_copy_paste')->nullable();
                $table->text('invoice_url')->nullable();
                $table->timestamp('paid_at')->nullable();
                $table->timestamps();

                $table->index('tenant_id');
                $table->index('status');
            });
        }

        // 4. Extrato / Ledger de transações e consumo de créditos de IA
        if (!Schema::hasTable('saas_ai_credit_transactions')) {
            Schema::create('saas_ai_credit_transactions', function (Blueprint $table) {
                $table->id();
                $table->string('tenant_id', 100);
                $table->enum('type', ['plan_renewal', 'purchase', 'usage', 'adjustment'])->default('usage');
                $table->integer('amount'); // Positivo para recarga, negativo para consumo
                $table->integer('balance_after')->default(0);
                $table->string('source', 50)->default('instruction_program_editor');
                $table->string('description', 255);
                $table->json('metadata')->nullable();
                $table->timestamps();

                $table->index('tenant_id');
                $table->index('created_at');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('saas_ai_credit_transactions');
        Schema::dropIfExists('saas_ai_credit_purchases');
        Schema::dropIfExists('saas_ai_credit_wallets');
        Schema::dropIfExists('saas_gateways');
    }
};
