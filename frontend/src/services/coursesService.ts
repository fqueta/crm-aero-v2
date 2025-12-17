import { GenericApiService } from './GenericApiService';
import { CourseRecord, CoursePayload, CoursesListParams } from '@/types/courses';
import { PaginatedResponse } from '@/types/index';

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
}

/**
 * Instância padrão exportada
 */
export const coursesService = new CoursesService();