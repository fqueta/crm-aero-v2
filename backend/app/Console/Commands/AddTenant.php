<?php

namespace App\Console\Commands;

use App\Models\Tenant;
use Illuminate\Console\Command;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Artisan;
use Stancl\Tenancy\Tenancy;

class AddTenant extends Command
{
    protected $signature = 'tenants:add
        {id : ID do tenant (ex.: api-delivery)}
        {--name= : Nome legível (default: baseado no ID)}
        {--domain= : Domínio do tenant (default: <id>.local)}
        {--no-migrate : Não executar migrations do tenant}';

    protected $description = 'Cria um novo tenant com domínio e executa migrações de schema do tenant';

    public function handle(): int
    {
        $id = (string) $this->argument('id');
        $name = (string) ($this->option('name') ?: Str::of($id)->replace('-', ' ')->title()->toString());
        $domain = (string) ($this->option('domain') ?: ($id . '.local'));
        $noMigrate = (bool) $this->option('no-migrate');

        $existing = Tenant::find($id);
        if ($existing) {
            $this->warn("Tenant '{$id}' já existe. Vou garantir domínio e migrações.");
            $tenant = $existing;
            // Garantir slug em data
            $data = $tenant->data ?? [];
            if (!isset($data['slug'])) {
                $data['slug'] = $id;
                $tenant->data = $data;
                $tenant->save();
            }
            // Garantir domínio
            if (!$tenant->domains()->where('domain', $domain)->exists()) {
                $tenant->domains()->create(['domain' => $domain]);
                $this->info("Domínio associado: {$domain}");
            }
            // Migrações (se permitido)
            if (!$noMigrate) {
                $this->info("Executando migrações do tenant '{$id}' ...");
                try {
                    Artisan::call('tenants:migrate', ['--tenant' => [$tenant->id]]);
                    $this->line(Artisan::output());
                } catch (\Throwable $e) {
                    /** @var Tenancy $tenancy */
                    $tenancy = app(Tenancy::class);
                    $tenancy->initialize($tenant);
                    Artisan::call('tenants:migrate');
                    $this->line(Artisan::output());
                    $tenancy->end();
                }
                $this->info("Migrações concluídas para tenant '{$id}'.");
            }
            $this->info("Pronto! Aponte seu hosts para {$domain} → 127.0.0.1 e acesse rotas do tenant por domínio.");
            return 0;
        }

        /** Criar tenant com slug em data */
        $tenant = Tenant::create([
            'id' => $id,
            'name' => $name,
            'data' => [
                'slug' => $id,
            ],
        ]);
        $this->info("Tenant '{$id}' criado.");

        /** Criar banco de dados do tenant */
        $tenant->createDatabase();
        $tenant->save();
        $this->info("Banco de dados criado: " . ($tenant->database()->getName() ?? 'desconhecido'));

        /** Adicionar domínio */
        $tenant->domains()->create(['domain' => $domain]);
        $this->info("Domínio associado: {$domain}");

        /** Executar migrações (opcional) */
        if (!$noMigrate) {
            $this->info("Executando migrações do tenant '{$id}' ...");
            // Tentar executar apenas para esse tenant
            try {
                Artisan::call('tenants:migrate', ['--tenant' => [$tenant->id]]);
                $this->line(Artisan::output());
            } catch (\Throwable $e) {
                // Fallback: inicializar tenancy e rodar migrations sem filtro
                /** @var Tenancy $tenancy */
                $tenancy = app(Tenancy::class);
                $tenancy->initialize($tenant);
                Artisan::call('tenants:migrate');
                $this->line(Artisan::output());
                $tenancy->end();
            }
            $this->info("Migrações concluídas para tenant '{$id}'.");
        } else {
            $this->warn("Migrações não executadas (--no-migrate).");
        }

        $this->info("Pronto! Aponte seu hosts para {$domain} → 127.0.0.1 e acesse rotas do tenant por domínio.");
        return 0;
    }
}
