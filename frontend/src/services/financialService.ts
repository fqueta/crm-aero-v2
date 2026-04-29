/**
 * Serviços para operações financeiras
 * Inclui APIs para contas a pagar, contas a receber, fluxo de caixa e relatórios
 */

import { BaseApiService } from './BaseApiService';

const api = new BaseApiService();
import {
  AccountPayable,
  AccountReceivable,
  CashFlowEntry,
  FinancialCategory,
  FinancialDashboardData,
  FinancialSummary,
  MonthlyReport,
  BillingReport,
  CreateAccountPayableDto,
  CreateAccountReceivableDto,
  CreateCashFlowEntryDto,
  UpdateAccountDto,
  PaginatedResponse,
  AccountsFilter,
  CashFlowFilter,
  ReportFilter,
  WonProposalReportFilter,
  WonProposalReportResponse,
  GeneralConversionReportFilter,
  GeneralConversionReportResponse,
  GeneralConversionReportDetailResponse
} from '../types/financial';

/**
 * Constrói um rótulo amigável a partir do status financeiro.
 */
function getFinancialStatusLabel(status?: string): string {
  if (status === 'paid') return 'Pago';
  if (status === 'partial') return 'Parcial';
  if (status === 'pending') return 'Pendente';
  if (status === 'cancelled') return 'Cancelado';
  if (status === 'overdue') return 'Vencido';
  return status || 'Nao informado';
}

