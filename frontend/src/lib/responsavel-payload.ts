/**
 * responsavel-payload.ts
 * Builder centralizado para o payload de criação/atualização de responsáveis.
 * Aplica o padrão Builder — concentra a lógica de transformação de formulário
 * em payload de API em um único lugar, eliminando duplicação em
 * ProposalContractsTab.tsx e ProposalsEdit.tsx.
 */

import { QuickResponsibleFormData } from '@/components/proposals/QuickResponsibleModal';
import { phoneRemoveMask } from '@/lib/masks/phone-apply-mask';

/** Campos extras exclusivos da criação de um novo responsável. */
interface CreateExtras {
  autor?: string;
}

/**
 * Constrói o payload para criação de um novo responsável.
 * Inclui campos obrigatórios como `tipo_pessoa`, `genero` e `status`.
 */
export function buildCreateResponsavelPayload(
  data: QuickResponsibleFormData,
  extras?: CreateExtras,
): Record<string, any> {
  const config = buildConfigBlock(data);
  return {
    name: data.name,
    email: data.email || undefined,
    cpf: data.cpf.replace(/\D/g, '') || undefined,
    tipo_pessoa: 'pf',
    genero: 'ni',
    status: 'actived',
    autor: extras?.autor || undefined,
    config,
  };
}

/**
 * Constrói o payload para atualização de um responsável existente.
 * Omite campos imutáveis como `tipo_pessoa`, `genero` e `status`.
 */
export function buildUpdateResponsavelPayload(
  data: QuickResponsibleFormData,
): Record<string, any> {
  const config = buildConfigBlock(data);
  return {
    name: data.name,
    email: data.email || undefined,
    cpf: data.cpf.replace(/\D/g, '') || undefined,
    config,
  };
}

/** Bloco `config` compartilhado entre criação e atualização. */
function buildConfigBlock(data: QuickResponsibleFormData): Record<string, string | undefined> {
  const phoneClean = phoneRemoveMask(data.phone);
  const cepClean = data.cep.replace(/\D/g, '');

  return {
    celular: phoneClean || undefined,
    nacionalidade: data.nationality || undefined,
    profissao: data.profession || undefined,
    estado_civil: data.maritalStatus || undefined,
    identidade: data.identity || undefined,
    rg: data.identity || undefined,
    cep: cepClean || undefined,
    endereco: data.address || undefined,
    numero: data.number || undefined,
    complemento: data.complement || undefined,
    bairro: data.bairro || undefined,
    cidade: data.city || undefined,
    uf: data.state || undefined,
  };
}
