/**
 * Tipos relacionados a contratos/termos de cursos (post_type=contratos)
 */

export type ContractStatus = 'publish' | 'draft';

/**
 * Registro de contrato retornado pela API
 */
export interface ContractRecord {
  id: string | number;
  nome: string;
  slug?: string;
  conteudo?: string;
  id_curso?: number | string | null;
  periodo?: string | null;
  ativo: ContractStatus;
}

/**
 * Payload para criar contrato
 */
export interface CreateContractInput {
  nome: string;
  slug?: string;
  conteudo?: string;
  id_curso?: number | string | null;
  periodo?: string | null;
  ativo?: ContractStatus;
}

/**
 * Payload para atualizar contrato
 */
export interface UpdateContractInput {
  nome?: string;
  slug?: string;
  conteudo?: string;
  id_curso?: number | string | null;
  periodo?: string | null;
  ativo?: ContractStatus;
}

/**
 * Filtros de listagem
 */
export interface ContractsListParams {
  page?: number;
  per_page?: number;
  name?: string;
  slug?: string;
  id_curso?: number | string;
  periodo?: string;
  ativo?: ContractStatus;
  search?: string;
}