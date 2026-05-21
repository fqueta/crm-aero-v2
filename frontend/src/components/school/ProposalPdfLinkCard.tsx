import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, FileText, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

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

  async function handleCopy() {
    if (!pdfUrl) return;
    try {
      await navigator.clipboard.writeText(pdfUrl);
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
    if (!pdfUrl) return;
    window.open(pdfUrl, '_blank');
  }

  if (!pdfUrl) return null;

  return (
    <Card className="border-none shadow-sm rounded-2xl bg-rose-50/30 overflow-hidden border border-rose-100/50">
      <CardHeader className="pb-3 border-b border-rose-100/30">
        <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-rose-800">
           <FileText className="h-4 w-4" /> Link da Proposta em PDF
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="flex items-center space-x-2">
          <Input 
            value={pdfUrl} 
            readOnly 
            className="font-mono text-[11px] bg-white border-rose-100 h-10 focus-visible:ring-rose-500" 
            onClick={(e) => e.currentTarget.select()}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            title="Copiar link"
            className="shrink-0 h-10 w-10 border-rose-100 bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-800"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={handleOpen}
            title="Visualizar PDF"
            className="shrink-0 h-10 w-10 bg-rose-600 hover:bg-rose-700 shadow-sm text-white"
          >
             <FileText className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[11px] font-medium text-rose-700/60 mt-3 flex items-center gap-2">
          <Info className="h-3.5 w-3.5" /> Acesse ou copie o link do arquivo PDF desta proposta.
        </p>
      </CardContent>
    </Card>
  );
}
