import { BaseApiService } from '@/services/BaseApiService';

export interface ProposalData {
  id: number;
  id_cliente: string;
  id_matricula: number;
  curso_nome: string;
  turma_nome: string;
  total: number;
  is_expired?: boolean;
  valid_until?: string | null;
  expiration_message?: string | null;
  validity_days?: number;
  config?: any; // Matricula config
  meta?: {
      contrato_pdf?: Array<{
          nome_arquivo: string;
          url: string;
          url_pdf?: string;
          nome_contrato: string;
      }>;
      [key: string]: any;
  };
  cliente: {
    id: string;
    name: string;
    email: string;
    cpf: string;
    celular?: string;
    nascimento?: string;
    config?: any;
    sexo?: string;
    genero?: string;
    pais_origem?: string;
    enderecos?: any;
  };
}

export interface SignProposalData {
  name: string;
  email: string;
  cpf: string;
  celular: string;
  nascimento: string;
  pais_origem?: string;
  canac?: string;
  identidade?: string;
  cep?: string;
  endereco?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  estado?: string;
  nacionalidade?: string;
  profissao?: string;
  sexo?: string;
  altura?: number;
  peso?: number;
  foi_transferido?: boolean;
  cma_em_dia?: boolean;
  classe_cma?: string;
  possui_banca?: boolean;
  aluno_ciente_taxa_manutencao_alojamento?: boolean;
  aluno_ciente_hora_seca?: boolean;
  aluno_ciente_headset?: boolean;
  aluno_ciente_prazo_estimado?: boolean;
  aluno_ciente_limite_c150?: boolean;
  aluno_ciente_documentacao_ground_school?: boolean;
  aluno_ciente_uniforme?: boolean;
}

class ProposalService extends BaseApiService {
  async getProposal(clientId: string, matriculaId: string): Promise<ProposalData> {
    return this.get<ProposalData>(`/proposal/${clientId}/${matriculaId}`);
  }

  async signProposal(clientId: string, matriculaId: string, data: SignProposalData) {
    return this.post(`/proposal/${clientId}/${matriculaId}/sign`, data);
  }

  async approveProposal(clientId: string, matriculaId: string, data: Partial<SignProposalData> = {}) {
    return this.post(`/proposal/${clientId}/${matriculaId}/approve`, data);
  }

  async getContractsHtml(clientId: string, matriculaId: string) {
    return this.get<any[]>(`/proposal/${clientId}/${matriculaId}/contracts-html`);
  }

  async generateContracts(clientId: string, matriculaId: string) {
    // pt-BR: Endpoint de geração de contratos/propostas. force=1 garante a recriação.
    return this.get(`/pdf/matriculas/${matriculaId}?generate_proposal=1&force=1`);
  }

  async sendToZapsign(matriculaId: string) {
    // pt-BR: Envia os documentos atuais para assinatura.
    return this.get(`/pdf/matriculas/${matriculaId}?send_zapsign=1`);
  }

  async generateResponsibleContracts(matriculaId: string) {
    return this.post(`/matriculas/${matriculaId}/gerar-contratos-responsavel`, {});
  }

  async sendResponsibleToZapsign(matriculaId: string) {
    return this.post(`/matriculas/${matriculaId}/enviar-zapsign-responsavel`, {});
  }

  async testSendSignatureLinksToZapguru(matriculaId: string, tkPeriodo?: string) {
    // pt-BR: Dispara manualmente o envio dos links já gerados pelo ZapSign para o Zapguru.
    return this.post(`/matriculas/${matriculaId}/testar-envio-link-assinatura-zapguru`, tkPeriodo ? { tk_periodo: tkPeriodo } : {});
  }
}

export const proposalService = new ProposalService();
