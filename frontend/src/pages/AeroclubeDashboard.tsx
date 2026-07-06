import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Label } from '@/components/ui/label';
import { Tooltip as MetricTooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  DollarSign,
  Percent,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import { financialService } from '@/services/financialService';
import {
  FinancialDashboardData,
  GeneralConversionReportResponse,
  FinancialOverviewScheduleItem,
  FinancialOverviewTransaction,
  WonProposalReportItem,
  WonProposalReportResponse,
} from '@/types/financial';

/**
 * Retorna a data de hoje no formato yyyy-mm-dd.
 */
function getTodayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Retorna o mês atual no formato yyyy-mm.
 */
function getCurrentMonthInputValue(): string {
  return getTodayInputValue().slice(0, 7);
}

/**
 * Garante que o mês selecionado seja válido e não fique no futuro.
 */
function normalizeDashboardMonth(period?: string): string {
  const currentMonth = getCurrentMonthInputValue();

  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return currentMonth;
  }

  return period > currentMonth ? currentMonth : period;
}

/**
 * Retorna o primeiro dia do mês de referência.
 */
function getMonthStartInputValue(period?: string): string {
  const normalizedMonth = normalizeDashboardMonth(period);
  return `${normalizedMonth}-01`;
}

/**
 * Retorna o último dia útil do mês de referência, limitado à data atual.
 */
function getMonthEndInputValue(period?: string): string {
  const normalizedMonth = normalizeDashboardMonth(period);
  const [year, month] = normalizedMonth.split('-').map(Number);
  const date = new Date(year, month, 0);
  date.setHours(0, 0, 0, 0);

  const computedEndDate = date.toISOString().slice(0, 10);
  return computedEndDate > getTodayInputValue() ? getTodayInputValue() : computedEndDate;
}

/**
 * Retorna o primeiro dia da janela analítica de 6 meses encerrada no mês de referência.
 */
