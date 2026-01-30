import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { eventLogsService, EventLogsListParams, EventLogRecord } from '@/services/eventLogsService';

/**
 * useEventLogsList
 * pt-BR: Lista logs por entidade e paginação.
 * en-US: Lists logs by entity with pagination.
 */
export function useEventLogsList(params?: EventLogsListParams) {
  return useQuery({
    queryKey: ['event-logs', params],
    queryFn: () => eventLogsService.listEventLogs(params),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/**
 * useCreateEventLog
 * pt-BR: Registra novo log de evento.
 * en-US: Registers a new event log.
 */
export function useCreateEventLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Omit<EventLogRecord, 'id' | 'created_at' | 'updated_at'>) =>
      eventLogsService.createEventLog(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event-logs'] });
    },
  });
}
