import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, ExternalLink, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

interface SignatureLinkCardProps {
  /**
   * link
   * pt-BR: O link de assinatura a ser exibido e copiado.
   * en-US: The signature link to be displayed and copied.
   */
  link: string;
}

/**
 * SignatureLinkCard
 * pt-BR: Card que exibe o link de assinatura e permite copiar para a área de transferência.
 * en-US: Card that displays the signature link and allows copying to clipboard.
 */
export default function SignatureLinkCard({ link }: SignatureLinkCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      toast({
        title: 'Copiado!',
        description: 'Link de assinatura copiado para a área de transferência.',
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
    if (!link) return;
    window.open(link, '_blank');
  }

  if (!link) return null;

  return (
    <Card className="border-none shadow-sm rounded-2xl bg-blue-50/30 overflow-hidden border border-blue-100/50">
      <CardHeader className="pb-3 border-b border-blue-100/30">
        <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-blue-800">
           <ExternalLink className="h-4 w-4" /> Link para Assinatura
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <div className="flex items-center space-x-2">
          <Input 
            value={link} 
            readOnly 
            className="font-mono text-[11px] bg-white border-blue-100 h-10 focus-visible:ring-blue-500" 
            onClick={(e) => e.currentTarget.select()}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            title="Copiar link"
            className="shrink-0 h-10 w-10 border-blue-100 bg-white hover:bg-blue-50 text-blue-700 hover:text-blue-800"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button
            variant="default"
            size="icon"
            onClick={handleOpen}
            title="Abrir link em nova aba"
            className="shrink-0 h-10 w-10 bg-blue-600 hover:bg-blue-700 shadow-sm"
          >
             <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[11px] font-medium text-blue-700/60 mt-3 flex items-center gap-2">
          {/* pt-BR: Compartilhe este link com o aluno; en-US: Share this link with the student */}
          <Info className="h-3.5 w-3.5" /> Envie este link para o aluno realizar a assinatura digital.
        </p>
      </CardContent>
    </Card>
  );
}
