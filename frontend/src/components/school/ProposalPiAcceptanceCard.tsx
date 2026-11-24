import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BookOpen, CheckCircle2, Clock, ExternalLink, ShieldCheck } from 'lucide-react';
import { formatScheduleDateBR } from '@/lib/paymentSchedule';

interface ProposalPiAcceptanceCardProps {
  meta?: Record<string, any>;
  instructionProgram?: {
    id?: number | string;
    title?: string;
    code?: string;
    slug?: string;
    current_revision?: string;
    revision_date?: string;
    period_name?: string | null;
  } | null;
}

export default function ProposalPiAcceptanceCard({ meta, instructionProgram }: ProposalPiAcceptanceCardProps) {
  const isAccepted = meta?.pi_termos_aceitos === 's' || meta?.pi_termos_aceitos === '1' || meta?.pi_termos_aceitos === true;
  const isAccessed = meta?.pi_link_acessado === 's' || meta?.pi_link_acessado === '1' || meta?.pi_link_acessado === true;
  
  const piCode = meta?.pi_aceito_codigo || instructionProgram?.code || '';
  const piRevision = meta?.pi_aceito_revisao || instructionProgram?.current_revision || '';
  const piSlug = meta?.pi_aceito_slug || instructionProgram?.slug || '';
  const acceptedAt = meta?.pi_aceito_em;
  const acceptedIp = meta?.pi_aceito_ip;

  // Se não houver configuração nem aceite prévio gravado, não exibe o card
  if (!isAccepted && !instructionProgram) {
    return null;
  }

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr.replace(' ', 'T'));
      if (isNaN(d.getTime())) return dateStr;
      return `${formatScheduleDateBR(dateStr.substring(0, 10))} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="border-none shadow-sm rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/50 overflow-hidden border border-border/40">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-foreground">
            <BookOpen className="h-4 w-4 text-emerald-600" /> Programa de Instrução (PI)
          </CardTitle>
          {isAccepted ? (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-none text-[10px] font-semibold gap-1">
              <CheckCircle2 className="h-3 w-3" /> Termos Aceitos
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground text-[10px] gap-1">
              <Clock className="h-3 w-3" /> Aguarda Assinatura
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <div className="rounded-xl border border-border/50 bg-background p-3.5 space-y-2 text-xs">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground">
                {piCode ? `PI ${piCode}` : 'Programa de Instrução'}
              </span>
              {piRevision && (
                <Badge variant="secondary" className="font-mono text-[10px] py-0 px-1.5 h-5">
                  Rev. {piRevision}
                </Badge>
              )}
              {instructionProgram?.period_name && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-5">
                  {instructionProgram.period_name}
                </Badge>
              )}
            </div>

            {piSlug && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs gap-1 px-2 text-primary hover:text-primary"
                onClick={() => window.open(`/programa-instrucao/${piSlug}`, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-3 w-3" /> Ver PI
              </Button>
            )}
          </div>

          {isAccepted ? (
            <div className="pt-2 border-t border-border/40 space-y-1.5 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                <span>Aceite confirmado durante a assinatura do aluno</span>
              </div>
              {acceptedAt && (
                <div className="flex items-center justify-between">
                  <span>Data/Hora:</span>
                  <span className="font-mono font-medium text-foreground">{formatDateTime(acceptedAt)}</span>
                </div>
              )}
              {acceptedIp && (
                <div className="flex items-center justify-between">
                  <span>IP de Confirmação:</span>
                  <span className="font-mono text-foreground">{acceptedIp}</span>
                </div>
              )}
              {isAccessed && (
                <div className="flex items-center justify-between">
                  <span>Documento aberto pelo aluno:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">Sim</span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
              O aluno será solicitado a consultar o documento e assinalar o aceite das regras e diretrizes operacionais no momento da assinatura.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
