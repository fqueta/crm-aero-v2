import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableCell, TableBody } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Combobox, useComboboxOptions } from '@/components/ui/combobox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, ChevronLeft, ChevronRight, MoreHorizontal, Plus, Trash2 } from 'lucide-react';
import { useDebounce } from '@/hooks/useDebounce';
import { useComponentsList, useDeleteComponent, useDuplicateComponent } from '@/hooks/components';
import { componentsService } from '@/services/componentsService';
import { useContentTypesList } from '@/hooks/contentTypes';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coursesService } from '@/services/coursesService';
import { PaginatedResponse } from '@/types';
import type { ComponentRecord } from '@/types/components';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/components/ui/use-toast';

/**
 * SiteComponentsList
 * pt-BR: Página de listagem de componentes CMS com filtros e paginação.
 * en-US: CMS components listing page with filters and pagination.
 */
export default function SiteComponentsList() {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * getInitialParamsFromURL
   * pt-BR: Lê parâmetros iniciais da URL para per_page, page e busca.
   * en-US: Reads initial URL params for per_page, page and search.
   */
  const getInitialParamsFromURL = () => {
    const qs = new URLSearchParams(location.search);
    const per = Number(qs.get('per_page') || 10);
    const p = Number(qs.get('page') || 1);
    return {
      perPage: Number.isNaN(per) ? 10 : per,
      page: Number.isNaN(p) ? 1 : p,
      searchTerm: qs.get('search') || '',
      ativo: (qs.get('ativo') as any) || '',
      tipoConteudo: qs.get('tipo_conteudo') || '',
      idCurso: qs.get('id_curso') || '',
    };
  };

  const init = getInitialParamsFromURL();
  const [perPage, setPerPage] = useState<number>(init.perPage);
  const [page, setPage] = useState<number>(init.page);
  const [searchTerm, setSearchTerm] = useState<string>(init.searchTerm);
  const [ativo, setAtivo] = useState<string>(init.ativo || 'all');
  const [tipoConteudo, setTipoConteudo] = useState<string>(init.tipoConteudo);
  const [idCurso, setIdCurso] = useState<string>(init.idCurso);
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  /**
   * fetchSelectOptions
   * pt-BR: Carrega opções para os filtros. Tipo de conteúdo via Select e Curso via Combobox.
   * en-US: Loads options for filters. Content type via Select and Course via Combobox.
   */
  const { data: contentTypesResp, isLoading: loadingContentTypes } = useContentTypesList({ per_page: 200 });
  const [courseSearch, setCourseSearch] = useState<string>('');
  const coursesQuery = useQuery({
    queryKey: ['cursos', 'list', 200, courseSearch],
    queryFn: async () => coursesService.listCourses({ page: 1, per_page: 200, search: courseSearch }),
    staleTime: 5 * 60 * 1000,
  });
  const courseItems = ((coursesQuery.data as PaginatedResponse<any> | undefined)?.data) || [];
  const courseOptions = useComboboxOptions(courseItems as any[], 'id', 'nome', undefined, (c: any) => String(c?.titulo || ''));

  /**
   * Persistência de filtros na URL
   * pt-BR: Sincroniza filtros com querystring para navegação estável.
   * en-US: Sync filters to querystring for stable navigation.
   */
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    params.set('per_page', String(perPage));
    params.set('page', String(page));
    params.set('search', String(searchTerm || ''));
    if (ativo && ativo !== 'all') params.set('ativo', ativo); else params.delete('ativo');
    if (tipoConteudo && tipoConteudo !== 'all') params.set('tipo_conteudo', tipoConteudo); else params.delete('tipo_conteudo');
    if (idCurso) params.set('id_curso', idCurso); else params.delete('id_curso');
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  }, [perPage, page, searchTerm, ativo, tipoConteudo, idCurso]);

  /**
   * listParams
   * pt-BR: Parâmetros de listagem com paginação e filtros.
   * en-US: Listing params with pagination and filters.
   */
  const listParams = useMemo(() => ({
    page,
    per_page: perPage,
    search: debouncedSearch || undefined,
    ativo: ativo === 'all' ? undefined : ativo,
    tipo_conteudo: tipoConteudo === 'all' ? undefined : tipoConteudo,
    id_curso: idCurso || undefined,
  }), [page, perPage, debouncedSearch, ativo, tipoConteudo, idCurso]);

  const { data: resp, isLoading, isFetching } = useComponentsList(listParams);
  const deleteMutation = useDeleteComponent();
  const duplicateMutation = useDuplicateComponent();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: (string | number)[]) => componentsService.deleteMultipleComponents(ids),
    onSuccess: () => {
      toast({ title: 'Componentes excluídos', description: 'Registros removidos.' });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['cmsComponents'] });
    },
    onError: (err: any) => {
      toast({ title: 'Erro ao excluir em massa', description: String(err?.message ?? 'Falha ao excluir componentes'), variant: 'destructive' });
    },
  });

  /**
   * Actions
   * pt-BR: Navegação para criar/editar.
   * en-US: Navigation for create/edit.
   */
  // Navegação atualizada para novo prefixo
  const goToCreate = () => navigate('/admin/site/conteudo-site/create');
  const goToEdit = (id: string) => navigate(`/admin/site/conteudo-site/${id}/edit`);
  /**
   * handleRowDoubleClick
   * pt-BR: Abre a tela de edição ao dar duplo clique em uma linha da tabela.
   * en-US: Opens the edit screen when the user double-clicks a table row.
   */
  const handleRowDoubleClick = (id: string) => goToEdit(id);
  const handleDuplicate = (id: string) => {
    duplicateMutation.mutate(id, {
      onSuccess: (created) => {
        if (created?.id) goToEdit(String(created.id));
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Componentes (CMS)</h1>
          <p className="text-muted-foreground">Gerencie componentes de conteúdo</p>
        </div>
        <Button onClick={goToCreate}>
          <Plus className="h-4 w-4 mr-2" /> Novo cadastro
        </Button>
      </div>

      {/* Toolbar de filtros */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium">Componentes cadastrados</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }} className="pl-8 w-[260px]" placeholder="Buscar por nome/short code..." />
            </div>
            {/* Select Tipo de Conteúdo */}
            <Select value={tipoConteudo} onValueChange={(v) => { setTipoConteudo(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo conteúdo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {((contentTypesResp?.data ?? []) as any[])
                  .filter((opt: any) => opt && (opt.id ?? opt.value ?? opt.codigo) !== undefined)
                  .map((opt: any) => {
                    const value = String(opt.id ?? opt.value ?? opt.codigo);
                    const label = opt.nome ?? opt.name ?? opt.descricao ?? opt.titulo ?? value;
                    return (<SelectItem key={value} value={value}>{String(label)}</SelectItem>);
                  })}
              </SelectContent>
            </Select>
            {/* Combobox Curso (pesquisável) */}
            <div className="w-[220px]">
              <Combobox
                options={courseOptions}
                value={idCurso}
                onValueChange={(v) => { setIdCurso(v); setPage(1); }}
                placeholder="ID curso"
                searchPlaceholder="Pesquisar cursos..."
                emptyText="Nenhum curso encontrado"
                onSearch={(term) => setCourseSearch(term)}
                loading={coursesQuery.isLoading || coursesQuery.isFetching}
              />
            </div>
            <Select value={ativo} onValueChange={(v) => { setAtivo(v); setPage(1); }}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Ativo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="s">Sim</SelectItem>
                <SelectItem value="n">Não</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(perPage)} onValueChange={(v) => { setPerPage(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-[110px]"><SelectValue placeholder="Linhas" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" title="Página anterior" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={(resp?.current_page ?? 1) <= 1 || isFetching}><ChevronLeft className="h-4 w-4" /></Button>
              <span className="text-xs text-muted-foreground">Página {resp?.current_page ?? page} de {resp?.last_page ?? 1}</span>
              <Button variant="outline" size="icon" title="Próxima página" onClick={() => { const last = resp?.last_page ?? page; setPage((p) => Math.min(last, p + 1)); }} disabled={(resp?.current_page ?? 1) >= (resp?.last_page ?? 1) || isFetching}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>
        </div>

        {/* Tabela */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px] text-center">
                <Checkbox
                  checked={resp?.data?.length > 0 && selectedIds.size === resp?.data?.length}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSelectedIds(new Set(resp?.data?.map((item) => String(item.id)) ?? []));
                    } else {
                      setSelectedIds(new Set());
                    }
                  }}
                />
              </TableHead>
              <TableHead>ID</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Short Code</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Curso</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(resp?.data ?? []).map((item: ComponentRecord) => (
              <TableRow
                key={item.id}
                className="cursor-pointer"
                onDoubleClick={() => handleRowDoubleClick(String(item.id))}
              >
                <TableCell className="text-center">
                  <Checkbox
                    checked={selectedIds.has(String(item.id))}
                    onCheckedChange={(checked) => {
                      const next = new Set(selectedIds);
                      if (checked) next.add(String(item.id));
                      else next.delete(String(item.id));
                      setSelectedIds(next);
                    }}
                  />
                </TableCell>
                <TableCell className="font-mono">{item.id}</TableCell>
                <TableCell>{item.nome ?? '-'}</TableCell>
                <TableCell>{item.short_code ?? '-'}</TableCell>
                <TableCell>{item.tipo_conteudo_nome ?? '-'}</TableCell>
                {/*
                  Curso — exibe o nome do curso quando disponível
                  pt-BR: Prioriza `curso_nome` retornado pela API; fallback para `id_curso` ou `config.id_curso`.
                  en-US: Prefer `curso_nome` from API; fallback to `id_curso` or `config.id_curso`.
                */}
                <TableCell>{
                  (item as any).curso_nome
                    ? String((item as any).curso_nome)
                    : (item.id_curso || (item as any)?.config?.id_curso || '-')
                }</TableCell>
                <TableCell>{item.ativo === 's' ? 'Sim' : 'Não'}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => goToEdit(String(item.id))}>Editar</DropdownMenuItem>
                      <DropdownMenuItem disabled={duplicateMutation.isPending} onClick={() => handleDuplicate(String(item.id))}>Duplicar</DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={() => deleteMutation.mutate(String(item.id))}>Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Barra de ações em massa */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t bg-background/95 backdrop-blur px-6 py-4 shadow-lg">
          <span className="text-sm font-medium text-destructive">
            {selectedIds.size} componente(s) selecionado(s)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={bulkDeleteMutation.isPending}
              onClick={() => {
                if (window.confirm(`Excluir ${selectedIds.size} componente(s)?`)) {
                  bulkDeleteMutation.mutate(Array.from(selectedIds));
                }
              }}
            >
              {bulkDeleteMutation.isPending ? 'Excluindo...' : <><Trash2 className="h-4 w-4 mr-1" /> Excluir {selectedIds.size} selecionado(s)</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
