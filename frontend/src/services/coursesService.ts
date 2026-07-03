import { GenericApiService } from './GenericApiService';
import { CourseRecord, CoursePayload, CoursesListParams } from '@/types/courses';
import { PaginatedResponse } from '@/types/index';
import { CoursePeriodsFlowResponse } from '@/types/periods';


/**
 * CoursesService — serviço de CRUD para cursos
 * pt-BR: Encapsula operações no endpoint '/cursos'.
 * en-US: Encapsulates operations for the '/cursos' endpoint.
 */
class CoursesService extends GenericApiService<CourseRecord, CoursePayload, CoursePayload> {
  /**
   * Construtor
   * pt-BR: Inicializa com o endpoint base.
   * en-US: Initializes with the base endpoint.
   */
  constructor() {
    super('/cursos');
  }

  /**
   * Lista cursos com paginação e busca
   * pt-BR: Retorna resposta paginada de cursos.
   * en-US: Returns a paginated list of courses.
   */
  async listCourses(params?: CoursesListParams): Promise<PaginatedResponse<CourseRecord>> {
    return this.list(params);
  }

  /**
   * Cria um curso
   * pt-BR: Envia payload completo conforme tipos definidos.
   * en-US: Sends the full payload according to defined types.
   */
  async createCourse(data: CoursePayload): Promise<CourseRecord> {
    return this.create(data);
  }

  /**
   * Atualiza um curso existente
   */
  async updateCourse(id: string | number, data: CoursePayload): Promise<CourseRecord> {
    return this.update(id, data);
  }

  /**
   * Remove um curso por ID
   */
  async deleteCourse(id: string | number): Promise<void> {
    return this.deleteById(id);
  }

  async deleteMultipleCourses(ids: (string | number)[]): Promise<void> {
    await Promise.all(ids.map((id) => this.deleteById(id)));
  }

  /**
   * getPeriodsFlow
   * pt-BR: Busca o fluxo de períodos de um curso tipo 4, com contagem de matriculados e prontos.
   *        Aceita parâmetro opcional situacao_slug para calcular "prontos para avançar".
   * en-US: Fetches the periods flow for a tipo 4 course, with enrolled and ready counts.
   *        Accepts optional situacao_slug to compute "ready to advance" count.
   */
  async getPeriodsFlow(
    courseId: string | number,
    params?: { situacao_slug?: string }
  ): Promise<CoursePeriodsFlowResponse> {
    return this.get<CoursePeriodsFlowResponse>(`/cursos/${courseId}/periodos-flow`, params);
  }
}

/**
 * Instância padrão exportada
 */
export const coursesService = new CoursesService();