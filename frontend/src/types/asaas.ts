/**
 * types/asaas.ts — Tipos da integração Asaas (padrão Help Desk).
 */

export type AsaasEnvironment = 'sandbox' | 'production';

export type AsaasBillingType = 'BOLETO' | 'PIX' | 'CREDIT_CARD' | 'UNDEFINED';

export interface AsaasStatus {
  success: boolean;
  configured: boolean;
  connected: boolean;
}

export interface AsaasSavePayload {
  api_key: string;
  webhook_token: string;
  environment: AsaasEnvironment;
  billing_type: AsaasBillingType;
  /** Multa % pós-vencimento ('' = padrão da conta Asaas) */
  fine_value?: string;
  fine_type?: 'FIXED' | 'PERCENTAGE';
  /** Juros % a.m. pós-vencimento ('' = padrão da conta Asaas) */
  interest_value?: string;
}

export type AsaasPaymentStatus = 'PENDING' | 'RECEIVED' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | string;

export interface AsaasBillingPayment {
  kind: string;
  id: string;
  value: number;
  dueDate: string;
  installment_id?: string | null;
  installment_number?: number | null;
  total_installments?: number | null;
  status?: string;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  description?: string | null;
  /** Status vivo consultado no Asaas */
  live_status?: AsaasPaymentStatus | null;
  /** Última visualização da fatura pelo cliente (Asaas: lastInvoiceViewedDate) */
  lastInvoiceViewedDate?: string | null;
  /** Última visualização do boleto pelo cliente (Asaas: lastBankSlipViewedDate) */
  lastBankSlipViewedDate?: string | null;
}

/**
 * Rótulos em português dos status de cobrança do Asaas.
 * Mantém o código original p/ lógica (edição/exclusão) e exibe o rótulo.
 */
export const ASAAS_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendente',
  OVERDUE: 'Vencida',
  RECEIVED: 'Recebida',
  CONFIRMED: 'Confirmada',
  REFUNDED: 'Estornada',
  REFUND_REQUESTED: 'Estorno solicitado',
  RECEIVED_IN_CASH: 'Recebida em dinheiro',
  CHARGEBACK_REQUESTED: 'Chargeback solicitado',
  CHARGEBACK_DISPUTE: 'Chargeback em disputa',
  AWAITING_CHARGEBACK_REVERSAL: 'Aguard. reversão chargeback',
  DUNNING_REQUESTED: 'Em cobrança',
  DUNNING_RECEIVED: 'Cobrança recebida',
  AWAITING_RISK_ANALYSIS: 'Em análise de risco',
};

export function asaasStatusLabel(status?: string | null): string {
  const st = String(status || '').toUpperCase();
  return ASAAS_STATUS_LABEL[st] || st || '-';
}

export interface AsaasBilling {
  success: boolean;
  matricula_id: number;
  customer_id?: string | null;
  payments: AsaasBillingPayment[];
}
