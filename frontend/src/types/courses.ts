/**
 * Tipos de Cursos
 * pt-BR: Estruturas que representam exatamente o payload esperado pela API de cursos.
 * en-US: Structures that mirror the expected payload for the courses API.
 */

/**
 * Parâmetros de listagem de cursos
 * pt-BR: Suporta paginação, busca e filtros básicos.
 * en-US: Supports pagination, search and basic filters.
 */
export interface CoursesListParams {
  page?: number;
  per_page?: number;
  search?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  /**
   * tipo
   * pt-BR: Filtro de tipo do curso (1=Teórico, 2=Prático, 3=Teórico/Prático).
   * en-US: Course type filter (1=Theoretical, 2=Practical, 3=Both).
   */
  tipo?: string | number;
}

/**
 * Configurações da página de venda
 */
export interface CourseSalePage {
  link: string;
  label: string;
}

/**
 * Configurações adicionais (adc)
 */
export interface CourseADCConfig {
  recheck: 's' | 'n' | 'y' | 'n';
  recorrente: 's' | 'n';
  cor: string; // hex RGB sem '#'
}

/**
 * Configurações EAD
 */
export interface CourseEADConfig {
  id_eadcontrol: string;
}

/**
 * Configurações diversas do curso (config)
 */
export interface CourseConfig {
  proximo_curso: string;
  gratis: 's' | 'n';
  comissao: string; // ex: "3,00"
  tx2: Array<{ name_label: string; name_valor: string }>;
  tipo_desconto_taxa: 'v' | 'p';
  desconto_taxa: string; // ex: "10,00" ou vazio
  pagina_divulgacao: string;
  video: string; // URL do vídeo
  pagina_venda: CourseSalePage;
  adc: CourseADCConfig;
  ead: CourseEADConfig;
}

/**
 * Módulo de conteúdo do curso
 */
export interface CourseModule {
  etapa: 'etapa1' | 'etapa2' | string;
  nome: string;
  titulo: string;
  limite: string; // número em string (mantemos compatível com backend)
  valor?: string; // currency string
  aviao?: string[]; // lista de IDs de aeronaves quando aplicável
  /**
   * periodo
   * pt-BR: ID do período vinculado ao módulo (usado quando curso tipo=4).
   * en-US: Period ID linked to the module (used when course tipo=4).
   */
  periodo?: string;
}

/**
 * Payload principal de curso (criação/atualização)
 */
export interface CoursePayload {
  nome: string;
  titulo: string;
  ativo: 's' | 'n';
  destaque: 's' | 'n';
  publicar: 's' | 'n';
  duracao: string; // ex: "45"
  unidade_duracao: string; // ex: "Hrs"
  id?: string; // fornecido para atualizações
  tipo: string; // ex: "2"
  categoria: string; // ex: "cursos_online"
  token?: string; // ex: "5e31c31404efa"
  config: CourseConfig;
  inscricao: string; // currency string
  valor: string; // currency string
  /**
   * parcelas
   * pt-BR: Total de parcelas (opcional). Envie vazio quando não aplicável.
   * en-US: Total installments (optional). Send empty when not applicable.
   */
  parcelas?: string; // ex: "1"
  valor_parcela: string; // currency string
  aeronaves: string[]; // IDs de aeronaves
  modulos: CourseModule[];
}

/**
 * Registro retornado pela API (lista/detalhe)
 */
export interface CourseRecord extends CoursePayload {
  id: string; // garantir presença em listagens
}