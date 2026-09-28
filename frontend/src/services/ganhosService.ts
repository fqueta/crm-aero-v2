import { BaseApiService } from './BaseApiService';
import { PaginatedResponse } from '@/types/index';
import { EnrollmentRecord } from '@/types/enrollments';

export interface GanhoMeta {
  data_ganho?: string | null;
  financial_gain_account_id?: string | null;
  valor_negociado_ganho?: string | number | null;
  valor_entrada_ganho?: string | number | null;
  valor_pago?: string | number | null;
  valor_recebido_ganho?: string | number | null;
  saldo_ganho?: string | number | null;
  financeiro_status_ganho?: string | null;
  observacao_ganho?: string | null;
  pagamentos_ganho?: string | null;
  [key: string]: unknown;
}

export interface GanhoRow extends EnrollmentRecord {
  cliente_nome?: string;
  curso_nome?: string;
  turma_nome?: string;
  situacao?: string;
  total?: number | string | null;
  data?: string | null;
  meta?: GanhoMeta | null;
  id_cliente?: string | number | null;
  id_curso?: string | number | null;
}

export type GanhosListParams = {
  /** Nome do aluno (mapeia p/ `student` da API) */
  student?: string;
  /** Nome/tipo do curso (mapeia p/ `course` da API) */
  course?: string;
  /** ID exato do curso (mapeia p/ `id_curso`) */
  id_curso?: number | string;
  /** Descrição da proposta (mapeia p/ `search`) */
  search?: string;
  /** Situação posts.post_name; default `mat`. Use 'all' ou '' p/ sem filtro. */
  situacao?: string;
  page?: number;
  per_page?: number;
  order_by?: string;
  order?: 'asc' | 'desc';
};

/**
 * GanhosService
 * pt-BR: Lista matrículas ganhas (`status=g`) p/ a SPA `/admin/school/ganhos`.
 * en-US: Lists won enrollments (`status=g`) for the gains SPA.
 */
class GanhosService extends BaseApiService {
  async list(params?: GanhosListParams): Promise<PaginatedResponse<GanhoRow>> {
    const { situacao, student, course, ...rest } = params ?? {};
    const query: Record<string, unknown> = {
      status: 'g',
      ...(rest as Record<string, unknown>),
    };
    // Default escolar: apenas matriculados; permite override explícito.
    if (situacao === undefined) {
      query.situacao = 'mat';
    } else if (situacao !== 'all' && situacao !== '') {
      query.situacao = situacao;
    }
    if (student) query.student = student;
    if (course) query.course = course;
    const response = await this.get<PaginatedResponse<GanhoRow> | GanhoRow[]>(
      '/matriculas',
      query as Record<string, string | number | boolean | undefined>,
    );
    return this.normalizePaginatedResponse<GanhoRow>(response);
  }
}

export const ganhosService = new GanhosService();
