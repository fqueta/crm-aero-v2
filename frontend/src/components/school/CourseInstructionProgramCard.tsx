import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ExternalLink, Plus, Edit, Sparkles, Layers } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { instructionProgramService } from '@/services/instructionProgramService';
import { periodsService } from '@/services/periodsService';

interface Props {
  courseId?: string | number;
  courseName?: string;
  courseType?: string | number;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  published: { label: 'Publicado', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  draft: { label: 'Rascunho', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  archived: { label: 'Arquivado', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

export function CourseInstructionProgramCard({ courseId, courseName, courseType }: Props) {
  const navigate = useNavigate();
  const numericId = courseId ? Number(courseId) : NaN;
  const isTipo4 = String(courseType ?? '') === '4';

  const { data, isLoading } = useQuery({
    queryKey: ['instruction-programs', 'by-course', numericId],
    queryFn: () => instructionProgramService.list({ curso_id: numericId, per_page: 20 }),
    enabled: Number.isFinite(numericId) && numericId > 0,
  });

  const { data: periodsData, isLoading: isLoadingPeriods } = useQuery({
    queryKey: ['periodos', 'by_course', numericId],
    queryFn: () => periodsService.listPeriods({ id_curso: numericId, per_page: 200 }),
    enabled: isTipo4 && Number.isFinite(numericId) && numericId > 0,
  });

  if (!Number.isFinite(numericId) || numericId <= 0) {
    return null;
  }

  const programs = data?.data || [];
  const periods = periodsData?.data || [];
  const periodsWithPi = periods.filter((p) => p.instruction_program || p.instruction_program_id);
  const createUrl = `/admin/school/instruction-programs/create?curso_id=${numericId}${
    courseName ? `&curso_nome=${encodeURIComponent(courseName)}` : ''
  }`;

  return (
    <Card className="border-emerald-200/70 bg-emerald-50/30 dark:bg-emerald-950/10">
      <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-emerald-600" />
            Programa de Instrução (PI) deste Curso
          </CardTitle>
          <CardDescription className="text-xs">
            {isTipo4
              ? 'Curso dividido em períodos (tipo 4): vincule ou reaproveite um PI por período na aba Períodos, ou defina um PI geral do curso abaixo como padrão.'
              : "Página pública, chat RAG de IA e preenchimento automático de '{identificacao_pi}', '{revisao_pi}' e '{data_pi}' nos contratos."}
          </CardDescription>
        </div>
        <Button size="sm" variant={programs.length > 0 || periodsWithPi.length > 0 ? 'outline' : 'default'} onClick={() => navigate(createUrl)}>
          <Plus className="h-4 w-4 mr-1.5" />
          {programs.length > 0 ? 'Novo PI' : isTipo4 ? 'Criar PI Geral do Curso' : 'Criar PI do Curso'}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {isTipo4 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-emerald-600" />
                PIs configurados por período ({periodsWithPi.length}/{periods.length})
              </span>
            </div>
            {isLoadingPeriods ? (
              <p className="text-xs text-muted-foreground">Carregando PIs dos períodos...</p>
            ) : periodsWithPi.length === 0 ? (
              <div className="text-xs text-muted-foreground rounded-md border border-dashed bg-background/60 p-2.5">
                Nenhum período possui PI individual vinculado ainda. Abra a aba <strong>Períodos</strong> abaixo para vincular um PI próprio ou reaproveitar o PI de outro curso em cada período.
              </div>
            ) : (
              <div className="space-y-1.5">
                {periodsWithPi.map((period) => {
                  const pi = period.instruction_program;
                  const st = pi ? (STATUS_LABELS[pi.status] || STATUS_LABELS.draft) : null;
                  const isReused = Boolean(pi?.curso_id && Number(pi.curso_id) !== numericId);
                  return (
                    <div
                      key={String(period.id)}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-background border rounded-md p-2.5"
                    >
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="text-[11px] font-semibold">
                            {period.nome}
                          </Badge>
                          <span className="text-xs font-medium">{pi?.title || `PI #${period.instruction_program_id}`}</span>
                          {pi?.code && <Badge variant="secondary" className="text-[10px] font-mono">{pi.code}</Badge>}
                          {pi?.current_revision && <Badge variant="outline" className="text-[10px]">Rev. {pi.current_revision}</Badge>}
                          {st && <Badge variant="outline" className={`text-[10px] ${st.className}`}>{st.label}</Badge>}
                          {isReused && pi?.curso_nome && (
                            <Badge variant="secondary" className="text-[10px] bg-sky-100 text-sky-800 border-sky-200">
                              Reaproveitado de: {pi.curso_nome}
                            </Badge>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {period.signature_require_pi_acceptance
                            ? 'Exibido na assinatura com aceite obrigatório'
                            : period.signature_show_pi_link
                              ? 'Exibido na assinatura (opcional)'
                              : 'Oculto na assinatura pública'}
                        </div>
                      </div>
                      {pi && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {pi.status === 'published' && pi.is_public && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => window.open(`${window.location.origin}/programa-instrucao/${pi.slug}`, '_blank')}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Página Pública
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => navigate(`/admin/school/instruction-programs/${pi.id}/edit?periodo_id=${period.id}`)}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Editar PI
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {isLoading ? (
          <p className="text-xs text-muted-foreground">Verificando Programa de Instrução vinculado...</p>
        ) : programs.length === 0 ? (
          !isTipo4 ? (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>
                Este curso ainda não possui Programa de Instrução vinculado. Clique em <strong>Criar PI do Curso</strong> para cadastrar e editar com IA.
              </span>
            </div>
          ) : null
        ) : (
          <div className="space-y-2">
            {isTipo4 && (
              <div className="text-xs font-semibold text-muted-foreground">PI geral do curso (fallback)</div>
            )}
            {programs.map((pi) => {
              const st = STATUS_LABELS[pi.status] || STATUS_LABELS.draft;
              return (
                <div
                  key={pi.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-background border rounded-md p-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{pi.title}</span>
                      {pi.code && <Badge variant="secondary" className="text-[11px] font-mono">{pi.code}</Badge>}
                      <Badge variant="outline" className="text-[11px]">Rev. {pi.current_revision}</Badge>
                      <Badge variant="outline" className={`text-[11px] ${st.className}`}>{st.label}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {pi.revision_date ? `Emissão: ${pi.revision_date.split('-').reverse().join('/')}` : 'Sem data de emissão'}
                      {pi.status === 'published' && pi.is_public ? ` • /programa-instrucao/${pi.slug}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {pi.status === 'published' && pi.is_public && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(`${window.location.origin}/programa-instrucao/${pi.slug}`, '_blank')}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Página Pública
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => navigate(`/admin/school/instruction-programs/${pi.id}/edit`)}
                    >
                      <Edit className="h-3.5 w-3.5 mr-1.5" />
                      Editar PI / IA
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
