import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, FileText, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { normalizeUrl } from '@/lib/urls';

interface ProposalPdfLinkCardProps {
  /**
   * pdfUrl
   * pt-BR: O link do PDF da proposta a ser exibido e copiado.
   * en-US: The proposal PDF link to be displayed and copied.
   */
  pdfUrl: string;
}

/**
 * ProposalPdfLinkCard
 * pt-BR: Card que exibe o link da proposta em PDF e permite copiar ou abrir em nova aba.
 * en-US: Card that displays the proposal PDF link and allows copying or opening in a new tab.
 */
export default function ProposalPdfLinkCard({ pdfUrl }: ProposalPdfLinkCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  // pt-BR: Normaliza barras duplicadas (ex.: `br//tenancy/...`) vindas do backend.
  const safeUrl = normalizeUrl(pdfUrl);

  async function handleCopy() {
    if (!safeUrl) return;
    try {
      await navigator.clipboard.writeText(safeUrl);
      setCopied(true);
      toast({
        title: 'Copiado!',
        description: 'Link do PDF da proposta copiado para a área de transferência.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: 'Erro',
        description: 'Não foi possível copiar o link.',
        variant: 'destructive',
      });
    }
  }

  function handleOpen() {
    if (!safeUrl) return;
    window.open(safeUrl, '_blank');
  }

  if (!safeUrl) return null;

  return (
    <Card className="border-none shadow-sm rounded-2xl bg-rose-50/40 dark:bg-rose-950/30 overflow-hidden border border-rose-200/60 dark:border-rose-900/40">
      <CardHeader className="pb-3 border-b border-rose-100/40 dark:border-rose-900/40">
        <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-rose-700 dark:text-rose-300">
           <FileText className="h-4 w-4" /> Link da Proposta em PDF
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="flex items-center space-x-2">
          <Input 
            value={safeUrl} 
            readOnly 
            className="font-mono text-[11px] bg-white dark:bg-zinc-900/90 border-rose-200/80 dark:border-rose-900/50 text-slate-800 dark:text-slate-100 h-10 focus-visible:ring-rose-500" 
            onClick={(e) => e.currentTarget.select()}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            title="Copiar link"
            className="shrink-0 h-10 w-10 border-rose-200 dark:border-rose-900/60 bg-white dark:bg-zinc-900 hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={handleOpen}
            title="Visualizar PDF"
            className="shrink-0 h-10 w-10 bg-rose-600 hover:bg-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500 shadow-sm text-white"
          >
             <FileText className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[11px] font-medium text-rose-700/80 dark:text-rose-300/80 mt-3 flex items-center gap-2">
          <Info className="h-3.5 w-3.5 shrink-0" /> Acesse ou copie o link do arquivo PDF desta proposta.
        </p>
      </CardContent>
    </Card>
  );
}
