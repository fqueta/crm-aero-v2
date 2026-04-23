import { EnrollmentRecord, CreateEnrollmentInput, UpdateEnrollmentInput, EnrollmentsListParams } from '@/types/enrollments';
import { enrollmentsService } from '@/services/enrollmentsService';
import { useGenericApi } from './useGenericApi';
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * getEnrollmentsApi
 * pt-BR: Fornece hooks genéricos para CRUD de matrículas via React Query.
 * en-US: Provides generic CRUD hooks for enrollments via React Query.
 */
function getEnrollmentsApi() {
  return useGenericApi<EnrollmentRecord, CreateEnrollmentInput, UpdateEnrollmentInput, EnrollmentsListParams>({
    service: enrollmentsService,
    queryKey: 'enrollments',
    entityName: 'Matrícula',
    suppressToasts: true,
  });
}

/**
 * useEnrollmentsList
 * pt-BR: Lista de matrículas com suporte a paginação e filtros.
 * en-US: Enrollment list with pagination and filters.
 */
export function useEnrollmentsList(params?: EnrollmentsListParams, queryOptions?: any) {
  const api = getEnrollmentsApi();
  return api.useList(params, queryOptions);
}

export function useEnrollment(id: string, queryOptions?: any) {
  const api = getEnrollmentsApi();
  return api.useGetById(id, queryOptions);
}

export function useCreateEnrollment(mutationOptions?: any) {
  const api = getEnrollmentsApi();
  return api.useCreate(mutationOptions);
}

export function useUpdateEnrollment(mutationOptions?: any) {
  const api = getEnrollmentsApi();
  return api.useUpdate(mutationOptions);
}

export function useDeleteEnrollment(mutationOptions?: any) {
  const api = getEnrollmentsApi();
  return api.useDelete(mutationOptions);
}

/**
 * useUpdateEnrollmentStatus
 * pt-BR: Atualiza rapidamente o status da matrícula e invalida caches relacionados.
 * en-US: Quickly updates enrollment status and invalidates related caches.
 */
export function useUpdateEnrollmentStatus(mutationOptions?: any) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      loss_date,
      loss_reason,
      loss_observation,
    }: {
      id: string;
      status: 'a' | 'g' | 'p';
      loss_date?: string;
      loss_reason?: string;
      loss_observation?: string;
    }) =>
      enrollmentsService.updateEnrollmentStatus(id, { status, loss_date, loss_reason, loss_observation }),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['enrollments', 'detail', variables.id] });
      mutationOptions?.onSuccess?.(data, variables, undefined);
    },
    onError: (error, variables) => {
      mutationOptions?.onError?.(error, variables, undefined);
    },
  });
}

export const useEnrollmentsApi = getEnrollmentsApi;
