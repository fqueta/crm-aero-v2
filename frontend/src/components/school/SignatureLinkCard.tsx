import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, ExternalLink } from 'lucide-react';
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-medium flex items-center gap-2">
           Link para Assinatura
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <Input 
            value={link} 
            readOnly 
            className="font-mono text-sm bg-muted/50" 
            onClick={(e) => e.currentTarget.select()}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopy}
            title="Copiar link"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpen}
            title="Abrir link em nova aba"
          >
             <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Compartilhe este link com o aluno para que ele possa assinar o contrato digitalmente.
        </p>
      </CardContent>
    </Card>
  );
}
