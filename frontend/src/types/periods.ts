/**
 * Tipos de Períodos (posts com post_type=periodos)
 * pt-BR: Estruturas de tipos para listagem e CRUD de períodos.
 * en-US: Type structures for listing and CRUD of periods.
 */

export type PeriodStatus = 'publish' | 'draft';

/**
 * PeriodRecord
 * pt-BR: Registro retornado pela API de períodos.
 * en-US: Record returned by the periods API.
 */
export interface PeriodRecord {
  id: string | number;
  nome: string;
  slug?: string;
  id_curso?: number | string | null;
  /**
   * tipo_modulo
   * pt-BR: Tipo de módulo do período (1=Teórico, 2=Prático, 3=Teórico/Prático).
   * en-US: Period module type (1=Theoretical, 2=Practical, 3=Both).
   */
  tipo_modulo?: '1' | '2' | '3' | number | null;
  /**
   * valor
   * pt-BR: Valor associado ao período (ex.: mensalidade). Pode ser número ou string vinda da API.
   * en-US: Amount associated with the period (e.g., fee). May be number or string from API.
   */
  valor?: number | string | null;
  /**
   * id_contratos
   * pt-BR: IDs de contratos agregados ao período.
   * en-US: Aggregated contract IDs for the period.
   */
  id_contratos?: (number | string)[];
  /**
   * cursos_incluidos
   * pt-BR: IDs de cursos incluídos (seleção múltipla dinâmica).
   * en-US: Included course IDs (dynamic multi-select).
   */
  cursos_incluidos?: (number | string)[];
  /**
   * h_praticas
   * pt-BR: Horas práticas do período.
   * en-US: Practical hours for the period.
   */
  h_praticas?: number | null;
  /**
   * h_teoricas
   * pt-BR: Horas teóricas do período.
   * en-US: Theoretical hours for the period.
   */
  h_teoricas?: number | null;
  /**
   * aeronaves
   * pt-BR: IDs de aeronaves vinculadas (seleção múltipla).
   * en-US: Linked aircraft IDs (multi-select).
   */
  aeronaves?: (number | string)[];
  status: PeriodStatus;
}

/**
 * CreatePeriodInput
 * pt-BR: Payload para criar período.
 * en-US: Payload to create a period.
 */
export interface CreatePeriodInput {
  nome: string;
  slug?: string;
  id_curso?: number | string | null;
  /**
   * tipo_modulo
   * pt-BR: Tipo de módulo do período (1=Teórico, 2=Prático, 3=Teórico/Prático).
   * en-US: Period module type (1=Theoretical, 2=Practical, 3=Both).
   */
  tipo_modulo?: '1' | '2' | '3' | number | null;
  /**
   * valor
   * pt-BR: Valor opcional ao criar período.
   * en-US: Optional amount when creating a period.
   */
  valor?: number | string;
  /**
   * id_contratos
   * pt-BR: IDs de contratos agregados ao criar período.
   * en-US: Contract IDs aggregated when creating a period.
   */
  id_contratos?: (number | string)[];
  /**
   * cursos_incluidos
   * pt-BR: IDs de cursos incluídos ao criar período.
   * en-US: Included course IDs when creating a period.
   */
  cursos_incluidos?: (number | string)[];
  /**
   * h_praticas
   * pt-BR: Horas práticas ao criar período.
   * en-US: Practical hours when creating a period.
   */
  h_praticas?: number | null;
  /**
   * h_teoricas
   * pt-BR: Horas teóricas ao criar período.
   * en-US: Theoretical hours when creating a period.
   */
  h_teoricas?: number | null;
  /**
   * aeronaves
   * pt-BR: IDs de aeronaves vinculadas ao criar período.
   * en-US: Aircraft IDs linked when creating a period.
   */
  aeronaves?: (number | string)[];
  status?: PeriodStatus;
}

/**
 * UpdatePeriodInput
 * pt-BR: Payload para atualizar período.
 * en-US: Payload to update a period.
 */
export interface UpdatePeriodInput {
  nome?: string;
  slug?: string;
  id_curso?: number | string | null;
  /**
   * tipo_modulo
   * pt-BR: Tipo de módulo do período (1=Teórico, 2=Prático, 3=Teórico/Prático).
   * en-US: Period module type (1=Theoretical, 2=Practical, 3=Both).
   */
  tipo_modulo?: '1' | '2' | '3' | number | null;
  /**
   * valor
   * pt-BR: Valor opcional ao atualizar período.
   * en-US: Optional amount when updating a period.
   */
  valor?: number | string;
  /**
   * id_contratos
   * pt-BR: IDs de contratos agregados ao atualizar período.
   * en-US: Contract IDs aggregated when updating a period.
   */
  id_contratos?: (number | string)[];
  /**
   * cursos_incluidos
   * pt-BR: IDs de cursos incluídos ao atualizar período.
   * en-US: Included course IDs when updating a period.
   */
  cursos_incluidos?: (number | string)[];
  /**
   * h_praticas
   * pt-BR: Horas práticas ao atualizar período.
   * en-US: Practical hours when updating a period.
   */
  h_praticas?: number | null;
  /**
   * h_teoricas
   * pt-BR: Horas teóricas ao atualizar período.
   * en-US: Theoretical hours when updating a period.
   */
  h_teoricas?: number | null;
  /**
   * aeronaves
   * pt-BR: IDs de aeronaves vinculadas ao atualizar período.
   * en-US: Aircraft IDs linked when updating a period.
   */
  aeronaves?: (number | string)[];
  status?: PeriodStatus;
}

/**
 * SimplePeriodPayload
 * pt-BR: Payload compacto aceito pelo backend, conforme solicitado.
 *        Exemplo:
 *        {
 *          "id_curso": 128,
 *          "nome": "Primeiro Período",
 *          "slug": "primeiro-periodo",
 *          "status": "publish",
 *          "valor": 17820
 *        }
 * en-US: Compact payload accepted by backend, as requested.
 */
export interface SimplePeriodPayload {
  id_curso: number | string;
  nome: string;
  slug: string;
  status: PeriodStatus;
  valor: number | string;
}

/**
 * PeriodsListParams
 * pt-BR: Parâmetros de listagem com filtros aceitos pelo backend.
 * en-US: Listing parameters with filters accepted by the backend.
 */
export interface PeriodsListParams {
  page?: number;
  per_page?: number;
  name?: string; // filtro por nome (post_title)
  slug?: string;
  id_curso?: number | string;
  status?: PeriodStatus;
  search?: string;
}