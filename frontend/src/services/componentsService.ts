import { createGenericService } from '@/services/GenericApiService';
import { ComponentRecord, CreateComponentInput, UpdateComponentInput } from '@/types/components';

/**
 * ComponentsService
 * pt-BR: Serviço genérico para CRUD de componentes de conteúdo (CMS) no endpoint `/componentes`.
 * en-US: Generic service for CMS content components CRUD at `/componentes` endpoint.
 */
export const componentsService = createGenericService<ComponentRecord, CreateComponentInput, UpdateComponentInput>('/componentes');