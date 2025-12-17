import { useGenericApi } from '@/hooks/useGenericApi';
import { contentTypesService } from '@/services/contentTypesService';

/**
 * getContentTypesApi
 * pt-BR: Configura hooks genéricos para Tipos de Conteúdo.
 * en-US: Configures generic hooks for Content Types.
 */
function getContentTypesApi() {
  return useGenericApi<any, any, any, any>({
    service: contentTypesService,
    queryKey: 'contentTypes',
    entityName: 'Tipo de conteúdo',
    suppressToasts: true,
  });
}

/**
 * useContentTypesList
 * pt-BR: Lista tipos de conteúdo (para popular Select).
 * en-US: Lists content types (to populate Select).
 */
export function useContentTypesList(params?: any, queryOptions?: any) {
  const api = getContentTypesApi();
  return api.useList(params, queryOptions);
}

export const useContentTypesApi = getContentTypesApi;