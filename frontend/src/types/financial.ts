/**
 * Tipos para o módulo financeiro
 * Inclui contas a pagar, contas a receber, fluxo de caixa e relatórios
 */

// Enums para status e categorias
export enum AccountStatus {
  PENDING = 'pending',
  PARTIAL = 'partial',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled'
}

export enum TransactionType {
  INCOME = 'income',
  EXPENSE = 'expense'
}

// Alias para compatibilidade com componentes
export type CategoryType = 'income' | 'expense';

export enum PaymentMethod {
  CASH = 'cash',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  PIX = 'pix',
  CHECK = 'check',
  BOLETO = 'boleto',
  OTHER = 'other'
}

export enum RecurrenceType {
  NONE = 'none',
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  YEARLY = 'yearly'
}

// Interface base para contas
export interface BaseAccount {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  status: AccountStatus;
  category: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
  config?: Record<string, unknown>;
  attachments?: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// Contas a Pagar
export interface AccountPayable extends BaseAccount {
  supplierId?: string;
  supplierName?: string;
  invoiceNumber?: string;
  purchaseOrderId?: string;
  paymentDate?: string;
  discountAmount?: number;
  interestAmount?: number;
  recurrence?: RecurrenceType;
  installments?: number;
  currentInstallment?: number;
}

// Contas a Receber
export interface AccountReceivable extends BaseAccount {
  customerId?: string;
  customerName?: string;
  serviceOrderId?: string;
  invoiceNumber?: string;
  receivedDate?: string;
  paymentDate?: string;
  paidAmount?: number;
  remainingAmount?: number;
  paymentsTotal?: number;
  paymentsCount?: number;
  payments?: FinancialAccountPayment[];
  discountAmount?: number;
  interestAmount?: number;
  recurrence?: RecurrenceType;
  installments?: number;
  currentInstallment?: number;
}

export interface FinancialAccountPayment {
  id: string;
  financialAccountId: string;
  amount: number;
  paymentDate: string;
  paymentMethod: PaymentMethod | string;
  notes?: string;
  createdBy?: string;
  token?: string;
  config?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

// Fluxo de Caixa
export interface CashFlowEntry {
  id: string;
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  category: string;
  paymentMethod: PaymentMethod;
  accountId?: string; // Referência para conta a pagar/receber
  balance: number;
  notes?: string;
  createdAt: string;
  createdBy: string;
}

// Categorias Financeiras
export interface FinancialCategory {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  description?: string;
  parentId?: string;
  parent?: FinancialCategory;
  children?: FinancialCategory[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Tipos para CRUD de categorias financeiras
export interface CreateFinancialCategoryInput {
  name: string;
  description?: string;
  type: TransactionType;
  color: string;
  parentId?: string;
  isActive?: boolean;
}

export interface UpdateFinancialCategoryInput {
  name?: string;
  description?: string;
  type?: TransactionType;
  color?: string;
  parentId?: string;
  isActive?: boolean;
}

export interface FinancialCategoriesResponse {
  data: FinancialCategory[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FinancialCategoryFilters {
  search?: string;
  type?: TransactionType;
  parentId?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface FinancialCategoryFormData {
  name: string;
  description: string;
  type: TransactionType;
  color: string;
  parentId: string;
  isActive: boolean;
}

export interface FinancialCategoryOption {
  value: string;
  label: string;
  disabled?: boolean;
}

// Cores predefinidas para categorias
export const FINANCIAL_CATEGORY_COLORS = [
  '#ef4444', // red-500
  '#f97316', // orange-500
  '#eab308', // yellow-500
  '#22c55e', // green-500
  '#06b6d4', // cyan-500
  '#3b82f6', // blue-500
  '#8b5cf6', // violet-500
  '#ec4899', // pink-500
  '#64748b', // slate-500
  '#78716c', // stone-500
] as const;

// Tipos de categoria predefinidos
export const FINANCIAL_CATEGORY_TYPES = [
  { value: TransactionType.INCOME, label: 'Receita', color: '#22c55e' },
  { value: TransactionType.EXPENSE, label: 'Despesa', color: '#ef4444' },
] as const;

// Relatórios
export interface ReportFilter {
  startDate: string;
  endDate: string;
  categories?: string[];
  status?: AccountStatus[];
  paymentMethods?: PaymentMethod[];
  customerId?: string;
  supplierId?: string;
}

export interface WonProposalReportFilter {
  startDate?: string;
  endDate?: string;
  status?: 'pending' | 'partial' | 'paid' | 'all';
  search?: string;
  page?: number;
  perPage?: number;
}

export interface FinancialSummary {
  totalIncome: number;
  totalExpenses: number;
  netProfit: number;
  pendingReceivables: number;
  pendingPayables: number;
  overdueReceivables: number;
  overduePayables: number;
  cashBalance: number;
}

export interface MonthlyReport {
  month: string;
  year: number;
  summary: FinancialSummary;
  topCategories: {
    category: string;
    amount: number;
    percentage: number;
  }[];
  dailyFlow: {
    date: string;
    income: number;
    expenses: number;
    balance: number;
  }[];
}

export interface BillingReport {
  period: string;
  totalBilled: number;
  totalReceived: number;
  pendingAmount: number;
  overdueAmount: number;
  customers: {
    customerId: string;
    customerName: string;
    totalBilled: number;
    totalReceived: number;
    pendingAmount: number;
  }[];
  services: {
    serviceId: string;
    serviceName: string;
    quantity: number;
    totalAmount: number;
  }[];
}

export interface WonProposalReportItem {
  id: string;
  matriculaId: string | null;
  customerName?: string;
  description: string;
  contractNumber?: string;
  status: AccountStatus | string;
  statusLabel: string;
  gainDate?: string | null;
  lastPaymentDate?: string | null;
  negotiatedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentsCount: number;
  gainObservation?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface WonProposalReportSummary {
  totalAccounts: number;
  negotiatedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paidAccounts: number;
  partialAccounts: number;
  pendingAccounts: number;
  conversionAverage: number;
}

export interface WonProposalReportStatusBreakdown {
  status: AccountStatus | string;
  label: string;
  totalAccounts: number;
  negotiatedAmount: number;
  paidAmount: number;
  remainingAmount: number;
}

export interface WonProposalReportResponse {
  data: WonProposalReportItem[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
  summary: WonProposalReportSummary;
  statusBreakdown: WonProposalReportStatusBreakdown[];
  filters: {
    startDate?: string | null;
    endDate?: string | null;
    status?: string | null;
    search?: string | null;
  };
}

export interface GeneralConversionReportFilter {
  startDate?: string;
  endDate?: string;
  consultantId?: string;
  funnelId?: string;
}

export type GeneralConversionReportDetailType =
  | 'leads'
  | 'unique_converted_leads'
  | 'won_proposals';

export interface GeneralConversionReportSummary {
  leadsCount: number;
  conversionsCount: number;
  proposalsWonCount: number;
  uniqueConvertedLeadsCount: number;
  conversionRate: number;
  proposalWinRate: number;
  averageConversionDays: number;
  medianConversionDays: number;
  fastestConversionDays: number | null;
  slowestConversionDays: number | null;
}

export interface GeneralConversionReportMonthlyItem {
  month: string;
  label: string;
  leads: number;
  conversions: number;
  proposalsWon: number;
  uniqueConvertedLeads: number;
  conversionRate: number;
  proposalWinRate: number;
  averageConversionDays: number;
}

export interface GeneralConversionReportBucketItem {
  bucket: string;
  count: number;
}

export interface GeneralConversionReportRecentItem {
  leadId: string;
  leadName: string;
  matriculaId: string;
  consultantName?: string | null;
  leadCreatedAt: string;
  gainDate: string;
  conversionDays: number;
  negotiatedAmount: number;
}

export interface GeneralConversionReportConsultantItem {
  consultantId: string | null;
  consultantName: string;
  leadsCount: number;
  uniqueConvertedLeadsCount: number;
  proposalsWonCount: number;
  conversionRate: number;
  averageConversionDays: number;
}

export interface GeneralConversionReportResponse {
  filters: {
    startDate: string;
    endDate: string;
    consultantId?: string | null;
    funnelId?: string | null;
  };
  currentMonth: {
    label: string;
    summary: GeneralConversionReportSummary;
  };
  periodSummary: GeneralConversionReportSummary;
  monthlyConversion: GeneralConversionReportMonthlyItem[];
  conversionTimeBuckets: GeneralConversionReportBucketItem[];
  consultantBreakdown: GeneralConversionReportConsultantItem[];
  recentConversions: GeneralConversionReportRecentItem[];
}

export interface GeneralConversionReportLeadDetailItem {
  leadId: string;
  leadName: string;
  leadCreatedAt: string;
}

export interface GeneralConversionReportUniqueConvertedDetailItem {
  leadId: string;
  leadName: string;
  leadCreatedAt: string;
  gainDate: string;
  conversionDays: number;
  consultantName?: string | null;
  proposalsWonCount: number;
}

export interface GeneralConversionReportWonProposalDetailItem {
  leadId: string;
  leadName: string;
  matriculaId: string;
  leadCreatedAt: string;
  gainDate: string;
  conversionDays: number;
  consultantName?: string | null;
  negotiatedAmount: number;
}

export interface GeneralConversionReportDetailResponse {
  type: GeneralConversionReportDetailType;
  title: string;
  total: number;
  items: Array<
    | GeneralConversionReportLeadDetailItem
    | GeneralConversionReportUniqueConvertedDetailItem
    | GeneralConversionReportWonProposalDetailItem
  >;
}

// DTOs para formulários
export interface CreateAccountPayableDto {
  description: string;
  amount: number;
  dueDate: string;
  category: string;
  supplierId?: string;
  supplierName?: string;
  invoiceNumber?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
  recurrence?: RecurrenceType;
  installments?: number;
}

export interface CreateAccountReceivableDto {
  description: string;
  amount: number;
  dueDate: string;
  category: string;
  customerId?: string;
  customerName?: string;
  serviceOrderId?: string;
  invoiceNumber?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
  recurrence?: RecurrenceType;
  installments?: number;
}

export interface CreateCashFlowEntryDto {
  date: string;
  description: string;
  type: TransactionType;
  amount: number;
  category: string;
  paymentMethod: PaymentMethod;
  notes?: string;
}

export interface UpdateAccountDto {
  description?: string;
  amount?: number;
  dueDate?: string;
  category?: string;
  paymentMethod?: PaymentMethod;
  notes?: string;
  status?: AccountStatus;
}

// Responses da API
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface FinancialDashboardData {
  summary: FinancialSummary;
  recentTransactions: CashFlowEntry[];
  upcomingPayables: AccountPayable[];
  upcomingReceivables: AccountReceivable[];
  monthlyTrend: {
    month: string;
    income: number;
    expenses: number;
  }[];
  categoryBreakdown: {
    category: string;
    amount: number;
    type: TransactionType;
  }[];
}

// Filtros para listagens
export interface AccountsFilter {
  page?: number;
  limit?: number;
  search?: string;
  status?: AccountStatus;
  category?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: PaymentMethod;
  sortBy?: 'dueDate' | 'amount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface CashFlowFilter {
  page?: number;
  limit?: number;
  search?: string;
  type?: TransactionType;
  category?: string;
  startDate?: string;
  endDate?: string;
  paymentMethod?: PaymentMethod;
  sortBy?: 'date' | 'amount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}
