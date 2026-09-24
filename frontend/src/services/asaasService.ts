import { BaseApiService } from '@/services/BaseApiService';
import type { AsaasBilling, AsaasEnvironment, AsaasStatus } from '@/types/asaas';

/**
 * asaasService — status, teste de conexão e cobranças da matrícula (padrão Help Desk).
 */
class AsaasService extends BaseApiService {
  async getStatus() {
    return this.get<AsaasStatus>('/asaas/status');
  }

  async testConnection(credentials?: { api_key?: string; environment?: AsaasEnvironment }) {
    return this.post<{ success: boolean; message: string }>('/asaas/test-connection', credentials || {});
  }

  async getBilling(matriculaId: number | string) {
    return this.get<AsaasBilling>(`/asaas/billing/${matriculaId}`);
  }

  async updateBillingPayment(paymentId: string, payload: { matricula_id: number | string; dueDate?: string; value?: number; description?: string; discount_value?: number }) {
    return this.put<{ success: boolean; data: any }>(`/asaas/billing/payments/${paymentId}`, payload);
  }

  async deleteBillingPayment(paymentId: string, matriculaId: number | string) {
    return this.delete<{ success: boolean; data: any }>(`/asaas/billing/payments/${paymentId}?matricula_id=${matriculaId}`);
  }

  async cancelBillingInstallment(installmentId: string, matriculaId: number | string) {
    return this.delete<{ success: boolean; data: any }>(`/asaas/billing/installments/${installmentId}?matricula_id=${matriculaId}`);
  }
}

export const asaasService = new AsaasService();
