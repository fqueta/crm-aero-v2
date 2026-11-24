import { BaseApiService } from './BaseApiService';

export interface AiCreditBalance {
  is_unlimited: boolean;
  is_exhausted: boolean;
  total_available: number;
  monthly_allowance: number;
  monthly_used: number;
  monthly_remaining: number;
  purchased_balance: number;
  percent_used: number;
  cycle_ends_at: string | null;
  days_until_renewal: number;
}

export interface AiCreditPackage {
  slug: string;
  name: string;
  credits: number;
  price: number;
  unit_price: string;
  badge: string | null;
  description: string;
  recommended: boolean;
}

export interface AiCreditTransaction {
  id: number;
  type: 'plan_renewal' | 'purchase' | 'usage' | 'adjustment';
  amount: number;
  balance_after: number;
  source: string;
  description: string;
  date: string;
}

export interface BuyPackageResponse {
  purchase_id: number;
  payment_id: string;
  package: AiCreditPackage;
  price: number;
  credits: number;
  pix_qr_code: string | null;
  pix_copy_paste: string | null;
  invoice_url: string | null;
  status: string;
}

export interface CheckPurchaseStatusResponse {
  status: 'pending' | 'paid' | 'failed' | 'canceled' | 'not_found';
  is_paid: boolean;
  credits?: number;
  paid_at?: string;
  pix_qr_code?: string;
  pix_copy_paste?: string;
}

class AiCreditService extends BaseApiService {
  async getBalance(): Promise<AiCreditBalance> {
    const res = await this.get<{ success: boolean; data: AiCreditBalance }>('/ai/credits/balance');
    return (res as any).data || res;
  }

  async getPackages(): Promise<AiCreditPackage[]> {
    const res = await this.get<{ success: boolean; data: AiCreditPackage[] }>('/ai/credits/packages');
    return (res as any).data || res;
  }

  async getTransactions(): Promise<AiCreditTransaction[]> {
    const res = await this.get<{ success: boolean; data: AiCreditTransaction[] }>('/ai/credits/transactions');
    return (res as any).data || res;
  }

  async buyPackage(packageSlug: string): Promise<BuyPackageResponse> {
    const res = await this.post<{ success: boolean; data: BuyPackageResponse }>('/ai/credits/buy', {
      package_slug: packageSlug,
    });
    return (res as any).data || res;
  }

  async checkPurchaseStatus(purchaseId: number): Promise<CheckPurchaseStatusResponse> {
    const res = await this.get<{ success: boolean; data: CheckPurchaseStatusResponse }>(`/ai/credits/purchases/${purchaseId}/status`);
    return (res as any).data || res;
  }
}

export const aiCreditService = new AiCreditService();
