/**
 * Serviço de API para o Assistente de IA (guia do sistema — padrão Help Desk)
 */
import { BaseApiService } from './BaseApiService';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiChatAction {
  label: string;
  route: string;
}

export interface AiChatContext {
  currentRoute: string;
  history: AiChatMessage[];
}

export interface AiChatQuota {
  used: number;
  limit: number;
  remaining: number;
  percentage: number;
  is_unlimited: boolean;
}

export interface AiChatResponse {
  success: boolean;
  data: {
    reply: string;
    actions: AiChatAction[];
    provider: string;
    quota: AiChatQuota | null;
  };
  message?: string;
}

export interface AiSuggestionsResponse {
  success: boolean;
  data: {
    suggestions: string[];
    currentRoute: string;
  };
}

export interface AiStatusResponse {
  success: boolean;
  data: {
    preferred: string | null;
    providers: Record<string, boolean>;
  };
}

class AiAssistantService extends BaseApiService {
  /** Envia mensagem para o assistente de IA */
  async sendMessage(message: string, context: AiChatContext): Promise<AiChatResponse> {
    return this.post<AiChatResponse>('/ai/assistant', { message, context });
  }

  /** Busca sugestões contextuais baseadas na rota atual */
  async getSuggestions(currentRoute: string): Promise<AiSuggestionsResponse> {
    return super.get<AiSuggestionsResponse>('/ai/assistant/suggestions', { route: currentRoute });
  }

  /** Status de configuração por provedor (só presença da chave, sem custo) */
  async getStatus(): Promise<AiStatusResponse> {
    return super.get<AiStatusResponse>('/ai/status');
  }
}

export const aiAssistantService = new AiAssistantService();
