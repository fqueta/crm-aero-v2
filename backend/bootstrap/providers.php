<?php

return [
    App\Providers\AppServiceProvider::class,
    // Explicitly register Stancl Tenancy's provider to ensure routes like /tenancy/assets are available
    Stancl\Tenancy\TenancyServiceProvider::class,
    App\Providers\TenancyServiceProvider::class,
];
