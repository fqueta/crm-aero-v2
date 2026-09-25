import { BaseApiService } from './BaseApiService';

export interface ContratoVencidoRow {
  matricula_id: number;
  cliente_id: string | number;
  aluno: string;
  curso: string;
  /** Validade Y-m-d */
  validade: string;
  /** Validade dd/mm/aaaa */
  validade_br: string;
  origem: 'cadastrada' | 'calculada';
  dias_vencido: number;
  telefone: string;
}

export type ContratosVencidosListParams = {
  search?: string;
  id_curso?: number;
  page?: number;
  per_page?: number;
};

export interface ContratosVencidosResponse {
  data: ContratoVencidoRow[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  total_vencidos: number;
  data_consulta: string;
}

/**
 * Serviço do relatório de contratos vencidos (espelho do legado).
 * Endpoint base: /relatorios/contratos-vencidos
 */
class ContratosVencidosService extends BaseApiService {
  async list(params?: ContratosVencidosListParams): Promise<ContratosVencidosResponse> {
    return super.get<ContratosVencidosResponse>('/relatorios/contratos-vencidos', params);
  }

  /**
   * Baixa o CSV da lista filtrada.
   */
  async exportCsv(params?: ContratosVencidosListParams): Promise<Blob> {
    const url = this.buildUrlWithParams(
      `${this.API_BASE_URL}/relatorios/contratos-vencidos/export`,
      params
    );
    const response = await fetch(url, { headers: this.getHeaders() });
    if (!response.ok) {
      let message = 'Falha ao exportar CSV.';
      try {
        const body = await response.json();
        message = body?.message || body?.error || message;
      } catch {
        // mantém mensagem padrão
      }
      throw new Error(message);
    }
    return response.blob();
  }

  /**
   * Define/limpa a validade explícita (null volta à regra calculada).
   */
  async setValidade(id: number | string, validade: string | null): Promise<{ success: boolean; message: string }> {
    return this.patch<{ success: boolean; message: string }>(
      `/relatorios/contratos-vencidos/${id}/validade`,
      { validade }
    );
  }

  /**
   * Envia cobrança de renovação via WhatsApp (ZapGuru).
   */
  async sendWhatsapp(id: number | string): Promise<{ success: boolean; message: string }> {
    return this.post<{ success: boolean; message: string }>(
      `/relatorios/contratos-vencidos/${id}/whatsapp`,
      {}
    );
  }
}

export const contratosVencidosService = new ContratosVencidosService();
