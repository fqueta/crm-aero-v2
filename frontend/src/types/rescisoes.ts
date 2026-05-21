export interface RescisaoRecord {
  id?: string | number;
  matricula_id: string | number;
  data_rescisao: string;
  valor_pago: number;
  valor_matricula: number;
  valor_inicial: number;
  horas_compradas: number;
  horas_voadas: number;
  multa_rescisoria: number;
  dias_alojamento: number;
  preco_diaria: number;
  valor_alojamento: number;
  saldo_final: number;
  config?: {
    aeronaves?: Array<{
      aeronave_id: number | string;
      nome: string;
      hora_rescisao: number;
      quantidade: number;
      total: number;
    }>;
    [key: string]: any;
  };
  obs?: string;
  matricula?: {
    id: string | number;
    student_name?: string;
    course_name?: string;
    cliente?: {
      name: string;
      [key: string]: any;
    };
    curso?: {
      nome: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  created_at?: string;
  updated_at?: string;
}

export interface CreateRescisaoInput extends Omit<RescisaoRecord, 'id' | 'created_at' | 'updated_at'> {}
export interface UpdateRescisaoInput extends Partial<CreateRescisaoInput> {}

export interface RescisoesListParams {
  page?: number;
  per_page?: number;
  search?: string;
  [key: string]: any;
}