// Serviços para Contas a Pagar
export const accountsPayableService = {
  /**
   * Lista todas as contas a pagar com filtros
   */
  async getAll(filters: AccountsFilter = {}): Promise<PaginatedResponse<AccountPayable>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    
    const response = await api.get<PaginatedResponse<AccountPayable>>(`/financial/accounts-payable?${params}`);
    return response;
  },

  /**
   * Busca uma conta a pagar por ID
   */
  async getById(id: string): Promise<AccountPayable> {
    const response = await api.get(`/financial/accounts-payable/${id}`);
    return response.data;
  },

  /**
   * Cria uma nova conta a pagar
   */
  async create(data: CreateAccountPayableDto): Promise<AccountPayable> {
    const response = await api.post('/financial/accounts-payable', data);
    return response.data;
  },

  /**
   * Atualiza uma conta a pagar
   */
  async update(id: string, data: UpdateAccountDto): Promise<AccountPayable> {
    const response = await api.put(`/financial/accounts-payable/${id}`, data);
    return response.data;
  },

  /**
   * Marca uma conta como paga
   */
  async markAsPaid(id: string, paymentDate: string, paymentMethod: string): Promise<AccountPayable> {
    const response = await api.patch(`/financial/accounts-payable/${id}/pay`, {
      paymentDate,
      paymentMethod
    });
    return response.data;
  },

  /**
   * Cancela uma conta a pagar
   */
  async cancel(id: string, reason?: string): Promise<AccountPayable> {
    const response = await api.patch(`/financial/accounts-payable/${id}/cancel`, { reason });
    return response.data;
  },

  /**
   * Remove uma conta a pagar
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/financial/accounts-payable/${id}`);
  }
};

// Serviços para Contas a Receber
export const accountsReceivableService = {
  /**
   * Lista todas as contas a receber com filtros
   */
  async getAll(filters: AccountsFilter = {}): Promise<PaginatedResponse<AccountReceivable>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    
    const response = await api.get<PaginatedResponse<AccountReceivable>>(`/financial/accounts-receivable?${params}`);
    return response;
  },

  /**
   * Busca uma conta a receber por ID
   */
  async getById(id: string): Promise<AccountReceivable> {
    const response = await api.get(`/financial/accounts-receivable/${id}`);
    return response.data;
  },

  /**
   * Cria uma nova conta a receber
   */
  async create(data: CreateAccountReceivableDto): Promise<AccountReceivable> {
    const response = await api.post('/financial/accounts-receivable', data);
    return response.data;
  },

  /**
   * Atualiza uma conta a receber
   */
  async update(id: string, data: UpdateAccountDto): Promise<AccountReceivable> {
    const response = await api.put(`/financial/accounts-receivable/${id}`, data);
    return response.data;
  },

  /**
   * Marca uma conta como recebida
   */
  async markAsReceived(
    id: string,
    receivedDate: string,
    paymentMethod: string,
    amount?: number,
    notes?: string
  ): Promise<AccountReceivable> {
    const response = await api.patch(`/financial/accounts-receivable/${id}/receive`, {
      receivedDate,
      paymentMethod,
      amount,
      notes,
    });
    return response.data;
  },

  /**
   * Atualiza uma parcela previamente registrada em uma conta a receber.
   */
  async updatePayment(
    id: string,
    paymentId: string,
    receivedDate: string,
    paymentMethod: string,
    amount: number,
    notes?: string
  ): Promise<AccountReceivable> {
    const response = await api.patch(`/financial/accounts-receivable/${id}/payments/${paymentId}`, {
      receivedDate,
      paymentMethod,
      amount,
      notes,
    });
    return response.data;
  },

  /**
   * Remove uma parcela previamente registrada em uma conta a receber.
   */
  async deletePayment(id: string, paymentId: string): Promise<AccountReceivable> {
    const response = await api.delete(`/financial/accounts-receivable/${id}/payments/${paymentId}`);
    return response.data;
  },

  /**
   * Cancela uma conta a receber
   */
  async cancel(id: string, reason?: string): Promise<AccountReceivable> {
    const response = await api.patch(`/financial/accounts-receivable/${id}/cancel`, { reason });
    return response.data;
  },

  /**
   * Remove uma conta a receber
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/financial/accounts-receivable/${id}`);
  }
};

// Serviços para Fluxo de Caixa
export const cashFlowService = {
  /**
   * Lista todas as entradas do fluxo de caixa com filtros
   */
  async getAll(filters: CashFlowFilter = {}): Promise<PaginatedResponse<CashFlowEntry>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, value.toString());
      }
    });
    
    const response = await api.get<PaginatedResponse<CashFlowEntry>>(`/financial/cash-flow?${params}`);
    return response;
  },

  /**
   * Busca uma entrada do fluxo de caixa por ID
   */
  async getById(id: string): Promise<CashFlowEntry> {
    const response = await api.get(`/financial/cash-flow/${id}`);
    return response.data;
  },

  /**
   * Cria uma nova entrada no fluxo de caixa
   */
  async create(data: CreateCashFlowEntryDto): Promise<CashFlowEntry> {
    const response = await api.post('/financial/cash-flow', data);
    return response.data;
  },

  /**
   * Atualiza uma entrada do fluxo de caixa
   */
  async update(id: string, data: Partial<CreateCashFlowEntryDto>): Promise<CashFlowEntry> {
    const response = await api.put(`/financial/cash-flow/${id}`, data);
    return response.data;
  },

  /**
   * Remove uma entrada do fluxo de caixa
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/financial/cash-flow/${id}`);
  },

  /**
   * Obtém o saldo atual do caixa
   */
  async getCurrentBalance(): Promise<{ balance: number; lastUpdate: string }> {
    const response = await api.get('/financial/cash-flow/balance');
    return response.data;
  }
};

// Serviços para Categorias Financeiras
export const categoriesService = {
  /**
   * Lista todas as categorias financeiras
   */
  async getAll(): Promise<FinancialCategory[]> {
    const response = await api.get('/financial/categories');
    return response.data;
  },

  /**
   * Cria uma nova categoria financeira
   */
  async create(data: Omit<FinancialCategory, 'id' | 'createdAt'>): Promise<FinancialCategory> {
    const response = await api.post('/financial/categories', data);
    return response.data;
  },

  /**
   * Atualiza uma categoria financeira
   */
  async update(id: string, data: Partial<Omit<FinancialCategory, 'id' | 'createdAt'>>): Promise<FinancialCategory> {
    const response = await api.put(`/financial/categories/${id}`, data);
    return response.data;
  },

  /**
   * Remove uma categoria financeira
   */
  async delete(id: string): Promise<void> {
    await api.delete(`/financial/categories/${id}`);
  }
};

