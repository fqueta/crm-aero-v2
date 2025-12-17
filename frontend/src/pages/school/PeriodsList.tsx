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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Períodos</h1>
        <Button onClick={handleCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Novo período
        </Button>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Buscar</Label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Nome do período"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button variant="secondary" onClick={() => refetch()}>
                <Search className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Filtro de status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="publish">Publicado</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Curso</Label>
            <Combobox
              options={courseOptions}
              value={selectedCourseId}
              onValueChange={(val) => {
                setSelectedCourseId(val);
                setPage(1);
              }}
              placeholder="Curso"
              searchPlaceholder="Pesquisar curso pelo nome..."
              emptyText={courseItems.length === 0 ? 'Nenhum curso encontrado' : 'Digite para filtrar'}
              disabled={coursesQuery.isLoading}
              loading={coursesQuery.isLoading || coursesQuery.isFetching}
              onSearch={setCourseSearch}
              searchTerm={courseSearch}
              debounceMs={250}
            />
          </div>
        </div>

        {(search || selectedCourseId || (statusFilter !== 'all')) && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-sm text-muted-foreground">Filtros ativos:</span>
            {search && (
              <Badge variant="secondary" title="Filtro de busca aplicado">{`Busca: "${search}"`}</Badge>
            )}
            {statusFilter !== 'all' && (
              <Badge variant="outline" title="Filtro de status aplicado">
                {`Status: ${statusFilter === 'publish' ? 'Publicado' : 'Rascunho'}`}
              </Badge>
            )}
            {selectedCourseId && (
              <Badge variant="secondary" title="Filtro de curso aplicado">
                {`Curso: ${selectedCourseLabel || selectedCourseId}`}
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setSelectedCourseId('');
                setCourseSearch('');
                setPage(1);
                refetch();
                // Remove o id_curso da URL ao limpar filtros
                const next = new URLSearchParams(searchParams);
                next.delete('id_curso');
                setSearchParams(next, { replace: true });
              }}
            >
              Limpar filtros
            </Button>
          </div>
        )}

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Horas práticas</TableHead>
                <TableHead>Horas teóricas</TableHead>
                <TableHead>Tipo de Módulo</TableHead>
                <TableHead>Cursos incluídos</TableHead>
                <TableHead>Aeronaves</TableHead>
                <TableHead>Contratos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={11}>Carregando…</TableCell>
                </TableRow>
              )}
              {!isLoading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11}>Nenhum período encontrado.</TableCell>
                </TableRow>
              )}
              {items.map((p: PeriodRecord) => (
                <TableRow key={String(p.id)}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell>{p.id_curso ?? '—'}</TableCell>
                  <TableCell>{formatValorDisplay((p as any).valor)}</TableCell>
                  <TableCell>{p.h_praticas ?? '—'}</TableCell>
                  <TableCell>{p.h_teoricas ?? '—'}</TableCell>
                  <TableCell>{getModuleTypeLabel((p as any).tipo_modulo)}</TableCell>
                  <TableCell>
                    {Array.isArray((p as any).cursos_incluidos) && (p as any).cursos_incluidos.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {getIncludedCourseLabels(p).map((label) => (
                          <Badge key={`${p.id}-inc-${label}`} variant="secondary" className="max-w-[160px] truncate">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {Array.isArray(p.aeronaves) && p.aeronaves.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {getAircraftLabels(p).map((label) => (
                          <Badge key={`${p.id}-air-${label}`} variant="outline" className="max-w-[160px] truncate">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {Array.isArray(p.id_contratos) && p.id_contratos.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {getContractLabels(p).map((label) => (
                          <Badge key={`${p.id}-${label}`} variant="secondary" className="max-w-[160px] truncate">
                            {label}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{p.status === 'publish' ? 'Publicado' : 'Rascunho'}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Ações</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleView(p.id)}>Ver detalhes</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(p.id)}>Editar</DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
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

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Anterior
          </Button>
          <div className="px-2">Página {page} de {totalPages}</div>
          <Button
            variant="outline"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Próxima
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </Card>
    </div>
  );
}