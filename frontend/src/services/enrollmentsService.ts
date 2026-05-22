import { PaginatedResponse, ApiResponse, ApiDeleteResponse } from '@/types/index';
import { BaseApiService } from './BaseApiService';
import { EnrollmentRecord, CreateEnrollmentInput, UpdateEnrollmentInput, EnrollmentsListParams } from '@/types/enrollments';

type EnrollmentListApiResponse = PaginatedResponse<EnrollmentRecord> | EnrollmentRecord[] | Record<string, unknown>;

/**
 * EnrollmentsService
 * pt-BR: Serviço para gerenciar matrículas (`/matriculas`).
 * en-US: Service to manage enrollments (`/matriculas`).
 */
class EnrollmentsService extends BaseApiService {
  /**
   * listEnrollments
   * pt-BR: Lista matrículas com paginação e filtros.
   * en-US: Lists enrollments with pagination and filters.
   */
  async listEnrollments(params?: EnrollmentsListParams): Promise<PaginatedResponse<EnrollmentRecord>> {
    /**
     * listEnrollments
     * pt-BR: Garante que o endpoint de listagem inclua `situacao=mat` por padrão,
     *        mesclando com quaisquer filtros/paginação fornecidos.
     * en-US: Ensures the listing endpoint includes `situacao=mat` by default,
     *        merging with any provided filters/pagination.
     */
    // Default to 'mat' but allow callers to override with a provided `situacao`
    const mergedParams = { situacao: 'mat', ...(params || {}) } as EnrollmentsListParams & { situacao?: string };
    const response = await this.get<EnrollmentListApiResponse>('/matriculas', mergedParams);
    return this.normalizePaginatedResponse<EnrollmentRecord>(response);
  }

  /**
   * getEnrollment
   * pt-BR: Obtém matrícula por ID.
   * en-US: Fetch enrollment by ID.
   */
  async getEnrollment(id: string): Promise<EnrollmentRecord> {
    return this.get<EnrollmentRecord>(`/matriculas/${id}`);
  }

  /**
   * createEnrollment
   * pt-BR: Cria nova matrícula.
   * en-US: Creates a new enrollment.
   */
  async createEnrollment(payload: CreateEnrollmentInput): Promise<EnrollmentRecord> {
    /**
     * pt-BR: Algumas APIs retornam o registro diretamente, outras usam wrapper `{ success, message, data }`.
     *        Normalizamos o retorno para sempre entregar `EnrollmentRecord`.
     * en-US: Some APIs return the record directly, others use a `{ success, message, data }` wrapper.
     *        We normalize the return to always deliver `EnrollmentRecord`.
     */
    const response = await this.post<EnrollmentRecord | ApiResponse<EnrollmentRecord>>('/matriculas', payload);
    const maybeWrapper = response as ApiResponse<EnrollmentRecord>;
    if (maybeWrapper && typeof maybeWrapper === 'object' && 'data' in maybeWrapper && ('success' in maybeWrapper || 'message' in maybeWrapper)) {
      return maybeWrapper.data;
    }
    return response as EnrollmentRecord;
  }

  /**
   * updateEnrollment
   * pt-BR: Atualiza matrícula existente.
   * en-US: Updates an existing enrollment.
   */
  async updateEnrollment(id: string, payload: UpdateEnrollmentInput): Promise<EnrollmentRecord> {
    return this.put<EnrollmentRecord>(`/matriculas/${id}`, payload);
  }

  /**
   * updateEnrollmentStage
   * pt-BR: Atualiza rapidamente a etapa da matrícula.
   * en-US: Quickly updates the enrollment stage.
   */
  async updateEnrollmentStage(id: string, stageId: number): Promise<EnrollmentRecord> {
    return this.patch<EnrollmentRecord>(`/matriculas/${id}/etapa`, { stage_id: stageId });
  }

  /**
   * updateEnrollmentStatus
   * pt-BR: Atualiza rapidamente o status da matrícula.
   * en-US: Quickly updates the enrollment status.
   */
  async updateEnrollmentStatus(
    id: string,
    payload: {
      status: 'a' | 'g' | 'p';
      gain_date?: string;
      negotiated_amount?: string;
      paid_amount?: string;
      gain_observation?: string;
      loss_date?: string;
      loss_reason?: string;
      loss_observation?: string;
    }
  ): Promise<EnrollmentRecord> {
    return this.patch<EnrollmentRecord>(`/matriculas/${id}/status`, payload);
  }

  /**
   * simulateFuel
   * pt-BR: Simula o custo de combustível baseado nos módulos.
   * en-US: Simulates fuel cost based on modules.
   */
  async simulateFuel(payload: { modulos: Array<Record<string, unknown>> }): Promise<{
    exec: boolean;
    valor: number;
    valor_litro: number | null;
    tipo_pagamento: string;
    color_tipo_pagamento: string;
  }> {
    return this.post<{
      exec: boolean;
      valor: number;
      valor_litro: number | null;
      tipo_pagamento: string;
      color_tipo_pagamento: string;
    }>('/matriculas/simulador-combustivel', payload);
  }

  /**
   * deleteEnrollment
   * pt-BR: Exclui matrícula.
   * en-US: Deletes an enrollment.
   */
  async deleteEnrollment(id: string): Promise<ApiDeleteResponse> {
    return super.delete<ApiDeleteResponse>(`/matriculas/${id}`);
  }

  /**
   * sendWhatsApp
   * pt-BR: Envia mensagem via WhatsApp (ChatGuru API) para o cliente.
   * en-US: Sends a WhatsApp message (ChatGuru API) to the client.
   */
  async sendWhatsApp(
    id: string,
    payload: { mensagem: string; dialog_id?: string }
  ): Promise<{ success: boolean; message: string; response?: any }> {
    return this.post<{ success: boolean; message: string; response?: any }>(`/matriculas/${id}/enviar-whatsapp`, payload);
  }

  // Compat layer for useGenericApi
  async list(params?: EnrollmentsListParams): Promise<PaginatedResponse<EnrollmentRecord>> {
    return this.listEnrollments(params);
  }
  async getById(id: string): Promise<EnrollmentRecord> {
    return this.getEnrollment(id);
  }
  async create(data: CreateEnrollmentInput): Promise<EnrollmentRecord> {
    return this.createEnrollment(data);
  }
  async update(id: string, data: UpdateEnrollmentInput): Promise<EnrollmentRecord> {
    return this.updateEnrollment(id, data);
  }
  async delete(id: string): Promise<ApiDeleteResponse> {
    return this.deleteEnrollment(id);
  }
}

export const enrollmentsService = new EnrollmentsService();
