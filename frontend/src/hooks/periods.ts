import { useGenericApi } from '@/hooks/useGenericApi';
import { periodsService } from '@/services/periodsService';
import { PeriodRecord, CreatePeriodInput, UpdatePeriodInput, PeriodsListParams } from '@/types/periods';

/**
 * getPeriodsApi
 * pt-BR: Retorna uma API de hooks baseada em useGenericApi para períodos.
 * en-US: Returns a hooks API based on useGenericApi for periods.
 */
function getPeriodsApi() {
  return useGenericApi<PeriodRecord, CreatePeriodInput, UpdatePeriodInput, PeriodsListParams>({
    service: periodsService,
    queryKey: 'periods',
    entityName: 'Período',
  });
}

/**
 * usePeriodsList
 * pt-BR: Lista períodos com filtros e opções de consulta.
 * en-US: Lists periods with filters and query options.
 */
export function usePeriodsList(params?: PeriodsListParams, queryOptions?: any) {
  const api = getPeriodsApi();
  return api.useList(params, queryOptions);
}

/**
 * usePeriod
 * pt-BR: Obtém detalhes de um período por ID.
 * en-US: Fetches period details by ID.
 */
export function usePeriod(id: string, queryOptions?: any) {
  const api = getPeriodsApi();
  return api.useDetail(id, queryOptions);
}

/**
 * useCreatePeriod
 * pt-BR: Cria um novo período.
 * en-US: Creates a new period.
 */
export function useCreatePeriod(mutationOptions?: any) {
  const api = getPeriodsApi();
  return api.useCreate(mutationOptions);
}

/**
 * useUpdatePeriod
 * pt-BR: Atualiza um período existente.
 * en-US: Updates an existing period.
 */
export function useUpdatePeriod(mutationOptions?: any) {
  const api = getPeriodsApi();
  return api.useUpdate(mutationOptions);
}

/**
 * useDeletePeriod
 * pt-BR: Exclui um período pelo ID.
 * en-US: Deletes a period by ID.
 */
export function useDeletePeriod(mutationOptions?: any) {
  const api = getPeriodsApi();
  return api.useDelete(mutationOptions);
}

/**
 * usePeriodsApi
 * pt-BR: Acesso direto à API genérica de períodos (uso avançado).
 * en-US: Direct access to periods generic API (advanced usage).
 */
export const usePeriodsApi = getPeriodsApi;