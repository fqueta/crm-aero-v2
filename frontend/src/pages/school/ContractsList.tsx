import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useContractsList, useDeleteContract } from '@/hooks/contracts';
import type { ContractRecord, ContractStatus } from '@/types/contracts';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableRow, TableHead, TableCell, TableBody } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, ChevronLeft, ChevronRight, MoreHorizontal, Plus, Copy, Zap, CheckCircle2 } from 'lucide-react';
import { contractsService } from '@/services/contractsService';
import { coursesService } from '@/services/coursesService';
import { toast } from 'sonner';

/**
 * ContractsList
 * pt-BR: Página de listagem de contratos/termos com busca, filtros e ações.
 * en-US: Contracts/terms listing page with search, filters and actions.
 */
export default function ContractsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchParams, setSearchParams] = useSearchParams();
  
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const status = (searchParams.get('status') || '') as ContractStatus | '';
  const tipo = searchParams.get('tipo') || '';
  const page = Number(searchParams.get('page')) || 1;
  const perPage = 20;

  // Sync status to URL
  const setStatus = (newStatus: ContractStatus | '') => {
    setSearchParams(prev => {
      if (newStatus) prev.set('status', newStatus);
      else prev.delete('status');
      prev.set('page', '1');
      return prev;
    }, { replace: true });
  };

  // Sync tipo to URL
  const setTipo = (newTipo: string) => {
    setSearchParams(prev => {
      if (newTipo) prev.set('tipo', newTipo);
      else prev.delete('tipo');
      prev.set('page', '1');
      return prev;
    }, { replace: true });
  };

  // Sync page to URL
  const setPage = (newPageOrFn: number | ((p: number) => number)) => {
    const next = typeof newPageOrFn === 'function' ? newPageOrFn(page) : newPageOrFn;
    setSearchParams(prev => {
      prev.set('page', String(next));
      return prev;
    }, { replace: true });
  };

  // Sync search to URL with debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      const currentSearch = searchParams.get('search') || '';
      if (search !== currentSearch) {
        setSearchParams(prev => {
          if (search) prev.set('search', search);
          else prev.delete('search');
          prev.set('page', '1');
          return prev;
        }, { replace: true });
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [search, setSearchParams, searchParams]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    if (urlSearch !== search) {
      setSearch(urlSearch);
    }
  }, [searchParams]);

  /**
   * listQuery
   * pt-BR: Consulta paginada de contratos.
   * en-US: Paginated contracts query.
   */
  const { data, isLoading } = useContractsList({ 
    page, 
    per_page: perPage, 
    search: search || undefined, 
    ativo: (status || undefined) as any,
    tipo: tipo || undefined
  }, {
    keepPreviousData: true,
  });

  const items = useMemo(() => (data?.data ?? ([] as ContractRecord[])), [data]);
  const currentPage = data?.current_page ?? page;
  const lastPage = data?.last_page ?? 1;

  /**
   * coursesQuery
   * pt-BR: Carrega um conjunto de cursos para mapear ID -> nome/título.
   * en-US: Loads a set of courses to map ID -> name/title.
   */
  const coursesQuery = useQuery({
    queryKey: ['cursos', 'list', 200],
    queryFn: async () => coursesService.listCourses({ page: 1, per_page: 200 }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const courseItems = ((coursesQuery.data as any)?.data || (coursesQuery.data as any)?.items || []) as any[];
  const coursesMap = useMemo(() => {
    const map = new Map<string | number, string>();
    for (const c of courseItems) {
      const id = (c?.id as any);
      const label = String(c?.nome || c?.titulo || '');
      if (id != null && label) {
        map.set(typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : id, label);
      }
    }
    return map;
  }, [courseItems]);

  /**
   * getCourseLabel
   * pt-BR: Retorna o nome/título do curso pelo ID; fallback para o próprio ID.
   * en-US: Returns the course name/title by ID; falls back to the raw ID.
   */
  function getCourseLabel(courseId?: number | string | null): string {
    if (courseId == null || courseId === '') return '-';
    const key = typeof courseId === 'string' && /^\d+$/.test(courseId) ? Number(courseId) : courseId;
    const label = coursesMap.get(key as any);
    return label ? label : String(courseId);
  }

  /**
   * deleteMutation
   * pt-BR: Exclui contrato e atualiza listagem.
   * en-US: Deletes a contract and refreshes listing.
   */
  const deleteMutation = useDeleteContract({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contracts', 'list'] }),
  });

  /**
   * handleDelete
   * pt-BR: Confirma e executa exclusão do item.
   * en-US: Confirms and executes item deletion.
   */
  const handleDelete = (item: ContractRecord) => {
    if (!confirm(`Excluir contrato "${item.nome}"?`)) return;
    deleteMutation.mutate(String(item.id));
  };

  /**
   * handleCopy
   * pt-BR: Abre a página de criação com os dados do contrato selecionado pré-preenchidos.
   * en-US: Opens the create page with the selected contract data prefilled.
   */
  const handleCopy = async (item: ContractRecord) => {
    try {
      const full = await contractsService.getById(item.id);
      if (!full) {
        toast.error('Contrato não encontrado', { description: 'Não foi possível carregar dados para duplicar.' });
        return;
      }
      navigate('/admin/school/contracts/create', { state: { initialContract: full } });
      toast.success('Contrato carregado para duplicação', { description: 'Edite e salve o novo contrato.' });
    } catch (err) {
      toast.error('Erro ao preparar cópia', { description: 'Tente novamente mais tarde.' });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contratos</h1>
        <div className="flex gap-2">
          <Button onClick={() => navigate('/admin/school/contracts/create')}>Novo <Plus className="ml-1 h-4 w-4" /></Button>
        </div>
      </div>

      <Card className="p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label className="flex items-center gap-2"><Search className="h-3.5 w-3.5 text-muted-foreground" /> Busca</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Pesquisar por nome, slug" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-10 border-slate-200 focus:border-primary" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" /> Status</Label>
            <Select
              value={status === '' ? 'all' : status}
              onValueChange={(v) => {
                if (v === 'all') return setStatus('');
                setStatus(v as ContractStatus);
              }}
            >
              <SelectTrigger className="h-10 border-slate-200"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="publish">Publicado</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="flex items-center gap-2"><Zap className="h-3.5 w-3.5 text-muted-foreground" /> Público-alvo / Tipo</Label>
            <Select
              value={tipo === '' ? 'all' : tipo}
              onValueChange={(v) => {
                if (v === 'all') return setTipo('');
                setTipo(v);
              }}
            >
              <SelectTrigger className="h-10 border-slate-200"><SelectValue placeholder="Todos os tipos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="geral">Geral (Aluno)</SelectItem>
                <SelectItem value="responsavel">Responsável Financeiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[30%]">Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">Carregando...</TableCell>
                </TableRow>
              )}
              {!isLoading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum contrato encontrado.</TableCell>
                </TableRow>
              )}
              {!isLoading && items.map((c) => (
                <TableRow key={String(c.id)}>
                  <TableCell className="font-medium text-slate-900">{c.nome}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{c.slug || '-'}</TableCell>
                  <TableCell>
                    {c.tipo === 'responsavel' ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-700 border border-indigo-200">
                        Responsável
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                        Geral
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase ${
                      c.ativo === 'publish' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-amber-100 text-amber-700 border border-amber-200'
                    }`}>
                      {c.ativo === 'publish' ? 'Publicado' : 'Rascunho'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{getCourseLabel(c.id_curso)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleCopy(c)} title="Copiar contrato">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Ações</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleCopy(c)}>
                            Duplicar contrato
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/admin/school/contracts/${c.id}/edit`)}>
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(c)} className="text-red-600">
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            <ChevronLeft className="mr-1 h-4 w-4" />Anterior
          </Button>
          <span className="text-sm">Página {currentPage} de {lastPage}</span>
          <Button variant="outline" disabled={currentPage >= lastPage} onClick={() => setPage((p) => p + 1)}>
            Próxima<ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}
