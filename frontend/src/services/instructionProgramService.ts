import { BaseApiService } from './BaseApiService';
import {
  AiEditProposal,
  ContractInstitutionalDefaults,
  InstructionProgram,
  InstructionProgramPayload,
  InstructionProgramRevision,
  PublicProgramChatResponse,
} from '@/types/instructionProgram';
import { PaginatedResponse } from '@/types/index';

class InstructionProgramService extends BaseApiService {
  private readonly endpoint = '/instruction-programs';

  async list(params?: { search?: string; status?: string; curso_id?: number; page?: number; per_page?: number }): Promise<PaginatedResponse<InstructionProgram>> {
    const response = await this.get<any>(this.endpoint, params);
    return this.normalizePaginatedResponse<InstructionProgram>(response);
  }

  async getById(id: string | number): Promise<InstructionProgram> {
    const response = await this.get<{ data: InstructionProgram }>(`${this.endpoint}/${id}`);
    return response.data;
  }

  async create(payload: InstructionProgramPayload): Promise<InstructionProgram> {
    const response = await this.post<{ data: InstructionProgram }>(this.endpoint, payload);
    return response.data;
  }

  async update(id: string | number, payload: InstructionProgramPayload): Promise<InstructionProgram> {
    const response = await this.put<{ data: InstructionProgram }>(`${this.endpoint}/${id}`, payload);
    return response.data;
  }

  async remove(id: string | number): Promise<void> {
    await this.delete<void>(`${this.endpoint}/${id}`);
  }

  async publishRevision(
    id: string | number,
    payload: {
      revision_code: string;
      revision_date?: string;
      mgr_revision?: string;
      mgr_date?: string;
      change_notes?: string;
      edited_by_ai?: boolean;
      content_html?: string;
      contract_defaults?: Record<string, string>;
    }
  ): Promise<{ data: InstructionProgram; revision: InstructionProgramRevision }> {
    return this.post<{ data: InstructionProgram; revision: InstructionProgramRevision }>(
      `${this.endpoint}/${id}/publish-revision`,
      payload
    );
  }

  async restoreRevision(id: string | number, revisionId: number): Promise<InstructionProgram> {
    const response = await this.post<{ data: InstructionProgram }>(
      `${this.endpoint}/${id}/revisions/${revisionId}/restore`
    );
    return response.data;
  }

  async aiEdit(
    id: string | number,
    payload: {
      instruction: string;
      history?: { role: 'user' | 'assistant'; content: string }[];
      draft?: Record<string, any>;
    }
  ): Promise<{ success: boolean; data: AiEditProposal; message?: string }> {
    return this.post<{ success: boolean; data: AiEditProposal; message?: string }>(
      `${this.endpoint}/${id}/ai-edit`,
      payload
    );
  }

  async reindexRag(): Promise<{ success: boolean; message: string; data?: any }> {
    return this.post<{ success: boolean; message: string; data?: any }>('/ai/rag/reindex');
  }

  // ==================== ROTAS PÚBLICAS ====================

  async listPublic(): Promise<InstructionProgram[]> {
    const response = await this.get<{ data: InstructionProgram[] }>(`${this.endpoint}/public`);
    return response.data || [];
  }

  async getPublicBySlug(slug: string): Promise<InstructionProgram> {
    const response = await this.get<{ data: InstructionProgram }>(`${this.endpoint}/public/${slug}`);
    return response.data;
  }

  async sendPublicChat(
    slug: string,
    message: string,
    history: { role: 'user' | 'assistant'; content: string }[] = []
  ): Promise<PublicProgramChatResponse> {
    return this.post<PublicProgramChatResponse>(`${this.endpoint}/public/${slug}/chat`, {
      message,
      history,
    });
  }

  // ==================== CONFIGURAÇÃO INSTITUCIONAL ====================

  async getContractDefaults(): Promise<ContractInstitutionalDefaults> {
    const response = await this.get<{ data: ContractInstitutionalDefaults }>('/settings/contract-defaults');
    return response.data;
  }

  async updateContractDefaults(payload: Partial<ContractInstitutionalDefaults>): Promise<ContractInstitutionalDefaults> {
    const response = await this.put<{ data: ContractInstitutionalDefaults }>('/settings/contract-defaults', payload);
    return response.data;
  }
}

export const instructionProgramService = new InstructionProgramService();
