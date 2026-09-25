<?php

namespace App\Services\Ai\Chat;

use App\Contracts\AiChatProviderInterface;
use App\Models\ApiCredential;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

abstract class BaseAiChatProvider implements AiChatProviderInterface
{
    protected ?string $apiKey;
    protected string $model;

    public function __construct(?string $apiKey = null, ?string $model = null)
    {
        $this->apiKey = $apiKey;
        $this->model = $model ?? $this->getDefaultModel();
    }

    public function isConfigured(): bool
    {
        return !empty($this->apiKey);
    }

    /**
     * Resolve a API key em cascata: env → options → api_credentials.
     * pt-BR: Mesma ordem do padrão Help Desk, sem precedência por organização
     * (o CRM é single-tenant por banco) e sem gateway SaaS central.
     */
    protected function resolveApiKey(string $envKey, array $credentialNames = [], array $optionKeys = []): ?string
    {
        // 1. Variável de ambiente
        $key = env($envKey);
        if (!empty($key)) {
            return trim($key);
        }
        // 2. Tabela options (ex.: openai_api_key, gemini_api_key, ai_api_key)
        try {
            foreach ($optionKeys as $optKey) {
                $val = DB::table('options')->where('url', $optKey)->value('value');
                if (!empty($val)) {
                    return trim($val);
                }
            }
        } catch (\Throwable $e) {
        }
        // 3. Credenciais api_credentials (ex.: integracao-openai). Segredos
        // podem estar criptografados (Crypt) — tenta descriptografar.
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
                if (!empty($cred->token)) {
                    return trim((string) $cred->token);
                }
                $cfg = is_array($cred->config) ? $cred->config : json_decode($cred->config ?? '[]', true);
                if (is_array($cfg)) {
                    foreach (['access_token', 'api_key', 'pass', 'key', 'secret_key', 'user'] as $field) {
                        if (!empty($cfg[$field])) {
                            return trim($this->decrypt((string) $cfg[$field]));
                        }
                    }
                }
            }
        } catch (\Throwable $e) {
        }

        return null;
    }

    /**
     * Descriptografa segredos salvos via Crypt (padrão ApiCredentialController);
     * mantém o valor como está se for texto puro legado.
     */
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
