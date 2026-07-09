import { BaseApiService } from './BaseApiService';
import {
  CreateScheduledCommunicationInput,
  ScheduledCommunicationListResponse,
  ScheduledCommunicationRecord,
  ScheduledCommunicationsListParams,
} from '@/types/scheduledCommunications';

/**
 * ScheduledCommunicationsService
 * pt-BR: Serviço de API para o módulo de agendamento de envios e atendimentos.
 * en-US: API service for the scheduling module for sends and attendances.
 */
class ScheduledCommunicationsService extends BaseApiService {
  /**
   * list
   * pt-BR: Lista os agendamentos com paginação e filtros.
   * en-US: Lists scheduled communications with pagination and filters.
   */
  async list(params?: ScheduledCommunicationsListParams): Promise<ScheduledCommunicationListResponse> {
    const normalizedParams = { ...(params || {}) };
    if (normalizedParams.status === 'all') delete normalizedParams.status;
    if (normalizedParams.channel === 'all') delete normalizedParams.channel;
    const response = await this.get<any>('/scheduled-communications', normalizedParams);
    return this.normalizePaginatedResponse<ScheduledCommunicationRecord>(response);
  }

  /**
   * createBatch
   * pt-BR: Cria agendamentos em lote para as propostas selecionadas.
   * en-US: Creates scheduled communications in batch for selected proposals.
   */
  async createBatch(payload: CreateScheduledCommunicationInput): Promise<{
    message: string;
    data: ScheduledCommunicationRecord[];
    summary: {
      created_count: number;
      skipped_count: number;
      skipped: Array<{ matricula_id: string | number; reason: string }>;
    };
  }> {
    return this.post('/scheduled-communications', payload);
  }

  /**
   * cancel
   * pt-BR: Cancela um agendamento existente.
   * en-US: Cancels an existing scheduled communication.
   */
  async cancel(id: string | number): Promise<{ message: string; data: ScheduledCommunicationRecord }> {
    return this.patch(`/scheduled-communications/${id}/cancel`);
  }

  /**
   * retry
   * pt-BR: Reenfileira um agendamento para nova tentativa.
   * en-US: Requeues a scheduled communication for another attempt.
   */
  async retry(
    id: string | number,
    payload?: { scheduled_at?: string }
  ): Promise<{ message: string; data: ScheduledCommunicationRecord }> {
    return this.patch(`/scheduled-communications/${id}/retry`, payload || {});
  }

  /**
   * remove
   * pt-BR: Remove permanentemente um agendamento.
   * en-US: Permanently deletes a scheduled communication.
   */
  async remove(id: string | number): Promise<{ message: string }> {
    return super.delete<{ message: string }>(`/scheduled-communications/${id}`);
  }
}

export const scheduledCommunicationsService = new ScheduledCommunicationsService();
