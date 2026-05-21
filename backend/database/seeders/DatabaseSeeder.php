<?php

namespace Database\Seeders;

use App\Models\User;
use App\Services\Qlib;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Database\Seeders\Tenant\AvisoInformacoesImportantesSeeder;
use Database\Seeders\Tenant\TermoRescisaoSeeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        // User::factory()->create([
        //     'name' => 'Test User',
        //     'email' => 'test@example.com',
        // ]);
        if(Qlib::is_crm_aero()){
            $var_cal = [
                    UserSeeder::class,
                    // escolaridadeSeeder::class,
                    // estadocivilSeeder::class,
                    // ProfissaoSeeder::class,
                    MenuSeeder::class, //cadastra menus permissõs e menu_permissions
                    // PermissionSeeder::class,
                    // MenuPermissionSeeder::class,
                    TipoConteudoSeeder::class,
                    DashboardMetricsSeeder::class,
                    CategorySeeder::class,
                    FinancialCategoriesSeeder::class,
                    OptionsTableSeeder::class,
                    ZapsignIntegrationSeeder::class,
                    ZapguruIntegrationSeeder::class,
                    ProductUnitsSeeder::class,
                    EnrollmentSituationsSeeder::class,
                    FunnelStageSeeder::class,
                    AeronavesSeeder::class,
                    AircraftAttendanceSeeder::class,
                    CursosSeeder::class,
                    TurmasSeeder::class,
                    PeriodosSeeder::class,
                    ContratosSeeder::class,
                    ComponentesFundosPropostaSeeder::class,
                    AvisoInformacoesImportantesSeeder::class,
                    TermoRescisaoSeeder::class,
                    // QoptionSeeder::class,
            ];

        }else{
            $var_cal = [
                    UserSeeder::class,
                    MenuSeeder::class, //cadastra menus permissõs e menu_permissions
                    TipoConteudoSeeder::class,
                    DashboardMetricsSeeder::class,
                    CategorySeeder::class,
                    FinancialCategoriesSeeder::class,
                    OptionsTableSeeder::class,
                    ZapsignIntegrationSeeder::class,
                    ZapguruIntegrationSeeder::class,
                    ProductUnitsSeeder::class,
                    EnrollmentSituationsSeeder::class,
                    FunnelStageSeeder::class,
                    AeronavesSeeder::class,
                    AircraftAttendanceSeeder::class,
                    PeriodosSeeder::class,
                    ContratosSeeder::class,
                    ComponentesFundosPropostaSeeder::class,
                    AvisoInformacoesImportantesSeeder::class,
                    TermoRescisaoSeeder::class,
            ];

        }
        $this->call($var_cal);
    }
}
