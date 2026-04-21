/**
 * useContractsMeta.ts
 * Hook customizado para processar os metadados da matrícula relacionados
 * a documentos, assinaturas e ZapSign. Extrai 160 linhas de useMemo do
 * ProposalContractsTab, separando a lógica de negócio da camada de UI.
 *
 * Padrão aplicado: Custom Hook (encapsulamento de lógica com estado/efeito).
 */

import { useMemo } from 'react';

// ──────────────────────────────────────────────────────────────────────────────
// Tipos
// ──────────────────────────────────────────────────────────────────────────────

export interface PdfItem {
  name: string;
  url: string;
  original?: any;
}

export interface SentDoc {
  name: string;
  url: string;
  signer?: any;
}

export interface LocalExtraDoc {
  nome: string;
  link: string;
}

export interface ContractsMetaResult {
  /** PDFs do aluno a serem enviados para assinatura */
  pdfsToSend: PdfItem[];
  /** Signatários já enviados (aluno) */
  sentDocs: SentDoc[];
  /** Contratos parseados (para edição) */
  rawParsedContracts: any[];
  /** Documento ZapSign do aluno */
  zapsignDoc: any;
  /** URL do arquivo assinado localmente (aluno) */
  localSignedUrl: string;
  /** Documentos extras assinados individualmente */
  localExtraDocs: LocalExtraDoc[];
  /** PDFs do responsável financeiro */
  pdfsToSendResp: PdfItem[];
  /** Signatários já enviados (responsável) */
  sentDocsResp: SentDoc[];
  /** Documento ZapSign do responsável */
  zapsignDocResp: any;
  /** URL do arquivo assinado localmente (responsável) */
  localSignedUrlResp: string;
  /** Indica se o ZapSign do responsável foi iniciado */
  hasZapsignResp: boolean;
}

// ──────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ──────────────────────────────────────────────────────────────────────────────

/** Faz parse seguro de um campo que pode ser string JSON ou objeto. */
function safeParse(value: unknown): any {
  if (!value) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return value;
}

/** Normaliza um valor para sempre retornar um array de itens. */
function toArray(value: unknown): any[] {
  const parsed = safeParse(value);
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === 'object' && parsed !== null) return Object.values(parsed);
  return [parsed];
}

/** Extrai PDFs de um campo de meta (proposta_pdf ou contrato_pdf). */
function extractPdfs(raw: unknown, fallbackName: string): PdfItem[] {
  if (!raw) return [];
  const str = typeof raw === 'string' ? raw : null;

  // Caso simples: URL direta
  if (str && (str.startsWith('http') || str.startsWith('/storage'))) {
    return [{ name: fallbackName, url: str, original: { type: 'proposal' } }];
  }

  const items = toArray(raw);
  return items
    .filter((item: any) => item?.url)
    .map((item: any) => ({
      name: item.nome_contrato || item.nome_arquivo || fallbackName,
      url: item.url,
      original: item,
    }));
}

/** Extrai signatários com link de assinatura do documento ZapSign. */
function extractSigners(signers: unknown, namePrefix = 'Link Assinatura'): SentDoc[] {
  if (!Array.isArray(signers)) return [];
  return signers
    .filter((s: any) => s.sign_url || s.signing_link)
    .map((s: any) => ({
      name: `${namePrefix}: ${s.name}`,
      url: s.sign_url || s.signing_link,
      signer: s,
    }));
}

/** Lê os links assinados localmente do meta. */
function extractLocalLinks(meta: any): { url: string; extras: LocalExtraDoc[] } {
  const raw = meta?.salvar_links_assinados;
  let obj: any = null;

  if (raw) {
    obj = safeParse(raw);
  } else {
    // Busca por chaves dinâmicas: salvar_links_assinados_TK123
    const key = Object.keys(meta || {}).find(k => k.startsWith('salvar_links_assinados_'));
    if (key) obj = safeParse(meta[key]);
  }

  return {
    url: obj?.principal?.link ?? '',
    extras: obj?.extra ? (Object.values(obj.extra) as LocalExtraDoc[]) : [],
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Hook principal
// ──────────────────────────────────────────────────────────────────────────────

export function useContractsMeta(meta: any): ContractsMetaResult {
  return useMemo<ContractsMetaResult>(() => {
    // ── Aluno ──────────────────────────────────────────────────────────────
    const propostaPdfs = extractPdfs(meta?.proposta_pdf, 'Proposta Comercial (PDF)');
    const rawContratos = toArray(meta?.contrato_pdf);
    const contratoPdfs = rawContratos
      .filter((item: any) => item?.url)
      .map((item: any) => ({
        name: item.nome_contrato || item.nome_arquivo || 'Contrato',
        url: item.url,
        original: item,
      }));

    const pdfsToSend: PdfItem[] = [...propostaPdfs, ...contratoPdfs];

    // ZapSign do aluno
    const rawZapsign = meta?.processo_assinatura;
    const zapsignBase = safeParse(rawZapsign) ?? {};
    const zapsignDoc = zapsignBase?.enviar?.response ?? zapsignBase;
    const sentDocs = extractSigners(zapsignDoc?.signers);

    // Links assinados localmente
    const { url: localSignedUrl, extras: localExtraDocs } = extractLocalLinks(meta);

    // ── Responsável Financeiro ─────────────────────────────────────────────
    const pdfsToSendResp: PdfItem[] = toArray(meta?.contrato_responsavel_pdf)
      .filter((item: any) => item?.url)
      .map((item: any) => ({
        name: item.nome_contrato || item.nome_arquivo || 'Contrato Responsável',
        url: item.url,
        original: item,
      }));

    const rawZapsignResp = meta?.processo_assinatura_responsavel;
    const zapsignDocResp = safeParse(rawZapsignResp) ?? {};
    const sentDocsResp = extractSigners(zapsignDocResp?.signers, 'Link Responsável');
    const localSignedUrlResp: string = zapsignDocResp?.signed_file ?? '';
    const hasZapsignResp = Object.keys(zapsignDocResp).length > 0;

    return {
      pdfsToSend,
      sentDocs,
      rawParsedContracts: rawContratos,
      zapsignDoc,
      localSignedUrl,
      localExtraDocs,
      pdfsToSendResp,
      sentDocsResp,
      zapsignDocResp,
      localSignedUrlResp,
      hasZapsignResp,
    };
  }, [meta]);
}
