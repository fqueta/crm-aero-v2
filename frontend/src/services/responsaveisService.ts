import { createGenericService } from './GenericApiService';
import { ClientRecord, CreateClientInput, UpdateClientInput } from '@/types/clients';

/**
 * responsaveisService
 * pt-BR: Serviço para consumir o CRUD de responsáveis usando o endpoint dedicado `/responsaveis`.
 * en-US: Service to consume guardian CRUD using the dedicated `/responsaveis` endpoint.
 */
export const responsaveisService = createGenericService<ClientRecord, CreateClientInput, UpdateClientInput>('/responsaveis');
