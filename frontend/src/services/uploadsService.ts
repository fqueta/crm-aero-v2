import { UploadResponse, UploadRecord } from '@/types/uploads';
import { BaseApiService } from '@/services/BaseApiService';
import { PaginatedResponse } from '@/types';

/**
 * UploadsService
 * pt-BR: Serviço dedicado para enviar e listar uploads via endpoint `/uploads`.
 *        Implementa POST multipart (FormData) sem definir manualmente Content-Type.
 * en-US: Dedicated service to send and list uploads through `/uploads`.
 *        Implements multipart POST (FormData) without manually setting Content-Type.
 */
class UploadsService extends BaseApiService {
  /**
   * listUploads
   * pt-BR: Lista uploads com suporte a filtros (ex.: component_id).
   * en-US: Lists uploads with filter support (e.g., component_id).
   */
  async listUploads(params?: Record<string, any>): Promise<PaginatedResponse<UploadRecord>> {
    const response = await this.get<any>('/uploads', params);
    return this.normalizePaginatedResponse<UploadRecord>(response);
  }

  /**
   * getUpload
   * pt-BR: Busca um upload específico por ID.
   * en-US: Fetches a specific upload by ID.
   */
  async getUpload(id: string | number): Promise<UploadRecord> {
    const response = await this.get<any>(`/uploads/${id}`);
    const normalized = (response && typeof response === 'object' && 'data' in response)
      ? (response.data as UploadRecord)
      : (response as UploadRecord);
    return normalized;
  }

  /**
   * uploadFile
   * pt-BR: Envia um arquivo de imagem usando FormData (multipart). Campos extras podem ser enviados.
   * en-US: Sends an image file using FormData (multipart). Extra fields can be sent.
   */
  async uploadFile(file: File, extraFields?: Record<string, any>): Promise<UploadResponse> {
    const formData = new FormData();
    // Campo padrão do backend: 'arquivo'.
    // pt-BR: A API exige 'arquivo' quando 'url' não está presente.
    // en-US: The API requires 'arquivo' when 'url' is not provided.
    formData.append('arquivo', file, file.name);
    // Campos extras (ex.: component_id, descricao, ordenar, ativo)
    Object.entries(extraFields || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    // Cabeçalhos: não definir Content-Type para permitir boundary automático do FormData
    const headers: HeadersInit = {
      Accept: 'application/json',
    };
    const token = localStorage.getItem('auth_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${this.API_BASE_URL}/uploads`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return this.handleResponse<UploadResponse>(response);
  }
}

/**
 * uploadsService
 * pt-BR: Instância exportada para uso em hooks/Componentes.
 * en-US: Exported instance for hooks/Components usage.
 */
export const uploadsService = new UploadsService();