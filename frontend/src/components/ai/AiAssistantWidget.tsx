import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, X, Send, Trash2, ChevronDown, Bot, User, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAiAssistant } from '@/hooks/useAiAssistant';
import { cn } from '@/lib/utils';
import { AiChatAction } from '@/services/aiAssistantService';

/**
 * Renderiza conteúdo markdown simples (negrito, links, listas)
 */
function renderMarkdown(text: string, onNavigate: (route: string) => void) {
  const lines = text.split('\n');

  return lines.map((line, i) => {
    // Processa a linha para markdown inline
    const processed = line;

    // Links markdown: [texto](/rota)
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let match;

    while ((match = linkRegex.exec(processed)) !== null) {
      // Texto antes do link
      if (match.index > lastIndex) {
        parts.push(renderInlineMarkdown(processed.slice(lastIndex, match.index), i + '-' + lastIndex));
      }
      const linkText = match[1];
      const linkUrl = match[2];

      if (linkUrl.startsWith('/')) {
        parts.push(
          <button
            key={`link-${i}-${match.index}`}
            onClick={() => onNavigate(linkUrl)}
            className="text-emerald-600 hover:text-emerald-800 underline font-medium inline"
          >
            {linkText}
          </button>
        );
      } else {
        parts.push(
          <a key={`link-${i}-${match.index}`} href={linkUrl} target="_blank" rel="noopener noreferrer"
            className="text-emerald-600 hover:text-emerald-800 underline">{linkText}</a>
        );
      }
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < processed.length) {
      parts.push(renderInlineMarkdown(processed.slice(lastIndex), i + '-end'));
    }

    if (parts.length === 0) {
      parts.push(renderInlineMarkdown(processed, i + '-full'));
    }

    // Detecta listas
    const listMatch = line.match(/^(\d+\.\s|[-*]\s)/);
    if (listMatch) {
      return (
        <div key={i} className="pl-4 py-0.5">
          {parts}
        </div>
      );
    }

    // Linha vazia
    if (line.trim() === '') {
      return <div key={i} className="h-2" />;
    }

    return <div key={i}>{parts}</div>;
  });
}

function renderInlineMarkdown(text: string, key: string): React.ReactNode {
  // Negrito: **texto**
  const boldParts = text.split(/\*\*(.+?)\*\*/g);
  if (boldParts.length > 1) {
    return (
      <span key={key}>
        {boldParts.map((part, j) =>
          j % 2 === 1 ? <strong key={j}>{part}</strong> : <span key={j}>{part}</span>
        )}
      </span>
    );
  }
  return <span key={key}>{text}</span>;
}

/**
 * Assistente de IA do CRM Aeroclube — Widget Flutuante (guia do sistema)
 */
