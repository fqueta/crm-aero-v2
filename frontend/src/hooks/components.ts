import { componentsService } from '@/services/componentsService';
import { useGenericApi } from '@/hooks/useGenericApi';
import { ComponentRecord, CreateComponentInput, UpdateComponentInput, ComponentsListParams } from '@/types/components';

/**
 * getComponentsApi
 * pt-BR: Configura hooks genéricos para a entidade de componentes (CMS).
 * en-US: Configures generic hooks for the CMS components entity.
 */
function getComponentsApi() {
  return useGenericApi<ComponentRecord, CreateComponentInput, UpdateComponentInput, ComponentsListParams>({
    service: componentsService,
    queryKey: 'cmsComponents',
    entityName: 'Componente',
  });
}

/**
 * useComponentsList
 * pt-BR: Lista componentes com paginação/filtros.
 * en-US: Lists components with pagination/filters.
 */
export function useComponentsList(params?: ComponentsListParams, queryOptions?: any) {
  const api = getComponentsApi();
  return api.useList(params, queryOptions);
}

/**
 * useComponentById
 * pt-BR: Busca componente por ID.
 * en-US: Fetch component by ID.
 */
export function useComponentById(id: string, queryOptions?: any) {
  const api = getComponentsApi();
  return api.useGetById(id, queryOptions);
}

/**
 * useCreateComponent
 * pt-BR: Cria novo componente.
 * en-US: Creates a new component.
 */
export function useCreateComponent(mutationOptions?: any) {
  const api = getComponentsApi();
  return api.useCreate(mutationOptions);
}

/**
 * useUpdateComponent
 * pt-BR: Atualiza componente existente.
 * en-US: Updates an existing component.
 */
export function useUpdateComponent(mutationOptions?: any) {
  const api = getComponentsApi();
  return api.useUpdate(mutationOptions);
}

/**
 * useDeleteComponent
 * pt-BR: Exclui componente por ID.
 * en-US: Deletes a component by ID.
 */
export function useDeleteComponent(mutationOptions?: any) {
  const api = getComponentsApi();
  return api.useDelete(mutationOptions);
}

/**
 * Exporta a factory para usos avançados.
 */
export const useComponentsApi = getComponentsApi;