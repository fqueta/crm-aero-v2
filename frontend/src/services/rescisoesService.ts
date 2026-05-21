import { BaseApiService } from './BaseApiService';
import { RescisaoRecord, CreateRescisaoInput, UpdateRescisaoInput, RescisoesListParams } from '@/types/rescisoes';
import { PaginatedResponse, ApiResponse } from '@/types/index';

class RescisoesService extends BaseApiService {
  private readonly endpoint = '/rescisoes';

  /**
   * List all contract terminations
   */
  async listRescisoes(params?: RescisoesListParams): Promise<PaginatedResponse<RescisaoRecord>> {
    const response = await this.get<any>(this.endpoint, params);
    return this.normalizePaginatedResponse<RescisaoRecord>(response);
  }

  /**
   * Fetch a specific contract termination by ID
   */
  async getRescisao(id: string | number): Promise<RescisaoRecord> {
    const response = await this.get<ApiResponse<RescisaoRecord>>(`${this.endpoint}/${id}`);
    return response.data;
  }

  /**
   * Fetch a termination by public token - no auth required
   */
  async getPublicRescisao(token: string): Promise<{rescisao: RescisaoRecord, termoHtml: string}> {
    const response = await this.get<ApiResponse<RescisaoRecord> & {termo_html?: string}>(`${this.endpoint}/public/${token}`);
    return {
      rescisao: response.data,
      termoHtml: response.termo_html || '',
    };
  }

  /**
   * Send the termination term to ZapSign for digital signature
   */
  async signTermo(token: string): Promise<{exec: boolean; sign_url?: string; pdf_url?: string}> {
    return this.post<{exec: boolean; sign_url?: string; pdf_url?: string}>(`${this.endpoint}/public/${token}/sign`);
  }

  /**
   * Save a new contract termination record
   */
  async createRescisao(data: CreateRescisaoInput): Promise<RescisaoRecord> {
    const response = await this.post<ApiResponse<RescisaoRecord>>(this.endpoint, data);
    return response.data;
  }

  /**
   * Update an existing contract termination record
   */
  async updateRescisao(id: string | number, data: UpdateRescisaoInput): Promise<RescisaoRecord> {
    const response = await this.put<ApiResponse<RescisaoRecord>>(`${this.endpoint}/${id}`, data);
    return response.data;
  }

  /**
   * Delete a contract termination record
   */
  async deleteRescisao(id: string | number): Promise<void> {
    await this.delete<void>(`${this.endpoint}/${id}`);
  }

  // Compat layer for generic API hooks if needed
  async list(params?: RescisoesListParams): Promise<PaginatedResponse<RescisaoRecord>> {
    return this.listRescisoes(params);
  }

  async getById(id: string | number): Promise<RescisaoRecord> {
    return this.getRescisao(id);
  }

  async create(data: CreateRescisaoInput): Promise<RescisaoRecord> {
    return this.createRescisao(data);
  }

  async update(id: string | number, data: UpdateRescisaoInput): Promise<RescisaoRecord> {
    return this.updateRescisao(id, data);
  }

  async delete(id: string | number): Promise<void> {
    return this.deleteRescisao(id);
  }
}

export const rescisoesService = new RescisoesService();
