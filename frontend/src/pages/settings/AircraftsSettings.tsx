import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aircraftSettingsService } from '@/services/aircraftSettingsService';
import { PaginatedResponse } from '@/types/index';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableCell, TableBody } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import useDebounce from '@/hooks/useDebounce';
import { Search, ChevronLeft, ChevronRight, MoreHorizontal, Eye, Pencil, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const AircraftsSettings = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const getInitialParamsFromURL = () => {
    const qs = new URLSearchParams(location.search);
    const search = qs.get('search') || '';
    const pageQS = Number(qs.get('page') || 1);
    const perQS = Number(qs.get('per_page') || 100);
    return {
      searchTerm: search,
      page: Number.isNaN(pageQS) ? 1 : pageQS,
      perPage: Number.isNaN(perQS) ? 100 : perQS,
    };
  };

  const init = getInitialParamsFromURL();
  const [perPage, setPerPage] = useState<number>(init.perPage);
  const [page, setPage] = useState<number>(init.page);
  const [searchTerm, setSearchTerm] = useState<string>(init.searchTerm);
  const [deletingRecord, setDeletingRecord] = useState<any>(null);

  const debouncedSearch = useDebounce(searchTerm, 400);

  const listQuery = useQuery({
    queryKey: ['aeronaves', 'list', perPage, debouncedSearch, page],
    queryFn: async (): Promise<PaginatedResponse<any>> => {
      const params: any = { page, per_page: perPage };
      if (debouncedSearch?.trim()) params.search = debouncedSearch.trim();
      return aircraftSettingsService.list(params);
    },
  });

  useEffect(() => {
    setPage(1);
  }, [perPage, debouncedSearch]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    if (page && page !== 1) params.set('page', String(page));
    if (perPage && perPage !== 100) params.set('per_page', String(perPage));
    navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' }, { replace: true });
  }, [searchTerm, page, perPage, navigate, location.pathname]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string | number) => {
      return aircraftSettingsService.deleteById(id);
    },
    onSuccess: () => {
      toast({ title: 'Aeronave removida', description: 'Registro excluído com sucesso.' });
      qc.invalidateQueries({ queryKey: ['aeronaves', 'list'] });
    },
    onError: (err: any) => {
      toast({ title: 'Falha ao remover', description: err?.message || 'Não foi possível excluir o registro.', variant: 'destructive' });
    },
  });

  const resolveAtivo = (value: any) => {
    const isActive = value === 's' || value === true;
    return <Badge variant={isActive ? 'default' : 'secondary'}>{isActive ? 'Ativo' : 'Inativo'}</Badge>;
  };

  const resolvePublicar = (item: any) => {
    const v = item?.publicar ?? item?.published ?? item?.publish;
    if (v === undefined) return <span className="text-muted-foreground">-</span>;
    const isPublished = v === 's' || v === true;
    return <Badge variant={isPublished ? 'default' : 'outline'}>{isPublished ? 'Sim' : 'Não'}</Badge>;
  };

  const handleEdit = (row: any) => {
    navigate(`/admin/settings/aircrafts/${row.id}/edit`);
  };

  const handleView = (row: any) => {
    navigate(`/admin/settings/aircrafts/${row.id}/view`);
  };

  const handleCreate = () => {
    navigate('/admin/settings/aircrafts/create');
  };

  const handleDelete = (row: any) => {
    if (!row?.id) return;
    setDeletingRecord(row);
  };

  const confirmDelete = () => {
    if (deletingRecord?.id) {
      deleteMutation.mutate(deletingRecord.id, {
        onSuccess: () => setDeletingRecord(null)
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Aeronaves</h1>
          <p className="text-sm text-muted-foreground">Cadastro e configurações de aeronaves</p>
        </div>
        <Button onClick={handleCreate}>Novo cadastro</Button>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium">Aeronaves cadastradas</h2>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-[220px]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Número de Linhas:</span>
              <Select value={String(perPage)} onValueChange={(v) => setPerPage(Number(v))}>
                <SelectTrigger className="w-[120px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                title="Página anterior"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={(listQuery.data?.current_page ?? 1) <= 1 || listQuery.isFetching}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground min-w-[120px] text-center">
                Página {listQuery.data?.current_page ?? page} de {listQuery.data?.last_page ?? '-'}
              </span>
              <Button
                variant="outline"
                size="icon"
                title="Próxima página"
                onClick={() => {
                  const last = listQuery.data?.last_page ?? page;
                  setPage((p) => Math.min(last, p + 1));
                }}
                disabled={(listQuery.data?.current_page ?? 1) >= (listQuery.data?.last_page ?? 1) || listQuery.isFetching}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <span className="text-xs text-muted-foreground">
              últimos {perPage} registros, {listQuery.data?.data?.length ?? 0} registros
            </span>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Codigo</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead>Publicar</TableHead>
              <TableHead className="text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.data?.data?.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono">{a.id}</TableCell>
                <TableCell>{a.nome ?? '-'}</TableCell>
                <TableCell>{a.codigo ?? '-'}</TableCell>
                <TableCell>{resolveAtivo(a.ativo)}</TableCell>
                <TableCell>{resolvePublicar(a)}</TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem onClick={() => handleView(a)}><Eye className="mr-2 h-4 w-4" /> Ver</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleEdit(a)}><Pencil className="mr-2 h-4 w-4" /> Editar</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(a)}><Trash2 className="mr-2 h-4 w-4" /> Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {!listQuery.data?.data?.length && (
              <TableRow>
                <TableCell colSpan={6}>
                  <p className="text-sm text-muted-foreground">Nenhuma aeronave encontrada</p>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={!!deletingRecord} onOpenChange={(open) => !open && setDeletingRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a aeronave <strong>{deletingRecord?.nome || deletingRecord?.codigo}</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AircraftsSettings;