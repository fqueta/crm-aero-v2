import { EnrollmentRecord, CreateEnrollmentInput, UpdateEnrollmentInput, EnrollmentsListParams } from '@/types/enrollments';
import { enrollmentsService } from '@/services/enrollmentsService';
import { useGenericApi } from './useGenericApi';
import { useMutation, useQueryClient, UseMutationOptions, UseQueryOptions } from '@tanstack/react-query';
import { PaginatedResponse } from '@/types';

/**
 * useEnrollmentsApiInternal
 * pt-BR: Fornece hooks genéricos para CRUD de matrículas via React Query.
 * en-US: Provides generic CRUD hooks for enrollments via React Query.
 */
function useEnrollmentsApiInternal() {
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
export function useEnrollmentsList(
  params?: EnrollmentsListParams,
  queryOptions?: Omit<UseQueryOptions<PaginatedResponse<EnrollmentRecord>>, 'queryKey' | 'queryFn'>
) {
  const api = useEnrollmentsApiInternal();
  return api.useList(params, queryOptions);
}

export function useEnrollment(
  id: string,
  queryOptions?: Omit<UseQueryOptions<EnrollmentRecord>, 'queryKey' | 'queryFn'>
) {
  const api = useEnrollmentsApiInternal();
  return api.useGetById(id, queryOptions);
}

export function useCreateEnrollment(mutationOptions?: UseMutationOptions<EnrollmentRecord, Error, CreateEnrollmentInput>) {
  const api = useEnrollmentsApiInternal();
  return api.useCreate(mutationOptions);
}

export function useUpdateEnrollment(
  mutationOptions?: UseMutationOptions<EnrollmentRecord, Error, { id: string; data: UpdateEnrollmentInput }>
) {
  const api = useEnrollmentsApiInternal();
  return api.useUpdate(mutationOptions);
}

export function useDeleteEnrollment(mutationOptions?: UseMutationOptions<void, Error, string>) {
  const api = useEnrollmentsApiInternal();
  return api.useDelete(mutationOptions);
}

/**
 * useUpdateEnrollmentStatus
 * pt-BR: Atualiza rapidamente o status da matrícula e invalida caches relacionados.
 * en-US: Quickly updates enrollment status and invalidates related caches.
 */
type UpdateEnrollmentStatusVariables = {
  id: string;
  status: 'a' | 'g' | 'p';
  gain_date?: string;
  negotiated_amount?: string;
  paid_amount?: string;
  gain_observation?: string;
  loss_date?: string;
  loss_reason?: string;
  loss_observation?: string;
};

export function useUpdateEnrollmentStatus(
  mutationOptions?: UseMutationOptions<EnrollmentRecord, Error, UpdateEnrollmentStatusVariables>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      gain_date,
      negotiated_amount,
      paid_amount,
      gain_observation,
      loss_date,
      loss_reason,
      loss_observation,
    }: UpdateEnrollmentStatusVariables) =>
      enrollmentsService.updateEnrollmentStatus(id, {
        status,
        gain_date,
        negotiated_amount,
        paid_amount,
        gain_observation,
        loss_date,
        loss_reason,
        loss_observation,
      }),
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

export const useEnrollmentsApi = useEnrollmentsApiInternal;
