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
  Filter, RotateCcw, Printer, Download, User, MessageCircle,
  Pencil, Check, X, CalendarClock, FileWarning,
} from 'lucide-react';
import { contratosVencidosService, ContratoVencidoRow, ContratosVencidosResponse } from '@/services/contratosVencidosService';
import { coursesService } from '@/services/coursesService';

/**
 * Escapa texto para HTML (impressão).
 */
function escapeHtml(value: string): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Página do relatório de contratos vencidos (espelho do legado).
 * Regra híbrida: validade explícita (config.validade_contrato) ou
 * calculada (data_contrato/data_inicio + vigência).
 */
export default function ContratosVencidosReport() {
  const [report, setReport] = useState<ContratosVencidosResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [courseId, setCourseId] = useState<string>('all');
  const [perPage, setPerPage] = useState('10');
  const [courses, setCourses] = useState<{ id: string; titulo: string }[]>([]);

  // Edição inline da validade
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isSavingValidade, setIsSavingValidade] = useState(false);

  // Envio WhatsApp
  const [sendingId, setSendingId] = useState<number | null>(null);

  // Exportação / impressão
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
   * Busca o relatório no backend respeitando os filtros atuais.
   */
  const loadReport = async (page = 1) => {
    setIsLoading(true);
    try {
      const data = await contratosVencidosService.list({
        search: search.trim() || undefined,
        id_curso: courseId !== 'all' ? Number(courseId) : undefined,
        page,
        per_page: Number(perPage),
      });
      setReport(data);
    } catch (error) {
      console.error('Erro ao carregar contratos vencidos:', error);
      toast.error('Erro ao carregar o relatório de contratos vencidos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReport(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyFilters = () => {
    loadReport(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setCourseId('all');
    setPerPage('10');
    setIsLoading(true);
    contratosVencidosService
      .list({ page: 1, per_page: 10 })
      .then(setReport)
      .catch(() => toast.error('Erro ao recarregar relatório'))
      .finally(() => setIsLoading(false));
  };

  const currentFilters = () => ({
    search: search.trim() || undefined,
    id_curso: courseId !== 'all' ? Number(courseId) : undefined,
  });

  /**
   * Busca todas as páginas (para impressão completa).
   */
  const fetchAllRows = async (): Promise<ContratoVencidoRow[]> => {
    const all: ContratoVencidoRow[] = [];
    let page = 1;
    for (;;) {
      const data = await contratosVencidosService.list({ ...currentFilters(), page, per_page: 100 });
      all.push(...(data?.data ?? []));
      if (page >= (data?.last_page ?? 1)) break;
      page += 1;
    }
    return all;
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
        .map(
          (r, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(r.aluno)}</td><td>${escapeHtml(r.curso)}</td><td>${escapeHtml(r.validade_br)}</td><td>${escapeHtml(r.telefone || '-')}</td></tr>`
        )
        .join('');
      win.document.write(`<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Contratos vencidos</title>
        <style>body{font-family:Arial,sans-serif;margin:24px;color:#111}h1{font-size:20px;margin:0}p{font-size:12px;color:#555}table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #999;padding:6px 8px;font-size:12px;text-align:left}th{background:#eee}</style>
        </head><body><h1>Contratos vencidos</h1><p>Data da consulta: ${escapeHtml(report?.data_consulta ?? '')} • Total vencidos: ${rows.length}</p>
        <table><thead><tr><th>#</th><th>Aluno</th><th>Curso</th><th>Validade</th><th>Telefone</th></tr></thead><tbody>${body}</tbody></table>
        <script>window.onload=function(){window.print();};</script></body></html>`);
      win.document.close();
    } catch {
      toast.error('Não foi possível preparar a impressão.');
    } finally {
      setIsPrinting(false);
    }
  };

  /**
   * Exporta a lista filtrada completa em CSV.
   */
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const blob = await contratosVencidosService.exportCsv(currentFilters());
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `contratos-vencidos-${new Date().toISOString().slice(0, 10)}.csv`;
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
   * Envia cobrança de renovação via WhatsApp (ZapGuru).
   */
  const handleWhatsapp = async (row: ContratoVencidoRow) => {
    if (!row.telefone) {
      toast.error('Aluno sem telefone cadastrado.');
      return;
    }
    if (!window.confirm(`Enviar mensagem de renovação para ${row.aluno} via WhatsApp?`)) return;
    setSendingId(row.matricula_id);
    try {
      const ret = await contratosVencidosService.sendWhatsapp(row.matricula_id);
      toast.success(ret?.message || 'Mensagem enviada via WhatsApp!');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao enviar WhatsApp.');
    } finally {
      setSendingId(null);
    }
  };

  /**
   * Salva a validade explícita (vazio = volta à regra calculada).
   */
  const handleSaveValidade = async (row: ContratoVencidoRow) => {
    setIsSavingValidade(true);
    try {
      await contratosVencidosService.setValidade(row.matricula_id, editingValue || null);
      toast.success('Validade atualizada.');
      setEditingId(null);
      loadReport(report?.current_page ?? 1);
    } catch {
      toast.error('Falha ao salvar validade.');
    } finally {
      setIsSavingValidade(false);
    }
  };

  const startEditingValidade = (row: ContratoVencidoRow) => {
    setEditingId(row.matricula_id);
    setEditingValue(row.origem === 'cadastrada' ? row.validade : '');
  };

  const from = report && report.total > 0 ? (report.current_page - 1) * report.per_page + 1 : 0;
  const to = report ? Math.min(report.current_page * report.per_page, report.total) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">Contratos vencidos</h1>
        <p className="text-sm text-muted-foreground">
          Data da consulta: {report?.data_consulta ?? '—'} • Total vencidos: {report?.total_vencidos ?? 0}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="cv-search">Procurar</Label>
              <Input
                id="cv-search"
                placeholder="Aluno ou curso"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleApplyFilters();
                }}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cv-course">Curso</Label>
              <Select value={courseId} onValueChange={setCourseId}>
                <SelectTrigger id="cv-course">
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
              <Label htmlFor="cv-per-page">Registros por página</Label>
              <Select value={perPage} onValueChange={setPerPage}>
                <SelectTrigger id="cv-per-page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-amber-600" />
            Contratos vencidos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(report?.data ?? []).map((row, idx) => (
                <TableRow key={row.matricula_id}>
                  <TableCell>{from + idx}</TableCell>
                  <TableCell className="font-medium">{row.aluno}</TableCell>
                  <TableCell>{row.curso}</TableCell>
                  <TableCell>
                    {editingId === row.matricula_id ? (
                      <div className="flex items-center gap-1">
                        <Input
                          type="date"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="h-8 w-[150px]"
                          disabled={isSavingValidade}
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSaveValidade(row)} disabled={isSavingValidade} title="Salvar (vazio = calculada)">
                          <Check className="h-4 w-4 text-emerald-600" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingId(null)} disabled={isSavingValidade} title="Cancelar">
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{row.validade_br}</span>
                        <Badge variant={row.origem === 'cadastrada' ? 'default' : 'outline'} title={row.origem === 'cadastrada' ? 'Validade cadastrada manualmente' : 'Validade calculada (data do contrato + vigência)'}>
                          {row.origem === 'cadastrada' ? 'Cadastrada' : 'Calculada'}
                        </Badge>
                        <span className="text-xs text-muted-foreground">há {row.dias_vencido}d</span>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEditingValidade(row)} title="Editar validade">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>{row.telefone || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="outline" size="icon" asChild title="Ver cliente">
                        <Link to={`/admin/clients/${row.cliente_id}/view`}>
                          <User className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button
                        size="icon"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleWhatsapp(row)}
                        disabled={sendingId === row.matricula_id}
                        title="Enviar cobrança via WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {(report?.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    {isLoading ? 'Carregando...' : 'Nenhum contrato vencido para os filtros informados.'}
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
                Próximo
              </Button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" />
            Validade "Cadastrada" vem do campo manual da matrícula; "Calculada" usa data do contrato + vigência padrão (12 meses).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
