import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { toast } from 'react-hot-toast';
import { Filter, RotateCcw, TrendingUp, Wallet, Clock3, ListOrdered } from 'lucide-react';
import { financialService } from '@/services/financialService';
import { WonProposalReportResponse } from '@/types/financial';

/**
 * Retorna a data atual no formato aceito por inputs do tipo date.
 */
function getTodayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Retorna o primeiro dia do mês atual no formato aceito por inputs do tipo date.
 */
function getMonthStartInputValue(): string {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}

/**
 * Formata valores monetários no padrão pt-BR.
 */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

/**
 * Formata datas ISO curtas para o padrão brasileiro.
 */
function formatDate(date?: string | null): string {
  if (!date) {
    return '-';
  }

  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleDateString('pt-BR');
}

/**
 * Resolve a variante visual do badge conforme o status financeiro.
 */
function getStatusVariant(status?: string): 'default' | 'secondary' | 'outline' {
  if (status === 'paid') {
    return 'default';
  }

  if (status === 'partial') {
    return 'secondary';
  }

  return 'outline';
}

/**
 * Calcula o percentual recebido em relacao ao valor negociado.
 */
function getReceivedPercentage(negotiatedAmount: number, paidAmount: number): string {
  if (negotiatedAmount <= 0) {
    return '0%';
  }

  return `${Math.min(100, (paidAmount / negotiatedAmount) * 100).toFixed(1)}%`;
}

/**
 * Página dedicada ao relatório geral de propostas ganhas.
 */
