import { ClientRecord, CreateClientInput, UpdateClientInput, ClientsListParams } from '@/types/clients';
import { responsaveisService } from '@/services/responsaveisService';
import { useGenericApi } from './useGenericApi';

/**
 * getResponsaveisApi
 * pt-BR: Expõe hooks CRUD para responsáveis usando o endpoint dedicado.
 * en-US: Exposes CRUD hooks for guardians using the dedicated endpoint.
 */
function getResponsaveisApi() {
  return useGenericApi<ClientRecord, CreateClientInput, UpdateClientInput, ClientsListParams>({
    service: responsaveisService,
    queryKey: 'responsaveis',
    entityName: 'Responsável',
    suppressToasts: true,
  });
}

/**
 * useResponsiblesList
 * pt-BR: Lista responsáveis com paginação e filtros.
 * en-US: Lists guardians with pagination and filters.
 */
export function useResponsiblesList(params?: ClientsListParams, queryOptions?: any) {
  const api = getResponsaveisApi();
  return api.useList(params, queryOptions);
}

/**
 * useResponsible
 * pt-BR: Busca um responsável pelo ID.
 * en-US: Fetches a guardian by ID.
 */
export function useResponsible(id: string, queryOptions?: any) {
  const api = getResponsaveisApi();
  return api.useGetById(id, queryOptions);
}

/**
 * useCreateResponsible
 * pt-BR: Cria um responsável via endpoint dedicado.
 * en-US: Creates a guardian via the dedicated endpoint.
 */
export function useCreateResponsible(mutationOptions?: any) {
  const api = getResponsaveisApi();
  return api.useCreate(mutationOptions);
}

export const useResponsaveisApi = getResponsaveisApi;
