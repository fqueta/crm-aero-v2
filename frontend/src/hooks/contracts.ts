import { useGenericApi } from '@/hooks/useGenericApi';
import { contractsService } from '@/services/contractsService';
import { ContractRecord, CreateContractInput, UpdateContractInput, ContractsListParams } from '@/types/contracts';

/**
 * getContractsApi
 * pt-BR: Configura hooks genéricos para a entidade de contratos.
 * en-US: Configures generic hooks for the contracts entity.
 */
function getContractsApi() {
  return useGenericApi<ContractRecord, CreateContractInput, UpdateContractInput, ContractsListParams>({
    service: contractsService,
    queryKey: 'contracts',
    entityName: 'Contrato',
  });
}

/**
 * useContractsList
 * pt-BR: Lista contratos com paginação e filtros.
 * en-US: Lists contracts with pagination and filters.
 */
export function useContractsList(params?: ContractsListParams, queryOptions?: any) {
  const api = getContractsApi();
  const safeQueryOptions = {
    retry: (failureCount: number, error: any) => {
      if (error?.status === 404 || (error?.status >= 400 && error?.status < 500)) {
        return false;
      }
      return failureCount < 1;
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: false,
    ...queryOptions,
  };
  return api.useList(params, safeQueryOptions);
}

/**
 * useContract
 * pt-BR: Obtém detalhes de um contrato por ID.
 * en-US: Gets contract details by ID.
 */
export function useContract(id: string | number, queryOptions?: any) {
  const api = getContractsApi();
  return api.useGetById(String(id), queryOptions);
}

/**
 * useCreateContract
 * pt-BR: Cria um novo contrato.
 * en-US: Creates a new contract.
 */
export function useCreateContract(mutationOptions?: any) {
  const api = getContractsApi();
  return api.useCreate(mutationOptions);
}

/**
 * useUpdateContract
 * pt-BR: Atualiza um contrato existente.
 * en-US: Updates an existing contract.
 */
export function useUpdateContract(mutationOptions?: any) {
  const api = getContractsApi();
  return api.useUpdate(mutationOptions);
}

/**
 * useDeleteContract
 * pt-BR: Remove (soft-delete) um contrato.
 * en-US: Removes (soft-delete) a contract.
 */
export function useDeleteContract(mutationOptions?: any) {
  const api = getContractsApi();
  return api.useDelete(mutationOptions);
}

/**
 * useContractsApi
 * pt-BR: Exporta a API genérica para uso avançado.
 * en-US: Exports the generic API for advanced usage.
 */
export const useContractsApi = getContractsApi;