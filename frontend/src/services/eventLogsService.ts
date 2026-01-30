import { BaseApiService } from './BaseApiService';
import { PaginatedResponse, ApiResponse } from '@/types/index';

export interface EventLogRecord {
  id: number;
  entity_type: string;
  entity_id: string;
  action: string;
  description?: string | null;
  payload?: any;
  actor_id?: string | null;
  actor?: {
    id: string;
    name: string;
    email: string;
  };
  ip_address?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventLogsListParams {
  page?: number;
  per_page?: number;
  entity_type?: string;
  entity_id?: string;
  action?: string;
  actor_id?: string;
}

/**
 * EventLogsService
 * pt-BR: Serviço para listar e registrar event-logs via `/event-logs`.
 * en-US: Service to list and create event logs via `/event-logs`.
 */
class EventLogsService extends BaseApiService {
  /**
   * listEventLogs
   * pt-BR: Lista logs com paginação e filtros por entidade/ação.
   * en-US: Lists logs with pagination and filters by entity/action.
   */
  async listEventLogs(params?: EventLogsListParams): Promise<PaginatedResponse<EventLogRecord>> {
    const response = await this.get<any>('/event-logs', params);
    return this.normalizePaginatedResponse<EventLogRecord>(response);
  }

  /**
   * createEventLog
   * pt-BR: Registra um novo evento para uma entidade.
   * en-US: Registers a new event for an entity.
   */
  async createEventLog(data: Omit<EventLogRecord, 'id' | 'created_at' | 'updated_at'>): Promise<EventLogRecord> {
    const response = await this.post<EventLogRecord | ApiResponse<EventLogRecord>>('/event-logs', data);
    const maybeWrapper = response as ApiResponse<EventLogRecord>;
    if (maybeWrapper && typeof maybeWrapper === 'object' && 'data' in maybeWrapper) {
      return maybeWrapper.data;
    }
    return response as EventLogRecord;
  }
}

export const eventLogsService = new EventLogsService();