export default function WonProposalsReport() {
  const [report, setReport] = useState<WonProposalReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [startDate, setStartDate] = useState(getMonthStartInputValue);
  const [endDate, setEndDate] = useState(getTodayInputValue);
  const [status, setStatus] = useState<'all' | 'pending' | 'partial' | 'paid'>('all');
  const [search, setSearch] = useState('');

  /**
   * Busca o relatório no backend respeitando os filtros atuais.
   */
  const loadReport = async (page = 1) => {
    setIsLoading(true);

    try {
      const data = await financialService.reports.getWonProposalsReport({
        startDate,
        endDate,
        status,
        search: search.trim() || undefined,
        page,
        perPage: 15,
      });

      setReport(data);
    } catch (error) {
      console.error('Erro ao carregar relatório de ganhos:', error);
      toast.error('Erro ao carregar relatório geral dos ganhos');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Recarrega o relatório inicial ao abrir a página.
   */
  useEffect(() => {
    loadReport(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Aplica os filtros atuais reiniciando a paginação.
   */
  const handleApplyFilters = () => {
    loadReport(1);
  };

  /**
   * Limpa os filtros e recarrega o relatório padrão do mês atual.
   */
  const handleResetFilters = async () => {
    const nextStartDate = getMonthStartInputValue();
    const nextEndDate = getTodayInputValue();

    setStartDate(nextStartDate);
    setEndDate(nextEndDate);
    setStatus('all');
    setSearch('');

    setIsLoading(true);
    try {
      const data = await financialService.reports.getWonProposalsReport({
        startDate: nextStartDate,
        endDate: nextEndDate,
        page: 1,
        perPage: 15,
      });

      setReport(data);
    } catch (error) {
      console.error('Erro ao recarregar relatório de ganhos:', error);
      toast.error('Erro ao recarregar relatório');
    } finally {
      setIsLoading(false);
    }
  };

  const summary = report?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Relatório Geral dos Ganhos</h1>
        <p className="text-sm text-muted-foreground">
          Acompanhe propostas ganhas, valores negociados, recebimentos e saldos pendentes.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="won-report-start-date">Data inicial</Label>
              <Input
                id="won-report-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="won-report-end-date">Data final</Label>
              <Input
                id="won-report-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="won-report-status">Status financeiro</Label>
              <Select value={status} onValueChange={(value: 'all' | 'pending' | 'partial' | 'paid') => setStatus(value)}>
                <SelectTrigger id="won-report-status">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="partial">Parciais</SelectItem>
                  <SelectItem value="paid">Pagos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="won-report-search">Busca</Label>
              <Input
                id="won-report-search"
                placeholder="Aluno, contrato ou proposta"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    handleApplyFilters();
                  }
                }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleApplyFilters} disabled={isLoading}>
              <Filter className="mr-2 h-4 w-4" />
              {isLoading ? 'Carregando...' : 'Aplicar filtros'}
            </Button>
            <Button variant="outline" onClick={handleResetFilters} disabled={isLoading}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Limpar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor negociado</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.negotiatedAmount ?? 0)}</div>
            <p className="text-xs text-muted-foreground">{summary?.totalAccounts ?? 0} ganhos no período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total recebido</CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.paidAmount ?? 0)}</div>
            <p className="text-xs text-muted-foreground">{summary?.paidAccounts ?? 0} propostas quitadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo pendente</CardTitle>
            <Clock3 className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.remainingAmount ?? 0)}</div>
            <p className="text-xs text-muted-foreground">
              {summary?.pendingAccounts ?? 0} pendentes e {summary?.partialAccounts ?? 0} parciais
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket médio</CardTitle>
            <ListOrdered className="h-4 w-4 text-violet-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(summary?.conversionAverage ?? 0)}</div>
            <p className="text-xs text-muted-foreground">Média por proposta ganha</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status do período</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {(report?.statusBreakdown ?? []).map((item) => (
              <div key={item.status} className="rounded-lg border p-4">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant={getStatusVariant(item.status)}>{item.label}</Badge>
                  <span className="text-sm text-muted-foreground">{item.totalAccounts} propostas</span>
                </div>
                <div className="mt-4 space-y-1 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Negociado</span>
                    <span className="font-medium">{formatCurrency(item.negotiatedAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Recebido</span>
                    <span className="font-medium">{formatCurrency(item.paidAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">% recebido</span>
                    <span className="font-medium">
                      {getReceivedPercentage(item.negotiatedAmount, item.paidAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Saldo</span>
                    <span className={`font-medium ${item.remainingAmount <= 0 ? 'text-emerald-600' : ''}`}>
                      {item.remainingAmount <= 0 ? 'Saldo quitado' : formatCurrency(item.remainingAmount)}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {(report?.statusBreakdown?.length ?? 0) === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground md:col-span-3">
                Nenhum ganho encontrado para os filtros informados.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalhamento das propostas ganhas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proposta</TableHead>
                <TableHead>Data do ganho</TableHead>
                <TableHead>Negociado</TableHead>
                <TableHead>Recebido</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Parcelas</TableHead>
                <TableHead>Ultimo recebimento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report?.data ?? []).map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="min-w-[280px]">
                    <div className="space-y-1">
                      <div className="font-medium">{item.customerName || item.description}</div>
                      <div className="text-xs text-muted-foreground">
                        Proposta #{item.matriculaId ?? item.id}
                        {item.contractNumber ? ` • Contrato ${item.contractNumber}` : ''}
                      </div>
                      {item.gainObservation && (
                        <div className="line-clamp-2 text-xs text-muted-foreground">
                          {item.gainObservation}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{formatDate(item.gainDate)}</TableCell>
                  <TableCell>{formatCurrency(item.negotiatedAmount)}</TableCell>
                  <TableCell>{formatCurrency(item.paidAmount)}</TableCell>
                  <TableCell className={item.remainingAmount <= 0 ? 'font-medium text-emerald-600' : undefined}>
                    {item.remainingAmount <= 0 ? 'Quitado' : formatCurrency(item.remainingAmount)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={getStatusVariant(item.status)}>{item.statusLabel}</Badge>
                  </TableCell>
                  <TableCell>{item.paymentsCount}</TableCell>
                  <TableCell>{formatDate(item.lastPaymentDate)}</TableCell>
                </TableRow>
              ))}

              {(report?.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma proposta ganha encontrada para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              Exibindo {report?.from ?? 0} a {report?.to ?? 0} de {report?.total ?? 0} registros
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={isLoading || !report || report.current_page <= 1}
                onClick={() => loadReport((report?.current_page ?? 1) - 1)}
              >
                Anterior
              </Button>
              <div className="text-sm text-muted-foreground">
                Página {report?.current_page ?? 1} de {report?.last_page ?? 1}
              </div>
              <Button
                variant="outline"
                disabled={isLoading || !report || report.current_page >= report.last_page}
                onClick={() => loadReport((report?.current_page ?? 1) + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
