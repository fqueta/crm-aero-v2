import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, Check, FileSignature, ExternalLink, ShieldCheck, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { normalizeUrl } from '@/lib/urls';

export interface ContractPdfItem {
  nome_contrato?: string;
  nome_arquivo?: string;
  url?: string;
  url_pdf?: string;
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

export default function ProposalContractPdfCard({ meta, isSigned }: ProposalContractPdfCardProps) {
  const { toast } = useToast();
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const rawContracts = meta?.contrato_pdf;
  const contracts = parseContracts(rawContracts).filter((c) => c?.url || c?.url_pdf);

  // Links assinados pelo ZapSign após a finalização
  const signedFile = meta?.processo_assinatura?.signed_file || meta?.processo_assinatura?.response?.signed_file;

  if (contracts.length === 0 && !signedFile) {
    return null;
  }

  const handleCopy = async (url: string, index: number) => {
    const safeUrl = normalizeUrl(url);
    if (!safeUrl) return;
    try {
      await navigator.clipboard.writeText(safeUrl);
      setCopiedIndex(index);
      toast({
        title: 'Copiado!',
        description: 'Link do PDF do contrato copiado para a área de transferência.',
      });
      setTimeout(() => setCopiedIndex(null), 2000);
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
          {isSigned ? (
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-none text-[10px] font-semibold gap-1">
              <ShieldCheck className="h-3 w-3" /> Assinado
            </Badge>
          ) : (
            <Badge variant="outline" className="text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 text-[10px] gap-1">
              <Clock className="h-3 w-3" /> Para ZapSign ({contracts.length})
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-2.5">
        {signedFile && (
          <div className="p-2.5 rounded-xl border border-emerald-200/70 bg-emerald-50/60 dark:bg-emerald-950/40 dark:border-emerald-800/60 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-emerald-900 dark:text-emerald-200">Arquivo Assinado Oficial (ZapSign)</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 border-emerald-300 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:text-emerald-200"
                  onClick={() => handleCopy(signedFile, -1)}
                >
                  {copiedIndex === -1 ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
                  Copiar
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 px-2 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleOpen(signedFile)}
                >
                  <ExternalLink className="h-3 w-3" />
                  Abrir
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {contracts.map((contract, idx) => {
            const url = contract.url || contract.url_pdf || '';
            const name = contract.nome_contrato || contract.nome_arquivo || `Documento ${idx + 1}`;
            return (
              <div
                key={idx}
                className="rounded-xl border border-indigo-200/60 dark:border-indigo-900/50 bg-white dark:bg-zinc-900/90 p-2.5 flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileSignature className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate" title={name}>
                    {name}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950"
                    onClick={() => handleCopy(url, idx)}
                    title="Copiar link"
                  >
                    {copiedIndex === idx ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950"
                    onClick={() => handleOpen(url)}
                    title="Visualizar documento em PDF"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
          Documento oficial com cláusulas, tabela de parcelamento e ciência do PI vinculado ao ZapSign.
        </p>
      </CardContent>
    </Card>
  );
}
