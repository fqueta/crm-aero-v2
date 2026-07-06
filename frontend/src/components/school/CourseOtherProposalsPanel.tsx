import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { enrollmentsService } from '@/services/enrollmentsService';
import { format } from 'date-fns';
import { FileText, Loader2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CourseOtherProposalsPanelProps {
  clientId: string;
  courseId: number;
  currentEnrollmentId?: string;
}

export default function CourseOtherProposalsPanel({ clientId, courseId, currentEnrollmentId }: CourseOtherProposalsPanelProps) {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['enrollments', 'otherProposals', clientId, courseId],
    queryFn: () => enrollmentsService.listEnrollments({ 
      id_cliente: clientId, 
      id_curso: String(courseId),
      per_page: 100,
      situacao: '' // Empty string to bypass the default 'mat' filter on backend if possible
    }),
    enabled: !!clientId && !!courseId
  });

  const enrollments = useMemo(() => {
    if (!data) return [];
    const list = Array.isArray(data) ? data : (data.data || []);
    // Sort by created_at desc
    return [...list].sort((a, b) => {
      const d1 = a.created_at ? new Date(a.created_at).getTime() : 0;
      const d2 = b.created_at ? new Date(b.created_at).getTime() : 0;
      return d2 - d1;
    });
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Se não tem outras propostas além da atual, podemos exibir vazio ou não exibir.
  // Vamos exibir a tabela com a proposta atual para o usuário saber que ela existe.

  return (
    <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-white/40 dark:bg-zinc-900/40">
      <CardHeader className="pb-3 border-b border-border/40 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <FileText className="w-4 h-4 text-violet-500" />
          Propostas do Aluno neste Curso
        </CardTitle>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate(`/admin/sales/proposals/create?id_cliente=${clientId}&id_curso=${courseId}`)}
          className="h-8 text-xs"
        >
          + Nova Proposta
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12 text-center">#</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-4">
                    Nenhuma outra proposta encontrada.
                  </TableCell>
                </TableRow>
              ) : (
                enrollments.map((env, i) => {
                  const isCurrent = String(env.id) === currentEnrollmentId;
                  
                  // Data: prioriza data_matricula, depois created_at
                  const rawDate = env.data_matricula || env.created_at;
                  const dateStr = rawDate ? format(new Date(rawDate), 'dd/MM/yyyy') : '-';
                  
                  // Período: tenta buscar do periodo_nome injetado, turma_nome, ou de dentro do JSON orc
                  let orcObj = env.orc;
                  if (typeof env.orc === 'string') {
                    try { orcObj = JSON.parse(env.orc); } catch (e) {}
                  }

                  // Valor: prioriza o campo total, depois orc.total_geral, orc.total, valor
                  const rawTotal = Number(env.total) || Number(orcObj?.total_geral) || Number(orcObj?.total) || Number(env.valor) || 0;
                  const formattedVal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rawTotal);
                  
                  let period = env.periodo_nome || env.turma_nome || env.config?.periodo_nome;
                  if (!period && orcObj) {
                    period = orcObj?.modulos?.[0]?.nome || orcObj?.modulos?.[0]?.titulo;
                  }
                  if (!period) period = '-';
                  
                  return (
                    <TableRow key={env.id} className={isCurrent ? 'bg-violet-500/5 hover:bg-violet-500/10 dark:bg-violet-500/10' : ''}>
                      <TableCell className="text-center text-muted-foreground">{env.id}</TableCell>
                      <TableCell>{dateStr}</TableCell>
                      <TableCell className="font-medium">{formattedVal}</TableCell>
                      <TableCell>{period}</TableCell>
                      <TableCell>
                        <span className="text-[10px] uppercase font-semibold px-2 py-1 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 tracking-wider">
                          {env.situacao || env.situacao_nome || env.status || '-'}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant={isCurrent ? "secondary" : "outline"}
                          size="sm"
                          className="h-7 text-xs px-2"
                          disabled={isCurrent}
                          onClick={() => navigate(`/admin/sales/proposals/view/${env.id}`)}
                        >
                          {isCurrent ? 'Atual' : 'Visualizar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
