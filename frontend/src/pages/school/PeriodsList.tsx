import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useQuery, useQueries } from '@tanstack/react-query';
import { usePeriodsList, useDeletePeriod } from '@/hooks/periods';
import type { PeriodRecord, PeriodStatus } from '@/types/periods';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableRow, TableHead, TableCell, TableBody } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, ChevronLeft, ChevronRight, MoreHorizontal, Plus } from 'lucide-react';
import { Combobox, useComboboxOptions } from '@/components/ui/combobox';
import { coursesService } from '@/services/coursesService';
import { contractsService } from '@/services/contractsService';
import { aircraftService } from '@/services/aircraftService';
import { Badge } from '@/components/ui/badge';
import { currencyApplyMask } from '@/lib/masks/currency';

/**
 * PeriodsList
 * pt-BR: Listagem de períodos com busca, filtro de status, paginação e ações.
 * en-US: Periods listing with search, status filter, pagination, and actions.
 */
export default function PeriodsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [courseSearch, setCourseSearch] = useState<string>('');

  /**
   * syncFilterFromUrl
   * pt-BR: Inicializa o filtro de curso a partir do parâmetro de URL `id_curso`.
   * en-US: Initializes the course filter from the URL parameter `id_curso`.
   */
  useEffect(() => {
    const cid = String(searchParams.get('id_curso') || '');
    if (cid && cid !== selectedCourseId) {
      setSelectedCourseId(cid);
      setPage(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  /**
   * persistFilterToUrl
   * pt-BR: Persiste o filtro `id_curso` na URL quando o usuário altera o curso.
   * en-US: Persists the `id_curso` filter to the URL when user changes the course.
   */
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedCourseId) {
      next.set('id_curso', String(selectedCourseId));
    } else {
      next.delete('id_curso');
    }
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId]);

  const { data, isLoading, refetch } = usePeriodsList(
    {
      page,
      per_page: perPage,
      name: search || undefined,
      status: statusFilter === 'all' ? undefined : (statusFilter as PeriodStatus),
      id_curso: selectedCourseId ? Number(selectedCourseId) : undefined,
    },
    { keepPreviousData: true }
  );

  /**
   * coursesQuery
   * pt-BR: Busca cursos para popular o combobox de filtro de cursos.
   * en-US: Fetches courses to populate the course filter combobox.
   */
  const coursesQuery = useQuery({
    queryKey: ['cursos', 'list', 200, courseSearch],
    queryFn: async () => coursesService.listCourses({ page: 1, per_page: 200, search: courseSearch }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const courseItems = (coursesQuery.data?.data || coursesQuery.data?.items || []) as any[];
  const courseOptions = useComboboxOptions(courseItems, 'id', 'nome', undefined, (c: any) => String(c?.titulo || ''));

  /**
   * selectedCourseLabel
   * pt-BR: Obtém o label do curso selecionado para exibir no feedback visual.
   * en-US: Gets the selected course label to display in visual feedback.
   */
  const selectedCourseLabel = useMemo(() => {
    const opt = (courseOptions || []).find((o: any) => String(o?.value) === String(selectedCourseId));
    return String(opt?.label || '') || '';
  }, [courseOptions, selectedCourseId]);

  const items = useMemo(() => data?.data ?? [], [data]);
  const totalPages = useMemo(() => data?.last_page ?? 1, [data]);

  //
  // Contracts fetching per course to map labels on list
  // pt-BR: Busca contratos por curso presente na página atual para exibir labels.
  // en-US: Fetch contracts per course present in current page to display labels.
  const courseIds = useMemo(() => Array.from(new Set(items.map((p: PeriodRecord) => p.id_curso).filter(Boolean))), [items]);
  const contractsQueries = useQueries({
    queries: courseIds.map((cid) => ({
      queryKey: ['contracts', 'by_course', cid],
      queryFn: async () => contractsService.listContracts({ page: 1, per_page: 200, id_curso: cid as any }),
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })),
  });
  const contractsByCourse: Record<string, any[]> = {};
  contractsQueries.forEach((q, idx) => {
    const cid = String(courseIds[idx]);
    const arr = (q.data?.data || q.data?.items || []) as any[];
    contractsByCourse[cid] = arr || [];
  });

  // --- Cursos incluídos mapping ---
  /**
   * includedCourseIds
   * pt-BR: IDs únicos de cursos presentes em cursos_incluidos nos períodos da página.
   * en-US: Unique course IDs present in cursos_incluidos of periods on the page.
   */
  const includedCourseIds = useMemo(
    () => Array.from(new Set(
      items.flatMap((p: PeriodRecord) => Array.isArray((p as any).cursos_incluidos) ? (p as any).cursos_incluidos : [])
        .map((id: any) => String(id))
    )),
    [items]
  );

  /**
   * includedCoursesQueries
   * pt-BR: Busca lista ampla de cursos (até 200) e filtra pelos IDs necessários para exibir labels.
   * en-US: Fetch a broad course list (up to 200) and filter by needed IDs to display labels.
   */
  const includedCoursesQuery = useQuery({
    queryKey: ['cursos', 'included_for_list', includedCourseIds.join(',')],
    queryFn: async () => {
      if (includedCourseIds.length === 0) return { data: [] } as any;
      return coursesService.listCourses({ page: 1, per_page: 200 });
    },
    enabled: includedCourseIds.length > 0,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const includedCourses = (includedCoursesQuery.data?.data || includedCoursesQuery.data?.items || []) as any[];

  /**
   * getIncludedCourseLabels
   * pt-BR: Mapeia IDs de cursos para labels amigáveis (título ou nome).
   * en-US: Maps course IDs to friendly labels (title or name).
   */
  function getIncludedCourseLabels(p: PeriodRecord): string[] {
    const ids = Array.isArray((p as any).cursos_incluidos) ? (p as any).cursos_incluidos : [];
    return ids.map((cid: any) => {
      const c = includedCourses.find((x: any) => String(x?.id) === String(cid));
      return String(c?.titulo || c?.nome || cid);
    });
  }

  /**
   * getModuleTypeLabel
   * pt-BR: Retorna label amigável para tipo_modulo.
   * en-US: Returns friendly label for tipo_modulo.
   */
  function getModuleTypeLabel(tipo?: number | string | null): string {
    const v = tipo == null ? null : Number(tipo);
    if (v === 1) return 'Teórico';
    if (v === 2) return 'Prático';
    if (v === 3) return 'Teórico/Prático';
    return '—';
  }

  /**
   * getContractLabels
   * pt-BR: Retorna os nomes/labels dos contratos selecionados para um período.
   * en-US: Returns the names/labels of selected contracts for a period.
   */
  function getContractLabels(period: PeriodRecord): string[] {
    const ids = (period.id_contratos || []).map(String);
    if (!period.id_curso) return ids; // fallback: retorna IDs quando não há curso
    const list = contractsByCourse[String(period.id_curso)] || [];
    const labelById = new Map<string, string>(
      list.map((c: any) => [String(c.id), String(c?.nome || c?.title || c?.slug || c.id)])
    );
    // console.log('list', list);
    
    return ids.map((id) => labelById.get(id) || id);
  }

  /**
   * aircraftQuery
   * pt-BR: Busca aeronaves para exibir labels na listagem.
   * en-US: Fetches aircraft to display labels in the listing.
   */
  const { data: aircraftList } = useQuery({
    queryKey: ['aeronaves', 'list', 200],
    queryFn: async () => aircraftService.listAircraft({ page: 1, per_page: 200 }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const aircraftItems = ((aircraftList as any)?.data || (aircraftList as any)?.items || []) as any[];
  const aircraftLabelById = useMemo(() => {
    const map = new Map<string, string>();
    aircraftItems.forEach((a: any) => {
      /**
       * Preferência de label
       * pt-BR: Prioriza campo "nome"; fallback para matrícula, descrição, identificador primário e ID.
       * en-US: Prioritize "nome" field; fallback to matricula, description, identifier_primary, and ID.
       */
      const base = String(a?.nome || a?.matricula || a?.description || a?.identifier_primary || a?.id);
      map.set(String(a.id), base);
    });
    return map;
  }, [aircraftItems]);

  /**
   * getAircraftLabels
   * pt-BR: Retorna labels das aeronaves selecionadas do período.
   * en-US: Returns labels of selected aircraft for the period.
   */
  function getAircraftLabels(period: PeriodRecord): string[] {
    const ids = (period.aeronaves || []).map(String);
    return ids.map((id) => aircraftLabelById.get(id) || id);
  }

  const deleteMutation = useDeletePeriod({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periods'] });
      refetch();
    },
  });
  
  /**
   * getQuerySuffixWithCourse
   * pt-BR: Retorna sufixo de query com `id_curso` se houver curso selecionado.
   * en-US: Returns query suffix with `id_curso` if a course is selected.
   */
  function getQuerySuffixWithCourse(): string {
    return selectedCourseId ? `?id_curso=${encodeURIComponent(String(selectedCourseId))}` : '';
  }

  /**
   * handleBackToPrevious
   * pt-BR: Se houver curso selecionado, volta para edição do curso na aba
   *        "Módulos". Caso contrário, tenta voltar no histórico e, na falta,
   *        permanece na listagem preservando o filtro.
   * en-US: If a course is selected, navigates to course edit page on
   *        "Modules" tab. Otherwise, tries history back; if unavailable,
   *        stays on the listing preserving the filter.
   */
  const handleBackToPrevious = () => {
    if (selectedCourseId) {
      navigate(`/admin/school/courses/${encodeURIComponent(String(selectedCourseId))}/edit?tab=modules`);
      return;
    }
    if (typeof window !== 'undefined' && window.history && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(`/admin/school/periods${getQuerySuffixWithCourse()}`);
  };

  /**
   * handleCreate
   * pt-BR: Navega para criação preservando filtro de curso na URL.
   * en-US: Navigates to creation preserving course filter in URL.
   */
  const handleCreate = () => navigate(`/admin/school/periods/create${getQuerySuffixWithCourse()}`);

  /**
   * handleEdit
   * pt-BR: Navega para edição preservando filtro de curso na URL.
   * en-US: Navigates to edit preserving course filter in URL.
   */
  const handleEdit = (id: string | number) => navigate(`/admin/school/periods/${id}/edit${getQuerySuffixWithCourse()}`);
  /**
   * handleView
   * pt-BR: Navega para a página de detalhes do período selecionado.
   * en-US: Navigates to the selected period's detail page.
   */
  const handleView = (id: string | number) => navigate(`/admin/school/periods/${id}${getQuerySuffixWithCourse()}`);

  /**
   * formatValorDisplay
   * pt-BR: Formata o valor do período vindo da API. Se número ou string só com dígitos
   *        (ex.: 17820), trata como reais e exibe em BRL (R$ 17.820,00).
   *        Para strings já mascaradas (ex.: "17.820,00"), preserva usando a máscara.
   *        Null/indefinido retorna "—".
   * en-US: Formats period amount from API. If number or digits-only string (e.g., 17820),
   *        treats as reais and displays BRL (R$ 17,820.00). For already masked strings
   *        (e.g., "17.820,00"), preserves using the mask. Null/undefined returns "—".
   */
  function formatValorDisplay(val?: number | string | null): string {
    if (val === null || val === undefined || String(val) === '') return '—';
    // Números: tratar como reais
    if (typeof val === 'number') {
      try {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(val);
      } catch {
        return `R$ ${(Number(val) || 0).toFixed(2)}`;
      }
    }
    const s = String(val).trim();
    // String apenas dígitos: tratar como reais
    if (/^\d+$/.test(s)) {
      const n = parseInt(s, 10);
      try {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(n);
      } catch {
        return `R$ ${(Number(n) || 0).toFixed(2)}`;
      }
    }
    // Strings com separadores: usar máscara para normalizar exibição
    return currencyApplyMask(s, 'pt-BR', 'BRL');
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            onClick={handleBackToPrevious}
            className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-50 transition-all duration-200"
          >
            <ChevronLeft className="w-4 h-4 mr-1 text-zinc-500" />
            Voltar
          </Button>
          <div className="h-6 w-[1px] bg-zinc-200 dark:bg-zinc-800"></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Períodos</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Configure as etapas, custos, aeronaves e contratos para os cursos</p>
          </div>
        </div>
        <Button 
          onClick={handleCreate}
          className="rounded-xl h-10 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/10 text-white font-medium transition-all duration-300 transform active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo período
        </Button>
      </div>

      <Card className="p-6 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm rounded-2xl bg-white dark:bg-zinc-950 space-y-6">
        {/* Barra de Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-zinc-400" /> Buscar por nome
            </Label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nome do período"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 focus:bg-white dark:focus:bg-zinc-950 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
              />
              <Button 
                variant="secondary" 
                onClick={() => refetch()}
                className="h-10 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-900 dark:hover:bg-zinc-850 hover:text-zinc-900 transition-all duration-200"
              >
                <Search className="w-4 h-4 text-zinc-500" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Status do período
            </Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <SelectTrigger className="h-10 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 focus:bg-white dark:focus:bg-zinc-950 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200">
                <SelectValue placeholder="Filtro de status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="publish">Publicado</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span> Curso principal
            </Label>
            <Combobox
              options={courseOptions}
              value={selectedCourseId}
              onValueChange={(val) => {
                setSelectedCourseId(val);
                setPage(1);
              }}
              placeholder="Selecionar curso..."
              searchPlaceholder="Pesquisar curso pelo nome..."
              emptyText={courseItems.length === 0 ? 'Nenhum curso encontrado' : 'Digite para filtrar'}
              disabled={coursesQuery.isLoading}
              loading={coursesQuery.isLoading || coursesQuery.isFetching}
              onSearch={setCourseSearch}
              searchTerm={courseSearch}
              debounceMs={250}
              className="h-10 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 text-left"
            />
          </div>
        </div>

        {/* Filtros Ativos */}
        {(search || selectedCourseId || (statusFilter !== 'all')) && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-150 dark:border-zinc-900/80">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 dark:text-zinc-500">Filtros ativos:</span>
            {search && (
              <Badge variant="secondary" className="rounded-lg px-2.5 py-0.5 border border-zinc-200 bg-white font-medium text-xs text-zinc-750 dark:text-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 shadow-sm" title="Filtro de busca aplicado">
                {`Nome: "${search}"`}
              </Badge>
            )}
            {statusFilter !== 'all' && (
              <Badge variant="outline" className="rounded-lg px-2.5 py-0.5 border border-zinc-200 bg-white font-medium text-xs text-zinc-750 dark:text-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 shadow-sm" title="Filtro de status aplicado">
                {`Status: ${statusFilter === 'publish' ? 'Publicado' : 'Rascunho'}`}
              </Badge>
            )}
            {selectedCourseId && (
              <Badge variant="secondary" className="rounded-lg px-2.5 py-0.5 border border-zinc-200 bg-white font-medium text-xs text-zinc-750 dark:text-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 shadow-sm truncate max-w-[320px]" title="Filtro de curso aplicado">
                {`Curso: ${selectedCourseLabel || selectedCourseId}`}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg px-2 ml-auto"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setSelectedCourseId('');
                setCourseSearch('');
                setPage(1);
                refetch();
                const next = new URLSearchParams(searchParams);
                next.delete('id_curso');
                setSearchParams(next, { replace: true });
              }}
            >
              Limpar filtros
            </Button>
          </div>
        )}

        {/* Tabela de Resultados */}
        <div className="overflow-hidden border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-sm">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-50/60 dark:bg-zinc-900/30">
                <TableRow className="hover:bg-transparent border-zinc-200 dark:border-zinc-800">
                  <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11">Nome</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11">Curso</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11">Valor</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11">Horas Práticas</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11">Horas Teóricas</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11">Tipo de Módulo</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11">Cursos Incluídos</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11">Aeronaves</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11">Contratos</TableHead>
                  <TableHead className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground h-11">Status</TableHead>
                  <TableHead className="w-12 h-11" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-zinc-500">
                      Carregando períodos...
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-zinc-500">
                      Nenhum período encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {items.map((p: PeriodRecord) => (
                  <TableRow 
                    key={String(p.id)} 
                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/35 border-zinc-200 dark:border-zinc-800 transition-colors duration-150"
                  >
                    <TableCell className="font-semibold text-zinc-900 dark:text-zinc-150">{p.nome}</TableCell>
                    <TableCell className="text-zinc-650 dark:text-zinc-400 font-mono text-[11px]">{p.id_curso ?? '—'}</TableCell>
                    <TableCell className="font-semibold text-zinc-900 dark:text-zinc-100">{formatValorDisplay((p as any).valor)}</TableCell>
                    <TableCell className="text-zinc-700 dark:text-zinc-300 font-medium">{p.h_praticas ?? '0'}</TableCell>
                    <TableCell className="text-zinc-700 dark:text-zinc-300 font-medium">{p.h_teoricas ?? '0'}</TableCell>
                    <TableCell className="text-zinc-600 dark:text-zinc-400 text-xs font-medium">
                      {getModuleTypeLabel((p as any).tipo_modulo)}
                    </TableCell>
                    <TableCell>
                      {Array.isArray((p as any).cursos_incluidos) && (p as any).cursos_incluidos.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                          {getIncludedCourseLabels(p).map((label) => (
                            <Badge 
                              key={`${p.id}-inc-${label}`} 
                              className="rounded-md border border-sky-100 bg-sky-50 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950/20 dark:border-sky-900/30 dark:text-sky-400 shadow-sm truncate max-w-[160px]"
                            >
                              {label}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-650">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {Array.isArray(p.aeronaves) && p.aeronaves.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                          {getAircraftLabels(p).map((label) => (
                            <Badge 
                              key={`${p.id}-air-${label}`} 
                              className="rounded-md border border-amber-100 bg-amber-50/50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/20 dark:border-amber-900/30 dark:text-amber-400 shadow-sm truncate max-w-[160px]"
                            >
                              {label}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-650">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {Array.isArray(p.id_contratos) && p.id_contratos.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                          {getContractLabels(p).map((label) => (
                            <Badge 
                              key={`${p.id}-${label}`} 
                              className="rounded-md border border-violet-100 bg-violet-50 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950/20 dark:border-violet-900/30 dark:text-violet-400 shadow-sm truncate max-w-[160px]"
                            >
                              {label}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-650">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.status === 'publish' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/50 dark:bg-emerald-950/25 dark:text-emerald-400 dark:border-emerald-900/50 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Publicado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800 shadow-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500"></span>
                          Rascunho
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors duration-150">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="rounded-xl">
                           <DropdownMenuLabel className="text-xs text-muted-foreground font-bold tracking-wider uppercase">Ações</DropdownMenuLabel>
                           <DropdownMenuSeparator className="bg-zinc-100 dark:bg-zinc-900" />
                           <DropdownMenuItem onClick={() => handleView(p.id)} className="text-xs py-2 cursor-pointer font-medium rounded-lg">Ver detalhes</DropdownMenuItem>
                           <DropdownMenuItem onClick={() => handleEdit(p.id)} className="text-xs py-2 cursor-pointer font-medium rounded-lg">Editar</DropdownMenuItem>
                           <DropdownMenuItem
                             className="text-xs py-2 cursor-pointer text-red-650 hover:bg-red-50 focus:bg-red-50 focus:text-red-750 font-semibold rounded-lg"
                             onClick={() => deleteMutation.mutate(String(p.id))}
                           >
                             Excluir
                           </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-900 pt-4 mt-2">
          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            Página <span className="font-semibold text-zinc-700 dark:text-zinc-300">{page}</span> de <span className="font-semibold text-zinc-700 dark:text-zinc-300">{totalPages}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              disabled={page <= 1} 
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="h-9 px-3 rounded-lg border-zinc-200 dark:border-zinc-800 font-semibold text-xs transition-colors duration-150"
            >
              <ChevronLeft className="w-4 h-4 mr-1 text-zinc-500" />
              Anterior
            </Button>
            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="h-9 px-3 rounded-lg border-zinc-200 dark:border-zinc-800 font-semibold text-xs transition-colors duration-150"
            >
              Próxima
              <ChevronRight className="w-4 h-4 ml-1 text-zinc-500" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}