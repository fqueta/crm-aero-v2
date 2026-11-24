import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, FileSignature, ExternalLink, ShieldCheck, Clock, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { normalizeUrl } from '@/lib/urls';

export interface ContractPdfItem {
  nome_contrato?: string;
  nome_arquivo?: string;
  url?: string;
  url_pdf?: string;
}

interface LocalExtraDoc {
  nome: string;
  link: string;
}

interface ProposalContractPdfCardProps {
  meta?: Record<string, any>;
  isSigned?: boolean;
}

function parseContracts(raw: any): ContractPdfItem[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return [];
    }
  }
  return [];
}

function safeParse(val: any): any {
  if (!val) return null;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return null;
    }
  }
  return null;
}

/** Extrai os links dos arquivos baixados e salvos localmente no CRM (permanentes) */
function extractLocalLinks(meta: any): { url: string; extras: LocalExtraDoc[] } {
  const raw = meta?.salvar_links_assinados;
  let obj: any = null;

  if (raw) {
    obj = safeParse(raw);
  } else {
    const key = Object.keys(meta || {}).find((k) => k.startsWith('salvar_links_assinados_'));
    if (key) obj = safeParse(meta[key]);
  }

  return {
    url: obj?.principal?.link ? normalizeUrl(obj.principal.link) : '',
    extras: obj?.extra ? (Object.values(obj.extra) as LocalExtraDoc[]).map(e => ({ ...e, link: normalizeUrl(e.link) })) : [],
  };
}

export default function ProposalContractPdfCard({ meta, isSigned }: ProposalContractPdfCardProps) {
  const { toast } = useToast();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const rawContracts = meta?.contrato_pdf;
  const initialContracts = parseContracts(rawContracts).filter((c) => c?.url || c?.url_pdf);

  // Arquivos permanentes baixados no CRM
  const { url: localSignedUrl, extras: localExtraDocs } = extractLocalLinks(meta);

  // Arquivo assinado retornado pelo ZapSign (fallback)
  const zapsignSignedFile = meta?.processo_assinatura?.signed_file || meta?.processo_assinatura?.response?.signed_file;
  
  // Prioriza o arquivo local permanente armazenado no CRM (`doc.aeroclubejf.com.br/storage/...`)
  const officialFinalPdf = localSignedUrl || (zapsignSignedFile ? normalizeUrl(zapsignSignedFile) : '');

  if (initialContracts.length === 0 && !officialFinalPdf && localExtraDocs.length === 0) {
    return null;
  }

  const handleCopy = async (url: string, key: string) => {
    const safeUrl = normalizeUrl(url);
    if (!safeUrl) return;
    try {
      await navigator.clipboard.writeText(safeUrl);
      setCopiedKey(key);
      toast({
        title: 'Copiado!',
        description: 'Link do PDF copiado para a área de transferência.',
      });
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      toast({
        title: 'Erro',
        description: 'Não foi possível copiar o link.',
        variant: 'destructive',
      });
    }
  };

  const handleOpen = (url: string) => {
    const safeUrl = normalizeUrl(url);
    if (!safeUrl) return;
    window.open(safeUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <Card className="border-none shadow-sm rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/30 overflow-hidden border border-indigo-200/60 dark:border-indigo-900/40">
      <CardHeader className="pb-3 border-b border-indigo-100/40 dark:border-indigo-900/40">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-indigo-800 dark:text-indigo-300">
            <FileSignature className="h-4 w-4" /> Contrato em PDF (Assinatura)
          </CardTitle>
          {isSigned || officialFinalPdf ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-none text-[10px] font-semibold gap-1">
              <ShieldCheck className="h-3 w-3" /> Assinado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 text-[10px] gap-1">
              <Clock className="h-3 w-3" /> Para ZapSign ({initialContracts.length})
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {/* Documento Final Assinado Oficial (Salvo localmente no CRM) */}
        {officialFinalPdf && (
          <div className="p-3 rounded-xl border border-emerald-300/80 bg-emerald-50 dark:bg-emerald-950/50 dark:border-emerald-800 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span className="font-bold text-emerald-900 dark:text-emerald-200 truncate">
                  {localSignedUrl ? 'Contrato Assinado (Local CRM)' : 'Documento Final Assinado'}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 border-emerald-300 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-200 bg-white dark:bg-zinc-900"
                  onClick={() => handleCopy(officialFinalPdf, 'official')}
                >
                  {copiedKey === 'official' ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                  Copiar
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                  onClick={() => handleOpen(officialFinalPdf)}
                >
                  <ExternalLink className="h-3 w-3" />
                  Abrir
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-emerald-700 dark:text-emerald-400 leading-tight">
              Arquivo final permanente registrado no servidor do CRM após a assinatura.
            </p>
          </div>
        )}

        {/* Lista de Arquivos Individuais Assinados (Locais do CRM) */}
        {localExtraDocs.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
              Documentos do Envelope ({localExtraDocs.length})
            </span>
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {localExtraDocs.map((doc, idx) => (
                <div
                  key={`extra-${idx}`}
                  className="rounded-xl border border-border/50 bg-white dark:bg-zinc-900/90 p-2 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate text-[11px]" title={doc.nome}>
                      {doc.nome}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-600 dark:text-slate-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => handleCopy(doc.link, `extra-${idx}`)}
                      title="Copiar link permanente"
                    >
                      {copiedKey === `extra-${idx}` ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-slate-600 dark:text-slate-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      onClick={() => handleOpen(doc.link)}
                      title="Visualizar documento"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Caso ainda não tenha sido assinado (Documentos gerados para envio) */}
        {!officialFinalPdf && initialContracts.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
              Documentos Gerados para Assinatura ({initialContracts.length})
            </span>
            <div className="space-y-1.5">
              {initialContracts.map((contract, idx) => {
                const url = contract.url || contract.url_pdf || '';
                const name = contract.nome_contrato || contract.nome_arquivo || `Documento ${idx + 1}`;
                return (
                  <div
                    key={`initial-${idx}`}
                    className="rounded-xl border border-indigo-200/60 dark:border-indigo-900/50 bg-white dark:bg-zinc-900/90 p-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileSignature className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <span className="font-medium text-slate-800 dark:text-slate-200 truncate text-[11px]" title={name}>
                        {name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950"
                        onClick={() => handleCopy(url, `initial-${idx}`)}
                        title="Copiar link"
                      >
                        {copiedKey === `initial-${idx}` ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950"
                        onClick={() => handleOpen(url)}
                        title="Visualizar documento em PDF"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