function getDefaultPeriodStartInputValue(period?: string): string {
  const normalizedMonth = normalizeDashboardMonth(period);
  const [year, month] = normalizedMonth.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() - 5, 1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

/**
 * Formata um mês yyyy-mm para exibição amigável.
 */
function formatMonthLabel(period?: string): string {
  const normalizedMonth = normalizeDashboardMonth(period);
  const parsed = new Date(`${normalizedMonth}-01T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return normalizedMonth;
  }

  return parsed.toLocaleDateString('pt-BR', {
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Retorna um mês deslocado para frente ou para trás.
 */
function shiftDashboardMonth(period: string, offset: number): string {
  const normalizedMonth = normalizeDashboardMonth(period);
  const [year, month] = normalizedMonth.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() + offset);
  return normalizeDashboardMonth(date.toISOString().slice(0, 7));
}

/**
 * Monta opções de seleção com os meses mais recentes disponíveis.
 */
function getDashboardMonthOptions(totalMonths = 18): Array<{ value: string; label: string }> {
  const currentMonth = getCurrentMonthInputValue();
  const [year, month] = currentMonth.split('-').map(Number);
  const date = new Date(year, month - 1, 1);

  return Array.from({ length: totalMonths }, (_, index) => {
    const optionDate = new Date(date);
    optionDate.setMonth(date.getMonth() - index);
    const value = optionDate.toISOString().slice(0, 7);

    return {
      value,
      label: formatMonthLabel(value),
    };
  });
}

/**
 * Formata valores monetários no padrão brasileiro.
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

/**
 * Formata números inteiros no padrão pt-BR.
 */
function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}

/**
 * Formata percentuais com duas casas.
 */
function formatPercentage(value: number): string {
  return `${Number(value || 0).toFixed(2)}%`;
}

/**
 * Formata datas ISO para o padrão brasileiro.
 */
function formatDate(value?: string | null): string {
  if (!value) {
    return '-';
  }

  const normalizedValue = value.includes('T') ? value : `${value}T00:00:00`;
  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleDateString('pt-BR');
}

/**
 * Exibe um tempo em dias com fallback amigável.
 */
function formatDays(value?: number | null): string {
  if (value === null || value === undefined) {
    return '-';
  }

  return `${value} dias`;
}

/**
 * Normaliza uma data ISO curta para chave mensal yyyy-mm.
 */
function getMonthKey(value?: string | null): string | null {
  if (!value || value.length < 7) {
    return null;
  }

  return value.slice(0, 7);
}

/**
 * Dashboard principal da escola de aviação com foco comercial e financeiro.
 */
export default function AeroclubeDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthInputValue);
  const [conversionReport, setConversionReport] = useState<GeneralConversionReportResponse | null>(null);
  const [wonPeriodReport, setWonPeriodReport] = useState<WonProposalReportResponse | null>(null);
  const [wonCurrentMonthReport, setWonCurrentMonthReport] = useState<WonProposalReportResponse | null>(null);
  const [financialOverview, setFinancialOverview] = useState<FinancialDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const { user } = useAuth();
  const showFinancial = user && user.permission_id <= 3;

  /**
   * Carrega os dados principais do dashboard a partir dos relatórios existentes.
   */
  const loadDashboard = async (requestedMonth = selectedMonth) => {
    const normalizedMonth = normalizeDashboardMonth(requestedMonth);
    const periodStartDate = getDefaultPeriodStartInputValue(normalizedMonth);
    const currentMonthStartDate = getMonthStartInputValue(normalizedMonth);
    const endDate = getMonthEndInputValue(normalizedMonth);

    if (normalizedMonth !== selectedMonth) {
      setSelectedMonth(normalizedMonth);
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const [conversionData, wonPeriodData, wonCurrentMonthData, financialOverviewData] = await Promise.all([
        financialService.reports.getGeneralConversionReport({
          startDate: periodStartDate,
          endDate,
        }),
        financialService.reports.getWonProposalsReport({
          startDate: periodStartDate,
          endDate,
          perPage: 5000,
        }),
        financialService.reports.getWonProposalsReport({
          startDate: currentMonthStartDate,
          endDate,
          perPage: 5000,
        }),
        financialService.dashboard.getDashboardData(normalizedMonth),
      ]);

      setConversionReport(conversionData);
      setWonPeriodReport(wonPeriodData);
      setWonCurrentMonthReport(wonCurrentMonthData);
      setFinancialOverview(financialOverviewData);
    } catch (error) {
      console.error('Erro ao carregar dashboard do aeroclube:', error);
      setLoadError('Nao foi possivel carregar o dashboard principal.');
      toast.error('Erro ao carregar dashboard');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard(selectedMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  /**
   * Abre a ficha do lead preservando a origem da navegação.
   */
  const openLeadView = (leadId?: string | null) => {
    if (!leadId) {
      return;
    }

    navigate(`/admin/clients/${encodeURIComponent(String(leadId))}/view`, {
      state: { from: location },
    });
  };

  /**
   * Abre a visualização da proposta preservando a origem da navegação.
   */
  const openProposalView = (proposalId?: string | null) => {
    if (!proposalId) {
      return;
    }

    navigate(`/admin/sales/proposals/view/${encodeURIComponent(String(proposalId))}`, {
      state: { from: location },
    });
  };

  /**
   * Monta a série financeira mensal a partir das propostas ganhas do período.
   */
  const monthlyFinancial = useMemo(() => {
    const baseMonths = conversionReport?.monthlyConversion ?? [];
    const items = wonPeriodReport?.data ?? [];
    const grouped = new Map<string, {
      month: string;
      label: string;
      negotiatedAmount: number;
      paidAmount: number;
      remainingAmount: number;
      proposalsWon: number;
    }>();

    baseMonths.forEach((item) => {
      grouped.set(item.month, {
        month: item.month,
        label: item.label,
        negotiatedAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        proposalsWon: 0,
      });
    });

    items.forEach((item) => {
      const monthKey = getMonthKey(item.gainDate);
      if (!monthKey || !grouped.has(monthKey)) {
        return;
      }

      const current = grouped.get(monthKey);
      if (!current) {
        return;
      }

      current.negotiatedAmount += Number(item.negotiatedAmount ?? 0);
      current.paidAmount += Number(item.paidAmount ?? 0);
      current.remainingAmount += Number(item.remainingAmount ?? 0);
      current.proposalsWon += 1;
    });

    return Array.from(grouped.values());
  }, [conversionReport, wonPeriodReport]);

  /**
   * Lista as propostas ganhas com saldo pendente ordenadas pelo maior saldo.
   */
  const pendingWonProposals = useMemo(() => {
    return (wonPeriodReport?.data ?? [])
      .filter((item) => Number(item.remainingAmount ?? 0) > 0)
      .sort((a, b) => Number(b.remainingAmount ?? 0) - Number(a.remainingAmount ?? 0))
      .slice(0, 5);
  }, [wonPeriodReport]);

  /**
   * Lista consultores ordenados por melhor performance de conversão.
   */
  const topConsultants = useMemo(() => {
    return (conversionReport?.consultantBreakdown ?? [])
      .slice()
      .sort((a, b) => {
        if (b.uniqueConvertedLeadsCount !== a.uniqueConvertedLeadsCount) {
          return b.uniqueConvertedLeadsCount - a.uniqueConvertedLeadsCount;
        }

        return b.proposalsWonCount - a.proposalsWonCount;
      })
      .slice(0, 5);
  }, [conversionReport]);

  /**
   * Gera o resumo financeiro do mês atual usando o relatório de ganhos.
   */
  const currentMonthFinancialSummary = useMemo(() => {
    const summary = wonCurrentMonthReport?.summary;

    return {
      negotiatedAmount: Number(summary?.negotiatedAmount ?? 0),
      paidAmount: Number(summary?.paidAmount ?? 0),
      remainingAmount: Number(summary?.remainingAmount ?? 0),
      paidAccounts: Number(summary?.paidAccounts ?? 0),
      partialAccounts: Number(summary?.partialAccounts ?? 0),
      pendingAccounts: Number(summary?.pendingAccounts ?? 0),
      totalAccounts: Number(summary?.totalAccounts ?? 0),
    };
  }, [wonCurrentMonthReport]);

  /**
   * Consolida o resumo comercial do mês selecionado.
   */
  const selectedMonthSummary = useMemo(() => {
    const fallbackSummary = conversionReport?.currentMonth.summary;
    const selectedMonthData = (conversionReport?.monthlyConversion ?? []).find((item) => item.month === selectedMonth);

    return {
      leadsCount: Number(selectedMonthData?.leads ?? fallbackSummary?.leadsCount ?? 0),
      uniqueConvertedLeadsCount: Number(selectedMonthData?.uniqueConvertedLeads ?? fallbackSummary?.uniqueConvertedLeadsCount ?? 0),
      proposalsWonCount: Number(selectedMonthData?.proposalsWon ?? fallbackSummary?.proposalsWonCount ?? fallbackSummary?.conversionsCount ?? 0),
      conversionRate: Number(selectedMonthData?.conversionRate ?? fallbackSummary?.conversionRate ?? 0),
      averageConversionDays: Number(selectedMonthData?.averageConversionDays ?? fallbackSummary?.averageConversionDays ?? 0),
    };
  }, [conversionReport, selectedMonth]);

  /**
   * Retorna os recebimentos mais recentes entre as propostas ganhas.
   */
  const recentReceipts = useMemo(() => {
    return (wonPeriodReport?.data ?? [])
      .filter((item) => item.lastPaymentDate)
      .slice()
      .sort((a, b) => String(b.lastPaymentDate ?? '').localeCompare(String(a.lastPaymentDate ?? '')))
      .slice(0, 5);
  }, [wonPeriodReport]);

  const currentMonthLabel = formatMonthLabel(selectedMonth);
  const currentMonthValue = getCurrentMonthInputValue();
  const monthOptions = useMemo(() => getDashboardMonthOptions(), []);
  const financialStatusBreakdown = wonCurrentMonthReport?.statusBreakdown ?? [];
  const financialSummary = financialOverview?.summary;
  const upcomingReceivables = financialOverview?.upcomingReceivables ?? [];
  const recentTransactions = financialOverview?.recentTransactions ?? [];
  const conversionMetricHelpText =
    'Leads convertidos contam leads unicos com pelo menos um ganho no periodo. Propostas ganhas contam todos os ganhos, inclusive quando o mesmo lead fecha mais de uma proposta.';

  if (isLoading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-sm text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Erro ao carregar dashboard</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={loadDashboard}>Tentar novamente</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const conversionSeries = conversionReport?.monthlyConversion ?? [];
  const recentConversions = conversionReport?.recentConversions ?? [];

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-none shadow-none">
        <div className="rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-sky-900 p-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold md:text-3xl">Dashboard do Aeroclube</h1>
              <p className="max-w-3xl text-sm opacity-90 md:text-base">
                Visao executiva de captacao, conversao comercial e financeiro das propostas ganhas.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-white/15 text-white hover:bg-white/20">
                  Janela analitica: 6 meses ate {currentMonthLabel}
                </Badge>
                <Badge className="bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/25">
                  Mes em foco: {currentMonthLabel}
                </Badge>
              </div>
            </div>

            <div className="flex w-full max-w-xl flex-col gap-3 lg:w-auto">
              <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                <Label htmlFor="dashboard-month" className="text-xs font-medium uppercase tracking-wide text-white/80">
                  Mes de referencia
                </Label>
                <div className="mt-2 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      onClick={() => setSelectedMonth((current) => shiftDashboardMonth(current, -1))}
                      aria-label="Mês anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                      <SelectTrigger
                        id="dashboard-month"
                        className="w-full flex-1 border-white/20 bg-white/10 text-white"
                      >
                        <SelectValue placeholder="Selecione o mês" />
                      </SelectTrigger>
                      <SelectContent>
                        {monthOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon"
                      onClick={() => setSelectedMonth((current) => shiftDashboardMonth(current, 1))}
                      disabled={selectedMonth >= currentMonthValue}
                      aria-label="Próximo mês"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <p className="mt-2 text-xs text-white/70">
                  Use as setas ou escolha um mes da lista. O dashboard atualiza automaticamente.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row flex-wrap gap-2">
                <Button asChild variant="secondary" className="w-full sm:w-auto justify-between sm:justify-center">
                  <Link to="/admin/reports/relatorio-geral">
                    Relatorio geral
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" className="w-full sm:w-auto justify-between sm:justify-center">
                  <Link to="/admin/reports/relatorio-vendas">
                    Relatorio de ganhos
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                {showFinancial && (
                  <Button asChild variant="secondary" className="w-full sm:w-auto justify-between sm:justify-center">
                    <Link to="/admin/financial">
                      Financeiro
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Card onClick={() => {
          const [year, month] = selectedMonth.split('-');
          const start = `${year}-${month}-01`;
          const lastDay = new Date(Number(year), Number(month), 0).getDate();
          const end = `${year}-${month}-${lastDay}`;
          navigate(`/admin/clients?date_start=${start}&date_end=${end}`);
        }} className="cursor-pointer hover:bg-slate-50 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-primary" />
              Leads do mes
            </CardTitle>
            <CardDescription>Captados em {currentMonthLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatNumber(selectedMonthSummary.leadsCount)}</div>
          </CardContent>
        </Card>

        <Card onClick={() => navigate('/admin/school/enrollments')} className="cursor-pointer hover:bg-slate-50 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-primary" />
              Leads convertidos
              <MetricTooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground" aria-label="Entender leads convertidos">
                    <CircleHelp className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-sm">
                  {conversionMetricHelpText}
                </TooltipContent>
              </MetricTooltip>
            </CardTitle>
            <CardDescription>Leads unicos com ganho no mes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatNumber(selectedMonthSummary.uniqueConvertedLeadsCount)}</div>
          </CardContent>
        </Card>

        <Card onClick={() => navigate('/admin/reports/relatorio-vendas')} className="cursor-pointer hover:bg-slate-50 transition-colors">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Percent className="h-4 w-4 text-primary" />
              Taxa de conversao
            </CardTitle>
            <CardDescription>Leads unicos convertidos / leads captados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatPercentage(selectedMonthSummary.conversionRate)}</div>
          </CardContent>
        </Card>

        {showFinancial && (
          <>
            <Card onClick={() => navigate('/admin/reports/relatorio-vendas')} className="cursor-pointer hover:bg-slate-50 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  Negociado no mes
                </CardTitle>
                <CardDescription>Total das propostas ganhas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{formatCurrency(currentMonthFinancialSummary.negotiatedAmount)}</div>
              </CardContent>
            </Card>

            <Card onClick={() => navigate('/admin/finance/accounts-receivable')} className="cursor-pointer hover:bg-slate-50 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Recebido no mes
                </CardTitle>
                <CardDescription>Recebimentos vinculados aos ganhos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{formatCurrency(currentMonthFinancialSummary.paidAmount)}</div>
              </CardContent>
            </Card>

            <Card onClick={() => navigate('/admin/finance/accounts-receivable')} className="cursor-pointer hover:bg-slate-50 transition-colors">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-amber-600" />
                  Saldo em aberto
                </CardTitle>
                <CardDescription>Restante a receber dos ganhos do mes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{formatCurrency(currentMonthFinancialSummary.remainingAmount)}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {showFinancial && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Card onClick={() => navigate('/admin/finance/accounts-receivable')} className={`cursor-pointer transition-colors hover:border-amber-400 hover:bg-amber-100/60 ${Number(financialSummary?.overdueReceivables ?? 0) > 0 ? 'border-amber-300 bg-amber-50/60' : 'hover:bg-slate-50'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Recebiveis vencidos
              </CardTitle>
              <CardDescription>Saldo vencido dentro do mes de referencia</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatCurrency(Number(financialSummary?.overdueReceivables ?? 0))}</div>
            </CardContent>
          </Card>

          <Card onClick={() => navigate('/admin/finance/accounts-payable')} className={`cursor-pointer transition-colors hover:border-rose-400 hover:bg-rose-100/60 ${Number(financialSummary?.overduePayables ?? 0) > 0 ? 'border-rose-300 bg-rose-50/60' : 'hover:bg-slate-50'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock3 className="h-4 w-4 text-rose-600" />
                Pagaveis vencidos
              </CardTitle>
              <CardDescription>Compromissos vencidos no mesmo recorte</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatCurrency(Number(financialSummary?.overduePayables ?? 0))}</div>
            </CardContent>
          </Card>

          <Card onClick={() => navigate('/admin/finance/cash-flow')} className="cursor-pointer hover:bg-slate-50 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-emerald-600" />
                Caixa liquido
              </CardTitle>
              <CardDescription>Entradas pagas menos saidas pagas no mes</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatCurrency(Number(financialSummary?.cashBalance ?? 0))}</div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className={`grid gap-6 ${showFinancial ? 'xl:grid-cols-2' : 'xl:grid-cols-1'}`}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Conversao mensal
              <MetricTooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground" aria-label="Entender a conversão mensal">
                    <CircleHelp className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-sm">
                  {conversionMetricHelpText}
                </TooltipContent>
              </MetricTooltip>
            </CardTitle>
            <CardDescription>Leads captados, leads convertidos e propostas ganhas ao longo do periodo.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={conversionSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis yAxisId="left" allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={(value) => `${value}%`} />
                <Tooltip />
                <Legend />
                <Bar yAxisId="left" dataKey="leads" name="Leads" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="uniqueConvertedLeads" name="Leads convertidos" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="proposalsWon" name="Propostas ganhas" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="conversionRate" name="Taxa (%)" stroke="#f59e0b" strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {showFinancial && (
          <Card>
            <CardHeader>
              <CardTitle>Financeiro dos ganhos</CardTitle>
              <CardDescription>Negociado, recebido e saldo das propostas ganhas no mesmo periodo.</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyFinancial}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis tickFormatter={(value) => `R$ ${Math.round(Number(value) / 1000)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(Number(value))} />
                  <Legend />
                  <Bar dataKey="negotiatedAmount" name="Negociado" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="paidAmount" name="Recebido" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="remainingAmount" name="Saldo" stroke="#f97316" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Desempenho por consultor</CardTitle>
            <CardDescription>Top consultores do periodo por conversao de leads e propostas ganhas.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topConsultants} layout="vertical" margin={{ left: 20, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="consultantName" width={140} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="uniqueConvertedLeadsCount" name="Leads convertidos" fill="#2563eb" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="proposalsWonCount" name="Propostas ganhas" fill="#14b8a6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Consultor</TableHead>
                    <TableHead>Leads</TableHead>
                    <TableHead>Convertidos</TableHead>
                    <TableHead>Ganhos</TableHead>
                    <TableHead>Taxa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topConsultants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhum consultor encontrado no periodo.
                      </TableCell>
                    </TableRow>
                  ) : (
                    topConsultants.map((item) => (
                      <TableRow key={item.consultantId ?? item.consultantName}>
                        <TableCell className="font-medium">{item.consultantName}</TableCell>
                        <TableCell>{formatNumber(item.leadsCount)}</TableCell>
                        <TableCell>{formatNumber(item.uniqueConvertedLeadsCount)}</TableCell>
                        <TableCell>{formatNumber(item.proposalsWonCount)}</TableCell>
                        <TableCell>{formatPercentage(item.conversionRate)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Status financeiro do mes</CardTitle>
            <CardDescription>Situacao das propostas ganhas em {currentMonthLabel}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              {financialStatusBreakdown.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhum ganho financeiro registrado no mes atual.
                </div>
              ) : (
                financialStatusBreakdown.map((item) => (
                  <div key={String(item.status)} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={item.status === 'paid' ? 'default' : item.status === 'partial' ? 'secondary' : 'outline'}>
                            {item.label}
                          </Badge>
                          <span className="text-sm text-muted-foreground">{formatNumber(item.totalAccounts)} propostas</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Negociado {formatCurrency(item.negotiatedAmount)}
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        <div>Recebido: {formatCurrency(item.paidAmount)}</div>
                        <div className={Number(item.remainingAmount) > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                          Saldo: {Number(item.remainingAmount) > 0 ? formatCurrency(item.remainingAmount) : 'Quitado'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" />
                Atencao financeira
              </div>
              <p>
                Existem {formatNumber(currentMonthFinancialSummary.pendingAccounts + currentMonthFinancialSummary.partialAccounts)} propostas do mes atual com saldo pendente.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Propostas ganhas recentes</CardTitle>
              <CardDescription>Ultimos ganhos registrados no CRM.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/reports/relatorio-geral">Ver relatorio</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Data do ganho</TableHead>
                    <TableHead>Tempo</TableHead>
                    <TableHead>Consultor</TableHead>
                    <TableHead className="text-right">Negociado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentConversions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Nenhuma proposta ganha encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentConversions.slice(0, 5).map((item) => (
                      <TableRow key={`${item.matriculaId}-${item.gainDate}`}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <button
                              type="button"
                              className="w-fit text-left font-medium text-primary hover:underline"
                              onClick={() => openLeadView(item.leadId)}
                            >
                              {item.leadName}
                            </button>
                            <button
                              type="button"
                              className="w-fit text-left text-xs text-muted-foreground hover:text-primary hover:underline"
                              onClick={() => openProposalView(item.matriculaId)}
                            >
                              Matricula #{item.matriculaId}
                            </button>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(item.gainDate)}</TableCell>
                        <TableCell>{formatDays(item.conversionDays)}</TableCell>
                        <TableCell>{item.consultantName || '-'}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.negotiatedAmount)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Ganhos com saldo pendente</CardTitle>
              <CardDescription>Propostas ganhas que ainda exigem recebimento.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/reports/relatorio-vendas">Ver ganhos</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingWonProposals.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhuma proposta ganha com saldo pendente no periodo atual.
                </div>
              ) : (
                pendingWonProposals.map((item: WonProposalReportItem) => (
                  <div key={item.id} className="flex items-start justify-between rounded-lg border p-4">
                    <div className="space-y-1">
                      <p className="font-medium">{item.customerName || item.description}</p>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>Ganho em {formatDate(item.gainDate)}</span>
                        <span>•</span>
                        <span>{item.statusLabel}</span>
                        {item.matriculaId ? (
                          <>
                            <span>•</span>
                            <button
                              type="button"
                              className="text-primary hover:underline"
                              onClick={() => openProposalView(item.matriculaId)}
                            >
                              Matricula #{item.matriculaId}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="text-right text-sm">
                      <div>Negociado: {formatCurrency(item.negotiatedAmount)}</div>
                      <div>Recebido: {formatCurrency(item.paidAmount)}</div>
                      <div className="font-medium text-amber-600">Saldo: {formatCurrency(item.remainingAmount)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Ultimos recebimentos</CardTitle>
            <CardDescription>Movimentos financeiros recentes ligados aos ganhos.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentReceipts.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhum recebimento recente encontrado.
                </div>
              ) : (
                recentReceipts.map((item) => (
                  <div key={`${item.id}-${item.lastPaymentDate}`} className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <p className="font-medium">{item.customerName || item.description}</p>
                      <p className="text-sm text-muted-foreground">
                        Ultimo recebimento em {formatDate(item.lastPaymentDate)}
                      </p>
                    </div>
                    <div className="text-right text-sm">
                      <div>Recebido: {formatCurrency(item.paidAmount)}</div>
                      <div className={Number(item.remainingAmount) > 0 ? 'text-amber-600' : 'text-emerald-600'}>
                        {Number(item.remainingAmount) > 0 ? `Saldo ${formatCurrency(item.remainingAmount)}` : 'Quitado'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Leitura rapida do mes</CardTitle>
            <CardDescription>Resumo operacional para tomada de decisao.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border p-4">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <Clock3 className="h-4 w-4 text-primary" />
                Tempo medio de conversao
              </div>
              <p className="text-2xl font-semibold">{formatDays(selectedMonthSummary.averageConversionDays)}</p>
              <p className="text-sm text-muted-foreground">
                Na janela analitica, o menor ciclo foi {formatDays(conversionReport?.periodSummary.fastestConversionDays)} e o maior foi {formatDays(conversionReport?.periodSummary.slowestConversionDays)}.
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <Target className="h-4 w-4 text-primary" />
                Volume comercial
              </div>
              <p className="text-2xl font-semibold">{formatNumber(selectedMonthSummary.proposalsWonCount)} propostas ganhas</p>
              <p className="text-sm text-muted-foreground">
                {formatNumber(selectedMonthSummary.uniqueConvertedLeadsCount)} leads distintos geraram esses ganhos no mes.
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Pendencias imediatas
              </div>
              <p className="text-2xl font-semibold">{formatNumber(pendingWonProposals.length)} ganhos com saldo em aberto</p>
              <p className="text-sm text-muted-foreground">
                Use o relatorio de ganhos e o financeiro para acompanhar cobrancas e parcelas futuras.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Proximos vencimentos</CardTitle>
              <CardDescription>Contas a receber pendentes previstas para os proximos 30 dias.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/financial">Abrir financeiro</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {upcomingReceivables.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhum recebivel previsto para os proximos 30 dias.
                </div>
              ) : (
                upcomingReceivables.map((item: FinancialOverviewScheduleItem) => (
                  <div key={item.id} className="flex items-start justify-between rounded-lg border p-4">
                    <div className="space-y-1">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-sm text-muted-foreground">Vence em {formatDate(item.date)}</p>
                    </div>
                    <div className="text-right font-medium text-amber-600">
                      {formatCurrency(item.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Movimentacoes recentes</CardTitle>
              <CardDescription>Ultimas transacoes do overview financeiro para leitura operacional.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/financial">Ver fluxo</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentTransactions.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Nenhuma movimentacao recente encontrada.
                </div>
              ) : (
                recentTransactions.map((item: FinancialOverviewTransaction) => (
                  <div key={item.id} className="flex items-start justify-between rounded-lg border p-4">
                    <div className="space-y-1">
                      <p className="font-medium">{item.description}</p>
                      <p className="text-sm text-muted-foreground">{formatDate(item.date)}</p>
                    </div>
                    <div className={`text-right font-medium ${item.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {item.type === 'income' ? 'Entrada' : 'Saida'}: {formatCurrency(item.amount)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