// Serviços para Dashboard
export const dashboardService = {
  /**
   * Obtém dados do dashboard financeiro
   */
  async getDashboardData(period?: string): Promise<FinancialDashboardData> {
    const params = period ? `?period=${period}` : '';
    const response = await api.get<FinancialDashboardData>(`/financial/overview${params}`);
    return response;
  },

  /**
   * Obtém resumo financeiro
   */
  async getFinancialSummary(startDate?: string, endDate?: string): Promise<FinancialSummary> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await api.get(`/financial/summary?${params}`);
    return response.data;
  }
};

// Serviços para Relatórios
export const reportsService = {
  /**
   * Obtém o relatório geral das propostas marcadas como ganho.
   */
  async getWonProposalsReport(filters: WonProposalReportFilter = {}): Promise<WonProposalReportResponse> {
    const page = Math.max(1, filters.page ?? 1);
    const perPage = Math.max(1, filters.perPage ?? 15);
    const response = await api.get<{
      data: AccountReceivable[];
      current_page?: number;
      last_page?: number;
      per_page?: number;
      total?: number;
    }>('/financial/accounts-receivable', {
      type: 'receivable',
      source: 'proposal_gain',
      status: filters.status && filters.status !== 'all' ? filters.status : undefined,
      search: filters.search,
      due_date_from: filters.startDate,
      due_date_to: filters.endDate,
      per_page: 5000,
      order_by: 'due_date',
      order: 'desc',
    });

    const allItems = Array.isArray(response?.data) ? response.data : [];
    const mappedItems = allItems.map((item) => {
      const config = (item.config ?? {}) as Record<string, unknown>;
      const negotiatedAmount = Number(item.amount ?? 0);
      const paidAmount = Number(item.paidAmount ?? 0);
      const remainingAmount = Number(item.remainingAmount ?? Math.max(0, negotiatedAmount - paidAmount));

      return {
        id: String(item.id),
        matriculaId: config.matricula_id ? String(config.matricula_id) : null,
        customerName: item.customerName,
        description: item.description,
        contractNumber: item.contractNumber,
        status: item.status,
        statusLabel: getFinancialStatusLabel(item.status),
        gainDate: typeof config.gain_date === 'string' ? config.gain_date : item.dueDate,
        lastPaymentDate: item.paymentDate,
        negotiatedAmount,
        paidAmount,
        remainingAmount,
        paymentsCount: Number(item.paymentsCount ?? 0),
        gainObservation: typeof config.gain_observation === 'string' ? config.gain_observation : null,
        notes: item.notes,
        createdAt: (item as any).created_at,
        updatedAt: (item as any).updated_at,
      };
    });

    const summary = mappedItems.reduce((accumulator, item) => {
      accumulator.totalAccounts += 1;
      accumulator.negotiatedAmount += item.negotiatedAmount;
      accumulator.paidAmount += item.paidAmount;
      accumulator.remainingAmount += item.remainingAmount;

      if (item.status === 'paid') accumulator.paidAccounts += 1;
      if (item.status === 'partial') accumulator.partialAccounts += 1;
      if (item.status === 'pending') accumulator.pendingAccounts += 1;

      return accumulator;
    }, {
      totalAccounts: 0,
      negotiatedAmount: 0,
      paidAmount: 0,
      remainingAmount: 0,
      paidAccounts: 0,
      partialAccounts: 0,
      pendingAccounts: 0,
      conversionAverage: 0,
    });

    summary.conversionAverage = summary.totalAccounts > 0
      ? summary.negotiatedAmount / summary.totalAccounts
      : 0;

    const statuses: Array<'paid' | 'partial' | 'pending'> = ['paid', 'partial', 'pending'];
    const statusBreakdown = statuses
      .map((status) => {
        const items = mappedItems.filter((item) => item.status === status);
        const negotiatedAmount = items.reduce((total, item) => total + item.negotiatedAmount, 0);
        const paidAmount = items.reduce((total, item) => total + item.paidAmount, 0);
        const remainingAmount = items.reduce((total, item) => total + item.remainingAmount, 0);

        return {
          status,
          label: getFinancialStatusLabel(status),
          totalAccounts: items.length,
          negotiatedAmount,
          paidAmount,
          remainingAmount,
        };
      })
      .filter((item) => item.totalAccounts > 0);

    const total = mappedItems.length;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    const safePage = Math.min(page, lastPage);
    const offset = (safePage - 1) * perPage;
    const pagedItems = mappedItems.slice(offset, offset + perPage);

    return {
      data: pagedItems,
      current_page: safePage,
      last_page: lastPage,
      per_page: perPage,
      total,
      from: total === 0 ? null : offset + 1,
      to: total === 0 ? null : offset + pagedItems.length,
      summary: {
        ...summary,
        negotiatedAmount: Number(summary.negotiatedAmount.toFixed(2)),
        paidAmount: Number(summary.paidAmount.toFixed(2)),
        remainingAmount: Number(summary.remainingAmount.toFixed(2)),
        conversionAverage: Number(summary.conversionAverage.toFixed(2)),
      },
      statusBreakdown: statusBreakdown.map((item) => ({
        ...item,
        negotiatedAmount: Number(item.negotiatedAmount.toFixed(2)),
        paidAmount: Number(item.paidAmount.toFixed(2)),
        remainingAmount: Number(item.remainingAmount.toFixed(2)),
      })),
      filters: {
        startDate: filters.startDate ?? null,
        endDate: filters.endDate ?? null,
        status: filters.status ?? null,
        search: filters.search ?? null,
      },
    };
  },

  /**
   * Obtém o relatório geral de conversão comercial por período.
   */
  async getGeneralConversionReport(
    filters: GeneralConversionReportFilter = {}
  ): Promise<GeneralConversionReportResponse> {
    const response = await api.get<GeneralConversionReportResponse>('/reports/general-conversion', {
      start_date: filters.startDate,
      end_date: filters.endDate,
      consultant_id: filters.consultantId,
      funnel_id: filters.funnelId,
    });

    return response;
  },

  /**
   * Obtém a lista detalhada que compõe os cards do relatório geral.
   */
  async getGeneralConversionReportDetails(
    type: 'leads' | 'unique_converted_leads' | 'won_proposals',
    filters: GeneralConversionReportFilter = {}
  ): Promise<GeneralConversionReportDetailResponse> {
    const response = await api.get<GeneralConversionReportDetailResponse>('/reports/general-conversion/details', {
      type,
      start_date: filters.startDate,
      end_date: filters.endDate,
      consultant_id: filters.consultantId,
      funnel_id: filters.funnelId,
    });

    return response;
  },

  /**
   * Gera relatório mensal
   */
  async getMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
    const response = await api.get(`/financial/reports/monthly/${year}/${month}`);
    return response.data;
  },

  /**
   * Gera relatório de faturamento
   */
  async getBillingReport(filters: ReportFilter): Promise<BillingReport> {
    const response = await api.post('/financial/reports/billing', filters);
    return response.data;
  },

  /**
   * Gera relatório personalizado
   */
  async getCustomReport(filters: ReportFilter): Promise<unknown> {
    const response = await api.post<unknown>('/financial/reports/custom', filters);
    return response.data;
  },

  /**
   * Exporta relatório em PDF
   */
  async exportToPdf(reportType: string, filters: ReportFilter): Promise<Blob> {
    const response = await api.post(`/financial/reports/export/pdf/${reportType}`, filters, {
      responseType: 'blob'
    });
    return response.data;
  },

  /**
   * Exporta relatório em Excel
   */
  async exportToExcel(reportType: string, filters: ReportFilter): Promise<Blob> {
    const response = await api.post(`/financial/reports/export/excel/${reportType}`, filters, {
      responseType: 'blob'
    });
    return response.data;
  }
};

// Serviço principal que agrupa todos os outros
export const financialService = {
  accountsPayable: accountsPayableService,
  accountsReceivable: accountsReceivableService,
  cashFlow: cashFlowService,
  categories: categoriesService,
  dashboard: dashboardService,
  reports: reportsService
};

export default financialService;
