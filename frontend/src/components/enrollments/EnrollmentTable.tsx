import React from 'react';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, MoreHorizontal, Eye, Edit, Trash2 } from 'lucide-react';

export interface EnrollmentTableProps {
  items: any[];
  isLoading?: boolean;
  /** Optional flag when a background refetch is happening; not used for UI state here */
  isFetching?: boolean;
  onView?: (item: any) => void;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  onRowDoubleClick?: (item: any) => void;
  resolveAmountBRL?: (item: any) => string;
  /** IDs selecionadas para exclusão em massa */
  selectedIds?: Set<string>;
  /** Toggle de seleção de um item */
  onSelectChange?: (id: string) => void;
  /** Selecionar/desmarcar todos */
  onSelectAllChange?: (checked: boolean) => void;
}

/**
 * EnrollmentTable
 * pt-BR: Componente de tabela reutilizável para listar matrículas, com ações em cada linha.
 *        Exibe colunas padrão (ID, Cliente, Curso, Turma, Status, Valor) e menu de ações.
 * en-US: Reusable table component to list enrollments, with per-row actions.
 *        Shows standard columns (ID, Client, Course, Class, Status, Amount) and actions menu.
 */
export default function EnrollmentTable({ items, isLoading, onView, onEdit, onDelete, onRowDoubleClick, resolveAmountBRL, selectedIds, onSelectChange, onSelectAllChange }: EnrollmentTableProps) {
  const amountFormatter = resolveAmountBRL || (() => '-');

  const hasCheckboxes = !!selectedIds && !!onSelectChange;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {hasCheckboxes && (
            <TableHead className="w-[50px] text-center font-bold">
              <Checkbox
                checked={items.length > 0 && selectedIds.size === items.length}
                onCheckedChange={(checked) => onSelectAllChange?.(!!checked)}
              />
            </TableHead>
          )}
          <TableHead>ID</TableHead>
          <TableHead>Cliente</TableHead>
          <TableHead>Curso</TableHead>
          <TableHead>Período (PF)</TableHead>
          <TableHead>Turma</TableHead>
          <TableHead>Situação</TableHead>
          <TableHead>Valor (BRL)</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading && (
          <TableRow>
            <TableCell colSpan={hasCheckboxes ? 8 : 7}>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando matrículas...
              </div>
            </TableCell>
          </TableRow>
        )}

        {!isLoading && items.length === 0 && (
          <TableRow>
            <TableCell colSpan={hasCheckboxes ? 8 : 7}>
              <div className="text-muted-foreground">Nenhuma matrícula encontrada</div>
            </TableCell>
          </TableRow>
        )}

        {!isLoading && items.map((enroll: any) => (
          <TableRow key={String(enroll.id)} onDoubleClick={() => onRowDoubleClick?.(enroll)} className="cursor-pointer">
            {hasCheckboxes && (
              <TableCell className="text-center">
                <Checkbox
                  checked={selectedIds.has(String(enroll.id))}
                  onCheckedChange={() => onSelectChange(String(enroll.id))}
                />
              </TableCell>
            )}
            <TableCell className="font-mono text-xs">{String(enroll.id)}</TableCell>
            <TableCell>{enroll.cliente_nome || enroll.student_name || enroll.name || '-'}</TableCell>
            <TableCell>{enroll.curso_nome || enroll.course_name || '-'}</TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {(() => {
                if (String(enroll.curso_tipo) !== '4') return '-';
                if (enroll.periodo_nome) return enroll.periodo_nome;
                try {
                  const orc = typeof enroll.orc === 'string' ? JSON.parse(enroll.orc) : (enroll.orc || {});
                  return orc?.modulos?.[0]?.nome || orc?.modulos?.[0]?.titulo || '-';
                } catch {
                  return '-';
                }
              })()}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{enroll.turma_nome ?? enroll?.turma?.nome ?? '-'}</TableCell>
            <TableCell>
              {enroll.situacao || enroll.status || enroll?.config?.situacao ? (
                <Badge variant="outline">{String(enroll.situacao ?? enroll.status ?? enroll?.config?.situacao)}</Badge>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </TableCell>
            <TableCell>{amountFormatter(enroll)}</TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <span className="sr-only">Abrir menu</span>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Ações</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => onView?.(enroll)}>
                    <Eye className="mr-2 h-4 w-4" /> Visualizar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEdit?.(enroll)}>
                    <Edit className="mr-2 h-4 w-4" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600" onClick={() => onDelete?.(enroll)}>
                    <Trash2 className="mr-2 h-4 w-4" /> Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}