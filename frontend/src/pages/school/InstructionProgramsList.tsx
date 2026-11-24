import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BookOpen,
  Plus,
  Search,
  Edit,
  Trash2,
  ExternalLink,
  Copy,
  RefreshCw,
  Globe,
  Lock,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { instructionProgramService } from '@/services/instructionProgramService';
import { InstructionProgram } from '@/types/instructionProgram';

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  published: { label: 'Publicado', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  draft: { label: 'Rascunho', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  archived: { label: 'Arquivado', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

export default function InstructionProgramsList() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const { data, isLoading } = useQuery({
    queryKey: ['instruction-programs', search, statusFilter],
    queryFn: () =>
      instructionProgramService.list({
        search: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        per_page: 50,
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => instructionProgramService.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instruction-programs'] });
      toast({ title: 'Programa de Instrução excluído com sucesso.' });
    },
    onError: () => {
      toast({ title: 'Erro ao excluir Programa de Instrução.', variant: 'destructive' });
    },
  });

  const reindexMutation = useMutation({
    mutationFn: () => instructionProgramService.reindexRag(),
    onSuccess: (res) => {
      toast({
        title: 'Base RAG reindexada',
        description: res.message || 'Todos os Programas de Instrução e regras foram indexados.',
      });
    },
    onError: () => {
      toast({ title: 'Erro ao reindexar base RAG.', variant: 'destructive' });
    },
  });

  const items: InstructionProgram[] = data?.data || [];

  const getPublicUrl = (slug: string) => `${window.location.origin}/programa-instrucao/${slug}`;

  const handleCopyLink = async (slug: string) => {
    try {
      await navigator.clipboard.writeText(getPublicUrl(slug));
      toast({ title: 'Link público copiado para a área de transferência.' });
    } catch {
      toast({ title: 'Não foi possível copiar o link.', variant: 'destructive' });
    }
  };

  const handleDelete = (item: InstructionProgram) => {
    if (window.confirm(`Deseja realmente excluir o Programa de Instrução "${item.title}"?`)) {
      deleteMutation.mutate(item.id);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Programas de Instrução (PI)
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie revisões, páginas públicas, base de conhecimento RAG (IA) e shortcodes contratuais dos cursos.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => reindexMutation.mutate()}
            disabled={reindexMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${reindexMutation.isPending ? 'animate-spin' : ''}`} />
            Reindexar RAG (IA)
          </Button>
          <Button onClick={() => navigate('/admin/school/instruction-programs/create')}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Programa
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <CardTitle className="text-base">Programas cadastrados</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative w-full sm:w-72">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, código ou revisão..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="published">Publicado</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="archived">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              Carregando Programas de Instrução...
            </div>
          ) : items.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Sparkles className="h-10 w-10 text-muted-foreground/50 mx-auto" />
              <div className="text-sm text-muted-foreground">
                Nenhum Programa de Instrução encontrado. Crie o primeiro para habilitar a página pública, o RAG e os shortcodes de PI nos contratos.
              </div>
              <Button onClick={() => navigate('/admin/school/instruction-programs/create')}>
                <Plus className="h-4 w-4 mr-2" />
                Criar primeiro Programa de Instrução
              </Button>
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Programa / Código</TableHead>
                    <TableHead>Curso</TableHead>
                    <TableHead>Revisão PI</TableHead>
                    <TableHead>MGR</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const st = STATUS_BADGE[item.status] || STATUS_BADGE.draft;
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.title}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                            {item.code && <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{item.code}</span>}
                            <span>/{item.slug}</span>
                            {item.is_public ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <Globe className="h-3 w-3" /> Público
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-500">
                                <Lock className="h-3 w-3" /> Interno
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {item.curso?.nome || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{item.current_revision || '001'}</div>
                          {item.revision_date && (
                            <div className="text-xs text-muted-foreground">
                              {item.revision_date.split('-').reverse().join('/')}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {item.mgr_revision ? (
                            <div>
                              <div className="text-sm">{item.mgr_revision}</div>
                              {item.mgr_date && (
                                <div className="text-xs text-muted-foreground">
                                  {item.mgr_date.split('-').reverse().join('/')}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Padrão institucional</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={st.className}>
                            {st.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-1">
                            {item.status === 'published' && item.is_public && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Copiar link público"
                                  onClick={() => handleCopyLink(item.slug)}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Abrir página pública"
                                  onClick={() => window.open(getPublicUrl(item.slug), '_blank')}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar"
                              onClick={() => navigate(`/admin/school/instruction-programs/${item.id}/edit`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Excluir"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleDelete(item)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
