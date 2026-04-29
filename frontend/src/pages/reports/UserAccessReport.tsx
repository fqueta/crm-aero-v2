import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { AlertTriangle, Clock3, LogIn, LogOut, RefreshCcw, ShieldCheck } from 'lucide-react';
import { useUsersList } from '@/hooks/users';
import { userAccessReportService } from '@/services/userAccessReportService';
import { UserAccessReportResponse } from '@/types/user-access-report';

/**
 * Retorna a data atual no formato aceito por inputs do tipo date.
 */
function getTodayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Retorna o primeiro dia da janela padrão de 30 dias.
 */
function getDefaultStartInputValue(): string {
  const date = new Date();
  date.setDate(date.getDate() - 29);
  date.setHours(0, 0, 0, 0);
  return date.toISOString().slice(0, 10);
}

/**
 * Ajusta o período para evitar datas invertidas ou futuras.
 */
function normalizeDateRange(startDate?: string, endDate?: string): { startDate: string; endDate: string } {
  const today = getTodayInputValue();
  let normalizedStartDate = startDate || getDefaultStartInputValue();
  let normalizedEndDate = endDate || today;

  if (normalizedStartDate > today) {
    normalizedStartDate = today;
  }

  if (normalizedEndDate > today) {
    normalizedEndDate = today;
  }

  if (normalizedStartDate > normalizedEndDate) {
    normalizedStartDate = normalizedEndDate;
  }

  return {
    startDate: normalizedStartDate,
    endDate: normalizedEndDate,
  };
}

/**
 * Formata datas ISO para o padrão brasileiro com hora.
 */
function formatDateTime(value?: string | null): string {
  if (!value) {
    return '-';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '-';
  }

  return parsed.toLocaleString('pt-BR');
}

/**
 * Exibe inteiros no padrão pt-BR.
 */
function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(Number(value || 0));
}

/**
 * Traduz o status operacional do usuário.
 */
function getOperationalStatusLabel(status?: string | null, activeFlag?: string | null): string {
  if ((activeFlag ?? '').toLowerCase() === 'n') {
    return 'Inativo';
  }

  if ((status ?? '').toLowerCase() === 'actived') {
    return 'Ativo';
  }

  if (status) {
    return status;
  }

  return '-';
}

/**
 * Página do relatório de acesso de usuários do sistema.
 */
