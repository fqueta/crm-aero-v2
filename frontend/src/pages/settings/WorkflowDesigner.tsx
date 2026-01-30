import React, { useCallback, useMemo, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  NodeChange,
  applyNodeChanges,
  ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css'; 

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { workflowRulesService, WorkflowRuleRecord } from '@/services/workflowRulesService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

const SNAP_GRID = [20, 20];

export default function WorkflowDesigner() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize from URL param or undefined
  const initialBotId = searchParams.get('workflowId') ? Number(searchParams.get('workflowId')) : undefined;
  
  const [workflowId, setWorkflowId] = React.useState<number | undefined>(initialBotId);
  
  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  // Update URL when workflowId changes
  useEffect(() => {
    if (workflowId) {
      setSearchParams({ workflowId: String(workflowId) });
    } else {
      setSearchParams({});
    }
  }, [workflowId, setSearchParams]);


  // --- API Integrations ---

  const listQuery = useQuery({
    queryKey: ['workflow-designer-rules', workflowId],
    queryFn: () => workflowRulesService.list({ per_page: 100, workflow_id: workflowId }),
    enabled: !!workflowId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<WorkflowRuleRecord> }) =>
      workflowRulesService.update(id, data),
    onSuccess: () => {
       // Optional: We might not want to refetch immediately to avoid jumping, 
       // but we should ensure consistency eventually.
       // For now, let's just invalidate.
       qc.invalidateQueries({ queryKey: ['workflow-designer-rules'] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<WorkflowRuleRecord>) => workflowRulesService.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-designer-rules'] }),
  });

  // --- Effects & Logic ---

  // Sync Rules -> Nodes
  React.useEffect(() => {
    if (!listQuery.data?.data) {
      setNodes([]);
      return;
    }
    
    const newNodes: Node[] = listQuery.data.data.map((r: WorkflowRuleRecord) => {
      const ui = (r.conditions as any)?.ui || {};
      return {
        id: String(r.id),
        type: 'default', // Using default node type for now
        position: { x: Number(ui.x || 0), y: Number(ui.y || 0) },
        data: { 
          label: (
            <div className="flex flex-col gap-1 p-1">
               <span className="font-bold text-xs">{r.source_type}</span>
               <span className="text-xs text-muted-foreground">{r.event}</span>
            </div>
          ) 
        },
        style: { width: 180 },
        selected: selectedId === String(r.id),
      };
    });

    setNodes(newNodes);
  }, [listQuery.data, setNodes, selectedId]);


  // Handle drag stop to save position
  const onNodeDragStop = useCallback(
    (_: any, node: Node) => {
      // Find original rule to preserve other conditions
      const originalRule = listQuery.data?.data.find((r) => String(r.id) === node.id);
      if (!originalRule) return;

      const currentConditions = originalRule.conditions || {};
      
      updateMutation.mutate({
        id: Number(node.id),
        data: {
          conditions: {
            ...currentConditions,
            ui: {
              ...((currentConditions as any)?.ui || {}),
              x: Math.round(node.position.x),
              y: Math.round(node.position.y),
            },
          },
        },
      });
    },
    [listQuery.data, updateMutation]
  );

  const addRule = useCallback(() => {
    if (!workflowId) return;
    // Add new node in center(ish) or 0,0
    createMutation.mutate({
      workflow_id: workflowId,
      source_type: 'matricula', // Default for now
      event: 'stage_changed',
      conditions: { ui: { x: 100, y: 100 } },
    });
  }, [workflowId, createMutation]);
  
  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedId(node.id);
  }, []);
  
  const selectedRule: WorkflowRuleRecord | undefined = React.useMemo(() => {
    if (!selectedId) return undefined;
    return listQuery.data?.data.find((r) => String(r.id) === selectedId);
  }, [selectedId, listQuery.data]);
  
  const [filtersEdit, setFiltersEdit] = React.useState<{ endpoint1?: string; endpoint2?: string; path?: string }>({});
  
  React.useEffect(() => {
    if (selectedRule) {
      const f = (selectedRule.filters as any) || {};
      setFiltersEdit({
        endpoint1: f.endpoint1 || '',
        endpoint2: f.endpoint2 || '',
        path: f.path || '',
      });
    } else {
      setFiltersEdit({});
    }
  }, [selectedRule]);
  
  const saveFilters = useCallback(() => {
    if (!selectedRule) return;
    updateMutation.mutate({
      id: selectedRule.id,
      data: { filters: { ...filtersEdit } },
    });
  }, [selectedRule, filtersEdit, updateMutation]);

  return (
      <div className="p-6 h-[calc(100vh-100px)] flex flex-col gap-4">
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center justify-between">
            <span>Workflow Designer</span>
            <div className="flex items-center gap-2">
                 <Input 
                   className="w-[150px]" 
                   placeholder="Workflow ID" 
                   value={workflowId ?? ''} 
                   onChange={(e) => setWorkflowId(e.target.value ? Number(e.target.value) : undefined)} 
                 />
                 <Button onClick={addRule} disabled={!workflowId || createMutation.isPending}>
                   {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin"/> : 'Adicionar Regra'}
                 </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 p-0 relative min-h-0">
          {!workflowId ? (
             <div className="flex items-center justify-center h-full text-muted-foreground">
                Selecione um Workflow ID para começar
             </div>
          ) : (
            <div className="w-full h-full flex"> 
              <div className="flex-1 min-w-0">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeDragStop={onNodeDragStop}
                  onNodeClick={onNodeClick}
                  connectionMode={ConnectionMode.Loose}
                  fitView
                  className="bg-slate-50"
                >
                  <Background gap={16} size={1} />
                  <Controls />
                </ReactFlow>
              </div>
              <div className="w-[280px] border-l p-3 space-y-2">
                <div className="text-sm font-medium">Propriedades</div>
                {!selectedRule ? (
                  <div className="text-xs text-muted-foreground">Selecione um nó para editar filtros</div>
                ) : (
                  <>
                    <div className="text-xs text-muted-foreground">Regra #{selectedRule.id} ({selectedRule.source_type}/{selectedRule.event})</div>
                    <Input placeholder="endpoint1" value={filtersEdit.endpoint1 ?? ''} onChange={(e) => setFiltersEdit((s) => ({ ...s, endpoint1: e.target.value }))} />
                    <Input placeholder="endpoint2" value={filtersEdit.endpoint2 ?? ''} onChange={(e) => setFiltersEdit((s) => ({ ...s, endpoint2: e.target.value }))} />
                    <Input placeholder="path" value={filtersEdit.path ?? ''} onChange={(e) => setFiltersEdit((s) => ({ ...s, path: e.target.value }))} />
                    <Button size="sm" onClick={saveFilters} disabled={updateMutation.isPending}>Salvar</Button>
                  </>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
