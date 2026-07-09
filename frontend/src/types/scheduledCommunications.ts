import { PaginatedResponse } from '@/types/index';

/**
 * ScheduledCommunicationChannel
 * pt-BR: Canais suportados pelo módulo de agendamento.
 * en-US: Supported channels for the scheduling module.
 */
export type ScheduledCommunicationChannel = 'email' | 'manual';

/**
 * ScheduledCommunicationStatus
 * pt-BR: Status possíveis do ciclo de vida do agendamento.
 * en-US: Possible statuses for the scheduled communication lifecycle.
 */
export type ScheduledCommunicationStatus = 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';

/**
 * ScheduledCommunicationRecord
 * pt-BR: Registro retornado pela API de agendamentos.
 * en-US: Record returned by the scheduling API.
 */
export interface ScheduledCommunicationRecord {
  id: number;
  client_id?: string | null;
  matricula_id?: number | null;
  channel: ScheduledCommunicationChannel;
  provider?: string | null;
  status: ScheduledCommunicationStatus;
  recipient_name?: string | null;
  recipient_email?: string | null;
  subject?: string | null;
  message?: string | null;
  scheduled_at?: string | null;
  processed_at?: string | null;
  sent_at?: string | null;
  cancelled_at?: string | null;
  attempts?: number;
  max_attempts?: number;
  created_by?: string | null;
  provider_message_id?: string | null;
  last_error?: string | null;
  metadata?: Record<string, any> | null;
  payload?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
  client?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  } | null;
  matricula?: {
    id?: number | string;
    total?: number | string | null;
    subtotal?: number | string | null;
    cliente?: {
      id?: string;
      name?: string | null;
      email?: string | null;
    } | null;
    curso?: {
      id?: number | string;
      nome?: string | null;
      titulo?: string | null;
    } | null;
  } | null;
  creator?: {
    id?: string;
    name?: string | null;
  } | null;
}

/**
 * CreateScheduledCommunicationInput
 * pt-BR: Payload usado para criar agendamentos em lote.
 * en-US: Payload used to create scheduled communications in batch.
 */
export interface CreateScheduledCommunicationInput {
  channel: ScheduledCommunicationChannel;
  subject?: string;
  message: string;
  scheduled_at: string;
  matricula_ids: number[];
  recipient_email?: string;
  recipient_name?: string;
  signature_link?: string;
  app_url?: string;
  max_attempts?: number;
  tags?: string[];
  create_attendance_log?: boolean;
}

/**
 * ScheduledCommunicationsListParams
 * pt-BR: Filtros aceitos pela listagem do painel.
 * en-US: Accepted filters for the tracking panel list.
 */
export interface ScheduledCommunicationsListParams {
  page?: number;
  per_page?: number;
  status?: ScheduledCommunicationStatus | 'all';
  channel?: ScheduledCommunicationChannel | 'all';
  search?: string;
  scheduled_from?: string;
  scheduled_to?: string;
  matricula_id?: string;
  client_id?: string;
}

/**
 * ScheduledCommunicationListResponse
 * pt-BR: Resposta paginada da API de agendamentos.
 * en-US: Paginated response from the scheduling API.
 */
export type ScheduledCommunicationListResponse = PaginatedResponse<ScheduledCommunicationRecord>;
