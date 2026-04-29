import { BaseApiService } from './BaseApiService';
import {
  UserAccessReportParams,
  UserAccessReportResponse,
} from '@/types/user-access-report';

class UserAccessReportService extends BaseApiService {
  /**
   * Carrega o relatório de acesso dos usuários.
   */
  async getReport(params?: UserAccessReportParams): Promise<UserAccessReportResponse> {
    return this.get<UserAccessReportResponse>('/reports/user-access', params);
  }
}

export const userAccessReportService = new UserAccessReportService();
