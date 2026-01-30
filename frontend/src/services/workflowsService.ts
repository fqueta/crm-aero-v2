import { BaseApiService } from './BaseApiService';
import { PaginatedResponse } from '@/types/index';

export interface WorkflowRecord {
  id: number;
  name: string;
  description?: string | null;
  funnel_id?: number | null;
  isActive: boolean;
  settings?: any;
  created_at: string;
  updated_at: string;
}

class WorkflowsService extends BaseApiService {
  async list(params?: { per_page?: number; funnel_id?: number; isActive?: boolean; search?: string }): Promise<PaginatedResponse<WorkflowRecord>> {
    const resp = await this.get<any>('/workflows', params);
    return this.normalizePaginatedResponse<WorkflowRecord>(resp);
  }
  async create(data: Partial<WorkflowRecord>): Promise<WorkflowRecord> {
    const resp = await this.post<WorkflowRecord>('/workflows', data);
    return resp;
  }
  async update(id: number, data: Partial<WorkflowRecord>): Promise<WorkflowRecord> {
    const resp = await this.put<WorkflowRecord>(`/workflows/${id}`, data);
    return resp;
  }
  async toggleActive(id: number): Promise<WorkflowRecord> {
    const resp = await this.patch<WorkflowRecord>(`/workflows/${id}/toggle-active`);
    return resp;
  }
}

export const workflowsService = new WorkflowsService();
