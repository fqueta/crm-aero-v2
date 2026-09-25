import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, CreditCard, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { formatScheduleCurrencyBRL, formatScheduleDateBR } from '@/lib/paymentSchedule';

export interface AsaasBillingPayment {
  kind: 'matricula' | 'entrada' | 'parcelas' | 'parcela_unica' | string;
  id: string;
  value: number;
  dueDate: string;
  installment_id?: string;
  status?: string;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
}

export interface AsaasBillingData {
  customer_id?: string;
  matricula_id?: number;
  payments?: AsaasBillingPayment[];
  created_at?: string;
}

interface AsaasBillingCardProps {
  meta?: Record<string, any>;
  isSigned?: boolean;
}

function parseAsaasBilling(raw: any): AsaasBillingData | null {
  if (!raw) return null;
  if (typeof raw === 'object' && raw.payments) return raw as AsaasBillingData;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed as AsaasBillingData;
    } catch {
      return null;
    }
  }
  return null;
}

function formatPaymentKindLabel(kind: string): string {
  switch (kind) {
    case 'matricula':
      return 'Taxa de Inscrição / Matrícula';
    case 'entrada':
      return '1ª Parcela / Entrada';
    case 'parcelas':
      return 'Parcelamento';
    case 'parcela_unica':
      return 'Parcela Única';
    default:
      return 'Cobrança';
  }
}

function getStatusBadge(status?: string) {
  const s = String(status || 'PENDING').toUpperCase();
  switch (s) {
    case 'RECEIVED':
    case 'CONFIRMED':
    case 'PAGO':
      return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]">Pago</Badge>;
    case 'OVERDUE':
    case 'VENCIDO':
      return <Badge className="bg-red-600 hover:bg-red-700 text-white text-[10px]">Vencido</Badge>;
    case 'REFUNDED':
    case 'ESTORNADO':
      return <Badge className="bg-zinc-600 text-white text-[10px]">Estornado</Badge>;
    case 'PENDING':
    default:
      return <Badge variant="outline" className="text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 text-[10px]">Aguardando</Badge>;
  }
}

export default function AsaasBillingCard({ meta, isSigned }: AsaasBillingCardProps) {
  const rawBilling = meta?.asaas_billing;
  const billing = parseAsaasBilling(rawBilling);
  const customerId = billing?.customer_id || meta?.asaas_customer_id;
  const payments = billing?.payments || [];
  const hasBilling = payments.length > 0;

  return (
    <Card className="border-none shadow-sm rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/50 overflow-hidden border border-border/40">
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2 text-foreground">
            <CreditCard className="h-4 w-4 text-primary" /> Cobranças no Asaas
          </CardTitle>
          {hasBilling ? (
            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200 border-none text-[10px] font-semibold gap-1">
              <CheckCircle2 className="h-3 w-3" /> Geradas ({payments.length})
            </Badge>
          ) : isSigned ? (
            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 border-none text-[10px] font-semibold gap-1">
              <Clock className="h-3 w-3" /> Em processamento
            </Badge>
          ) : (
            <Badge variant="outline" className="text-muted-foreground text-[10px] gap-1">
              <AlertCircle className="h-3 w-3" /> Aguarda Assinatura
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {customerId && (
          <div className="flex items-center justify-between text-xs text-muted-foreground pb-2 border-b border-border/30">
            <span>Cliente Asaas:</span>
            <span className="font-mono font-medium text-foreground">{customerId}</span>
          </div>
        )}

        {hasBilling ? (
          <div className="space-y-2">
            {payments.map((p, idx) => {
              const directUrl = p.invoiceUrl || p.bankSlipUrl;
              return (
                <div
                  key={p.id || idx}
                  className="rounded-xl border border-border/50 bg-background p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground">{formatPaymentKindLabel(p.kind)}</span>
                      {getStatusBadge(p.status)}
                    </div>
                    <div className="text-muted-foreground text-[11px] flex items-center gap-2">
                      <span>Vencimento: {formatScheduleDateBR(p.dueDate)}</span>
                      <span>•</span>
                      <span className="font-semibold text-foreground">R$ {formatScheduleCurrencyBRL(p.value)}</span>
                    </div>
                  </div>

                  {directUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1 self-start sm:self-center"
                      onClick={() => window.open(directUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <ExternalLink className="h-3 w-3" /> Fatura
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground py-2 leading-relaxed">
            {isSigned ? (
              <p>O contrato foi assinado no ZapSign. A cobrança está sendo gerada automaticamente no Asaas via fila de integração.</p>
            ) : (
              <p>As cobranças (matrícula, entrada e parcelamento) serão enviadas e geradas automaticamente no Asaas assim que o envelope for assinado no ZapSign.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
