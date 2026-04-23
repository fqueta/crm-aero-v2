import { ClientRecord, CreateClientInput, UpdateClientInput, ClientsListParams } from '@/types/clients';
import { clientsService } from '@/services/clientsService';
import { useGenericApi } from './useGenericApi';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ClientAttendancesListParams, ClientAttendanceRecord, CreateClientAttendanceInput } from '@/types/attendance';

/**
 * Função para obter os hooks de clientes
 */
function getClientsApi() {
  return useGenericApi<ClientRecord, CreateClientInput, UpdateClientInput, ClientsListParams>({
    service: clientsService,
    queryKey: 'clients',
    entityName: 'Cliente',
    // Suprime toasts internos do hook genérico para evitar duplicação,
    // pois os componentes de Cliente já gerenciam seus próprios toasts.
    suppressToasts: true
  });
}

// Exporta os hooks individuais para manter compatibilidade
export function useClientsList(params?: ClientsListParams, queryOptions?: any) {
  const api = getClientsApi();
  return api.useList(params, queryOptions);
}

export function useClient(id: string, queryOptions?: any) {
  const api = getClientsApi();
  return api.useGetById(id, queryOptions);
}

export function useClientById(id: string, queryOptions?: any) {
  const api = getClientsApi();
  return api.useGetById(id, queryOptions);
}

export function useCreateClient(mutationOptions?: any) {
  const api = getClientsApi();
  return api.useCreate(mutationOptions);
}

export function useUpdateClient(mutationOptions?: any) {
  const api = getClientsApi();
  return api.useUpdate(mutationOptions);
}

export function useDeleteClient(mutationOptions?: any) {
  const api = getClientsApi();
  return api.useDelete(mutationOptions);
}

// Exporta função para uso avançado
export const useClientsApi = getClientsApi;

/**
 * useClientAttendances
 * pt-BR: Lista os atendimentos registrados para um cliente específico.
 * en-US: Lists attendance records registered for a specific client.
 */
export function useClientAttendances(clientId: string, params?: ClientAttendancesListParams, queryOptions?: any) {
  return useQuery({
    queryKey: ['clients', 'attendances', clientId, params],
    queryFn: () => clientsService.listAttendances(clientId, params),
    enabled: !!clientId,
    ...queryOptions,
  });
}

/**
 * useRegisterClientAttendance
 * pt-BR: Registra um novo atendimento para o cliente e invalida a listagem relacionada.
 * en-US: Registers a new client attendance and invalidates the related list.
 */
export function useRegisterClientAttendance(mutationOptions?: any) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, data }: { clientId: string; data: CreateClientAttendanceInput }) =>
      clientsService.registerAttendance(clientId, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['clients', 'attendances', variables.clientId] });
      queryClient.invalidateQueries({ queryKey: ['clients', 'detail', variables.clientId] });
      mutationOptions?.onSuccess?.(data, variables, undefined);
    },
    onError: (error: Error, variables: { clientId: string; data: CreateClientAttendanceInput }) => {
      mutationOptions?.onError?.(error, variables, undefined);
    },
  });
}

/**
 * Hook para restaurar cliente (soft delete)
 * Realiza PATCH em `/clients/{id}/restore` e atualiza caches relacionados.
 */
export function useRestoreClient(mutationOptions?: any) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => clientsService.restore(id),
    onSuccess: (data, id) => {
      // Invalida lista e detalhe do cliente restaurado
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['clients', 'detail', id] });
      toast.success('Cliente restaurado com sucesso!');
      mutationOptions?.onSuccess?.(data, id, undefined);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao restaurar cliente: ${error.message}`);
      mutationOptions?.onError?.(error, undefined as any, undefined);
    },
    ...mutationOptions,
  });
}
