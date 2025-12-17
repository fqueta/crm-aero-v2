<?php

declare(strict_types=1);

use Illuminate\Http\Request;
use App\Http\Controllers\admin\DashboardController;
use App\Http\Controllers\api\AuthController;
use App\Http\Controllers\api\ClientController;
use App\Http\Controllers\api\MenuPermissionController;
use App\Http\Controllers\api\OptionController;
use App\Http\Controllers\api\PermissionController;
use App\Http\Controllers\api\PostController;
use App\Http\Controllers\api\AircraftController;
use App\Http\Controllers\api\AeronaveController;
use App\Http\Controllers\api\CategoryController;
use App\Http\Controllers\api\FinancialCategoryController;
use App\Http\Controllers\api\FinancialOverviewController;
use App\Http\Controllers\api\FunnelController;
use App\Http\Controllers\api\StageController;
use App\Http\Controllers\api\WorkflowController;
use App\Http\Controllers\api\ClientAttendanceController;
use App\Http\Controllers\FinancialAccountController;
use App\Http\Controllers\api\WebhookController;
use App\Http\Controllers\api\MetricasController;
use App\Http\Controllers\api\TrackingEventController;
use App\Http\Controllers\api\DashboardMetricController;
use App\Http\Controllers\api\ProductUnitController;
use App\Http\Controllers\api\ProductController;
use App\Http\Controllers\api\ServiceController;
use App\Http\Controllers\api\ServiceUnitController;
use App\Http\Controllers\api\ServiceOrderController;
use App\Http\Controllers\api\ContratoController;
use App\Http\Controllers\api\SituacaoMatriculaController;
use App\Http\Controllers\api\ParcelamentoController;
use App\Http\Controllers\api\ContentTypeController;
use App\Http\Controllers\api\ComponentController;
use App\Http\Controllers\api\UploadController;
use App\Http\Controllers\api\PaginaController;
use App\Http\Controllers\api\RegisterController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\api\CursoController;
use App\Http\Controllers\TurmaController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\MenuController;
use App\Http\Controllers\TesteController;
use App\Http\Controllers\api\PeriodoController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Stancl\Tenancy\Middleware\InitializeTenancyByDomain;
use Stancl\Tenancy\Middleware\PreventAccessFromCentralDomains;
use App\Http\Controllers\Api\PermissionMenuController;
use App\Http\Controllers\api\UserController;

/*
|--------------------------------------------------------------------------
| Tenant Routes
|--------------------------------------------------------------------------
|
| Here you can register the tenant routes for your application.
| These routes are loaded by the TenantRouteServiceProvider.
|
| Feel free to customize them however you want. Good luck!
|
*/

Route::middleware([
    'web',
    InitializeTenancyByDomain::class,
    PreventAccessFromCentralDomains::class,
])->group(function () {
    // Route::get('/', function () {
    //     return Inertia::render('welcome');
    // })->name('home');
    Route::get('/teste', [ TesteController::class,'index'])->name('teste.index');
    // // Route::get('/', function () {
    //     //     return 'This is your multi-tenant application. The id of the current tenant is ' . tenant('id');
    //     // });
    // // Route::middleware(['auth', 'verified'])->group(function () {
    // //     Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');
    // //     // Route::get('profile', function () {
    // //     //     return Inertia::render('profile');
    // //     // })->name('profile');
    // // });

    // require __DIR__.'/settings.php';
    // require __DIR__.'/auth.php';

});

