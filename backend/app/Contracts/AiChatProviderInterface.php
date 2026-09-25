<?php

namespace App\Contracts;

interface AiChatProviderInterface
{
    /**
     * Envia mensagem para a IA e retorna a resposta.
     *
     * @param string $message      Mensagem do usuário
     * @param string $systemPrompt System prompt com mapa do sistema
     * @param array  $history      Histórico da conversa [{role, content}]
     * @param array  $options      Opções extras (temperature, max_tokens, etc.)
     * @return array {reply: string, tokens_prompt: ?int, tokens_completion: ?int, model: string}
     */
    public function chat(string $message, string $systemPrompt, array $history = [], array $options = []): array;

    /** Verifica se o provedor tem API key configurada */
    public function isConfigured(): bool;

    /** Slug identificador (gemini, openai) */
    public function getProviderSlug(): string;

    /** Modelo padrão do provedor */
    public function getDefaultModel(): string;
}
