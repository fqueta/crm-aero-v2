import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowRulesService, WorkflowRuleRecord } from '@/services/workflowRulesService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';

export default function WorkflowRules() {
  const qc = useQueryClient();
  const [perPage] = useState(10);
  const [workflowIdFilter, setWorkflowIdFilter] = useState<number | undefined>(undefined);
  const listQuery = useQuery({
    queryKey: ['workflow-rules', perPage, workflowIdFilter],
    queryFn: () => workflowRulesService.list({ per_page: perPage, workflow_id: workflowIdFilter }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const createMutation = useMutation({
    mutationFn: (data: Partial<WorkflowRuleRecord>) => workflowRulesService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-rules'] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<WorkflowRuleRecord> }) => workflowRulesService.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-rules'] }),
  });
  const removeMutation = useMutation({
    mutationFn: (id: number) => workflowRulesService.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-rules'] }),
  });

  const [newWorkflowId, setNewWorkflowId] = useState('');
  const [newSourceType, setNewSourceType] = useState('matricula');
  const [newEvent, setNewEvent] = useState('stage_changed');

  const items = listQuery.data?.data || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Regras de Workflow</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <Input placeholder="Filtrar por Workflow ID" value={workflowIdFilter ?? ''} onChange={(e) => setWorkflowIdFilter(e.target.value ? Number(e.target.value) : undefined)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <Input placeholder="Workflow ID" value={newWorkflowId} onChange={(e) => setNewWorkflowId(e.target.value)} />
            <Input placeholder="Source Type" value={newSourceType} onChange={(e) => setNewSourceType(e.target.value)} />
            <Input placeholder="Event" value={newEvent} onChange={(e) => setNewEvent(e.target.value)} />
            <Button
              onClick={() => createMutation.mutate({ workflow_id: Number(newWorkflowId), source_type: newSourceType, event: newEvent })}
              disabled={createMutation.isPending || !newWorkflowId.trim()}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.isLoading ? (
                  <TableRow><TableCell colSpan={6}>Carregando...</TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={6}>Nenhuma regra encontrada</TableCell></TableRow>
                ) : items.map((rule: any) => (
                  <TableRow key={rule.id}>
                    <TableCell className="font-mono text-xs">{rule.id}</TableCell>
                    <TableCell className="font-mono text-xs">{rule.workflow_id}</TableCell>
                    <TableCell>{rule.source_type}</TableCell>
                    <TableCell>{rule.event}</TableCell>
                    <TableCell>{rule.isActive ? 'Sim' : 'Não'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => updateMutation.mutate({ id: rule.id, data: { isActive: !rule.isActive } })}>
                        {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ativar/Desativar'}
                      </Button>
                      <Button variant="destructive" size="sm" className="ml-2" onClick={() => removeMutation.mutate(rule.id)}>
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