export function AiAssistantWidget() {
  const navigate = useNavigate();
  const {
    isOpen,
    toggleOpen,
    messages,
    sendMessage,
    clearMessages,
    isLoading,
    quota,
  } = useAiAssistant();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Foca no input ao abrir
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNavigate = (route: string) => {
    navigate(route);
    toggleOpen();
  };

  const handleActionClick = (action: AiChatAction) => {
    navigate(action.route);
    toggleOpen();
  };

  const handleSuggestionClick = (suggestion: string) => {
    sendMessage(suggestion);
  };

  // Sugestões padrão quando não há mensagens
  const defaultSuggestions = [
    'Como criar uma proposta?',
    'Onde vejo as cobranças Asaas?',
    'Como gerar o contrato em PDF?',
    'Como cadastrar um novo cliente?',
  ];

  return (
    <>
      {/* Painel de Chat */}
      <div
        className={cn(
          'fixed z-50 transition-all duration-300 ease-in-out',
          // Desktop
          'sm:bottom-6 sm:right-6 sm:w-[400px] sm:max-h-[560px]',
          // Mobile
          'bottom-0 right-0 w-full sm:rounded-2xl',
          isOpen
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'
        )}
      >
        <div className="bg-white border border-gray-200 shadow-2xl sm:rounded-2xl rounded-t-2xl flex flex-col overflow-hidden max-h-[85vh] sm:max-h-[560px] dark:bg-slate-900 dark:border-slate-700">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <span className="font-semibold text-sm">Assistente CRM Aeroclube</span>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  onClick={clearMessages}
                  className="p-1.5 rounded-full hover:bg-white/20 transition"
                  title="Limpar conversa"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={toggleOpen}
                className="p-1.5 rounded-full hover:bg-white/20 transition"
                title="Minimizar"
              >
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <X className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Área de Mensagens */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px] max-h-[380px] sm:max-h-[400px] bg-gray-50/50 dark:bg-slate-900/50">
            {/* Boas-vindas quando vazio */}
            {messages.length === 0 && (
              <div className="text-center py-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900 mb-3">
                  <Sparkles className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                  Olá! Como posso ajudar?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Pergunte sobre qualquer recurso do sistema
                </p>

                {/* Sugestões rápidas */}
                <div className="space-y-2">
                  {defaultSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="w-full text-left px-3 py-2 text-xs rounded-lg border border-gray-200 dark:border-slate-700
                                 hover:bg-emerald-50 hover:border-emerald-300 dark:hover:bg-emerald-950 transition-colors
                                 text-gray-600 hover:text-emerald-700 dark:text-gray-300 dark:hover:text-emerald-400 flex items-center gap-2"
                    >
                      <Zap className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Mensagens */}
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex gap-2',
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                )}

                <div
                  className={cn(
                    'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-md'
                      : 'bg-white border border-gray-200 text-gray-700 rounded-bl-md shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-gray-200'
                  )}
                >
                  {msg.role === 'assistant'
                    ? renderMarkdown(msg.content, handleNavigate)
                    : msg.content}

                  {/* Botões de ação */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-gray-100 dark:border-slate-700">
                      {msg.actions.map((action, actionIdx) => (
                        <button
                          key={actionIdx}
                          onClick={() => handleActionClick(action)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-full
                                     bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors
                                     dark:bg-emerald-950 dark:text-emerald-400"
                        >
                          <Zap className="h-3 w-3" />
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {msg.role === 'user' && (
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center mt-0.5">
                    <User className="h-3.5 w-3.5 text-gray-600 dark:text-gray-300" />
                  </div>
                )}
              </div>
            ))}

            {/* Indicador de digitação */}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="bg-white border border-gray-200 dark:bg-slate-800 dark:border-slate-700 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua pergunta..."
                rows={1}
                className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-slate-700 px-3 py-2 text-sm
                           focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent
                           placeholder:text-gray-400 max-h-[80px] dark:bg-slate-800 dark:text-gray-200"
                style={{ minHeight: '36px' }}
                disabled={isLoading}
              />
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!input.trim() || isLoading}
                className="rounded-xl h-9 w-9 p-0 bg-emerald-600 hover:bg-emerald-700 flex-shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {/* Rodapé com cota (só exibe quando o backend informa) */}
            {quota && (
              <div className="flex items-center justify-between mt-1.5 px-1">
                <span className="text-[10px] text-gray-400">
                  {quota.is_unlimited
                    ? 'Cota ilimitada'
                    : `${quota.used}/${quota.limit} consultas usadas`}
                </span>
                {!quota.is_unlimited && (
                  <div className="w-16 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        quota.percentage > 80 ? 'bg-red-500' : quota.percentage > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                      )}
                      style={{ width: `${Math.min(100, quota.percentage)}%` }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FAB Button */}
      <button
        onClick={toggleOpen}
        className={cn(
          'fixed z-50 rounded-full shadow-lg transition-all duration-300',
          'bg-gradient-to-r from-emerald-600 to-teal-600 text-white',
          'hover:shadow-xl hover:scale-105 active:scale-95',
          'flex items-center justify-center',
          // Desktop
          'sm:bottom-6 sm:right-6 sm:h-14 sm:w-14',
          // Mobile
          'bottom-20 right-4 h-12 w-12 sm:bottom-6',
          isOpen && 'opacity-0 pointer-events-none scale-75'
        )}
        title="Assistente de IA"
      >
        <Sparkles className="h-6 w-6 sm:h-7 sm:w-7" />
        {/* Pulse indicator */}
        {messages.length === 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400" />
          </span>
        )}
      </button>
    </>
  );
}
