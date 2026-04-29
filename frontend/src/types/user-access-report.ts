export interface UserAccessReportFilters {
  startDate: string;
  endDate: string;
  userId?: string | null;
  permissionId?: number | null;
  search?: string | null;
  perPage: number;
}

export interface UserAccessReportSummary {
  totalUsers: number;
  usersWithLoginInPeriod: number;
  totalLoginEvents: number;
  totalLogoutEvents: number;
  usersWithActiveSessions: number;
}

export interface UserAccessReportItem {
  userId: string;
  name: string;
  email: string;
  permissionId: number | null;
  status: string | null;
  activeFlag: string | null;
  loginCount: number;
  logoutCount: number;
  lastLoginAt: string | null;
  lastLogoutAt: string | null;
  lastLoginIp: string | null;
  lastLogoutIp: string | null;
  lastActivityAt: string | null;
  lastAccessAt: string | null;
  activeSessions: number;
  isOnline: boolean;
}

export interface UserAccessReportResponse {
  filters: UserAccessReportFilters;
  summary: UserAccessReportSummary;
  data: UserAccessReportItem[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface UserAccessReportParams {
  start_date?: string;
  end_date?: string;
  user_id?: string;
  permission_id?: number;
  search?: string;
  page?: number;
  per_page?: number;
}
