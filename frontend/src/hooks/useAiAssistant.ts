import { useState, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import {
  aiAssistantService,
  AiChatMessage,
  AiChatAction,
  AiChatResponse,
  AiChatQuota,
} from '@/services/aiAssistantService';

interface AssistantMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: AiChatAction[];
  timestamp: number;
}

const SESSION_KEY = 'ai_assistant_messages';
const MAX_HISTORY = 10;

/**
 * Hook para gerenciar o estado e interações do Assistente de IA (guia do sistema)
 */
export function useAiAssistant() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<AssistantMessage[]>(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [quota, setQuota] = useState<AiChatQuota | null>(null);

  // Persiste mensagens no sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
    } catch {
      // sessionStorage cheio ou indisponível
    }
  }, [messages]);

  // Mutation para enviar mensagem
  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      // Monta histórico limitado para envio (últimas MAX_HISTORY mensagens)
      const historyForApi: AiChatMessage[] = messages
        .slice(-MAX_HISTORY)
        .map((m) => ({ role: m.role, content: m.content }));

      return aiAssistantService.sendMessage(message, {
        currentRoute: location.pathname,
        history: historyForApi,
      });
    },
    onSuccess: (response: AiChatResponse) => {
      const assistantMsg: AssistantMessage = {
        role: 'assistant',
        content: response.data.reply,
        actions: response.data.actions,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (response.data.quota) {
        setQuota(response.data.quota);
      }
    },
    onError: (error: any) => {
      const errorMessage =
        error?.message || 'Não foi possível conectar ao assistente. Tente novamente.';

      // Se for falta de configuração, orienta para Integrações
      const assistantMsg: AssistantMessage = {
        role: 'assistant',
        content: /provedor|configurad|chave/i.test(errorMessage)
          ? '⚠️ O assistente de IA ainda não está configurado. Cadastre a chave em **Configurações > Integrações**.\n\n[Ir para Integrações](/admin/settings/integrations)'
          : `❌ ${errorMessage}`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    },
  });

  const sendMessage = useCallback(
    (message: string) => {
      if (!message.trim()) return;

      // Adiciona mensagem do usuário imediatamente
      const userMsg: AssistantMessage = {
        role: 'user',
        content: message.trim(),
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);

      // Envia para a API
      sendMutation.mutate(message.trim());
    },
    [sendMutation]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  return {
    isOpen,
    setIsOpen,
    toggleOpen,
    messages,
    sendMessage,
    clearMessages,
    isLoading: sendMutation.isPending,
    quota,
  };
}
