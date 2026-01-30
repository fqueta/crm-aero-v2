import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { workflowsService, WorkflowRecord } from '@/services/workflowsService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Loader2, Settings2 } from 'lucide-react';

export default function Workflows() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [perPage] = useState(10);
  const [search, setSearch] = useState('');
  const listQuery = useQuery({
    queryKey: ['workflows', perPage, search],
    queryFn: () => workflowsService.list({ per_page: perPage, search }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const toggleMutation = useMutation({
    mutationFn: (id: number) => workflowsService.toggleActive(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  });
  const createMutation = useMutation({
    mutationFn: (data: Partial<WorkflowRecord>) => workflowsService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const items = listQuery.data?.data || [];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Workflows</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Input placeholder="Buscar workflows..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input placeholder="Nome do workflow" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="Descrição" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            <Button
              onClick={() => createMutation.mutate({ name: newName, description: newDesc })}
              disabled={createMutation.isPending || !newName.trim()}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listQuery.isLoading ? (
                  <TableRow><TableCell colSpan={5}>Carregando...</TableCell></TableRow>
                ) : items.length === 0 ? (
                  <TableRow><TableCell colSpan={5}>Nenhum workflow encontrado</TableCell></TableRow>
                ) : items.map((wf: any) => (
                  <TableRow key={wf.id}>
                    <TableCell className="font-mono text-xs">{wf.id}</TableCell>
                    <TableCell>{wf.name}</TableCell>
                    <TableCell>{wf.description || '-'}</TableCell>
                    <TableCell>{wf.isActive ? 'Sim' : 'Não'}</TableCell>
                    <TableCell className="text-right flex items-center justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => navigate(`/admin/settings/workflows/designer?workflowId=${wf.id}`)}>
                        <Settings2 className="w-4 h-4 mr-2" />
                        Designer
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => toggleMutation.mutate(wf.id)}>
                        {toggleMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ativar/Desativar'}
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
