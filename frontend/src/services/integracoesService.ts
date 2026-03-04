import { BaseApiService } from '@/services/BaseApiService';

export interface IntegracaoConfig {
  url: string;
  user?: string;
  pass?: string;
  produto?: string;
}

export interface IntegracaoMetaPair {
  key: string;
  value: string;
}

export interface Integracao {
  id: number;
  name: string;
  slug: string;
  active: boolean;
  config: IntegracaoConfig;
  meta?: IntegracaoMetaPair[];
  created_at?: string;
  updated_at?: string;
}

class IntegracoesService extends BaseApiService {
  /** Lista integrações com paginação */
  async list(params?: { page?: number; per_page?: number; name?: string; slug?: string; order_by?: string; order?: 'asc'|'desc' }) {
    const response = await super.get<any>(`/integracoes`, params);
    return this.normalizePaginatedResponse<Integracao>(response);
  }
  /** Cria uma integração */
  async create(payload: { name: string; active?: boolean; config: IntegracaoConfig; meta?: IntegracaoMetaPair[] }) {
    return this.post<{ data: Integracao; message: string }>(`/integracoes`, payload);
  }
  /** Atualiza uma integração */
  async update(id: number | string, payload: Partial<{ name: string; active: boolean; config: IntegracaoConfig; meta: IntegracaoMetaPair[] }>) {
    return this.put<{ exec: boolean; data: Integracao; message: string }>(`/integracoes/${id}`, payload);
  }
  /** Detalhe de uma integração */
  async get(id: number | string) {
    return super.get<{ data: Integracao }>(`/integracoes/${id}`);
  }
  /** Move para lixeira */
  async remove(id: number | string) {
    return this.delete<{ message: string }>(`/integracoes/${id}`);
  }
  /** Lista lixeira */
  async trash(params?: { page?: number; per_page?: number }) {
    return this.get<{ data: Integracao[]; current_page: number; last_page: number; per_page: number; total: number }>(`/integracoes/trash`, params);
  }
  /** Restaura da lixeira */
  async restore(id: number | string) {
    return this.put<{ message: string }>(`/integracoes/${id}/restore`, {});
  }
  /** Exclui permanentemente */
  async forceDelete(id: number | string) {
    return this.delete<{ message: string }>(`/integracoes/${id}/force`);
  }
}

export const integracoesService = new IntegracoesService();
