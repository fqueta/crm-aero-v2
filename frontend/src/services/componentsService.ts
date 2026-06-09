import { GenericApiService } from './GenericApiService';
import { ComponentRecord, CreateComponentInput, UpdateComponentInput } from '@/types/components';

/**
 * ComponentsService — CRUD de componentes de conteúdo (CMS)
 * pt-BR: Serviço para operações no endpoint `/componentes`.
 * en-US: Service for operations at the `/componentes` endpoint.
 */
class ComponentsService extends GenericApiService<ComponentRecord, CreateComponentInput, UpdateComponentInput> {
  constructor() {
    super('/componentes');
  }

  /**
   * deleteMultipleComponents
   * pt-BR: Exclui múltiplos componentes em paralelo.
   * en-US: Deletes multiple components in parallel.
   */
  async deleteMultipleComponents(ids: (string | number)[]): Promise<void> {
    await Promise.all(ids.map((id) => this.deleteById(id)));
  }
}

export const componentsService = new ComponentsService();