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
}

export const proposalService = new ProposalService();
