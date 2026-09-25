<?php

namespace App\Services\Ai\Chat;

use App\Contracts\AiChatProviderInterface;
use App\Services\Qlib;

class AiChatProviderFactory
{
    protected static array $providers = [
        'gemini' => GeminiChatProvider::class,
        'openai' => OpenAiChatProvider::class,
    ];

    public static function make(?string $provider = null): ?AiChatProviderInterface
    {
        return self::configuredProviders($provider)[0] ?? null;
    }

    /**
     * Lista os provedores configurados, com o preferido primeiro.
     * pt-BR: Base do fallback em runtime — se o primeiro falhar na chamada,
     * o serviço tenta o próximo.
     *
     * @return AiChatProviderInterface[]
     */
    public static function configuredProviders(?string $provider = null): array
    {
        $preferred = $provider ?? self::resolvePreferredProvider();

        $ordered = [];
        if ($preferred && isset(self::$providers[$preferred])) {
            $ordered[$preferred] = self::$providers[$preferred];
        }
        foreach (self::$providers as $slug => $class) {
            if (!isset($ordered[$slug])) {
                $ordered[$slug] = $class;
            }
        }

        $configured = [];
        foreach ($ordered as $class) {
            try {
                $instance = new $class();
                if ($instance->isConfigured()) {
                    $configured[] = $instance;
                }
            } catch (\Throwable $e) {
            }
        }

        return $configured;
    }

    public static function hasConfiguredProvider(): bool
    {
        return self::make() !== null;
    }

    /**
     * Retorna o status de configuração por provedor (para o card de Integrações).
     * pt-BR: Só verifica presença da chave — não consome tokens da API.
     *
     * @return array{preferred: ?string, providers: array<string, bool>}
     */
    public static function status(): array
    {
        $status = [];
        foreach (self::$providers as $slug => $class) {
            try {
                $status[$slug] = (new $class())->isConfigured();
            } catch (\Throwable $e) {
                $status[$slug] = false;
            }
        }
        return [
            'preferred' => self::resolvePreferredProvider(),
            'providers' => $status,
        ];
    }

    public static function register(string $slug, string $class): void
    {
        self::$providers[$slug] = $class;
    }

    public static function resolvePreferredProvider(): ?string
    {
        $envProvider = env('AI_CHAT_PROVIDER');
        if (!empty($envProvider)) {
            return strtolower($envProvider);
        }

        try {
            $optProvider = Qlib::qoption('ai_chat_provider');
            if (!empty($optProvider)) {
                return strtolower((string) $optProvider);
            }
        } catch (\Throwable $e) {
        }

        return null;
    }
}
