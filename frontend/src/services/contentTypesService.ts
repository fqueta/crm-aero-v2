import { createGenericService } from '@/services/GenericApiService';

/**
 * contentTypesService
 * pt-BR: Serviço genérico para listar tipos de conteúdo via endpoint `/tipos-conteudo`.
 * en-US: Generic service to list content types from `/tipos-conteudo` endpoint.
 */
export const contentTypesService = createGenericService<any, any, any>('/tipos-conteudo');