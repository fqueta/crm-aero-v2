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
  status?: string;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  /** Status vivo consultado no Asaas */
  live_status?: AsaasPaymentStatus | null;
}

export interface AsaasBilling {
  success: boolean;
  matricula_id: number;
  customer_id?: string | null;
  payments: AsaasBillingPayment[];
}
