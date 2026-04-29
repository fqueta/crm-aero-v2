import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogFooter,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import { CircleHelp, Download, Filter, RotateCcw, Users, Target, Percent, Clock3 } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Line,
} from 'recharts';
import { financialService } from '@/services/financialService';
import {
  GeneralConversionReportDetailResponse,
  GeneralConversionReportDetailType,
  GeneralConversionReportResponse,
} from '@/types/financial';
import { useUsersList } from '@/hooks/users';
import { useFunnelsList } from '@/hooks/funnels';

/**
 * Retorna a data atual no formato aceito por inputs do tipo date.
 */
function getTodayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Retorna o primeiro dia do período padrão de 6 meses.
 */
function getDefaultStartInputValue(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 5, 1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

/**
 * Ajusta o intervalo para evitar datas futuras e períodos invertidos.
 */
function normalizeDateRange(startDate?: string, endDate?: string): {
  startDate: string;
  endDate: string;
  adjusted: boolean;
} {
  const today = getTodayInputValue();
  let normalizedStartDate = startDate || getDefaultStartInputValue();
  let normalizedEndDate = endDate || today;
  let adjusted = false;

  if (normalizedStartDate > today) {
    normalizedStartDate = today;
    adjusted = true;
  }

  if (normalizedEndDate > today) {
    normalizedEndDate = today;
    adjusted = true;
  }

  if (normalizedStartDate > normalizedEndDate) {
    normalizedStartDate = normalizedEndDate;
    adjusted = true;
  }

  return {
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
    adjusted,
  };
}

/**
 * Formata números inteiros no padrão pt-BR.
 */
function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}

/**
 * Formata percentuais com duas casas decimais.
 */
function formatPercentage(value: number): string {
  return `${Number(value || 0).toFixed(2)}%`;
}

/**
 * Formata moeda no padrão brasileiro.
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

/**
 * Formata datas ISO curtas para exibição em pt-BR.
 */
function formatDate(value?: string | null): string {
  if (!value) {
    return '-';
  }

  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleDateString('pt-BR');
}

/**
 * Exibe dias de conversão com fallback amigável.
 */
function formatDays(value?: number | null): string {
  if (value === null || value === undefined) {
    return '-';
  }

  return `${value} dias`;
}

/**
 * Escapa um valor para uso seguro em linhas CSV.
 */
