/**
 * CMS Component Types
 * pt-BR: Tipos e payloads para a entidade de componentes de conteúdo (CMS).
 * en-US: Types and payloads for the CMS content components entity.
 */

/**
 * ComponentRecord
 * pt-BR: Representa um registro retornado pela API `/componentes`.
 * en-US: Represents a record returned by the `/componentes` API.
 */
export interface ComponentRecord {
  id: string; // ID como string conforme exemplo
  nome: string;
  tipo_conteudo: string; // ex.: "15"
  ordenar: string; // ex.: "67" (mantido como string para compatibilidade)
  short_code: string; // ex.: "declaracao_pi_ppa"
  id_curso: string; // ex.: "64"
  ativo: 's' | 'n'; // status: 's' (sim) | 'n' (não)
  obs: string; // HTML permitido
  atualizado?: string; // timestamp como string
  /**
   * curso_nome
   * pt-BR: Nome do curso associado, quando enviado pelo backend para facilitar exibição na listagem.
   * en-US: Associated course name, when provided by backend to ease listing rendering.
   */
  curso_nome?: string;
  /**
   * config
   * pt-BR: Estrutura opcional com dados suplementares do componente (ex.: id_curso).
   * en-US: Optional structure with component supplementary data (e.g., id_curso).
   */
  config?: { id_curso?: string | number; [key: string]: any };
  /**
   * galeria
   * pt-BR: Lista de imagens da galeria. Aceita apenas IDs (compatibilidade)
   *        ou objetos com metadados `{ id, nome?, descricao? }`.
   * en-US: Component gallery list. Accepts plain IDs (compat) or objects
   *        with metadata `{ id, nome?, descricao? }`.
   */
  galeria?: number[] | GalleryItemPayload[];
}

/**
 * GalleryItemPayload
 * pt-BR: Item da galeria com metadados opcionais enviados junto ao ID.
 * en-US: Gallery item with optional metadata sent along with the ID.
 */
export interface GalleryItemPayload {
  id: number;
  nome?: string;
  descricao?: string;
}

/**
 * CreateComponentInput
 * pt-BR: Payload para criar um novo componente.
 * en-US: Payload to create a new component.
 */
export interface CreateComponentInput {
  nome: string;
  tipo_conteudo: string;
  ordenar?: string;
  short_code: string;
  id_curso?: string;
  ativo?: 's' | 'n';
  obs?: string;
  /**
   * galeria
   * pt-BR: Lista da galeria. Aceita somente IDs ou objetos com `{ id, nome?, descricao? }`.
   * en-US: Gallery list. Accepts plain IDs or objects `{ id, nome?, descricao? }`.
   */
  galeria?: number[] | GalleryItemPayload[];
}

/**
 * UpdateComponentInput
 * pt-BR: Payload para atualizar um componente existente.
 * en-US: Payload to update an existing component.
 */
export interface UpdateComponentInput extends Partial<CreateComponentInput> {
  id?: string;
}

/**
 * ComponentsListParams
 * pt-BR: Parâmetros de listagem/consulta.
 * en-US: Listing/query parameters.
 */
export interface ComponentsListParams {
  page?: number;
  per_page?: number;
  search?: string;
  ativo?: 's' | 'n';
  id_curso?: string;
  tipo_conteudo?: string;
}