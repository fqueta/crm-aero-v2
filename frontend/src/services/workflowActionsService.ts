import { BaseApiService } from './BaseApiService';
import { PaginatedResponse } from '@/types/index';

export interface WorkflowActionRecord {
  id: number;
  rule_id: number;
  type: string;
  payload?: any;
  order: number;
  isActive: boolean;
  retry_policy?: any;
  created_at: string;
  updated_at: string;
}

class WorkflowActionsService extends BaseApiService {
  async list(params?: { per_page?: number; rule_id?: number; type?: string; isActive?: boolean }): Promise<PaginatedResponse<WorkflowActionRecord>> {
    const resp = await this.get<any>('/workflow-actions', params);
    return this.normalizePaginatedResponse<WorkflowActionRecord>(resp);
  }
  async create(data: Partial<WorkflowActionRecord>): Promise<WorkflowActionRecord> {
    const resp = await this.post<WorkflowActionRecord>('/workflow-actions', data);
    return resp;
  }
  async update(id: number, data: Partial<WorkflowActionRecord>): Promise<WorkflowActionRecord> {
    const resp = await this.put<WorkflowActionRecord>(`/workflow-actions/${id}`, data);
    return resp;
  }
  async remove(id: number): Promise<{ message: string }> {
    const resp = await this.delete<{ message: string }>(`/workflow-actions/${id}`);
    return resp;
  }
}

export const workflowActionsService = new WorkflowActionsService();
