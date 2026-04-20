import { BaseApiService } from '@/services/BaseApiService';

export interface ProposalData {
  id: number;
  id_cliente: string;
  id_matricula: number;
  curso_nome: string;
  turma_nome: string;
  total: number;
  config?: any; // Matricula config
  meta?: {
      contrato_pdf?: Array<{
          nome_arquivo: string;
          url: string;
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
}

class ProposalService extends BaseApiService {
  async getProposal(clientId: string, matriculaId: string): Promise<ProposalData> {
    return this.get<ProposalData>(`/proposal/${clientId}/${matriculaId}`);
  }

  async signProposal(clientId: string, matriculaId: string, data: SignProposalData) {
    return this.post(`/proposal/${clientId}/${matriculaId}/sign`, data);
  }

  async approveProposal(clientId: string, matriculaId: string) {
    return this.post(`/proposal/${clientId}/${matriculaId}/approve`, {});
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
}

export const proposalService = new ProposalService();
