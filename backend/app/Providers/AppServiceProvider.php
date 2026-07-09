<?php

namespace App\Providers;

use App\Helpers\StringHelper;
use App\Services\ScheduledCommunication\ScheduledCommunicationService;
use App\Services\ScheduledCommunication\ScheduledCommunicationStrategyFactory;
use App\Services\ScheduledCommunication\Strategies\BrevoEmailScheduledCommunicationStrategy;
use App\Services\ScheduledCommunication\Strategies\ManualAttendanceScheduledCommunicationStrategy;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Event;
use Inertia\Inertia;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton('escola', function () {
            return new \App\Services\Escola();
        });
        $this->app->singleton('qlib', function () {
            return new \App\Services\Qlib();
        });
        // $this->app->singleton(StringHelper::class, function () {
        //     return new StringHelper();
        // });
        $this->app->singleton(ScheduledCommunicationStrategyFactory::class, function () {
            return new ScheduledCommunicationStrategyFactory([
                new BrevoEmailScheduledCommunicationStrategy(),
                new ManualAttendanceScheduledCommunicationStrategy(),
            ]);
        });
        $this->app->singleton(ScheduledCommunicationService::class, function ($app) {
            return new ScheduledCommunicationService(
                $app->make(ScheduledCommunicationStrategyFactory::class)
            );
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Inertia::share('nav', [
            ['label' => 'Dashboard', 'href' => '/dashboard'],
            ['label' => 'Usuários', 'href' => '/users'],
            ['label' => 'Configurações', 'href' => '/settings'],
        ]);
        Event::listen(\App\Events\StageChanged::class, \App\Listeners\StageChangedListener::class);
        Event::listen(\App\Events\WebhookReceived::class, \App\Listeners\WebhookReceivedListener::class);
    }
}
