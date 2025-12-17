import { BaseApiService } from './BaseApiService';
import { ApiResponse, PaginatedResponse } from '@/types/index';
import { ContractRecord, CreateContractInput, UpdateContractInput, ContractsListParams } from '@/types/contracts';

/**
 * Serviço para gerenciar contratos/termos de cursos
 * Endpoint base: /contratos
 */
class ContractsService extends BaseApiService {
  private readonly endpoint = '/contratos';

  /**
   * Lista contratos com paginação e filtros
   * @param params Parâmetros de listagem
   */
  async listContracts(params?: ContractsListParams): Promise<PaginatedResponse<ContractRecord>> {
    const response = await this.get<any>(this.endpoint, params);
    return this.normalizePaginatedResponse<ContractRecord>(response);
  }

  /**
   * Obtém um contrato por ID
   * @param id ID do contrato
   */
  async getContract(id: string | number): Promise<ContractRecord> {
    // Suporta APIs que retornam objeto direto ou envelope { data }
    const response = await this.get<any>(`${this.endpoint}/${id}`);
    return (response?.data ?? response) as ContractRecord;
  }

  /**
   * Cria um novo contrato
   * @param data Dados do contrato
   */
  async createContract(data: CreateContractInput): Promise<ContractRecord> {
    const response = await this.post<ApiResponse<ContractRecord>>(this.endpoint, data);
    return response.data;
  }

  /**
   * Atualiza um contrato existente
   * @param id ID do contrato
   * @param data Dados atualizados
   */
  async updateContract(id: string | number, data: UpdateContractInput): Promise<ContractRecord> {
    const response = await this.put<ApiResponse<ContractRecord>>(`${this.endpoint}/${id}`, data);
    return response.data;
  }

  /**
   * Remove (soft delete) um contrato
   * @param id ID do contrato
   */
  async deleteContract(id: string | number): Promise<void> {
    await this.delete(`${this.endpoint}/${id}`);
  }

  // Métodos de conveniência para compatibilidade com useGenericApi
  async list(params?: ContractsListParams): Promise<PaginatedResponse<ContractRecord>> {
    return this.listContracts(params);
  }

  async getById(id: string | number): Promise<ContractRecord> {
    return this.getContract(id);
  }

  async create(data: CreateContractInput): Promise<ContractRecord> {
    return this.createContract(data);
  }

  async update(id: string | number, data: UpdateContractInput): Promise<ContractRecord> {
    return this.updateContract(id, data);
  }

  async deleteById(id: string | number): Promise<void> {
    return this.deleteContract(id);
  }
}

export const contractsService = new ContractsService();