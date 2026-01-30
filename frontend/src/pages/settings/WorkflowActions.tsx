import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowActionsService, WorkflowActionRecord } from '@/services/workflowActionsService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';

export default function WorkflowActions() {
  const qc = useQueryClient();
  const [perPage] = useState(10);
  const [ruleIdFilter, setRuleIdFilter] = useState<number | undefined>(undefined);
  const listQuery = useQuery({
    queryKey: ['workflow-actions', perPage, ruleIdFilter],
    queryFn: () => workflowActionsService.list({ per_page: perPage, rule_id: ruleIdFilter }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const createMutation = useMutation({
    mutationFn: (data: Partial<WorkflowActionRecord>) => workflowActionsService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-actions'] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<WorkflowActionRecord> }) => workflowActionsService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-actions'] }),
  });
  const removeMutation = useMutation({
    mutationFn: (id: number) => workflowActionsService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-actions'] }),
  });

  const [newRuleId, setNewRuleId] = useState('');
  const [newType, setNewType] = useState('log');

  const items = listQuery.data?.data || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ações de Workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Input placeholder="Filtrar por Rule ID" value={ruleIdFilter ?? ''} onChange={(e) => setRuleIdFilter(e.target.value ? Number(e.target.value) : undefined)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <Input placeholder="Rule ID" value={newRuleId} onChange={(e) => setNewRuleId(e.target.value)} />
            <Input placeholder="Tipo" value={newType} onChange={(e) => setNewType(e.target.value)} />
            <Button
              onClick={() => createMutation.mutate({ rule_id: Number(newRuleId), type: newType })}
              disabled={createMutation.isPending || !newRuleId.trim()}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Rule</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.isLoading ? (
                  <TableRow><TableCell colSpan={5}>Carregando...</TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={5}>Nenhuma ação encontrada</TableCell></TableRow>
                ) : items.map((action: any) => (
                  <TableRow key={action.id}>
                    <TableCell className="font-mono text-xs">{action.id}</TableCell>
                    <TableCell className="font-mono text-xs">{action.rule_id}</TableCell>
                    <TableCell>{action.type}</TableCell>
                    <TableCell>{action.isActive ? 'Sim' : 'Não'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => updateMutation.mutate({ id: action.id, data: { isActive: !action.isActive } })}>
                        {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ativar/Desativar'}
                      </Button>
                      <Button variant="destructive" size="sm" className="ml-2" onClick={() => removeMutation.mutate(action.id)}>
                        Remover
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
