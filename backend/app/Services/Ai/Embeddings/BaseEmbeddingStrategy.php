<?php

namespace App\Services\Ai\Embeddings;

use App\Contracts\EmbeddingProviderInterface;
use App\Models\ApiCredential;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

abstract class BaseEmbeddingStrategy implements EmbeddingProviderInterface
{
    protected ?string $apiKey;

    public function __construct(?string $apiKey = null)
    {
        $this->apiKey = $apiKey;
    }

    public function isConfigured(): bool
    {
        return !empty($this->apiKey);
    }

    protected function resolveApiKey(string $envKey, array $credentialNames = [], array $optionKeys = []): ?string
    {
        $key = env($envKey);
        if (!empty($key)) {
            return trim($key);
        }

        try {
            foreach ($optionKeys as $optKey) {
                $val = DB::table('options')->where('url', $optKey)->value('value');
                if (!empty($val)) {
                    return trim((string) $val);
                }
            }
        } catch (\Throwable $e) {
        }

        try {
            $query = ApiCredential::withoutGlobalScope('notDeleted')
                ->where('deletado', '!=', 's');
            $query->where(function ($q) use ($credentialNames) {
                foreach ($credentialNames as $name) {
                    $q->orWhere('post_name', 'like', "%{$name}%")
                        ->orWhere('post_title', 'like', "%{$name}%");
                }
            });
            $creds = $query->orderBy('ID', 'desc')->get();
            foreach ($creds as $cred) {
                $cfg = is_array($cred->config) ? $cred->config : json_decode($cred->config ?? '[]', true);
                if (is_array($cfg)) {
                    foreach (['access_token', 'api_key', 'pass', 'key', 'secret_key'] as $field) {
                        if (!empty($cfg[$field])) {
                            $decrypted = trim($this->decrypt((string) $cfg[$field]));
                            if (!empty($decrypted)) {
                                return $decrypted;
                            }
                        }
                    }
                }
                if (!empty($cred->token) && strlen($cred->token) > 20 && !str_contains($cred->token, '-')) {
                    return trim((string) $cred->token);
                }
            }
        } catch (\Throwable $e) {
        }

        return null;
    }

    protected function decrypt(string $value): string
    {
        if ($value === '') {
            return '';
        }
        try {
            return Crypt::decryptString($value);
        } catch (\Throwable $e) {
            return $value;
        }
    }
}
