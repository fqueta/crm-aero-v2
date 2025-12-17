import { BaseApiService } from './BaseApiService';
import { ApiResponse, PaginatedResponse } from '@/types/index';
import { PeriodRecord, CreatePeriodInput, UpdatePeriodInput, PeriodsListParams, SimplePeriodPayload } from '@/types/periods';

/**
 * PeriodsService
 * pt-BR: Serviço para gerenciar períodos (post_type=periodos)
 * Endpoint base: /periodos
 * en-US: Service to manage periods (post_type=periodos)
 * Base endpoint: /periodos
 */
class PeriodsService extends BaseApiService {
  private readonly endpoint = '/periodos';

  /**
   * listPeriods
   * pt-BR: Lista períodos com paginação e filtros.
   * en-US: Lists periods with pagination and filters.
   */
  async listPeriods(params?: PeriodsListParams): Promise<PaginatedResponse<PeriodRecord>> {
    const response = await this.get<any>(this.endpoint, params);
    return this.normalizePaginatedResponse<PeriodRecord>(response);
  }

  /**
   * getById
   * pt-BR: Obtém um período por ID.
   * en-US: Gets a period by ID.
   */
  async getById(id: string | number): Promise<PeriodRecord | null> {
    const response = await this.get<any>(`${this.endpoint}/${id}`);
    // Normaliza casos onde a API retorna `{ data: obj }` ou `obj` diretamente
    const normalized = (response && typeof response === 'object' && 'data' in response)
      ? (response.data as PeriodRecord)
      : (response as PeriodRecord);
    return normalized ?? null;
  }

  /**
   * createPeriod
   * pt-BR: Cria um novo período.
   * en-US: Creates a new period.
   */
  async createPeriod(payload: CreatePeriodInput): Promise<PeriodRecord> {
    const response = await this.post<ApiResponse<PeriodRecord>>(this.endpoint, payload);
    return response.data;
  }

  /**
   * createPeriodRaw
   * pt-BR: Cria período aceitando o payload compacto solicitado (id_curso, nome, slug, status, valor).
   *        Para compatibilidade com leituras como `$item->config['id_curso']`, espelhamos `id_curso` dentro de `config`.
   * en-US: Creates a period accepting the requested compact payload. Mirrors `id_curso` under `config` for compatibility.
   */
  async createPeriodRaw(payload: SimplePeriodPayload): Promise<PeriodRecord> {
    const data: any = {
      id_curso: payload.id_curso,
      nome: payload.nome,
      slug: payload.slug,
      status: payload.status,
      valor: payload.valor,
      // Compatibilidade: alguns backends esperam id_curso também em config
      config: { id_curso: payload.id_curso, valor: payload.valor },
    };
    const response = await this.post<ApiResponse<PeriodRecord>>(this.endpoint, data);
    return response.data;
  }

  /**
   * updatePeriod
   * pt-BR: Atualiza um período existente.
   * en-US: Updates an existing period.
   */
  async updatePeriod(id: string | number, payload: UpdatePeriodInput): Promise<PeriodRecord> {
    const response = await this.put<ApiResponse<PeriodRecord>>(`${this.endpoint}/${id}`, payload);
    return response.data;
  }

  /**
   * updatePeriodRaw
   * pt-BR: Atualiza período aceitando o payload compacto. Mantém espelho de `id_curso` em `config` quando fornecido.
   * en-US: Updates a period using the compact payload. Mirrors `id_curso` under `config` when provided.
   */
  async updatePeriodRaw(id: string | number, payload: Partial<SimplePeriodPayload>): Promise<PeriodRecord> {
    const data: any = { ...payload };
    if (payload.id_curso !== undefined) {
      data.config = { ...(data.config || {}), id_curso: payload.id_curso };
    }
    if (payload.valor !== undefined) {
      data.config = { ...(data.config || {}), valor: payload.valor };
    }
    const response = await this.put<ApiResponse<PeriodRecord>>(`${this.endpoint}/${id}`, data);
    return response.data;
  }

  /**
   * deletePeriod
   * pt-BR: Remove um período.
   * en-US: Deletes a period.
   */
  async deletePeriod(id: string | number): Promise<void> {
    await this.delete<void>(`${this.endpoint}/${id}`);
  }

  /**
   * list
   * pt-BR: Wrapper genérico para compatibilidade com useGenericApi.
   * en-US: Generic wrapper for compatibility with useGenericApi.
   */
  async list(params?: PeriodsListParams): Promise<PaginatedResponse<PeriodRecord>> {
    return this.listPeriods(params);
  }

  // Removido método duplicado getById (o acima já cobre ambos os casos)

  /**
   * create
   * pt-BR: Wrapper genérico para criar período.
   * en-US: Generic wrapper to create a period.
   */
  async create(payload: CreatePeriodInput): Promise<PeriodRecord> {
    return this.createPeriod(payload);
  }

  /**
   * update
   * pt-BR: Wrapper genérico para atualizar período.
   * en-US: Generic wrapper to update a period.
   */
  async update(id: string, payload: UpdatePeriodInput): Promise<PeriodRecord> {
    return this.updatePeriod(id, payload);
  }

  /**
   * deleteById
   * pt-BR: Wrapper genérico para excluir período por ID.
   * en-US: Generic wrapper to delete a period by ID.
   */
  async deleteById(id: string): Promise<void> {
    await this.deletePeriod(id);
  }
}

export const periodsService = new PeriodsService();