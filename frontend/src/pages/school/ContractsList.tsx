import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useContractsList, useDeleteContract } from '@/hooks/contracts';
import type { ContractRecord, ContractStatus } from '@/types/contracts';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Table, TableHeader, TableRow, TableHead, TableCell, TableBody } from '@/components/ui/table';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Search, ChevronLeft, ChevronRight, MoreHorizontal, Plus, Copy } from 'lucide-react';
import { contractsService } from '@/services/contractsService';
import { toast } from 'sonner';

/**
 * ContractsList
 * pt-BR: Página de listagem de contratos/termos com busca, filtros e ações.
 * en-US: Contracts/terms listing page with search, filters and actions.
 */
export default function ContractsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ContractStatus | ''>('');
  const [page, setPage] = useState(1);
  const perPage = 20;

  /**
   * listQuery
   * pt-BR: Consulta paginada de contratos.
   * en-US: Paginated contracts query.
   */
  const { data, isLoading } = useContractsList({ page, per_page: perPage, search: search || undefined, ativo: (status || undefined) as any }, {
    keepPreviousData: true,
  });

  const items = useMemo(() => (data?.data ?? ([] as ContractRecord[])), [data]);
  const currentPage = data?.current_page ?? page;
  const lastPage = data?.last_page ?? 1;

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
   * pt-BR: Copia o conteúdo do contrato para a área de transferência e informa o usuário.
   * en-US: Copies the contract content to clipboard and notifies the user.
   */
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label>Busca</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Pesquisar por nome, slug" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            {/**
             * Status filter Select
             * pt-BR: Usa valor 'all' para representar todos, evitando string vazia.
             * en-US: Uses 'all' to represent all items, avoiding empty string value.
             */}
            <Select
              value={status === '' ? 'all' : status}
              onValueChange={(v) => {
                if (v === 'all') return setStatus('');
                setStatus(v as ContractStatus);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="publish">Publicado</SelectItem>
                <SelectItem value="draft">Rascunho</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border rounded-md overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5}>Carregando...</TableCell>
                </TableRow>
              )}
              {!isLoading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>Nenhum contrato encontrado.</TableCell>
                </TableRow>
              )}
              {!isLoading && items.map((c) => (
                <TableRow key={String(c.id)}>
                  <TableCell>{c.nome}</TableCell>
                  <TableCell>{c.slug || '-'}</TableCell>
                  <TableCell>{c.ativo === 'publish' ? 'Publicado' : 'Rascunho'}</TableCell>
                  <TableCell>{c.id_curso ? String(c.id_curso) : '-'}</TableCell>
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
                            Copiar contrato
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