export default function UserAccessReport() {
  const [report, setReport] = useState<UserAccessReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(getDefaultStartInputValue);
  const [endDate, setEndDate] = useState(getTodayInputValue);
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { data: usersData } = useUsersList({ per_page: 200, sort: 'name' });

  const internalUsers = useMemo(() => {
    return (usersData?.data ?? []).filter((user) => {
      const permissionId = Number(user.permission_id ?? 0);
      return permissionId !== 5 && permissionId !== 8;
    });
  }, [usersData?.data]);

  /**
   * Carrega o relatório com os filtros atuais.
   */
  const loadReport = async (nextPage = page) => {
    const normalizedRange = normalizeDateRange(startDate, endDate);

    setIsLoading(true);
    setLoadError(null);

    try {
      const data = await userAccessReportService.getReport({
        start_date: normalizedRange.startDate,
        end_date: normalizedRange.endDate,
        user_id: selectedUserId !== 'all' ? selectedUserId : undefined,
        search: search.trim() || undefined,
        page: nextPage,
        per_page: 25,
      });

      setStartDate(normalizedRange.startDate);
      setEndDate(normalizedRange.endDate);
      setReport(data);
      setPage(nextPage);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao carregar relatório de acessos';
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const summary = report?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatório de Acessos</h1>
          <p className="text-muted-foreground">
            Auditoria de login, logout, atividade recente e sessões ativas dos usuários do sistema.
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          Restrito a permission_id = 1
        </Badge>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="flex items-start gap-3 pt-6">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />
          <div className="text-sm text-amber-900">
            O histórico confiável deste relatório passa a crescer a partir da gravação de eventos de login e logout.
            Sessões ativas e última atividade usam os tokens atuais como apoio operacional.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>Defina o período e refine por usuário, quando necessário.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="space-y-2">
            <Label htmlFor="user-access-start-date">Data inicial</Label>
            <Input
              id="user-access-start-date"
              type="date"
              value={startDate}
              max={endDate || getTodayInputValue()}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-access-end-date">Data final</Label>
            <Input
              id="user-access-end-date"
              type="date"
              value={endDate}
              min={startDate}
              max={getTodayInputValue()}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Usuário</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os usuários" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os usuários</SelectItem>
                {internalUsers.map((user) => (
                  <SelectItem key={String(user.id)} value={String(user.id)}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="user-access-search">Busca</Label>
            <Input
              id="user-access-search"
              placeholder="Nome ou email"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          <div className="flex items-end gap-2">
            <Button className="w-full" onClick={() => loadReport(1)} disabled={isLoading}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {loadError ? (
        <Card>
          <CardContent className="py-10 text-center">
            <div className="text-lg font-semibold text-destructive">Erro ao carregar relatório</div>
            <p className="mt-2 text-sm text-muted-foreground">{loadError}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Usuários no recorte
            </CardTitle>
            <CardDescription>Base após filtros aplicados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatNumber(summary?.totalUsers ?? 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <LogIn className="h-4 w-4 text-emerald-600" />
              Usuários com login
            </CardTitle>
            <CardDescription>Usuários únicos com acesso no período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatNumber(summary?.usersWithLoginInPeriod ?? 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <LogIn className="h-4 w-4 text-primary" />
              Total de logins
            </CardTitle>
            <CardDescription>Eventos de login registrados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatNumber(summary?.totalLoginEvents ?? 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <LogOut className="h-4 w-4 text-amber-600" />
              Total de logouts
            </CardTitle>
            <CardDescription>Eventos de logout registrados</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatNumber(summary?.totalLogoutEvents ?? 0)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock3 className="h-4 w-4 text-emerald-600" />
              Sessões ativas
            </CardTitle>
            <CardDescription>Usuários com token ativo no momento</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatNumber(summary?.usersWithActiveSessions ?? 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usuários</CardTitle>
          <CardDescription>
            Último login, último logout, atividade recente e quantidade de acessos por usuário.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Permissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Logins</TableHead>
                <TableHead>Logouts</TableHead>
                <TableHead>Último login</TableHead>
                <TableHead>Último logout</TableHead>
                <TableHead>Última atividade</TableHead>
                <TableHead>Sessões</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    Carregando relatório...
                  </TableCell>
                </TableRow>
              ) : report?.data?.length ? (
                report.data.map((item) => (
                  <TableRow key={item.userId}>
                    <TableCell>
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground">{item.email}</div>
                    </TableCell>
                    <TableCell>{item.permissionId ?? '-'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={item.isOnline ? 'default' : 'secondary'} className="w-fit">
                          {item.isOnline ? 'Online' : 'Offline'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {getOperationalStatusLabel(item.status, item.activeFlag)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{formatNumber(item.loginCount)}</TableCell>
                    <TableCell>{formatNumber(item.logoutCount)}</TableCell>
                    <TableCell>
                      <div>{formatDateTime(item.lastLoginAt)}</div>
                      <div className="text-xs text-muted-foreground">{item.lastLoginIp || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <div>{formatDateTime(item.lastLogoutAt)}</div>
                      <div className="text-xs text-muted-foreground">{item.lastLogoutIp || '-'}</div>
                    </TableCell>
                    <TableCell>{formatDateTime(item.lastActivityAt || item.lastAccessAt)}</TableCell>
                    <TableCell>{formatNumber(item.activeSessions)}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                    Nenhum acesso encontrado no período selecionado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              Mostrando página {report?.current_page ?? 1} de {report?.last_page ?? 1} com total de{' '}
              {formatNumber(report?.total ?? 0)} registros.
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => loadReport(Math.max(1, page - 1))}
                disabled={isLoading || page <= 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                onClick={() => loadReport(Math.min(report?.last_page ?? page, page + 1))}
                disabled={isLoading || page >= (report?.last_page ?? 1)}
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
