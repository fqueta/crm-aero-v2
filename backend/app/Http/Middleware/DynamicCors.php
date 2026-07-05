<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class DynamicCors
{
    private const ALLOWED_PATTERNS = [
        '/^https?:\/\/.*\.localhost(:\d+)?$/',           // *.localhost
        '/^https:\/\/.*\.aeroclubejf\.com\.br$/',         // *.aeroclubejf.com.br
        '/^http:\/\/localhost:\d+$/',                     // localhost:port
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $origin = $request->header('Origin');
        $isAllowed = $this->isOriginAllowed($origin);

        if ($request->isMethod('OPTIONS')) {
            $response = response('', 204);
        } else {
            $response = $next($request);
        }

        if ($isAllowed) {
            $response->header('Access-Control-Allow-Origin', $origin);
            $response->header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
            $response->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Tenant-Id, X-Tenant-Slug');
            $response->header('Access-Control-Expose-Headers', 'X-Tenant-Id, X-Tenant-Slug');
            $response->header('Access-Control-Allow-Credentials', 'true');
            $response->header('Vary', 'Origin');
        }

        if ($request->isMethod('OPTIONS')) {
            $response->header('Access-Control-Max-Age', '86400');
        }

        return $response;
    }

    private function isOriginAllowed(?string $origin): bool
    {
        if (!$origin) {
            return false;
        }

        foreach (self::ALLOWED_PATTERNS as $pattern) {
            if (preg_match($pattern, $origin)) {
                return true;
            }
        }

        return false;
    }
}
