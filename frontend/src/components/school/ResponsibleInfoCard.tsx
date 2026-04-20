import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, ExternalLink, UserCheck, Mail, Phone, Fingerprint } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';

interface ResponsibleInfoCardProps {
  /**
   * data
   * pt-BR: Objeto contendo os dados do responsável (nome, cpf, email, etc.)
   */
  data: {
    name?: string;
    cpf?: string;
    email?: string;
    celular?: string;
    telefone?: string;
  };
  /**
   * signatureLink
   * pt-BR: Link opcional da ZapSign exclusivo para o responsável.
   */
  signatureLink?: string;
}

/**
 * ResponsibleInfoCard
 * pt-BR: Exibe resumidamente os dados do responsável financeiro e seu link de assinatura.
 */
export default function ResponsibleInfoCard({ data, signatureLink }: ResponsibleInfoCardProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!signatureLink) return;
    try {
      await navigator.clipboard.writeText(signatureLink);
      setCopied(true);
      toast({
        title: 'Copiado!',
        description: 'Link de assinatura do responsável copiado.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: 'Erro', description: 'Não foi possível copiar o link.', variant: 'destructive' });
    }
  }

  function handleOpen() {
    if (!signatureLink) return;
    window.open(signatureLink, '_blank');
  }

  if (!data?.name && !signatureLink) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/30 dark:bg-amber-900/10">
      <CardHeader className="pb-3 text-sm">
        <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-900 dark:text-amber-400">
           <UserCheck className="h-5 w-5" />
           Responsável Financeiro
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="font-medium truncate">{data.name || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Fingerprint className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{data.cpf || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="truncate">{data.email || '—'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>{data.celular || data.telefone || '—'}</span>
          </div>
        </div>

        {signatureLink && (
          <div className="pt-2 border-t border-amber-200/50">
            <p className="text-xs font-medium text-amber-800 dark:text-amber-500 mb-2">Link para Assinatura (Responsável):</p>
            <div className="flex items-center space-x-2">
              <Input 
                value={signatureLink} 
                readOnly 
                className="font-mono text-sm bg-white/80 dark:bg-zinc-950/50 border-amber-200" 
                onClick={(e) => e.currentTarget.select()}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopy}
                className="border-amber-200 hover:bg-amber-100 h-10 w-10 shrink-0"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleOpen}
                className="hover:bg-amber-100 h-10 w-10 shrink-0"
              >
                 <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-amber-700/70 mt-1 italic">
              Este link deve ser enviado ao responsável financeiro para assinatura digital.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
