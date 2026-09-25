import { BaseApiService } from './BaseApiService';
import { ApiResponse } from '@/types/index';

/**
 * Interface para configurações avançadas do sistema
 */
export interface AdvancedSystemSettings {
  // Configurações com Switch
  enableApiLogging: boolean;
  enableCaching: boolean;
  enableCompression: boolean;
  enableSslRedirect: boolean;
  enviar_link_assinatura_zap?: string;
  
  // Configurações com Select
  logLevel: string;
  cacheDriver: string;
  sessionDriver: string;
  queueDriver: string;
  
  // Configurações com Input
  maxFileSize: string;
  sessionTimeout: string;
  apiRateLimit: string;
  maxConnections: string;
  backupRetention: string;
  url_api_aeroclube: string;
  token_api_aeroclube: string;
  credenciais_zapsign?: { url_api: string; id_api: string } | string;
  logo_url?: string;
  favicon_url?: string;
  email_logo_url?: string;
  email_nome?: string;
  ai_chat_provider?: string;
  preco_litro?: string;
  app_primary_color?: string;
  app_secondary_color?: string;
  app_hover_color?: string;
  app_dark_mode_default?: string;
}

/**
 * Serviço para gerenciar configurações do sistema
 * Estende BaseApiService para reutilizar funcionalidades comuns
 */
class SystemSettingsService extends BaseApiService {
  private readonly endpoint = '/options/all';

  /**
   * Salva as configurações avançadas do sistema
   * @param settings - Configurações avançadas para salvar
   */
  async saveAdvancedSettings(settings: AdvancedSystemSettings): Promise<void> {
    await this.post<ApiResponse<void>>(this.endpoint, settings);
  }

  /**
   * Obtém as configurações avançadas do sistema
   */
  async getAdvancedSettings(endpoint : string | null): Promise<AdvancedSystemSettings> {
    const response = await this.get<ApiResponse<AdvancedSystemSettings>>(endpoint || this.endpoint);
    return response.data;
  }

  /**
   * Obtém o preço global do litro de combustível (options.url = preco_litro)
   */
  async getFuelPrice(): Promise<string> {
    const data = await this.getAdvancedSettings('/options');
    return String((data as any)?.preco_litro || '');
  }

  /**
   * Salva o preço global do litro de combustível.
   * Endpoint com permissão vinculada ao menu de Aeronaves.
   */
  async updateFuelPrice(preco_litro: string): Promise<void> {
    await this.post<ApiResponse<void>>('/options/fuel-price', { preco_litro });
  }
}

// Instância singleton do serviço
export const systemSettingsService = new SystemSettingsService();