function escapeCsvValue(value: unknown): string {
  const normalized = value === null || value === undefined ? '' : String(value);
  const escaped = normalized.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Gera uma linha CSV usando separador ponto e vírgula.
 */
function buildCsvLine(values: unknown[]): string {
  return values.map(escapeCsvValue).join(';');
}

/**
 * Faz o download de um conteúdo CSV compatível com Excel.
 */
function downloadCsvFile(filename: string, contents: string): void {
  const blob = new Blob([`\uFEFF${contents}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Página do relatório geral de conversão comercial.
 */
export default function GeneralConversionReport() {
  const navigate = useNavigate();
  const location = useLocation();
  const [report, setReport] = useState<GeneralConversionReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(getDefaultStartInputValue);
  const [endDate, setEndDate] = useState(getTodayInputValue);
  const [consultantId, setConsultantId] = useState<string>('all');
  const [funnelId, setFunnelId] = useState<string>('all');
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<GeneralConversionReportDetailResponse | null>(null);
  const { data: consultantsData } = useUsersList({ consultores: true, per_page: 200, sort: 'name' });
  const { data: funnelsData } = useFunnelsList({ per_page: 200 });
  const consultants = (consultantsData?.data ?? []).filter((consultant) => {
    return (Number(consultant.permission_id) || 0) < 7;
  });
  const funnels = (funnelsData?.data ?? []).slice().sort((a, b) => {
    const orderA = a.order ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.order ?? Number.MAX_SAFE_INTEGER;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  /**
   * Busca o relatório no backend respeitando o período informado.
   */
  const loadReport = async (
    nextStartDate = startDate,
    nextEndDate = endDate,
    nextConsultantId = consultantId,
    nextFunnelId = funnelId
  ) => {
    const normalizedRange = normalizeDateRange(nextStartDate, nextEndDate);

    if (normalizedRange.adjusted) {
      setStartDate(normalizedRange.startDate);
      setEndDate(normalizedRange.endDate);
    }

    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await financialService.reports.getGeneralConversionReport({
        startDate: normalizedRange.startDate,
        endDate: normalizedRange.endDate,
        consultantId: nextConsultantId !== 'all' ? nextConsultantId : undefined,
        funnelId: nextFunnelId !== 'all' ? nextFunnelId : undefined,
      });

      setReport(data);
    } catch (error) {
      console.error('Erro ao carregar relatório geral de conversão:', error);
      setReport(null);
      setLoadError('Nao foi possivel carregar os dados do relatório. Verifique o backend e tente novamente.');
      toast.error('Erro ao carregar relatório geral');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Carrega o relatório inicial ao abrir a página.
   */
  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Aplica os filtros atuais.
   */
  const handleApplyFilters = () => {
    const normalizedRange = normalizeDateRange(startDate, endDate);

    if (normalizedRange.adjusted) {
      setStartDate(normalizedRange.startDate);
      setEndDate(normalizedRange.endDate);
      toast('Periodo ajustado para um intervalo valido.');
    }

    loadReport(normalizedRange.startDate, normalizedRange.endDate, consultantId, funnelId);
  };

  /**
   * Restaura o período padrão e recarrega o relatório.
   */
  const handleResetFilters = () => {
    const defaultStartDate = getDefaultStartInputValue();
    const defaultEndDate = getTodayInputValue();

    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
    setConsultantId('all');
    setFunnelId('all');
    loadReport(defaultStartDate, defaultEndDate, 'all', 'all');
  };

  /**
   * Carrega a lista detalhada correspondente a um card do período selecionado.
   */
  const handleOpenDetail = async (type: GeneralConversionReportDetailType) => {
    setIsDetailOpen(true);
    setIsDetailLoading(true);

    try {
      const data = await financialService.reports.getGeneralConversionReportDetails(type, {
        startDate,
        endDate,
        consultantId: consultantId !== 'all' ? consultantId : undefined,
        funnelId: funnelId !== 'all' ? funnelId : undefined,
      });

      setDetailData(data);
    } catch (error) {
      console.error('Erro ao carregar detalhamento do relatório:', error);
      setDetailData(null);
      toast.error('Nao foi possivel carregar a lista detalhada');
    } finally {
      setIsDetailLoading(false);
    }
  };

  /**
   * Exporta o relatório atual em CSV para abertura no Excel.
   */
  const handleExportCsv = () => {
    if (!report) {
      toast.error('Nao ha dados para exportar');
      return;
    }

    const selectedConsultantName = consultantId !== 'all'
      ? consultants.find((item) => item.id === consultantId)?.name || 'Consultor selecionado'
      : 'Todos os consultores';
    const selectedFunnelName = funnelId !== 'all'
      ? funnels.find((item) => item.id === funnelId)?.name || 'Funil selecionado'
      : 'Todos os funis';

    const csvSections = [
      buildCsvLine(['Relatório geral de conversão']),
      buildCsvLine(['Período inicial', report.filters.startDate]),
      buildCsvLine(['Período final', report.filters.endDate]),
      buildCsvLine(['Consultor', selectedConsultantName]),
      buildCsvLine(['Funil', selectedFunnelName]),
      '',
      buildCsvLine(['Resumo do mês atual']),
      buildCsvLine(['Indicador', 'Valor']),
      buildCsvLine(['Leads captados', currentMonthSummary?.leadsCount ?? 0]),
      buildCsvLine(['Leads únicos convertidos', currentMonthSummary?.uniqueConvertedLeadsCount ?? 0]),
      buildCsvLine(['Propostas ganhas', currentMonthSummary?.proposalsWonCount ?? currentMonthSummary?.conversionsCount ?? 0]),
      buildCsvLine(['Taxa de conversão', formatPercentage(currentMonthSummary?.conversionRate ?? 0)]),
      buildCsvLine(['Tempo médio', formatDays(currentMonthSummary?.averageConversionDays ?? 0)]),
      '',
      buildCsvLine(['Resumo do período']),
      buildCsvLine(['Indicador', 'Valor']),
      buildCsvLine(['Leads captados', periodSummary?.leadsCount ?? 0]),
      buildCsvLine(['Leads únicos convertidos', periodSummary?.uniqueConvertedLeadsCount ?? 0]),
      buildCsvLine(['Propostas ganhas', periodSummary?.proposalsWonCount ?? periodSummary?.conversionsCount ?? 0]),
      buildCsvLine(['Taxa de conversão', formatPercentage(periodSummary?.conversionRate ?? 0)]),
      buildCsvLine(['Tempo médio', formatDays(periodSummary?.averageConversionDays ?? 0)]),
      buildCsvLine(['Tempo mediano', formatDays(periodSummary?.medianConversionDays ?? 0)]),
      '',
      buildCsvLine(['Conversão mensal']),
      buildCsvLine(['Mês', 'Leads', 'Leads convertidos', 'Propostas ganhas', 'Taxa', 'Tempo médio']),
      ...(report.monthlyConversion ?? []).map((item) =>
        buildCsvLine([
          item.label,
          item.leads,
          item.uniqueConvertedLeads,
          item.proposalsWon,
          formatPercentage(item.conversionRate),
          formatDays(item.averageConversionDays),
        ])
      ),
      '',
      buildCsvLine(['Desempenho por consultor']),
      buildCsvLine(['Consultor', 'Leads', 'Leads convertidos', 'Propostas ganhas', 'Taxa', 'Tempo médio']),
      ...(report.consultantBreakdown ?? []).map((item) =>
        buildCsvLine([
          item.consultantName,
          item.leadsCount,
          item.uniqueConvertedLeadsCount,
          item.proposalsWonCount,
          formatPercentage(item.conversionRate),
          formatDays(item.averageConversionDays),
        ])
      ),
      '',
      buildCsvLine(['Propostas ganhas recentes']),
      buildCsvLine(['Lead', 'Matrícula', 'Entrada do lead', 'Data do ganho', 'Tempo', 'Consultor', 'Negociado']),
      ...(report.recentConversions ?? []).map((item) =>
        buildCsvLine([
          item.leadName,
          item.matriculaId,
          formatDate(item.leadCreatedAt),
          formatDate(item.gainDate),
          formatDays(item.conversionDays),
          item.consultantName || '-',
          formatCurrency(item.negotiatedAmount),
        ])
      ),
    ];

    const filename = `relatorio-geral-conversao-${report.filters.startDate}-${report.filters.endDate}.csv`;
    downloadCsvFile(filename, csvSections.join('\r\n'));
    toast.success('Exportação iniciada');
  };

  /**
   * Abre a visualização do lead correspondente.
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
   * Abre a visualização da proposta correspondente.
   */
  const openProposalView = (proposalId?: string | null) => {
    if (!proposalId) {
      return;
    }

    navigate(`/admin/sales/proposals/view/${encodeURIComponent(String(proposalId))}`, {
      state: { from: location },
    });
  };

  const currentMonthSummary = report?.currentMonth.summary;
  const periodSummary = report?.periodSummary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Relatório geral de conversão</h1>
          <p className="text-sm text-muted-foreground">
            Acompanha captação de leads, vendas concluídas e tempo até o ganho da proposta.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => setIsHelpOpen(true)}>
          <CircleHelp className="mr-2 h-4 w-4" />
          Como ler este relatório
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros do período
          </CardTitle>
          <CardDescription>
            O resumo do mês atual fica sempre visível; os gráficos e a tabela seguem o intervalo abaixo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-6">
          <div className="space-y-2">
            <Label htmlFor="general-report-start-date">Data inicial</Label>
            <Input
              id="general-report-start-date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              max={endDate || getTodayInputValue()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="general-report-end-date">Data final</Label>
            <Input
              id="general-report-end-date"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              min={startDate || undefined}
              max={getTodayInputValue()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="general-report-consultant">Consultor</Label>
            <Select value={consultantId} onValueChange={setConsultantId}>
              <SelectTrigger id="general-report-consultant">
                <SelectValue placeholder="Todos os consultores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os consultores</SelectItem>
                {consultants.map((consultant) => (
                  <SelectItem key={consultant.id} value={consultant.id}>
                    {consultant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="general-report-funnel">Funil</Label>
            <Select value={funnelId} onValueChange={setFunnelId}>
              <SelectTrigger id="general-report-funnel">
                <SelectValue placeholder="Todos os funis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os funis</SelectItem>
                {funnels.map((funnel) => (
                  <SelectItem key={funnel.id} value={String(funnel.id)}>
                    {funnel.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2 md:col-span-2">
            <Button onClick={handleApplyFilters} disabled={isLoading} className="min-w-[140px]">
              <Filter className="mr-2 h-4 w-4" />
              Aplicar filtros
            </Button>
            <Button type="button" variant="outline" onClick={handleExportCsv} disabled={isLoading || !report}>
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
            <Button type="button" variant="outline" onClick={handleResetFilters} disabled={isLoading}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Resetar
            </Button>
          </div>
        </CardContent>
      </Card>

      {loadError && (
        <Card className="border-destructive/40">
          <CardContent className="pt-6 text-sm text-destructive">
            {loadError}
          </CardContent>
        </Card>
      )}

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Mês atual</h2>
          <p className="text-sm text-muted-foreground">
            Baseado nas entradas e ganhos registrados em {report?.currentMonth.label ?? getTodayInputValue().slice(5, 7)}/{getTodayInputValue().slice(0, 4)}.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Leads captados</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Users className="h-5 w-5 text-primary" />
                {formatNumber(currentMonthSummary?.leadsCount ?? 0)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Leads unicos convertidos</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Target className="h-5 w-5 text-primary" />
                {formatNumber(currentMonthSummary?.uniqueConvertedLeadsCount ?? 0)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Propostas ganhas</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Percent className="h-5 w-5 text-primary" />
                {formatNumber(currentMonthSummary?.proposalsWonCount ?? currentMonthSummary?.conversionsCount ?? 0)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Taxa de conversao</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Clock3 className="h-5 w-5 text-primary" />
                {formatPercentage(currentMonthSummary?.conversionRate ?? 0)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold">Período selecionado</h2>
          <p className="text-sm text-muted-foreground">
            De {formatDate(report?.filters.startDate)} até {formatDate(report?.filters.endDate)}.
            {consultantId !== 'all' && ` Consultor filtrado: ${consultants.find((item) => item.id === consultantId)?.name || 'Selecionado'}.`}
            {funnelId !== 'all' && ` Funil filtrado: ${funnels.find((item) => item.id === funnelId)?.name || 'Selecionado'}.`}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="transition-colors hover:border-primary/40">
            <button type="button" className="w-full text-left" onClick={() => handleOpenDetail('leads')}>
            <CardHeader className="pb-2">
              <CardDescription>Leads no período</CardDescription>
              <CardTitle className="text-2xl">{formatNumber(periodSummary?.leadsCount ?? 0)}</CardTitle>
              <p className="text-xs text-primary">Clique para ver a lista</p>
            </CardHeader>
            </button>
          </Card>
          <Card className="transition-colors hover:border-primary/40">
            <button type="button" className="w-full text-left" onClick={() => handleOpenDetail('unique_converted_leads')}>
            <CardHeader className="pb-2">
              <CardDescription>Leads unicos convertidos</CardDescription>
              <CardTitle className="text-2xl">{formatNumber(periodSummary?.uniqueConvertedLeadsCount ?? 0)}</CardTitle>
              <p className="text-xs text-primary">Clique para ver a lista</p>
            </CardHeader>
            </button>
          </Card>
          <Card className="transition-colors hover:border-primary/40">
            <button type="button" className="w-full text-left" onClick={() => handleOpenDetail('won_proposals')}>
            <CardHeader className="pb-2">
              <CardDescription>Propostas ganhas</CardDescription>
              <CardTitle className="text-2xl">{formatNumber(periodSummary?.proposalsWonCount ?? periodSummary?.conversionsCount ?? 0)}</CardTitle>
              <p className="text-xs text-primary">Clique para ver a lista</p>
            </CardHeader>
            </button>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Conversão do período</CardDescription>
              <CardTitle className="text-2xl">{formatPercentage(periodSummary?.conversionRate ?? 0)}</CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Conversão mensal</CardTitle>
            <CardDescription>
              Compara leads captados, leads unicos convertidos, propostas ganhas e taxa de conversao ao longo do período.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={report?.monthlyConversion ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" />
                  <YAxis yAxisId="count" allowDecimals={false} />
                  <YAxis yAxisId="rate" orientation="right" tickFormatter={(value) => `${value}%`} />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === 'Taxa') {
                        return [formatPercentage(value), name];
                      }

                      return [formatNumber(value), name];
                    }}
                  />
                  <Legend />
                  <Bar yAxisId="count" dataKey="leads" name="Leads" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  <Bar yAxisId="count" dataKey="uniqueConvertedLeads" name="Leads convertidos" fill="hsl(var(--secondary))" radius={[6, 6, 0, 0]} />
                  <Bar yAxisId="count" dataKey="proposalsWon" name="Propostas ganhas" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                  <Line yAxisId="rate" type="monotone" dataKey="conversionRate" name="Taxa" stroke="#f59e0b" strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tempo de conversão</CardTitle>
            <CardDescription>
              Distribuição dos leads convertidos por faixas de dias até o ganho.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Tempo médio</div>
                <div className="text-lg font-semibold">{formatDays(periodSummary?.averageConversionDays ?? 0)}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Tempo mediano</div>
                <div className="text-lg font-semibold">{formatDays(periodSummary?.medianConversionDays ?? 0)}</div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Propostas por lead convertido</div>
                <div className="text-lg font-semibold">
                  {periodSummary && (periodSummary.uniqueConvertedLeadsCount ?? 0) > 0
                    ? `${((periodSummary.proposalsWonCount ?? periodSummary.conversionsCount ?? 0) / (periodSummary.uniqueConvertedLeadsCount ?? 1)).toFixed(2)}x`
                    : '0.00x'}
                </div>
              </div>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={report?.conversionTimeBuckets ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="bucket" />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value: number) => [formatNumber(value), 'Leads']} />
                  <Bar dataKey="count" name="Leads" fill="#14b8a6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Desempenho por consultor</CardTitle>
          <CardDescription>
            Consolida leads, conversões e tempo médio por consultor no período selecionado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(report?.consultantBreakdown ?? []).slice(0, 10)}
                layout="vertical"
                margin={{ top: 8, right: 24, left: 24, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="consultantName"
                  width={140}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'Taxa') {
                      return [formatPercentage(value), name];
                    }

                    return [formatNumber(value), name];
                  }}
                />
                <Legend />
                <Bar dataKey="uniqueConvertedLeadsCount" name="Leads convertidos" fill="hsl(var(--secondary))" radius={[0, 6, 6, 0]} />
                <Bar dataKey="proposalsWonCount" name="Propostas ganhas" fill="#14b8a6" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Consultor</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Leads convertidos</TableHead>
                <TableHead>Propostas ganhas</TableHead>
                <TableHead>Taxa</TableHead>
                <TableHead>Tempo médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report?.consultantBreakdown ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhum consultor encontrado para o período informado.
                  </TableCell>
                </TableRow>
              )}
              {(report?.consultantBreakdown ?? []).map((item) => (
                <TableRow key={item.consultantId ?? item.consultantName}>
                  <TableCell className="font-medium">{item.consultantName}</TableCell>
                  <TableCell>{formatNumber(item.leadsCount)}</TableCell>
                  <TableCell>{formatNumber(item.uniqueConvertedLeadsCount)}</TableCell>
                  <TableCell>{formatNumber(item.proposalsWonCount)}</TableCell>
                  <TableCell>{formatPercentage(item.conversionRate)}</TableCell>
                  <TableCell>{formatDays(item.averageConversionDays)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Propostas ganhas recentes</CardTitle>
          <CardDescription>
            Lista dos ganhos registrados no período; um mesmo lead pode aparecer mais de uma vez quando possui mais de uma proposta ganha.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Entrada do lead</TableHead>
                <TableHead>Data do ganho</TableHead>
                <TableHead>Tempo</TableHead>
                <TableHead>Consultor</TableHead>
                <TableHead>Negociado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report?.recentConversions ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Nenhuma conversão encontrada para o período informado.
                  </TableCell>
                </TableRow>
              )}
              {(report?.recentConversions ?? []).map((item) => (
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
                        Matrícula #{item.matriculaId}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(item.leadCreatedAt)}</TableCell>
                  <TableCell>{formatDate(item.gainDate)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatDays(item.conversionDays)}</Badge>
                  </TableCell>
                  <TableCell>{item.consultantName || '-'}</TableCell>
                  <TableCell>{formatCurrency(item.negotiatedAmount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isHelpOpen} onOpenChange={setIsHelpOpen}>
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Como ler este relatório</DialogTitle>
            <DialogDescription>
              Este painel mostra captação, conversão e tempo até o ganho da proposta.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(90vh-160px)] space-y-4 overflow-y-auto pr-2 text-sm text-muted-foreground">
            <div className="rounded-lg border p-4">
              <div className="font-medium text-foreground">Regra principal</div>
              <p className="mt-2">
                `Leads convertidos` são os leads que tiveram pelo menos uma proposta marcada como
                `ganho` no período filtrado.
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="font-medium text-foreground">Leads captados</div>
              <p className="mt-2">
                Quantidade de leads criados no período. A base usa a data de entrada do lead no CRM.
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="font-medium text-foreground">Leads únicos convertidos</div>
              <p className="mt-2">
                Conta cada lead apenas uma vez, mesmo que ele tenha fechado mais de uma proposta ganha.
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="font-medium text-foreground">Propostas ganhas</div>
              <p className="mt-2">
                Mostra o total de propostas marcadas como ganho. Um mesmo lead pode aparecer mais de uma vez aqui.
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="font-medium text-foreground">Taxa de conversão</div>
              <p className="mt-2">
                Calculada por `leads únicos convertidos / leads captados`. Por isso ela representa conversão de leads, não volume de propostas.
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="font-medium text-foreground">Tempo de conversão</div>
              <p className="mt-2">
                É a diferença entre a data de criação do lead e a data em que a proposta foi marcada como ganho.
              </p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="font-medium text-foreground">Exemplo</div>
              <p className="mt-2">
                Se um lead entrou em `23/03` e a matrícula foi concluída em `25/04`, o tempo de conversão é de `32 dias`.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsHelpOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDetailOpen}
        onOpenChange={(open) => {
          setIsDetailOpen(open);
          if (!open) {
            setDetailData(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-[960px]">
          <DialogHeader>
            <DialogTitle>{detailData?.title ?? 'Detalhamento do período'}</DialogTitle>
            <DialogDescription>
              Lista dos registros que compõem o total do card selecionado.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[calc(90vh-160px)] overflow-y-auto">
            {isDetailLoading && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Carregando detalhamento...
              </div>
            )}

            {!isDetailLoading && detailData && detailData.items.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                Nenhum registro encontrado para o filtro atual.
              </div>
            )}

            {!isDetailLoading && detailData?.type === 'leads' && detailData.items.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Data de entrada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailData.items.map((item: any) => (
                    <TableRow key={item.leadId}>
                      <TableCell>
                        <button
                          type="button"
                          className="font-medium text-primary hover:underline"
                          onClick={() => openLeadView(item.leadId)}
                        >
                          {item.leadName}
                        </button>
                      </TableCell>
                      <TableCell>{formatDate(item.leadCreatedAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {!isDetailLoading && detailData?.type === 'unique_converted_leads' && detailData.items.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Primeiro ganho</TableHead>
                    <TableHead>Tempo</TableHead>
                    <TableHead>Consultor</TableHead>
                    <TableHead>Propostas ganhas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailData.items.map((item: any) => (
                    <TableRow key={item.leadId}>
                      <TableCell>
                        <button
                          type="button"
                          className="font-medium text-primary hover:underline"
                          onClick={() => openLeadView(item.leadId)}
                        >
                          {item.leadName}
                        </button>
                      </TableCell>
                      <TableCell>{formatDate(item.leadCreatedAt)}</TableCell>
                      <TableCell>{formatDate(item.gainDate)}</TableCell>
                      <TableCell>{formatDays(item.conversionDays)}</TableCell>
                      <TableCell>{item.consultantName || '-'}</TableCell>
                      <TableCell>{formatNumber(item.proposalsWonCount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {!isDetailLoading && detailData?.type === 'won_proposals' && detailData.items.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Matrícula</TableHead>
                    <TableHead>Entrada</TableHead>
                    <TableHead>Ganho</TableHead>
                    <TableHead>Tempo</TableHead>
                    <TableHead>Consultor</TableHead>
                    <TableHead>Negociado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailData.items.map((item: any) => (
                    <TableRow key={`${item.matriculaId}-${item.gainDate}`}>
                      <TableCell>
                        <button
                          type="button"
                          className="font-medium text-primary hover:underline"
                          onClick={() => openLeadView(item.leadId)}
                        >
                          {item.leadName}
                        </button>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="text-primary hover:underline"
                          onClick={() => openProposalView(item.matriculaId)}
                        >
                          #{item.matriculaId}
                        </button>
                      </TableCell>
                      <TableCell>{formatDate(item.leadCreatedAt)}</TableCell>
                      <TableCell>{formatDate(item.gainDate)}</TableCell>
                      <TableCell>{formatDays(item.conversionDays)}</TableCell>
                      <TableCell>{item.consultantName || '-'}</TableCell>
                      <TableCell>{formatCurrency(item.negotiatedAmount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDetailOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
