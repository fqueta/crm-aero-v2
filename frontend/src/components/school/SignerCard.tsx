/**
 * SignerCard.tsx
 * Componente de apresentação para um signatário do ZapSign.
 * Aplica o padrão Compound Component — o CardHeader, Avatar, métricas
 * e ações são compostos de forma coesa num único componente focado.
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ExternalLink, Copy, Check, MessageCircle, Eye, CheckCircle2, MousePointerClick } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getSignerStatusLabel, getSignerBadgeClass, getSignerDotClass } from '@/lib/zapsign';

// ──────────────────────────────────────────────────────────────────────────────
// Helpers locais
// ──────────────────────────────────────────────────────────────────────────────

function formatDateTime(isoString?: string): string {
  if (!isoString) return '';
  try {
    return new Date(isoString).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return isoString;
  }
}

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function CopyButton({ text }: { text: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({ title: 'Copiado', description: 'Link copiado para a área de transferência.' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Erro', description: 'Falha ao copiar link.', variant: 'destructive' });
    }
  };
  return (
    <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleCopy} title="Copiar link">
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────────────────────

interface SignerCardProps {
  /** Dados do signatário retornados pelo ZapSign */
  signer?: any;
  /** URL de assinatura */
  url: string;
  /** Variante de cor do card (padrão = aluno, indigo = responsável) */
  variant?: 'default' | 'indigo';
}

export function SignerCard({ signer, url, variant = 'default' }: SignerCardProps) {
  const status = signer?.status;
  const statusLabel = getSignerStatusLabel(status);
  const badgeClass = getSignerBadgeClass(status);
  const dotClass = getSignerDotClass(status);

  const whatsappMessage = `Olá ${signer?.name || ''}, segue o link para assinatura do seu contrato no Aeroclube: ${url}`;
  const whatsappUrl = `https://api.whatsapp.com/send?phone=55${signer?.phone_number || ''}&text=${encodeURIComponent(whatsappMessage)}`;

  const isIndigo = variant === 'indigo';

  return (
    <div className="group relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
      {/* Barra lateral colorida */}
      <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 dark:bg-zinc-800 group-hover:bg-primary transition-colors duration-300" />

      <div className="p-4">
        {/* Header: Avatar + Nome + Status */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm border-2 ${dotClass}`}>
              {getInitials(signer?.name || '')}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                {signer?.name || 'Assinante'}
              </h4>
              <p className="text-[10px] text-muted-foreground">
                {signer?.email || 'E-mail não informado'}
              </p>
            </div>
          </div>
          <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase font-black tracking-widest ${badgeClass}`}>
            {statusLabel}
          </span>
        </div>

        {/* Métricas de engajamento */}
        {!isIndigo && (
          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mb-4">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md">
              <MousePointerClick className="h-3 w-3 opacity-70" />
              <span className="font-medium">{signer?.times_viewed || 0}</span> acessos
            </div>
            {signer?.last_view_at && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500" title="Última visualização">
                <Eye className="h-3 w-3 opacity-70" />
                Lido: <span className="font-medium">{formatDateTime(signer.last_view_at)}</span>
              </div>
            )}
            {signer?.signed_at && (
              <div className="flex items-center gap-1.5 text-[10px] text-green-600 font-bold bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md">
                <CheckCircle2 className="h-3 w-3" />
                {formatDateTime(signer.signed_at)}
              </div>
            )}
          </div>
        )}

        {/* Ações: link + botões */}
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Input
              value={url}
              readOnly
              className="h-8 pr-16 bg-slate-50/50 dark:bg-zinc-800/30 border-slate-200 dark:border-zinc-800 text-[10px] focus-visible:ring-offset-0 focus-visible:ring-1"
            />
            <div className="absolute right-1 top-1">
              <CopyButton text={url} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              className={`flex-1 h-8 text-[10px] font-bold uppercase tracking-wider ${isIndigo ? 'border-indigo-200' : ''}`}
              asChild
            >
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3 w-3 mr-2" /> Abrir Link
              </a>
            </Button>

            {!isIndigo && (
              <Button
                variant="outline" size="sm"
                className="h-8 px-3 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400"
                onClick={() => window.open(whatsappUrl, '_blank')}
                title="Enviar lembrete pelo WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
