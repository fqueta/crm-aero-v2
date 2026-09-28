import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
import {
  Filter, RotateCcw, Printer, Download, User, Eye,
  TrendingUp, Wallet, Clock3, ListOrdered, CalendarClock,
} from 'lucide-react';
import { ganhosService, GanhoRow } from '@/services/ganhosService';
import { financialService } from '@/services/financialService';
import { coursesService } from '@/services/coursesService';
import { WonProposalReportResponse } from '@/types/financial';
import { PaginatedResponse } from '@/types/index';

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
function formatCurrency(value: number | string | null | undefined): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(value || 0));
}

/**
 * Formata datas (Y-m-d ou datetime) para o padrão brasileiro.
 */
function formatDate(date?: string | null): string {
  if (!date) return '-';
  const onlyDate = String(date).slice(0, 10);
  const parsed = new Date(`${onlyDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('pt-BR');
}

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Extrai os números do ganho a partir da meta da matrícula.
 * Chaves reais do backend: data_ganho, valor_negociado_ganho,
 * valor_pago / valor_recebido_ganho, saldo_ganho, financeiro_status_ganho.
 */
function getGanhoNumeros(row: GanhoRow): {
  gainDate: string | null;
  negociado: number;
  recebido: number;
  saldo: number;
  statusFin: string;
  observacao: string | null;
} {
  const meta = (row.meta ?? {}) as Record<string, unknown>;
  const gainDate =
    (typeof meta.data_ganho === 'string' && meta.data_ganho.slice(0, 10)) ||
    (typeof row.data === 'string' ? row.data.slice(0, 10) : null);
  const negociado = toNumber(
    meta.valor_negociado_ganho ?? (row as Record<string, unknown>).total ?? row.amount_brl ?? 0,
  );
  const recebido = toNumber(meta.valor_pago ?? meta.valor_recebido_ganho ?? 0);
  const saldoRaw = meta.saldo_ganho;
  const saldo =
    saldoRaw !== undefined && saldoRaw !== null && saldoRaw !== ''
      ? toNumber(saldoRaw)
      : Math.max(0, negociado - recebido);
  const statusFin =
    typeof meta.financeiro_status_ganho === 'string' && meta.financeiro_status_ganho
      ? meta.financeiro_status_ganho
      : negociado > 0 && saldo <= 0
        ? 'paid'
        : recebido > 0
          ? 'partial'
          : 'pending';
  const observacao =
    typeof meta.observacao_ganho === 'string' ? (meta.observacao_ganho as string) : null;
  return { gainDate, negociado, recebido, saldo, statusFin, observacao };
}

function getAlunoNome(row: GanhoRow): string {
  return (
    row.cliente_nome ||
    row.student_name ||
    (row as Record<string, unknown>).name as string ||
    '-'
  );
}

function getCursoNome(row: GanhoRow): string {
  return row.curso_nome || row.course_name || '-';
}

/**
 * Resolve a variante visual do badge conforme o status financeiro.
 */
function getStatusVariant(status?: string): 'default' | 'secondary' | 'outline' {
  if (status === 'paid') return 'default';
  if (status === 'partial') return 'secondary';
  return 'outline';
}

function getStatusLabel(status?: string): string {
  if (status === 'paid') return 'Pago';
  if (status === 'partial') return 'Parcial';
  if (status === 'pending') return 'Pendente';
  if (status === 'overdue') return 'Vencido';
  if (status === 'cancelled') return 'Cancelado';
  return status || '-';
}

/**
 * Escapa texto para HTML (impressão).
 */
function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Escapa valor para CSV com separador `;`.
 */
function escapeCsvValue(value: string | number | null | undefined): string {
  const text = String(value ?? '');
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

type FinStatus = 'all' | 'pending' | 'partial' | 'paid';

/**
 * SPA de listagem e acompanhamento dos ganhos.
 * Rota: /admin/school/ganhos (item "Ganhos" do menu Escola).
 * Combina visão comercial (matrículas status=g) + visão financeira
 * (resumo do relatório de propostas ganhas).
 */
export default function Ganhos() {
  const [report, setReport] = useState<PaginatedResponse<GanhoRow> | null>(null);
  const [financial, setFinancial] = useState<WonProposalReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFinancial, setIsLoadingFinancial] = useState(false);

  const [startDate, setStartDate] = useState(getMonthStartInputValue);
  const [endDate, setEndDate] = useState(getTodayInputValue);
  const [searchAluno, setSearchAluno] = useState('');
  const [courseId, setCourseId] = useState<string>('all');
  const [finStatus, setFinStatus] = useState<FinStatus>('all');
  const [perPage, setPerPage] = useState('15');
  const [courses, setCourses] = useState<{ id: string; titulo: string }[]>([]);

  const [isExporting, setIsExporting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);

  /**
   * Carrega a lista de cursos para o filtro.
   */
  useEffect(() => {
    (async () => {
      try {
        const data = await coursesService.listCourses({ per_page: 100 });
        const items = (data?.data ?? []).map((c) => ({
          id: String(c.id),
          titulo: c.titulo || 'Sem título',
        }));
        setCourses(items);
      } catch {
        // filtro de curso é opcional; segue sem ele
      }
    })();
  }, []);

  /**
   * Aplica os filtros de período/status nas linhas da tabela (client-side).
   * O backend de matrículas não filtra por data_ganho; o resumo financeiro
   * já vem filtrado por período no servidor.
   */
  const applyClientFilters = (rows: GanhoRow[]): GanhoRow[] => {
    return rows.filter((row) => {
      const n = getGanhoNumeros(row);
      if (startDate && (!n.gainDate || n.gainDate < startDate)) return false;
      if (endDate && (!n.gainDate || n.gainDate > endDate)) return false;
      if (finStatus !== 'all' && n.statusFin !== finStatus) return false;
      return true;
    });
  };

  /**
   * Busca tabela comercial + resumo financeiro respeitando os filtros atuais.
   */
  const loadData = async (page = 1) => {
    setIsLoading(true);
    setIsLoadingFinancial(true);
    try {
      const [table, fin] = await Promise.all([
        ganhosService.list({
          student: searchAluno.trim() || undefined,
          id_curso: courseId !== 'all' ? courseId : undefined,
          page,
          per_page: Number(perPage),
        }),
        financialService.reports.getWonProposalsReport({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          status: finStatus,
          search: searchAluno.trim() || undefined,
          page: 1,
          perPage: 1,
        }),
      ]);
      setReport(table);
      setFinancial(fin);
    } catch (error) {
      console.error('Erro ao carregar ganhos:', error);
      toast.error('Erro ao carregar os ganhos');
    } finally {
      setIsLoading(false);
      setIsLoadingFinancial(false);
    }
  };

  useEffect(() => {
    loadData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyFilters = () => {
    loadData(1);
  };

  const handleResetFilters = () => {
    const nextStart = getMonthStartInputValue();
    const nextEnd = getTodayInputValue();
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setSearchAluno('');
    setCourseId('all');
    setFinStatus('all');
    setPerPage('15');
    setIsLoading(true);
    setIsLoadingFinancial(true);
    Promise.all([
      ganhosService.list({ page: 1, per_page: 15 }),
      financialService.reports.getWonProposalsReport({
        startDate: nextStart,
        endDate: nextEnd,
        page: 1,
        perPage: 1,
      }),
    ])
      .then(([table, fin]) => {
        setReport(table);
        setFinancial(fin);
      })
      .catch(() => toast.error('Erro ao recarregar ganhos'))
      .finally(() => {
        setIsLoading(false);
        setIsLoadingFinancial(false);
      });
  };

  /**
   * Busca todas as páginas da tabela (para exportação/impressão completa).
   */
  const fetchAllRows = async (): Promise<GanhoRow[]> => {
    const all: GanhoRow[] = [];
    let page = 1;
    for (;;) {
      const data = await ganhosService.list({
        student: searchAluno.trim() || undefined,
        id_curso: courseId !== 'all' ? courseId : undefined,
        page,
        per_page: 100,
      });
      all.push(...(data?.data ?? []));
      if (page >= (data?.last_page ?? 1)) break;
      page += 1;
    }
    return applyClientFilters(all);
  };

  /**
   * Exporta a lista filtrada completa em CSV.
   */
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const rows = await fetchAllRows();
      const header = [
        'ID', 'Aluno', 'Curso', 'Data do ganho', 'Negociado (R$)',
        'Recebido (R$)', 'Saldo (R$)', 'Status financeiro', 'Observação',
      ];
      const lines = rows.map((row) => {
        const n = getGanhoNumeros(row);
        return [
          escapeCsvValue(row.id),
          escapeCsvValue(getAlunoNome(row)),
          escapeCsvValue(getCursoNome(row)),
          escapeCsvValue(n.gainDate ? formatDate(n.gainDate) : '-'),
          escapeCsvValue(n.negociado.toFixed(2).replace('.', ',')),
          escapeCsvValue(n.recebido.toFixed(2).replace('.', ',')),
          escapeCsvValue(n.saldo.toFixed(2).replace('.', ',')),
          escapeCsvValue(getStatusLabel(n.statusFin)),
          escapeCsvValue(n.observacao ?? ''),
        ].join(';');
      });
      const csv = '\uFEFF' + header.join(';') + "\n" + lines.join("\n");
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ganhos-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success('CSV exportado.');
    } catch {
      toast.error('Não foi possível exportar o CSV.');
    } finally {
      setIsExporting(false);
    }
  };

  /**
   * Imprime a lista filtrada completa em nova janela.
   */
  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      const rows = await fetchAllRows();
      const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
      if (!win) {
        toast.error('Permita pop-ups para imprimir.');
        return;
      }
      const body = rows
        .map((row, i) => {
          const n = getGanhoNumeros(row);
          return `<tr><td>${i + 1}</td><td>${escapeHtml(getAlunoNome(row))}</td><td>${escapeHtml(getCursoNome(row))}</td><td>${escapeHtml(n.gainDate ? formatDate(n.gainDate) : '-')}</td><td>${escapeHtml(formatCurrency(n.negociado))}</td><td>${escapeHtml(formatCurrency(n.recebido))}</td><td>${escapeHtml(getStatusLabel(n.statusFin))}</td></tr>`;
        })
        .join('');
      win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Ganhos</title>
        <style>body{font-family:Arial,sans-serif;margin:24px;color:#111}h1{font-size:20px;margin:0}p{font-size:12px;color:#555}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #999;padding:6px 8px;font-size:12px;text-align:left}th{background:#eee}</style>
        </head><body><h1>Ganhos</h1><p>Período: ${escapeHtml(startDate || '—')} a ${escapeHtml(endDate || '—')} • Total: ${rows.length}</p>
        <table><thead><tr><th>#</th><th>Aluno</th><th>Curso</th><th>Data do ganho</th><th>Negociado</th><th>Recebido</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>
        <script>window.onload=function(){window.print();};</script></body></html>`);
      win.document.close();
    } catch {
      toast.error('Não foi possível preparar a impressão.');
    } finally {
      setIsPrinting(false);
    }
  };

  const summary = financial?.summary;
  const visibleRows = applyClientFilters(report?.data ?? []);
  const from = report && report.total > 0 ? (report.current_page - 1) * report.per_page + 1 : 0;
  const to = report ? Math.min(report.current_page * report.per_page, report.total) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Ganhos</h1>
        <p className="text-sm text-muted-foreground">
          Listagem e acompanhamento das propostas ganhas: valores negociados, recebimentos e saldos.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="ganhos-start-date">Data inicial (ganho)</Label>
              <Input
                id="ganhos-start-date"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ganhos-end-date">Data final (ganho)</Label>
              <Input
                id="ganhos-end-date"
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ganhos-aluno">Aluno</Label>
              <Input
                id="ganhos-aluno"
                placeholder="Nome do aluno"
                value={searchAluno}
                onChange={(event) => setSearchAluno(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleApplyFilters();
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ganhos-course">Curso</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger id="ganhos-course">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.titulo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ganhos-status">Status financeiro</Label>
              <Select value={finStatus} onValueChange={(value: FinStatus) => setFinStatus(value)}>
                <SelectTrigger id="ganhos-status">
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
              <Label htmlFor="ganhos-per-page">Registros por página</Label>
              <Select value={perPage} onValueChange={setPerPage}>
                <SelectTrigger id="ganhos-per-page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="15">15</SelectItem>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
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
            <Button variant="outline" onClick={handlePrint} disabled={isPrinting || isLoading}>
              <Printer className="mr-2 h-4 w-4" />
              {isPrinting ? 'Preparando...' : 'Imprimir'}
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={isExporting || isLoading}>
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? 'Exportando...' : 'Exportar CSV'}
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
            <div className="text-2xl font-bold">
              {isLoadingFinancial ? '…' : formatCurrency(summary?.negotiatedAmount ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">{summary?.totalAccounts ?? 0} ganhos no período</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total recebido</CardTitle>
            <Wallet className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingFinancial ? '…' : formatCurrency(summary?.paidAmount ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground">{summary?.paidAccounts ?? 0} propostas quitadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo pendente</CardTitle>
            <Clock3 className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isLoadingFinancial ? '…' : formatCurrency(summary?.remainingAmount ?? 0)}
            </div>
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
            <div className="text-2xl font-bold">
              {isLoadingFinancial ? '…' : formatCurrency(summary?.conversionAverage ?? 0)}
            </div>
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
            {(financial?.statusBreakdown ?? []).map((item) => (
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
                    <span className="text-muted-foreground">Saldo</span>
                    <span className={`font-medium ${item.remainingAmount <= 0 ? 'text-emerald-600' : ''}`}>
                      {item.remainingAmount <= 0 ? 'Saldo quitado' : formatCurrency(item.remainingAmount)}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {(financial?.statusBreakdown?.length ?? 0) === 0 && (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground md:col-span-3">
                {isLoadingFinancial ? 'Carregando resumo financeiro...' : 'Nenhum ganho encontrado para os filtros informados.'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Propostas ganhas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Data do ganho</TableHead>
                <TableHead>Negociado</TableHead>
                <TableHead>Recebido</TableHead>
                <TableHead>Saldo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row, idx) => {
                const n = getGanhoNumeros(row);
                return (
                  <TableRow key={String(row.id)}>
                    <TableCell>{from + idx}</TableCell>
                    <TableCell className="font-medium">{getAlunoNome(row)}</TableCell>
                    <TableCell>{getCursoNome(row)}</TableCell>
                    <TableCell>{n.gainDate ? formatDate(n.gainDate) : '—'}</TableCell>
                    <TableCell>{formatCurrency(n.negociado)}</TableCell>
                    <TableCell>{formatCurrency(n.recebido)}</TableCell>
                    <TableCell className={n.saldo <= 0 ? 'font-medium text-emerald-600' : undefined}>
                      {n.saldo <= 0 ? 'Quitado' : formatCurrency(n.saldo)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusVariant(n.statusFin)}>{getStatusLabel(n.statusFin)}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        {row.id_cliente ? (
                          <Button variant="outline" size="icon" asChild title="Ver cliente">
                            <Link to={`/admin/clients/${row.id_cliente}/view`}>
                              <User className="h-4 w-4" />
                            </Link>
                          </Button>
                        ) : null}
                        <Button variant="outline" size="icon" asChild title="Ver proposta">
                          <Link to={`/admin/sales/proposals/view/${row.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}

              {visibleRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    {isLoading ? 'Carregando...' : 'Nenhum ganho para os filtros informados.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-muted-foreground">
              Exibindo {from} a {to} de {report?.total ?? 0} registros
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                disabled={isLoading || !report || report.current_page <= 1}
                onClick={() => loadData((report?.current_page ?? 1) - 1)}
              >
                Anterior
              </Button>
              <div className="text-sm text-muted-foreground">
                Página {report?.current_page ?? 1} de {report?.last_page ?? 1}
              </div>
              <Button
                variant="outline"
                disabled={isLoading || !report || report.current_page >= report.last_page}
                onClick={() => loadData((report?.current_page ?? 1) + 1)}
              >
                Próximo
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            Período e status financeiro filtram os cards (contas proposal_gain) e a tabela (data_ganho da matrícula).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
