<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Paths
    |--------------------------------------------------------------------------
    |
    | Aqui você define quais rotas terão CORS liberado.
    | Exemplo: ['api/*'] -> todas rotas que começam com /api
    | ['*'] -> todas as rotas
    |
    */
    // Aplica CORS a todas as rotas, inclusive respostas de erro
    'paths' => ['*'],

    /*
    |--------------------------------------------------------------------------
    | Allowed Methods
    |--------------------------------------------------------------------------
    |
    | Métodos HTTP permitidos. Use ['*'] para liberar todos.
    |
    */
    'allowed_methods' => ['*'],

    /*
    |--------------------------------------------------------------------------
    | Allowed Origins
    |--------------------------------------------------------------------------
    |
    | Quais domínios podem consumir sua API. Use ['*'] para liberar todos.
    | Exemplo: ['http://localhost:3000', 'https://meusite.com']
    |
    */
    // Origens fixas (fallback caso o middleware dinâmico não seja aplicado)
    'allowed_origins' => [],

    /*
    |--------------------------------------------------------------------------
    | Allowed Origins Patterns
    |--------------------------------------------------------------------------
    |
    | NOTA: O middleware DynamicCors agora gerencia as origens dinamicamente.
    |       Este array é mantido para compatibilidade com o HandleCors nativo
    |       caso seja reativado.
    |
    */
    'allowed_origins_patterns' => [],

    /*
    |--------------------------------------------------------------------------
    | Allowed Headers
    |--------------------------------------------------------------------------
    |
    | Cabeçalhos permitidos. Use ['*'] para liberar todos.
    |
    */
    'allowed_headers' => ['*'],

    /*
    |--------------------------------------------------------------------------
    | Exposed Headers
    |--------------------------------------------------------------------------
    |
    | Cabeçalhos que podem ser expostos para o navegador.
    |
    */
    // Expõe cabeçalhos úteis para debug multi-tenant no frontend
    'exposed_headers' => ['X-Tenant-Id', 'X-Tenant-Slug'],

    /*
    |--------------------------------------------------------------------------
    | Max Age
    |--------------------------------------------------------------------------
    |
    | Tempo em segundos que o navegador deve cachear as requisições preflight.
    |
    */
    'max_age' => 0,

    /*
    |--------------------------------------------------------------------------
    | Supports Credentials
    |--------------------------------------------------------------------------
    |
    | Se true, permite envio de cookies/autenticação cross-origin.
    |
    */
    'supports_credentials' => true,

];
