import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '@/components/ui/tabs';
import { Combobox, useComboboxOptions } from '@/components/ui/combobox';
import { coursesService } from '@/services/coursesService';
import { periodsService } from '@/services/periodsService';
import { enrollmentSituationsService } from '@/services/enrollmentSituationsService';
import type { CoursePeriodsFlowItem, PeriodEnrolledStudent } from '@/types/periods';
import { currencyApplyMask } from '@/lib/masks/currency';
import {
  GraduationCap,
  ChevronRight,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  CheckCheck,
  ArrowRight,
  ExternalLink,
  UserPlus,
  BookOpen,
  Loader2,
  Info,
  FilePlus2,
  Search,
} from 'lucide-react';


/**
 * FormationControl
 * pt-BR: Painel de Controle de Formação — exibe o pipeline de períodos de cursos tipo 4
 *        com contagem de matriculados e alunos prontos para avançar.
 * en-US: Formation Control Panel — displays the periods pipeline for tipo 4 courses
 *        with enrolled and ready-to-advance student counts.
 */
export default function FormationControl() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ─── Seletores ────────────────────────────────────────────────────────────
  // Inicializa com valor vindo da URL (ex: ao retornar da página de proposta)
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    () => searchParams.get('id_curso') || ''
  );
  const [courseSearch, setCourseSearch] = useState('');
  const [situacaoSlug, setSituacaoSlug] = useState<string>(
    () => searchParams.get('situacao_slug') || ''
  );
  const [situacaoSearch, setSituacaoSearch] = useState('');

  // ─── Sheet lateral ────────────────────────────────────────────────────────
  const highlightPeriod = searchParams.get('highlight_period');
  const highlightMatricula = searchParams.get('highlight_matricula');
  
  const [openPeriodId, setOpenPeriodId] = useState<number | null>(() => {
    return highlightPeriod ? Number(highlightPeriod) : null;
  });
  const [sheetTab, setSheetTab] = useState<'all' | 'ready' | 'pending'>('all');
  const [modalSearch, setModalSearch] = useState('');

  // ─── Cursos tipo 4 ────────────────────────────────────────────────────────
  const coursesQuery = useQuery({
    queryKey: ['cursos', 'tipo4', courseSearch],
    queryFn: () => coursesService.listCourses({ page: 1, per_page: 200, search: courseSearch, tipo: '4' }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const courseItems = (coursesQuery.data?.data || coursesQuery.data?.items || []) as any[];
  const courseOptions = useComboboxOptions(courseItems, 'id', 'nome');

  // ─── Situações de matrícula ───────────────────────────────────────────────
  const situacoesQuery = useQuery({
    queryKey: ['situacoes-matricula', 'list', situacaoSearch],
    queryFn: () => enrollmentSituationsService.listSituations({ page: 1, per_page: 200 }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const situacaoItems = (situacoesQuery.data?.data || situacoesQuery.data?.items || []) as any[];
  const situacaoOptions = useComboboxOptions(situacaoItems, 'slug', 'label');

  /**
   * Restaura o label do Combobox de curso quando a página carrega com id_curso na URL.
   * (ex: ao voltar da página de proposta com returnTo contendo ?id_curso=X)
   */
  useEffect(() => {
    if (!selectedCourseId || courseSearch) return;
    const found = courseItems.find((c: any) => String(c.id) === String(selectedCourseId));
    if (found) setCourseSearch(found.nome || found.titulo || '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseItems, selectedCourseId]);

  /**
   * Restaura o label do Combobox de situação quando a página carrega com situacao_slug na URL.
   */
  useEffect(() => {
    if (!situacaoSlug || situacaoSearch) return;
    const found = situacaoItems.find((s: any) => s.slug === situacaoSlug);
    if (found) setSituacaoSearch(found.label || found.name || '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situacaoItems, situacaoSlug]);

  // ─── Fluxo de períodos do curso selecionado ───────────────────────────────
  const flowQuery = useQuery({
    queryKey: ['periodos-flow', selectedCourseId, situacaoSlug],
    queryFn: () => coursesService.getPeriodsFlow(selectedCourseId, situacaoSlug ? { situacao_slug: situacaoSlug } : undefined),
    enabled: !!selectedCourseId,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const flowData = flowQuery.data;
  const periodos: CoursePeriodsFlowItem[] = flowData?.periodos || [];

  // Total acumulado para progresso relativo
  const maxMatriculados = useMemo(() => Math.max(...periodos.map(p => p.total_matriculados), 1), [periodos]);

  // ─── Alunos do período aberto no Sheet ───────────────────────────────────
  const studentsQuery = useQuery({
    queryKey: ['periodo-alunos', openPeriodId, situacaoSlug],
    queryFn: () => periodsService.getEnrolledStudents(openPeriodId!, situacaoSlug ? { situacao_slug: situacaoSlug } : undefined),
    enabled: openPeriodId !== null,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });
  const studentsData = studentsQuery.data;
  const allStudents: PeriodEnrolledStudent[] = studentsData?.matriculados || [];

  // Scroll automático para a matrícula destacada quando os alunos carregam
  useEffect(() => {
    if (highlightMatricula && !studentsQuery.isLoading && openPeriodId) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`matricula-${highlightMatricula}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [highlightMatricula, studentsQuery.isLoading, openPeriodId]);

  const filteredStudents = useMemo(() => {
    let list = allStudents;
    if (sheetTab === 'ready') list = list.filter(s => s.pronto_para_avancar);
    else if (sheetTab === 'pending') list = list.filter(s => !s.pronto_para_avancar);
    
    if (modalSearch.trim() !== '') {
      const q = modalSearch.toLowerCase().trim();
      list = list.filter(s => s.aluno_nome?.toLowerCase().includes(q) || String(s.aluno_id).includes(q) || String(s.matricula_id).includes(q));
    }
    return list;
  }, [allStudents, sheetTab, modalSearch]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const formatValor = useCallback((val?: number | string | null): string => {
    if (val === null || val === undefined || String(val) === '') return '';
    if (typeof val === 'number') {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    }
    const s = String(val).trim();
    if (/^\d+$/.test(s)) {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseInt(s, 10));
    }
    return currencyApplyMask(s, 'pt-BR', 'BRL');
  }, []);

  const statusConfig = {
    g: { label: 'Ganho',       icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' },
    a: { label: 'Atendimento', icon: Clock,         color: 'text-blue-600',    bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' },
    p: { label: 'Perda',       icon: XCircle,       color: 'text-red-500',     bg: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' },
  } as const;

  const openPeriodData = periodos.find(p => p.id === openPeriodId);

  // ─── Handlers ─────────────────────────────────────────────────────────────
  const handleOpenPeriod = useCallback((periodId: number) => {
    setOpenPeriodId(periodId);
    setSheetTab('all');
    setModalSearch('');
  }, []);

  const handleNewEnrollment = (student: PeriodEnrolledStudent) => {
    const params = new URLSearchParams();
    if (student.aluno_id) params.set('id_cliente', student.aluno_id);
    if (selectedCourseId) params.set('id_curso', selectedCourseId);
    if (student.proximo_periodo_id) params.set('periodo_id', String(student.proximo_periodo_id));
    navigate(`/admin/sales/proposals/create?${params.toString()}`, {
      state: {
        returnTo: `/admin/school/formation-control?id_curso=${selectedCourseId}${situacaoSlug ? `&situacao_slug=${situacaoSlug}` : ''}`,
      },
    });
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center shadow-md shadow-violet-500/20">
            <GraduationCap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Controle de Formação
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Acompanhe o progresso dos alunos nos períodos dos Planos de Formação
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card className="p-5 border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm rounded-2xl bg-white dark:bg-zinc-950">
        <div className="flex flex-col gap-5">
          {/* Curso */}
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-violet-400" />
              Curso — Plano de Formação (Tipo 4)
            </Label>
            <Combobox
              options={courseOptions}
              value={selectedCourseId}
              onValueChange={(val) => {
                setSelectedCourseId(val);
                setOpenPeriodId(null);
                const params = new URLSearchParams(searchParams);
                if (val) params.set('id_curso', val);
                else params.delete('id_curso');
                setSearchParams(params, { replace: true });
              }}
              placeholder="Selecionar curso..."
              searchPlaceholder="Buscar curso..."
              emptyText="Nenhum curso tipo 4 encontrado"
              loading={coursesQuery.isLoading}
              onSearch={setCourseSearch}
              searchTerm={courseSearch}
              debounceMs={250}
              className="h-10 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800"
            />
          </div>

          {/* Filtro de Situação */}
          <div className="space-y-2">
            <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
              Filtrar por Situação (Opcional)
            </Label>
            <Combobox
              options={situacaoOptions}
              value={situacaoSlug}
              onValueChange={(val) => {
                setSituacaoSlug(val);
                const params = new URLSearchParams(searchParams);
                if (val) params.set('situacao_slug', val);
                else params.delete('situacao_slug');
                setSearchParams(params, { replace: true });
              }}
              placeholder="Selecionar situação..."
              searchPlaceholder="Buscar situação..."
              emptyText="Nenhuma situação encontrada"
              loading={situacoesQuery.isLoading}
              onSearch={setSituacaoSearch}
              searchTerm={situacaoSearch}
              debounceMs={200}
              className="h-10 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800"
            />
          </div>
        </div>
      </Card>

      {/* Estado vazio — sem curso selecionado */}
      {!selectedCourseId && (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-950/40 dark:to-indigo-950/40 flex items-center justify-center shadow-inner">
            <GraduationCap className="w-9 h-9 text-violet-400" />
          </div>
          <div className="text-center space-y-1 max-w-xs">
            <p className="font-semibold text-zinc-700 dark:text-zinc-300">
              Selecione um Plano de Formação
            </p>
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              Escolha um curso do tipo 4 para visualizar o pipeline de períodos e o progresso dos alunos.
            </p>
          </div>
        </div>
      )}

      {/* Loading do fluxo */}
      {selectedCourseId && flowQuery.isLoading && (
        <div className="flex items-center justify-center py-20 gap-3 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm font-medium">Carregando períodos...</span>
        </div>
      )}

      {/* Sem períodos */}
      {selectedCourseId && !flowQuery.isLoading && periodos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Info className="w-10 h-10 text-zinc-300" />
          <p className="text-sm text-zinc-500 text-center max-w-xs">
            Nenhum período encontrado para este curso. Configure os períodos em{' '}
            <button
              className="text-violet-600 underline underline-offset-2 font-medium"
              onClick={() => navigate(`/admin/school/periods?id_curso=${selectedCourseId}`)}
            >
              Períodos
            </button>.
          </p>
        </div>
      )}

      {/* Pipeline de Períodos */}
      {selectedCourseId && !flowQuery.isLoading && periodos.length > 0 && (
        <div className="space-y-3">
          {/* Nome do curso */}
          <div className="flex items-center gap-2 px-1">
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
              {flowData?.curso_nome}
            </span>
            <ChevronRight className="w-4 h-4 text-zinc-400" />
            <span className="text-sm text-zinc-400">{periodos.length} período{periodos.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Cards do pipeline */}
          <div className="flex flex-nowrap gap-4 overflow-x-auto pb-3 snap-x snap-mandatory">
            {periodos.map((periodo, idx) => {
              const hasStudents = periodo.total_matriculados > 0;
              const fillPct = maxMatriculados > 0 ? Math.round((periodo.total_matriculados / maxMatriculados) * 100) : 0;
              const isLast = idx === periodos.length - 1;

              const borderColor = hasStudents
                  ? 'border-blue-200 dark:border-blue-800'
                  : 'border-zinc-200 dark:border-zinc-800';

              const dotColor = hasStudents ? 'bg-blue-500' : 'bg-zinc-300 dark:bg-zinc-600';

              return (
                <div key={periodo.id} className="flex items-start gap-3 snap-start flex-shrink-0">
                  <div
                    className={`relative w-64 rounded-2xl border-2 ${borderColor} bg-white dark:bg-zinc-950 shadow-sm hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group overflow-hidden`}
                    onClick={() => handleOpenPeriod(periodo.id)}
                  >
                    {/* Topo colorido */}
                    <div className={`h-1.5 w-full ${hasStudents ? 'bg-gradient-to-r from-blue-400 to-indigo-400' : 'bg-zinc-200 dark:bg-zinc-800'}`} />

                    <div className="p-4 space-y-3">
                      {/* Header do card */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0 mt-0.5`} />
                          <div>
                            <p className="text-[10px] font-bold tracking-wider text-zinc-400 uppercase">
                              Período {idx + 1}
                            </p>
                            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 leading-tight line-clamp-2">
                              {periodo.nome}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-300 dark:text-zinc-600 flex-shrink-0 mt-0.5 group-hover:text-violet-500 group-hover:translate-x-0.5 transition-all duration-150" />
                      </div>

                      {/* Valor */}
                      {periodo.valor && (
                        <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                          {formatValor(periodo.valor)}
                        </p>
                      )}

                      {/* Progress bar */}
                      <div className="space-y-1">
                        <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${hasStudents ? 'bg-gradient-to-r from-blue-400 to-indigo-400' : ''}`}
                            style={{ width: `${fillPct}%` }}
                          />
                        </div>
                      </div>

                      {/* Contadores */}
                      <div className="flex items-center justify-between pt-0.5">
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-zinc-400" />
                          <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                            {periodo.total_matriculados} aluno{periodo.total_matriculados !== 1 ? 's' : ''}
                          </span>
                        </div>

                      </div>

                      {/* Botão Ver */}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full h-8 text-xs font-semibold rounded-xl bg-zinc-50 hover:bg-violet-50 dark:bg-zinc-900 dark:hover:bg-violet-950/30 hover:text-violet-700 dark:hover:text-violet-400 border border-zinc-200 dark:border-zinc-800 transition-all duration-150"
                        onClick={(e) => { e.stopPropagation(); handleOpenPeriod(periodo.id); }}
                      >
                        Ver alunos
                      </Button>
                    </div>
                  </div>

                  {/* Seta entre cards */}
                  {!isLast && (
                    <div className="flex items-center self-center mt-8">
                      <ArrowRight className="w-5 h-5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legenda */}
          <div className="flex flex-wrap items-center gap-4 px-1 pt-2 text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Com matrículas
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-zinc-300 dark:bg-zinc-600" />
              Sem matrículas
            </div>
          </div>
        </div>
      )}

      {/* Sheet lateral — Alunos do período */}
      <Sheet open={openPeriodId !== null} onOpenChange={(open) => { if (!open) setOpenPeriodId(null); }}>
        <SheetContent side="right" className="w-full sm:w-[520px] p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-900 flex-shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-950/40 dark:to-indigo-950/40 flex items-center justify-center">
                <GraduationCap className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <SheetTitle className="text-sm font-bold text-zinc-800 dark:text-zinc-100 leading-tight">
                  {openPeriodData?.nome || 'Período'}
                </SheetTitle>
                <SheetDescription className="text-[10px] text-zinc-500 mt-0.5">
                  {studentsData?.total ?? '—'} matriculado{(studentsData?.total ?? 0) !== 1 ? 's' : ''}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          {/* Busca no Modal */}
          <div className="px-6 pt-4 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                placeholder="Buscar aluno por nome ou ID..."
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                className="pl-9 h-9 text-sm rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800"
              />
            </div>
          </div>

          {/* Lista de alunos */}
          <div className="flex-1 overflow-y-auto px-6 pb-6 pt-3 space-y-2">
            {studentsQuery.isLoading && (
              <div className="flex items-center justify-center py-16 gap-2 text-zinc-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Carregando alunos...</span>
              </div>
            )}

            {!studentsQuery.isLoading && filteredStudents.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-zinc-400 space-y-2">
                <Users className="w-8 h-8 text-zinc-300" />
                <p className="text-sm">Nenhum aluno encontrado</p>
              </div>
            )}

            {!studentsQuery.isLoading && filteredStudents.map((student) => {
              const st = statusConfig[student.status] || statusConfig['a'];
              const StatusIcon = st.icon;
              const isHighlighted = highlightMatricula === String(student.matricula_id);

              return (
                <div
                  key={student.matricula_id}
                  id={`matricula-${student.matricula_id}`}
                  className={`rounded-xl border border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3.5 space-y-2.5 hover:border-zinc-200 dark:hover:border-zinc-700 transition-colors duration-150 shadow-sm ${
                    isHighlighted ? 'ring-2 ring-violet-500 animate-[pulse_2s_ease-in-out_3]' : ''
                  }`}
                >
                  {/* Nome + status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center flex-shrink-0 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                        {student.aluno_nome?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                          {student.aluno_nome}
                        </p>
                        {student.data && (
                          <p className="text-[10px] text-zinc-400">
                            Desde {new Date(student.data).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Badge de status CRM */}
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border flex-shrink-0 ${st.bg}`}>
                      <StatusIcon className={`w-3 h-3 ${st.color}`} />
                      <span className={st.color}>{st.label}</span>
                    </span>
                  </div>

                  {/* Situação + próximo período */}
                  <div className="flex flex-wrap gap-2 items-center">
                    {/* Situação da matrícula */}
                    {student.situacao_label && (
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-lg border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 font-medium">
                        {student.situacao_label}
                      </Badge>
                    )}

                    {/* Pronto para avançar */}
                    {student.pronto_para_avancar && (
                      <Badge className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 font-semibold">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Pronto para avançar
                      </Badge>
                    )}
                  </div>

                  {/* Status do próximo período */}
                  {student.proximo_periodo_id && (
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-50 dark:border-zinc-900">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <ArrowRight className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                        <span className="text-[10px] text-zinc-500 truncate">
                          {student.proximo_periodo_nome || `Período seguinte`}
                        </span>
                      </div>
                      {student.ja_matriculado_no_proximo ? (
                        <Badge className="text-[10px] px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800 flex-shrink-0">
                          <CheckCheck className="w-3 h-3 mr-1" />
                          Já matriculado
                        </Badge>
                      ) : (
                        <Badge className="text-[10px] px-2 py-0.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800 flex-shrink-0">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          Pendente
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex flex-col gap-1.5 pt-0.5">
                    {/* Linha 1: Ver matrícula + Criar proposta */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] font-semibold rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex-1"
                        onClick={() =>
                          navigate(
                            `/admin/sales/proposals/view/${student.matricula_id}`,
                            {
                              state: {
                                returnTo: `/admin/school/formation-control?id_curso=${selectedCourseId}${situacaoSlug ? `&situacao_slug=${situacaoSlug}` : ''}&highlight_period=${openPeriodId}`,
                              },
                            }
                          )
                        }
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Ver matrícula
                      </Button>


                      {student.proximo_periodo_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[10px] font-semibold rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/30 hover:text-emerald-700 dark:hover:text-emerald-400 border border-zinc-200 dark:border-zinc-800 flex-1"
                          onClick={() =>
                            navigate(
                              `/admin/sales/proposals/create?id_cliente=${student.aluno_id}&id_curso=${selectedCourseId}`,
                              {
                                state: {
                                  returnTo: `/admin/school/formation-control?id_curso=${selectedCourseId}${situacaoSlug ? `&situacao_slug=${situacaoSlug}` : ''}&highlight_period=${student.proximo_periodo_id}`,
                                },
                              }
                            )
                          }
                        >
                          <FilePlus2 className="w-3 h-3 mr-1" />
                          Criar proposta
                        </Button>
                      )}
                    </div>

                    {/* Linha 2: Nova matrícula (só para prontos sem matrícula no próximo) */}
                    {student.pronto_para_avancar && !student.ja_matriculado_no_proximo && student.proximo_periodo_id && (
                      <Button
                        size="sm"
                        className="h-7 text-[10px] font-semibold rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-sm shadow-violet-500/20 w-full"
                        onClick={() => handleNewEnrollment(student)}
                      >
                        <UserPlus className="w-3 h-3 mr-1" />
                        Nova matrícula — {student.proximo_periodo_nome || 'próximo período'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
