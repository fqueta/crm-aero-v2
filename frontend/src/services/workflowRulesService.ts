import { BaseApiService } from './BaseApiService';
import { PaginatedResponse } from '@/types/index';

export interface WorkflowRuleRecord {
  id: number;
  workflow_id: number;
  source_type: string;
  event: string;
  filters?: any;
  conditions?: any;
  order: number;
  isActive: boolean;
  created_at: string;
  updated_at: string;
}

class WorkflowRulesService extends BaseApiService {
  async list(params?: { per_page?: number; workflow_id?: number; source_type?: string; event?: string; isActive?: boolean }): Promise<PaginatedResponse<WorkflowRuleRecord>> {
    const resp = await this.get<any>('/workflow-rules', params);
    return this.normalizePaginatedResponse<WorkflowRuleRecord>(resp);
  }
  async create(data: Partial<WorkflowRuleRecord>): Promise<WorkflowRuleRecord> {
    const resp = await this.post<WorkflowRuleRecord>('/workflow-rules', data);
    return resp;
  }
  async update(id: number, data: Partial<WorkflowRuleRecord>): Promise<WorkflowRuleRecord> {
    const resp = await this.put<WorkflowRuleRecord>(`/workflow-rules/${id}`, data);
    return resp;
  }
  async remove(id: number): Promise<{ message: string }> {
    const resp = await this.delete<{ message: string }>(`/workflow-rules/${id}`);
    return resp;
  }
}

export const workflowRulesService = new WorkflowRulesService();
