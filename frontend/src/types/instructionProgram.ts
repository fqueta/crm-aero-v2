export interface InstructionProgramRevision {
  id: number;
  instruction_program_id: number;
  revision_code: string;
  revision_date?: string | null;
  mgr_revision?: string | null;
  mgr_date?: string | null;
  content_html?: string | null;
  contract_defaults?: Record<string, string> | null;
  change_notes?: string | null;
  edited_by_ai?: boolean;
  created_by?: string | null;
  created_at?: string;
}

export interface InstructionProgram {
  id: number;
  curso_id?: number | null;
  curso?: { id: number; nome: string } | null;
  title: string;
  slug: string;
  code?: string | null;
  current_revision: string;
  revision_date?: string | null;
  mgr_revision?: string | null;
  mgr_date?: string | null;
  status: 'draft' | 'published' | 'archived';
  is_public: boolean;
  signature_show_pi_link?: boolean;
  signature_require_pi_acceptance?: boolean;
  summary?: string | null;
  content_html?: string | null;
  contract_defaults?: Record<string, string> | null;
  revisions?: InstructionProgramRevision[];
  created_at?: string;
  updated_at?: string;
}

export interface InstructionProgramPayload {
  curso_id?: number | null;
  title: string;
  slug?: string;
  code?: string;
  current_revision?: string;
  revision_date?: string | null;
  mgr_revision?: string | null;
  mgr_date?: string | null;
  status?: 'draft' | 'published' | 'archived';
  is_public?: boolean;
  signature_show_pi_link?: boolean;
  signature_require_pi_acceptance?: boolean;
  summary?: string;
  content_html?: string;
  contract_defaults?: Record<string, string>;
  create_revision?: boolean;
  change_notes?: string;
  edited_by_ai?: boolean;
}

export interface AiEditProposal {
  assistant_reply: string;
  change_summary?: string | null;
  proposed_content_html?: string | null;
  proposed_metadata?: Record<string, any> | null;
  provider?: string;
  model?: string;
}

export interface RagSourceCitation {
  title: string;
  section?: string | null;
  revision?: string | null;
  score?: number | null;
}

export interface PublicProgramChatResponse {
  success: boolean;
  data: {
    reply: string;
    sources?: RagSourceCitation[];
    provider?: string;
  };
  message?: string;
}

export interface ContractInstitutionalDefaults {
  revisao_mgr: string;
  data_mgr: string;
  identificacao_tabela_e_criterios: string;
  data_base_tarifa: string;
  itens_incluidos: string;
  custos_adicionais: string;
  juros_e_correcao: string;
  modalidade_escala: string;
  carencia_e_data_liberacao: string;
  prazo_maximo_espera: string;
  regra_faltas_bloco: string;
  canal_escala: string;
  canal_secretaria: string;
  canal_qualidade: string;
  canal_privacidade: string;
  limite_realocacoes_ppa: string;
}
