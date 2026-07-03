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

/**
 * PeriodEnrolledStudent
 * pt-BR: Representa um aluno matriculado em um período específico (tipo 4).
 * en-US: Represents a student enrolled in a specific period (tipo 4 course).
 */
export interface PeriodEnrolledStudent {
  matricula_id: number;
  aluno_id: string;
  aluno_nome: string;
  /** status CRM: 'a'=Atendimento, 'g'=Ganho, 'p'=Perda */
  status: 'a' | 'g' | 'p';
  situacao_slug?: string | null;
  situacao_label?: string | null;
  /** True quando a situação da matrícula coincide com a situação de avanço configurada */
  pronto_para_avancar: boolean;
  data?: string | null;
  proximo_periodo_id?: number | null;
  proximo_periodo_nome?: string | null;
  ja_matriculado_no_proximo: boolean;
}

/**
 * PeriodEnrolledStudentsResponse
 * pt-BR: Resposta do endpoint GET /periodos/{id}/alunos-matriculados.
 * en-US: Response from GET /periodos/{id}/alunos-matriculados endpoint.
 */
export interface PeriodEnrolledStudentsResponse {
  periodo: PeriodRecord;
  situacao_avancar?: { slug: string; label: string } | null;
  matriculados: PeriodEnrolledStudent[];
  total: number;
  prontos_para_avancar: number;
}

/**
 * CoursePeriodsFlowItem
 * pt-BR: Resumo de um período no fluxo do curso (para o Controle de Formação).
 * en-US: Summary of a period in the course flow (for Formation Control).
 */
export interface CoursePeriodsFlowItem {
  id: number;
  nome: string;
  menu_order: number;
  valor?: number | string | null;
  h_praticas?: number | null;
  h_teoricas?: number | null;
  status: PeriodStatus;
  total_matriculados: number;
  prontos_para_avancar: number;
}

/**
 * CoursePeriodsFlowResponse
 * pt-BR: Resposta do endpoint GET /cursos/{id}/periodos-flow.
 * en-US: Response from GET /cursos/{id}/periodos-flow endpoint.
 */
export interface CoursePeriodsFlowResponse {
  curso_id: number;
  curso_nome: string;
  periodos: CoursePeriodsFlowItem[];
}