import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { contractsService } from '@/services/contractsService';
import type { ContractRecord } from '@/types/contracts';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableRow, TableHead, TableCell, TableBody } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Plus, Copy, Trash2, Edit, Import, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { ImportContractsDialog } from './ImportContractsDialog';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface CourseContractsTabProps {
  courseId?: string | number;
  courseType?: string;
}

/**
 * CourseContractsTab
 * pt-BR: Aba de contratos dentro do formulário de curso.
 *        Lista contratos vinculados a este curso e permite adicionar/editar.
 * en-US: Contracts tab within the course form.
 *        Lists contracts linked to this course and allows adding/editing.
 */
export function CourseContractsTab({ courseId, courseType }: CourseContractsTabProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [orderedItems, setOrderedItems] = useState<ContractRecord[]>([]);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const perPage = 50; // Mostrar mais itens por padrão na aba

  // Se não tiver ID do curso, não carrega nada
  const enabled = !!courseId;

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', 'by_course', courseId, page],
    queryFn: async () => {
      if (!courseId) return { data: [] };
      return contractsService.listContracts({ 
        page, 
        per_page: perPage, 
        id_curso: courseId 
      });
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });

  const items = useMemo(() => ((data as any)?.data || (data as any)?.items || []) as ContractRecord[], [data]);
  useEffect(() => {
    if (!isSavingOrder) setOrderedItems(items);
  }, [items, isSavingOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const oldIndex = orderedItems.findIndex((c) => String(c.id) === activeId);
    const newIndex = orderedItems.findIndex((c) => String(c.id) === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(orderedItems, oldIndex, newIndex);
    setOrderedItems(next);
    setIsSavingOrder(true);
    try {
      await contractsService.reorderContracts(next.map((c) => c.id), courseId);
      toast.success('Ordem atualizada');
      queryClient.invalidateQueries({ queryKey: ['contracts', 'by_course', courseId] });
    } catch (error: any) {
      const msg = error?.response?.data?.message || error?.body?.message || 'Erro ao salvar ordem';
      toast.error(String(msg));
      setOrderedItems(items);
    } finally {
      setIsSavingOrder(false);
    }
  };

  function SortableContractRow({ contract, index }: { contract: ContractRecord; index: number }) {
    const id = String(contract.id);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 50 : 'auto',
      position: 'relative' as const,
      opacity: isDragging ? 0.3 : 1,
    };

    return (
      <TableRow ref={setNodeRef} style={style} key={id}>
        <TableCell className="w-[50px]">
          <div className="flex items-center gap-2">
            <button
              type="button"
              {...attributes}
              {...listeners}
              className="flex items-center justify-center p-1 cursor-grab text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md"
              title="Arraste para reordenar"
              disabled={isSavingOrder}
            >
              <GripVertical className="h-4 w-4" />
            </button>
            <span>{index + 1}</span>
          </div>
        </TableCell>
        <TableCell>{contract.nome}</TableCell>
        <TableCell>
          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
            contract.ativo === 'publish'
              ? 'bg-green-100 text-green-700'
              : 'bg-yellow-100 text-yellow-700'
          }`}>
            {contract.ativo === 'publish' ? 'Sim' : 'Não'}
          </span>
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                Ação <MoreHorizontal className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Ações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleEdit(contract.id)}>
                <Edit className="mr-2 h-4 w-4" /> Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCopy(contract)}>
                <Copy className="mr-2 h-4 w-4" /> Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleDelete(contract)} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" /> Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    );
  }

  /**
   * handleAdd
   * pt-BR: Redireciona para criação de contrato já vinculado a este curso.
   * en-US: Redirects to contract creation already linked to this course.
   */
  const handleAdd = () => {
    if (!courseId) {
      toast.error('Salve o curso antes de adicionar contratos.');
      return;
    }
    navigate('/admin/school/contracts/create', { 
      state: { 
        prefillData: { id_curso: Number(courseId) },
        returnPath: location.pathname + location.search
      } 
    });
  };

  /**
   * handleEdit
   * pt-BR: Redireciona para edição do contrato.
   * en-US: Redirects to contract edit.
   */
  const handleEdit = (id: string | number) => {
    navigate(`/admin/school/contracts/${id}/edit`, {
      state: {
        returnPath: location.pathname + location.search
      }
    });
  };

  /**
   * handleDelete
   * pt-BR: Exclui o contrato.
   * en-US: Deletes the contract.
   */
  const handleDelete = async (contract: ContractRecord) => {
    if (!confirm(`Excluir contrato "${contract.nome}"?`)) return;
    try {
      await contractsService.deleteContract(contract.id);
      toast.success('Contrato excluído');
      queryClient.invalidateQueries({ queryKey: ['contracts', 'by_course', courseId] });
    } catch (error) {
      toast.error('Erro ao excluir contrato');
    }
  };

  /**
   * handleCopy
   * pt-BR: Duplica o contrato.
   * en-US: Duplicates the contract.
   */
  const handleCopy = async (item: ContractRecord) => {
    try {
      const full = await contractsService.getById(item.id);
      if (!full) {
        toast.error('Contrato não encontrado');
        return;
      }
      navigate('/admin/school/contracts/create', { state: { initialContract: full } });
    } catch (err) {
      toast.error('Erro ao preparar cópia');
    }
  };

  if (!courseId) {
    return (
      <div className="p-8 text-center border rounded-md bg-muted/20">
        <p className="text-muted-foreground">
          Salve o curso para gerenciar os contratos.
        </p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Contratos deste curso</CardTitle>
          <CardDescription>Gerencie os termos e contratos vinculados.</CardDescription>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsImportOpen(true)} size="sm" variant="outline">
            <Import className="mr-2 h-4 w-4" /> Importar de outro curso
          </Button>
          <Button onClick={handleAdd} size="sm">
            <Plus className="mr-2 h-4 w-4" /> Novo Contrato
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">#</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4">Carregando...</TableCell>
                  </TableRow>
                )}
                {!isLoading && orderedItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                      Nenhum contrato vinculado.
                    </TableCell>
                  </TableRow>
                )}
                {!isLoading && orderedItems.length > 0 && (
                  <SortableContext
                    items={orderedItems.map((c) => String(c.id))}
                    strategy={verticalListSortingStrategy}
                  >
                    {orderedItems.map((c, index) => (
                      <SortableContractRow key={String(c.id)} contract={c} index={index} />
                    ))}
                  </SortableContext>
                )}
              </TableBody>
            </Table>
          </DndContext>
        </div>
      </CardContent>

      {/* Import Dialog */}
      {courseId && (
        <ImportContractsDialog
          open={isImportOpen}
          onOpenChange={setIsImportOpen}
          currentCourseId={courseId}
          courseType={courseType}
        />
      )}
    </Card>
  );
}