Route::name('api.')->prefix('api/v1')->middleware([
    'api',
    // 'auth:sanctum',
    InitializeTenancyByDomain::class,
    PreventAccessFromCentralDomains::class,
    'tenant.headers',
])->group(function () {
    Route::post('/login',[AuthController::class,'login'])->name('api.login');

    Route::get('register', [RegisteredUserController::class, 'create'])
        ->name('register');
    Route::post('register', [RegisterController::class, 'store']);
    Route::get('forgot-password', [PasswordResetLinkController::class, 'create'])
        ->name('password.request');

    Route::post('forgot-password', [PasswordResetLinkController::class, 'store'])
        ->name('password.email');
    Route::fallback(function () {
        return response()->json(['message' => 'Rota não encontrada'], 404);
    });


    Route::middleware(['auth:sanctum','auth.active'])->group(function () {
        Route::get('user',[UserController::class,'perfil'])->name('perfil.user');
        // User profile routes (self-service)
        Route::get('user/profile',[UserController::class,'profile'])->name('user.profile.show');
        Route::put('user/profile',[UserController::class,'updateProfile'])->name('user.profile.update');
        Route::get('user/can',[UserController::class,'can_access'])->name('perfil.can');
        Route::post('/logout',[AuthController::class,'logout'])->name('logout');
        Route::apiResource('users', UserController::class,['parameters' => [
            'users' => 'id'
        ]]);
        Route::apiResource('clients', ClientController::class,['parameters' => [
            'clients' => 'id'
        ]]);
        // Atendimentos do cliente (nested)
        Route::get('clients/{id}/attendances', [ClientAttendanceController::class, 'index'])->name('clients.attendances.index');
        Route::post('clients/{id}/attendances', [ClientAttendanceController::class, 'store'])->name('clients.attendances.store');
        Route::get('clients/trash', [ClientController::class, 'trash'])->name('clients.trash');
        Route::put('clients/{id}/restore', [ClientController::class, 'restore'])->name('clients.restore');
        Route::delete('clients/{id}/force', [ClientController::class, 'forceDelete'])->name('clients.forceDelete');

        // Responsáveis (clientes com permission_id=8)
        Route::get('responsaveis', [ClientController::class, 'responsaveisIndex'])->name('responsaveis.index');
        Route::post('responsaveis', [ClientController::class, 'responsaveisStore'])->name('responsaveis.store');
        Route::get('responsaveis/{id}', [ClientController::class, 'responsaveisShow'])->name('responsaveis.show');
        Route::put('responsaveis/{id}', [ClientController::class, 'responsaveisUpdate'])->name('responsaveis.update');
        Route::patch('responsaveis/{id}', [ClientController::class, 'responsaveisUpdate']);
        Route::delete('responsaveis/{id}', [ClientController::class, 'responsaveisDestroy'])->name('responsaveis.destroy');
        Route::get('responsaveis/trash', [ClientController::class, 'responsaveisTrash'])->name('responsaveis.trash');
        Route::put('responsaveis/{id}/restore', [ClientController::class, 'responsaveisRestore'])->name('responsaveis.restore');
        Route::delete('responsaveis/{id}/force', [ClientController::class, 'responsaveisForceDelete'])->name('responsaveis.forceDelete');

        // Rotas para options
        Route::get('options/all', [OptionController::class, 'index'])->name('options.all.get');
        Route::post('options/all', [OptionController::class, 'fast_update_all'])->name('options.all');
        Route::get('options/trash', [OptionController::class, 'trash'])->name('options.trash');
        Route::put('options/{id}/restore', [OptionController::class, 'restore'])->name('options.restore');
        Route::delete('options/{id}/force', [OptionController::class, 'forceDelete'])->name('options.forceDelete');
        Route::apiResource('options', OptionController::class,['parameters' => [
            'options' => 'id'
        ]]);

        // Rotas para posts
        Route::apiResource('posts', PostController::class,['parameters' => [
            'posts' => 'id'
        ]]);
        Route::get('posts/trash', [PostController::class, 'trash'])->name('posts.trash');
        Route::put('posts/{id}/restore', [PostController::class, 'restore'])->name('posts.restore');
        Route::delete('posts/{id}/force', [PostController::class, 'forceDelete'])->name('posts.forceDelete');

        // CRUD: Tipos de conteúdo (posts: post_type=tipo_conteudo)
        Route::apiResource('tipos-conteudo', ContentTypeController::class, ['parameters' => [
            'tipos-conteudo' => 'id'
        ]]);

        // CRUD: Componentes (posts: post_type=componentes)
        Route::apiResource('componentes', ComponentController::class, ['parameters' => [
            'componentes' => 'id'
        ]]);

        // PDF: Relatório de matrícula (tenant-aware URL)
        Route::get('pdf/matriculas/{id}', [\App\Http\Controllers\api\PdfController::class, 'matricula'])
            ->name('pdf.matriculas');

        // CRUD: Uploads de arquivos (posts: post_type=files_uload)
        Route::apiResource('uploads', UploadController::class, ['parameters' => [
            'uploads' => 'id'
        ]]);

        // CRUD: Páginas (posts: post_type=paginas)
        Route::apiResource('paginas', PaginaController::class, ['parameters' => [
            'paginas' => 'id'
        ]]);

        // Rotas para situações de matrícula (post_type=situacao_matricula)
        Route::apiResource('situacoes-matricula', SituacaoMatriculaController::class, ['parameters' => [
            'situacoes-matricula' => 'id'
        ]]);
        Route::get('situacoes-matricula/trash', [SituacaoMatriculaController::class, 'trash'])->name('situacoes-matricula.trash');
        Route::put('situacoes-matricula/{id}/restore', [SituacaoMatriculaController::class, 'restore'])->name('situacoes-matricula.restore');
        Route::delete('situacoes-matricula/{id}/force', [SituacaoMatriculaController::class, 'forceDelete'])->name('situacoes-matricula.forceDelete');

        // Rotas para aircraft
        Route::get('aircraft/trash', [AircraftController::class, 'trash'])->name('aircraft.trash');
        Route::put('aircraft/{id}/restore', [AircraftController::class, 'restore'])->name('aircraft.restore');
        Route::delete('aircraft/{id}/force', [AircraftController::class, 'forceDelete'])->name('aircraft.forceDelete');
        Route::apiResource('aircraft', AircraftController::class,['parameters' => [
            'aircraft' => 'id'
        ]]);

        // Rotas para aeronaves (CRUD baseado em tabela `aeronaves`)
        Route::get('aeronaves/trash', [AeronaveController::class, 'trash'])->name('aeronaves.trash');
        Route::put('aeronaves/{id}/restore', [AeronaveController::class, 'restore'])->name('aeronaves.restore');
        Route::apiResource('aeronaves', AeronaveController::class, ['parameters' => [
            'aeronaves' => 'id'
        ]]);

        // Rotas para categories
        Route::apiResource('categories', CategoryController::class,['parameters' => [
            'categories' => 'id'
        ]]);
        Route::get('categories/trash', [CategoryController::class, 'trash'])->name('categories.trash');
        Route::put('categories/{id}/restore', [CategoryController::class, 'restore'])->name('categories.restore');
        Route::delete('categories/{id}/force', [CategoryController::class, 'forceDelete'])->name('categories.forceDelete');
        Route::get('categories/tree', [CategoryController::class, 'tree'])->name('categories.tree');
        Route::get('service-categories', [CategoryController::class, 'indexServiceCategories'])->name('service-categories');
        /**Rota para o cadasto de produto */
        Route::get('product-categories', [CategoryController::class, 'index'])->name('product-categories');

        // Rotas para financial/categories
        Route::apiResource('financial/categories', FinancialCategoryController::class,[
            'parameters' => ['categories' => 'id'],
            'names' => [
                'index' => 'financial.categories.index',
                'store' => 'financial.categories.store',
                'show' => 'financial.categories.show',
                'update' => 'financial.categories.update',
                'destroy' => 'financial.categories.destroy'
            ]
        ]);
        Route::get('financial/categories/trash', [FinancialCategoryController::class, 'trash'])->name('financial.categories.trash');
        Route::put('financial/categories/{id}/restore', [FinancialCategoryController::class, 'restore'])->name('financial.categories.restore');
        Route::delete('financial/categories/{id}/force', [FinancialCategoryController::class, 'forceDelete'])->name('financial.categories.forceDelete');

        // Rotas para financial/accounts (contas financeiras unificadas)
        Route::apiResource('financial/accounts', FinancialAccountController::class,[
            'parameters' => ['accounts' => 'id']
        ])->names([
            'index' => 'financial.accounts.index',
            'store' => 'financial.accounts.store',
            'show' => 'financial.accounts.show',
            'update' => 'financial.accounts.update',
            'destroy' => 'financial.accounts.destroy'
        ]);
        Route::get('financial/accounts/trash', [FinancialAccountController::class, 'trash'])->name('financial.accounts.trash');
        Route::put('financial/accounts/{id}/restore', [FinancialAccountController::class, 'restore'])->name('financial.accounts.restore');
        Route::delete('financial/accounts/{id}/force', [FinancialAccountController::class, 'forceDelete'])->name('financial.accounts.forceDelete');

        // Rotas de compatibilidade para accounts-payable (contas a pagar)
        Route::get('financial/accounts-payable', function(Request $request) {
            $request->merge(['type' => 'payable']);
            return app(FinancialAccountController::class)->index($request);
        })->name('financial.accounts-payable.index');
        Route::post('financial/accounts-payable', function(Request $request) {
            $request->merge(['type' => 'payable']);
            return app(FinancialAccountController::class)->store($request);
        })->name('financial.accounts-payable.store');
        Route::get('financial/accounts-payable/{id}', function(Request $request, $id) {
            return app(FinancialAccountController::class)->show($request, $id);
        })->name('financial.accounts-payable.show');
        Route::put('financial/accounts-payable/{id}', function(Request $request, $id) {
            return app(FinancialAccountController::class)->update($request, $id);
        })->name('financial.accounts-payable.update');
        Route::delete('financial/accounts-payable/{id}', function(Request $request, $id) {
            return app(FinancialAccountController::class)->destroy($request, $id);
        })->name('financial.accounts-payable.destroy');
        Route::patch('financial/accounts-payable/{id}/pay', function(Request $request, $id) {
            return app(FinancialAccountController::class)->pay($request, $id);
        })->name('financial.accounts-payable.pay');

        // Rotas de compatibilidade para accounts-receivable (contas a receber)
        Route::get('financial/accounts-receivable', function(Request $request) {
            $request->merge(['type' => 'receivable']);
            return app(FinancialAccountController::class)->index($request);
        })->name('financial.accounts-receivable.index');
        Route::post('financial/accounts-receivable', function(Request $request) {
            $request->merge(['type' => 'receivable']);
            return app(FinancialAccountController::class)->store($request);
        })->name('financial.accounts-receivable.store');
        Route::get('financial/accounts-receivable/{id}', function(Request $request, $id) {
            return app(FinancialAccountController::class)->show($request, $id);
        })->name('financial.accounts-receivable.show');
        Route::put('financial/accounts-receivable/{id}', function(Request $request, $id) {
            return app(FinancialAccountController::class)->update($request, $id);
        })->name('financial.accounts-receivable.update');
        Route::delete('financial/accounts-receivable/{id}', function(Request $request, $id) {
            return app(FinancialAccountController::class)->destroy($request, $id);
        })->name('financial.accounts-receivable.destroy');
        Route::patch('financial/accounts-receivable/{id}/receive', function(Request $request, $id) {
            return app(FinancialAccountController::class)->receive($request, $id);
        })->name('financial.accounts-receivable.receive');
        Route::patch('financial/accounts-receivable/{id}/cancel', function(Request $request, $id) {
            return app(FinancialAccountController::class)->cancel($request, $id);
        })->name('financial.accounts-receivable.cancel');

        // Resumo financeiro (dados mocados)
        Route::get('financial/overview', [FinancialOverviewController::class, 'index'])->name('financial.overview');

        // Rotas para funnels (funis de atendimento)
        Route::apiResource('funnels', FunnelController::class, ['parameters' => [
            'funnels' => 'id'
        ]]);
        Route::patch('funnels/{id}/toggle-active', [FunnelController::class, 'toggleActive'])->name('funnels.toggle-active');
        Route::get('funnels/{id}/stages', [FunnelController::class, 'stages'])->name('funnels.stages');
        // Reordenar funis com payload de IDs (PUT e POST para compatibilidade)
        Route::put('funnels/reorder', [FunnelController::class, 'reorder'])->name('funnels.reorder');
        Route::post('funnels/reorder', [FunnelController::class, 'reorder'])->name('funnels.reorder.post');

        // Rotas para stages (etapas dos funis)
        Route::apiResource('stages', StageController::class, ['parameters' => [
            'stages' => 'id'
        ]]);
        Route::patch('stages/{id}/toggle-active', [StageController::class, 'toggleActive'])->name('stages.toggle-active');
        Route::post('funnels/{id}/stages/reorder', [FunnelController::class, 'reorderStages'])->name('funnels.stages.reorder');
        // Alias para permitir reordenação via PUT (compatibilidade com clientes)
        Route::put('funnels/{id}/stages/reorder', [FunnelController::class, 'reorderStages'])->name('funnels.stages.reorder.put');
        // Alias para atualização de etapa escopada por funil via PUT/PATCH
        Route::match(['put', 'patch'], 'funnels/{funnelId}/stages/{id}', [StageController::class, 'update'])
            ->name('funnels.stages.update');

        // Rotas para workflows (fluxos de trabalho)
        Route::apiResource('workflows', WorkflowController::class, ['parameters' => [
            'workflows' => 'id'
        ]]);
        Route::patch('workflows/{id}/toggle-active', [WorkflowController::class, 'toggleActive'])->name('workflows.toggle-active');
    });



    Route::middleware(['auth:sanctum','auth.active'])->group(function () {
        // Rotas para product-units
        Route::apiResource('product-units', ProductUnitController::class,['parameters' => [
            'product-units' => 'id'
        ]]);
        Route::get('product-units/trash', [ProductUnitController::class, 'trash'])->name('product-units.trash');
        Route::put('product-units/{id}/restore', [ProductUnitController::class, 'restore'])->name('product-units.restore');
        Route::delete('product-units/{id}/force', [ProductUnitController::class, 'forceDelete'])->name('product-units.forceDelete');

        // Rotas para products
        Route::get('products/trash', [ProductController::class, 'trash'])->name('products.trash');
        Route::put('products/{id}/restore', [ProductController::class, 'restore'])->name('products.restore');
        Route::delete('products/{id}/force', [ProductController::class, 'forceDelete'])->name('products.forceDelete');
        Route::apiResource('products', ProductController::class,['parameters' => [
            'products' => 'id'
        ]]);

        // Rotas para cursos (PT-BR)
        Route::get('cursos/trash', [CursoController::class, 'trash'])->name('cursos.trash');
        Route::put('cursos/{id}/restore', [CursoController::class, 'restore'])->name('cursos.restore');
        Route::delete('cursos/{id}/force', [CursoController::class, 'forceDelete'])->name('cursos.forceDelete');
        Route::apiResource('cursos', CursoController::class, ['parameters' => [
            'cursos' => 'id'
        ]]);

        // Rotas para parcelamentos (planos de pagamento de cursos)
        Route::get('parcelamentos/trash', [ParcelamentoController::class, 'trash'])->name('parcelamentos.trash');
        Route::put('parcelamentos/{id}/restore', [ParcelamentoController::class, 'restore'])->name('parcelamentos.restore');
        Route::delete('parcelamentos/{id}/force', [ParcelamentoController::class, 'forceDelete'])->name('parcelamentos.forceDelete');
        Route::apiResource('parcelamentos', ParcelamentoController::class, ['parameters' => [
            'parcelamentos' => 'id'
        ]]);

        // Alias em inglês para compatibilidade
        Route::get('courses/trash', [CursoController::class, 'trash'])->name('courses.trash');
        Route::put('courses/{id}/restore', [CursoController::class, 'restore'])->name('courses.restore');
        Route::delete('courses/{id}/force', [CursoController::class, 'forceDelete'])->name('courses.forceDelete');
        Route::apiResource('courses', CursoController::class, ['parameters' => [
            'courses' => 'id'
        ]]);

        // Rotas para turmas (PT-BR)
        Route::get('turmas/trash', [TurmaController::class, 'trash'])->name('turmas.trash');
        Route::put('turmas/{id}/restore', [TurmaController::class, 'restore'])->name('turmas.restore');
        Route::delete('turmas/{id}/force', [TurmaController::class, 'forceDelete'])->name('turmas.forceDelete');
        Route::apiResource('turmas', TurmaController::class, ['parameters' => [
            'turmas' => 'id'
        ]]);

        // Alias em inglês para turmas (compatibilidade)
        Route::get('classes/trash', [TurmaController::class, 'trash'])->name('classes.trash');
        Route::put('classes/{id}/restore', [TurmaController::class, 'restore'])->name('classes.restore');
        Route::delete('classes/{id}/force', [TurmaController::class, 'forceDelete'])->name('classes.forceDelete');
        Route::apiResource('classes', TurmaController::class, ['parameters' => [
            'classes' => 'id'
        ]]);

        // Rotas para services
        Route::apiResource('services', ServiceController::class,['parameters' => [
            'services' => 'id'
        ]]);
        Route::get('services/trash', [ServiceController::class, 'trash'])->name('services.trash');
        Route::put('services/{id}/restore', [ServiceController::class, 'restore'])->name('services.restore');
        Route::delete('services/{id}/force', [ServiceController::class, 'forceDelete'])->name('services.forceDelete');

        // Rotas para contratos (posts: post_type=contratos)
        Route::apiResource('contratos', ContratoController::class, ['parameters' => [
            'contratos' => 'id'
        ]]);
        Route::get('contratos/trash', [ContratoController::class, 'trash'])->name('contratos.trash');
        Route::put('contratos/{id}/restore', [ContratoController::class, 'restore'])->name('contratos.restore');
        Route::delete('contratos/{id}/force', [ContratoController::class, 'forceDelete'])->name('contratos.forceDelete');

        // Rotas para períodos (posts: post_type=periodos)
        Route::apiResource('periodos', PeriodoController::class, ['parameters' => [
            'periodos' => 'id'
        ]]);

         // Rotas para service-units
         Route::apiResource('service-units', ServiceUnitController::class,['parameters' => [
             'service-units' => 'id'
         ]]);
         Route::get('service-units/trash', [ServiceUnitController::class, 'trash'])->name('service-units.trash');
         Route::put('service-units/{id}/restore', [ServiceUnitController::class, 'restore'])->name('service-units.restore');
         Route::delete('service-units/{id}/force', [ServiceUnitController::class, 'forceDelete'])->name('service-units.forceDelete');

         // Rotas para service-orders
         Route::apiResource('service-orders', ServiceOrderController::class,['parameters' => [
             'service-orders' => 'id'
         ]]);
         Route::get('service-orders/trash', [ServiceOrderController::class, 'trash'])->name('service-orders.trash');
         Route::put('service-orders/{id}/restore', [ServiceOrderController::class, 'restore'])->name('service-orders.restore');
         Route::put('service-orders/{id}/status ', [ServiceOrderController::class, 'updateStatus'])->name('service-orders.update-status');
         Route::delete('service-orders/{id}/force', [ServiceOrderController::class, 'forceDelete'])->name('service-orders.forceDelete');

         // Rotas para dashboard-metrics
        Route::apiResource('dashboard-metrics', MetricasController::class,['parameters' => [
            'dashboard-metrics' => 'id'
        ]]);
        Route::post('dashboard-metrics/import-aeroclube', [MetricasController::class, 'importFromAeroclube'])->name('dashboard-metrics.import-aeroclube');

        // Route::apiResource('clients', ClientController::class,['parameters' => [
        //     'clients' => 'id'
        // ]]);
        Route::get('users/trash', [UserController::class, 'trash'])->name('users.trash');
        Route::get('metrics/filter', [MetricasController::class, 'filter']);
        Route::apiResource('metrics', MetricasController::class,['parameters' => [
            'metrics' => 'id'
        ]]);

        // Rotas para tracking events
        Route::apiResource('tracking', TrackingEventController::class,['parameters' => [
            'tracking' => 'id'
        ]]);
        Route::get('tracking-events', [TrackingEventController::class, 'index'])->name('tracking-events.index');
        // rota flexível de filtros
        Route::get('menus', [MenuController::class, 'getMenus']);
        Route::apiResource('permissions', PermissionController::class,['parameters' => [
            'permissions' => 'id'
        ]]);
        Route::prefix('permissions')->group(function () {
            Route::get('{id}/menu-permissions', [MenuPermissionController::class, 'show'])->name('menu-permissions.show');
            Route::put('{id}/menu-permissions', [MenuPermissionController::class, 'updatePermissions'])->name('menu-permissions.update');
            // Route::post('{id}/menus', [PermissionMenuController::class, 'update']);
        });
    });
    // Rotas para tracking events
    Route::post('tracking/whatsapp-contact', [TrackingEventController::class, 'whatsappContact'])->name('tracking.whatsapp-contact');
    // Rotas para webhooks
    Route::any('webhook/{endp1}', [WebhookController::class, 'handleSingleEndpoint'])->name('webhook.single');
    Route::any('webhook/{endp1}/{endp2}', [WebhookController::class, 'handleDoubleEndpoint'])->name('webhook.double');
});
