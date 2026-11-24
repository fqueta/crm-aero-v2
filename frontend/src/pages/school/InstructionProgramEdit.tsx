import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Save,
  Sparkles,
  Send,
  History,
  CheckCircle2,
  ExternalLink,
  RotateCcw,
  UploadCloud,
  Bot,
  Loader2,
  Plus,
  Trash2,
  Code2,
  Eye,
  FileEdit,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { useToast } from '@/hooks/use-toast';
import { coursesService } from '@/services/coursesService';
import { instructionProgramService } from '@/services/instructionProgramService';
import { AiEditProposal, InstructionProgramRevision } from '@/types/instructionProgram';
import {
  ParsedSection,
  parseProgramSections,
  rebuildProgramHtml,
} from '@/lib/instructionProgramSections';
import '@/styles/instruction-program-viewer.css';

interface AiChatEntry {
  role: 'user' | 'assistant';
  content: string;
  proposal?: AiEditProposal;
  targetSectionIdx?: number | null;
  targetSectionLabel?: string | null;
}

const CONTRACT_DEFAULT_FIELDS: { key: string; label: string; placeholder: string }[] = [
  { key: 'itens_incluidos', label: 'Itens incluídos {itens_incluidos}', placeholder: 'Ex.: Instrução prática em voo, briefing e debriefing...' },
  { key: 'custos_adicionais', label: 'Custos adicionais {custos_adicionais}', placeholder: 'Ex.: Cheque ANAC, examinador credenciado, taxas aeroportuárias, simulador e materiais' },
  { key: 'modalidade_escala', label: 'Modalidade de escala padrão {modalidade_escala}', placeholder: 'Ex.: DDS ou FDS conforme opção do aluno' },
  { key: 'carencia_e_data_liberacao', label: 'Carência / liberação {carencia_e_data_liberacao}', placeholder: 'Ex.: 6 meses a partir da matrícula' },
  { key: 'prazo_maximo_espera', label: 'Prazo máximo de espera {prazo_maximo_espera}', placeholder: 'Ex.: Prioridade após 30 dias em fila' },
  { key: 'regra_faltas_bloco', label: 'Regra disciplinar por faltas {regra_faltas_bloco}', placeholder: 'Ex.: Até 2 faltas injustificadas no bloco' },
  { key: 'limite_realocacoes_ppa', label: 'Limite de realocações por turma {limite_realocacoes_ppa}', placeholder: 'Ex.: Máximo de 1 realocação por turma' },
];

export default function InstructionProgramEdit() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const initialCursoId = !isEditing ? searchParams.get('curso_id') || 'none' : 'none';
  const initialCursoNome = !isEditing ? searchParams.get('curso_nome') || '' : '';

  const [title, setTitle] = useState(
    initialCursoNome ? `Programa de Instrução — ${initialCursoNome}` : ''
  );
  const [slug, setSlug] = useState('');
  const [code, setCode] = useState('');
  const [cursoId, setCursoId] = useState<string>(initialCursoId);
  const [currentRevision, setCurrentRevision] = useState('001');
  const [revisionDate, setRevisionDate] = useState(new Date().toISOString().slice(0, 10));
  const [mgrRevision, setMgrRevision] = useState('');
  const [mgrDate, setMgrDate] = useState('');
  const [status, setStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [isPublic, setIsPublic] = useState(true);
  const [summary, setSummary] = useState('');
  const [contentHtml, setContentHtml] = useState('');
  const [contractDefaults, setContractDefaults] = useState<Record<string, string>>({});
  const [changeNotes, setChangeNotes] = useState('');
  const [editedByAi, setEditedByAi] = useState(false);

  // Edição por seção/capítulo (manual + IA)
  const [sections, setSections] = useState<ParsedSection[]>([]);
  const [useSectionMode, setUseSectionMode] = useState(false);
  const [activeSecIdx, setActiveSecIdx] = useState(0);
  const [editorMode, setEditorMode] = useState<'visual' | 'html' | 'preview'>('visual');

  // Painel de Edição com IA
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState<AiChatEntry[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const { data: coursesResp } = useQuery({
    queryKey: ['courses-for-pi'],
    queryFn: () => coursesService.listCourses({ page: 1, per_page: 200 }),
  });
  const courses = coursesResp?.data || [];

  const { data: program, isLoading } = useQuery({
    queryKey: ['instruction-program', id],
    queryFn: () => instructionProgramService.getById(id!),
    enabled: isEditing,
  });

  useEffect(() => {
    if (program) {
      setTitle(program.title || '');
      setSlug(program.slug || '');
      setCode(program.code || '');
      setCursoId(program.curso_id ? String(program.curso_id) : 'none');
      setCurrentRevision(program.current_revision || '001');
      setRevisionDate(program.revision_date || '');
      setMgrRevision(program.mgr_revision || '');
      setMgrDate(program.mgr_date || '');
      setStatus(program.status || 'draft');
      setIsPublic(Boolean(program.is_public));
      setSummary(program.summary || '');
      const rawHtml = program.content_html || '';
      setContentHtml(rawHtml);
      setContractDefaults(program.contract_defaults || {});

      const parsed = parseProgramSections(rawHtml, program.title || 'Conteúdo');
      setSections(parsed);
      setActiveSecIdx(0);
      const multi = parsed.length > 1;
      setUseSectionMode(multi);
      if (multi && parsed[0]?.hasPg) {
        setEditorMode('preview');
      } else {
        setEditorMode('visual');
      }
    }
  }, [program]);

  const activeSection = useSectionMode ? sections[activeSecIdx] ?? null : null;

  const updateActiveSectionHtml = (newSectionHtml: string) => {
    setSections((prev) => {
      const next = prev.map((sec, idx) =>
        idx === activeSecIdx
          ? {
              ...sec,
              html: newSectionHtml,
              hasPg: newSectionHtml.includes('class="pg"') || newSectionHtml.includes("class='pg'"),
            }
          : sec
      );
      setContentHtml(rebuildProgramHtml(next));
      return next;
    });
  };

  const handleAddSection = () => {
    const newIndex = sections.length;
    const newNum = String(newIndex + 1);
    const newSec: ParsedSection = {
      id: `sec-${Date.now()}`,
      num: newNum,
      title: `Nova Seção ${newNum}`,
      html: `<h1>${newNum}. Nova Seção</h1>\n<p>Escreva o conteúdo desta seção aqui...</p>`,
      plainText: `${newNum}. Nova Seção`,
      hasPg: false,
      subs: [],
    };
    const next = useSectionMode
      ? [...sections, newSec]
      : [...parseProgramSections(contentHtml, title || 'Conteúdo'), newSec];
    setSections(next);
    setUseSectionMode(true);
    setActiveSecIdx(next.length - 1);
    setEditorMode('visual');
    setContentHtml(rebuildProgramHtml(next));
  };

  const handleRemoveActiveSection = () => {
    if (sections.length <= 1) return;
    const next = sections.filter((_, idx) => idx !== activeSecIdx);
    setSections(next);
    setActiveSecIdx(Math.max(0, activeSecIdx - 1));
    setContentHtml(rebuildProgramHtml(next));
    toast({ title: 'Seção removida do rascunho.' });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        curso_id: cursoId !== 'none' ? Number(cursoId) : null,
        title: title.trim(),
        slug: slug.trim() || undefined,
        code: code.trim() || undefined,
        current_revision: currentRevision.trim() || '001',
        revision_date: revisionDate || null,
        mgr_revision: mgrRevision.trim() || undefined,
        mgr_date: mgrDate || null,
        status,
        is_public: isPublic,
        summary: summary.trim() || undefined,
        content_html: contentHtml,
        contract_defaults: contractDefaults,
        edited_by_ai: editedByAi,
      };
      if (isEditing && id) {
        return instructionProgramService.update(id, payload);
      }
      return instructionProgramService.create(payload);
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ['instruction-programs'] });
      queryClient.invalidateQueries({ queryKey: ['instruction-program', String(saved.id)] });
      toast({ title: 'Programa de Instrução salvo com sucesso.' });
      if (!isEditing) {
        navigate(`/admin/school/instruction-programs/${saved.id}/edit`, { replace: true });
      }
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao salvar Programa de Instrução',
        description: err?.message || 'Verifique os campos obrigatórios.',
        variant: 'destructive',
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error('Salve o rascunho antes de publicar uma revisão.');
      return instructionProgramService.publishRevision(id, {
        revision_code: currentRevision.trim() || '001',
        revision_date: revisionDate || new Date().toISOString().slice(0, 10),
        mgr_revision: mgrRevision.trim() || undefined,
        mgr_date: mgrDate || undefined,
        change_notes: changeNotes.trim() || 'Nova revisão publicada',
        edited_by_ai: editedByAi,
        content_html: contentHtml,
        contract_defaults: contractDefaults,
      });
    },
    onSuccess: () => {
      setStatus('published');
      setChangeNotes('');
      setEditedByAi(false);
      queryClient.invalidateQueries({ queryKey: ['instruction-program', id] });
      queryClient.invalidateQueries({ queryKey: ['instruction-programs'] });
      toast({
        title: 'Revisão publicada e indexada no RAG!',
        description: 'A página pública e os shortcodes de contrato já refletem esta revisão.',
      });
    },
    onError: (err: any) => {
      toast({
        title: 'Erro ao publicar revisão',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (revId: number) => instructionProgramService.restoreRevision(id!, revId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instruction-program', id] });
      toast({ title: 'Revisão restaurada com sucesso.' });
    },
  });

  const handleSendAiInstruction = async () => {
    const prompt = aiInput.trim();
    if (!prompt || !id) return;

    const targetIdx = useSectionMode && activeSection ? activeSecIdx : null;
    const targetLabel = activeSection ? `${activeSection.num}. ${activeSection.title}` : null;
    const scopedHtml = activeSection ? activeSection.html : contentHtml;

    const history = aiMessages.map((m) => ({ role: m.role, content: m.content }));
    setAiMessages((prev) => [...prev, { role: 'user', content: prompt }]);
    setAiInput('');
    setAiLoading(true);

    try {
      const resp = await instructionProgramService.aiEdit(id, {
        instruction: prompt,
        history,
        draft: {
          title,
          code,
          current_revision: currentRevision,
          revision_date: revisionDate,
          mgr_revision: mgrRevision,
          mgr_date: mgrDate,
          summary,
          content_html: scopedHtml,
          section_title: targetLabel || undefined,
          contract_defaults: contractDefaults,
        },
      });

      if (resp.success && resp.data) {
        setAiMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: resp.data.assistant_reply,
            proposal: resp.data,
            targetSectionIdx: targetIdx,
            targetSectionLabel: targetLabel,
          },
        ]);
      } else {
        throw new Error(resp.message || 'Falha ao processar instrução na IA.');
      }
    } catch (err: any) {
      setAiMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err?.message || 'Não foi possível falar com a IA. Verifique as chaves em Configurações > Integrações.',
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiProposal = (proposal: AiEditProposal, targetSectionIdx?: number | null) => {
    if (proposal.proposed_content_html) {
      if (targetSectionIdx !== null && targetSectionIdx !== undefined && useSectionMode && sections[targetSectionIdx]) {
        const cleanSecHtml = proposal.proposed_content_html
          .replace(/^\s*<section[^>]*>/i, '')
          .replace(/<\/section>\s*$/i, '')
          .trim();
        setSections((prev) => {
          const next = prev.map((sec, idx) =>
            idx === targetSectionIdx
              ? {
                  ...sec,
                  html: cleanSecHtml,
                  hasPg: cleanSecHtml.includes('class="pg"') || cleanSecHtml.includes("class='pg'"),
                }
              : sec
          );
          setContentHtml(rebuildProgramHtml(next));
          return next;
        });
        setActiveSecIdx(targetSectionIdx);
      } else {
        setContentHtml(proposal.proposed_content_html);
        const parsed = parseProgramSections(proposal.proposed_content_html, title || 'Conteúdo');
        setSections(parsed);
        setUseSectionMode(parsed.length > 1);
      }
    }
    if (proposal.proposed_metadata) {
      const m = proposal.proposed_metadata;
      if (m.title) setTitle(String(m.title));
      if (m.code) setCode(String(m.code));
      if (m.current_revision) setCurrentRevision(String(m.current_revision));
      if (m.revision_date) setRevisionDate(String(m.revision_date));
      if (m.mgr_revision) setMgrRevision(String(m.mgr_revision));
      if (m.mgr_date) setMgrDate(String(m.mgr_date));
      if (m.summary) setSummary(String(m.summary));
      if (m.contract_defaults && typeof m.contract_defaults === 'object') {
        setContractDefaults((prev) => ({ ...prev, ...m.contract_defaults }));
      }
    }
    if (proposal.change_summary) {
      setChangeNotes(proposal.change_summary);
    }
    setEditedByAi(true);
    toast({
      title: 'Alterações da IA aplicadas ao rascunho!',
      description: 'Revise o conteúdo e clique em Salvar ou Publicar Nova Revisão.',
    });
  };

  if (isEditing && isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando Programa de Instrução...</div>;
  }

  const revisions: InstructionProgramRevision[] = program?.revisions || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate('/admin/school/instruction-programs')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {isEditing ? `Editar PI: ${title || '...'}` : 'Novo Programa de Instrução'}
            </h1>
            <p className="text-sm text-muted-foreground">
              Alimenta a página pública, o chat RAG de IA e os shortcodes {'{identificacao_pi}'}, {'{revisao_pi}'}, {'{data_pi}'}.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isEditing && slug && status === 'published' && isPublic && (
            <Button
              variant="outline"
              onClick={() => window.open(`${window.location.origin}/programa-instrucao/${slug}`, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Ver Página Pública
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !title.trim()}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? 'Salvando...' : 'Salvar Rascunho'}
          </Button>
          {isEditing && (
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending || !title.trim()}
            >
              <UploadCloud className="h-4 w-4 mr-2" />
              {publishMutation.isPending ? 'Publicando...' : 'Publicar Nova Revisão'}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Principal (Editor + Abas) */}
        <div className="lg:col-span-8 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Identificação e Controle de Revisão</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Título do Programa de Instrução *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex.: Programa de Instrução — Piloto Privado de Avião Prático (PPAP)"
                />
              </div>

              <div>
                <Label>Código / Identificação PI ({'{identificacao_pi}'})</Label>
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Ex.: PPAP"
                />
              </div>

              <div>
                <Label>Curso Vinculado</Label>
                <Select value={cursoId} onValueChange={setCursoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um curso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem vínculo específico</SelectItem>
                    {courses.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Revisão Atual ({'{revisao_pi}'})</Label>
                <Input
                  value={currentRevision}
                  onChange={(e) => setCurrentRevision(e.target.value)}
                  placeholder="Ex.: 001F"
                />
              </div>

              <div>
                <Label>Data da Revisão ({'{data_pi}'})</Label>
                <Input
                  type="date"
                  value={revisionDate}
                  onChange={(e) => setRevisionDate(e.target.value)}
                />
              </div>

              <div>
                <Label>Revisão MGR ({'{revisao_mgr}'}) — opcional</Label>
                <Input
                  value={mgrRevision}
                  onChange={(e) => setMgrRevision(e.target.value)}
                  placeholder="Vazio = usa padrão institucional"
                />
              </div>

              <div>
                <Label>Data MGR ({'{data_mgr}'}) — opcional</Label>
                <Input
                  type="date"
                  value={mgrDate}
                  onChange={(e) => setMgrDate(e.target.value)}
                />
              </div>

              <div>
                <Label>Slug da Página Pública</Label>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="gerado automaticamente se vazio"
                />
              </div>

              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="published">Publicado</SelectItem>
                    <SelectItem value="archived">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2 flex items-center justify-between border rounded-md p-3">
                <div>
                  <div className="text-sm font-medium">Exibir na página pública e habilitar Chat RAG público</div>
                  <div className="text-xs text-muted-foreground">
                    Quando ativo e publicado, alunos e leads podem consultar em /programa-instrucao/{slug || 'slug'}.
                  </div>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>

              <div className="md:col-span-2">
                <Label>Resumo (exibido no cabeçalho público)</Label>
                <Textarea
                  rows={2}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Breve descrição dos objetivos, pré-requisitos e carga horária do programa..."
                />
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="content">
            <TabsList>
              <TabsTrigger value="content">Conteúdo do Programa</TabsTrigger>
              <TabsTrigger value="defaults">Padrões Contratuais (Shortcodes)</TabsTrigger>
              {isEditing && (
                <TabsTrigger value="revisions" className="flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  Revisões ({revisions.length})
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="content" className="mt-4">
              <Card>
                <CardHeader className="pb-3 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">Texto Oficial do Programa de Instrução</CardTitle>
                      <CardDescription>
                        {useSectionMode
                          ? `Modo por Seção/Capítulo (${sections.length} seções) — edite manualmente ou com a IA sem alterar os demais capítulos.`
                          : 'Use títulos (H2/H3) para separar seções — o motor RAG indexa automaticamente por seção.'}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={handleAddSection}>
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        Nova Seção
                      </Button>
                    </div>
                  </div>

                  {useSectionMode && sections.length > 0 && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-2 border-t">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                        <Select
                          value={String(activeSecIdx)}
                          onValueChange={(val) => setActiveSecIdx(Number(val))}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Selecione uma seção..." />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {sections.map((sec, idx) => (
                              <SelectItem key={sec.id} value={String(idx)} className="text-xs">
                                {sec.num}. {sec.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant={editorMode === 'preview' ? 'default' : 'outline'}
                          className="h-8 text-xs px-2.5"
                          onClick={() => setEditorMode('preview')}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Prévia
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={editorMode === 'visual' ? 'default' : 'outline'}
                          className="h-8 text-xs px-2.5"
                          onClick={() => setEditorMode('visual')}
                        >
                          <FileEdit className="h-3.5 w-3.5 mr-1" />
                          Visual
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={editorMode === 'html' ? 'default' : 'outline'}
                          className="h-8 text-xs px-2.5"
                          onClick={() => setEditorMode('html')}
                        >
                          <Code2 className="h-3.5 w-3.5 mr-1" />
                          HTML
                        </Button>
                        {sections.length > 1 && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={handleRemoveActiveSection}
                            title="Remover esta seção"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="space-y-4">
                  {useSectionMode && activeSection ? (
                    <>
                      {editorMode === 'preview' && (
                        <div className="rounded-lg border bg-[#d9dee4] p-4 max-h-[620px] overflow-y-auto">
                          <div className="pi-doc-container">
                            {activeSection.hasPg ? (
                              <div dangerouslySetInnerHTML={{ __html: activeSection.html }} />
                            ) : (
                              <div className="pi-doc-fallback-paper">
                                <div className="pg-body" dangerouslySetInnerHTML={{ __html: activeSection.html }} />
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {editorMode === 'visual' && (
                        <div className="space-y-2">
                          {activeSection.hasPg && (
                            <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5">
                              Dica: esta seção usa layout editorial avançado (.pg / tabelas). Para preservar 100% da diagramação original, prefira o modo <strong>HTML</strong> ou peça o ajuste ao <strong>Assistente IA</strong> ao lado.
                            </p>
                          )}
                          <RichTextEditor
                            key={activeSection.id}
                            value={activeSection.html}
                            onChange={updateActiveSectionHtml}
                            placeholder="Edite o texto desta seção..."
                          />
                        </div>
                      )}

                      {editorMode === 'html' && (
                        <Textarea
                          value={activeSection.html}
                          onChange={(e) => updateActiveSectionHtml(e.target.value)}
                          rows={20}
                          className="font-mono text-xs leading-relaxed"
                          placeholder="<div class='pg'>...</div>"
                        />
                      )}
                    </>
                  ) : (
                    <RichTextEditor
                      value={contentHtml}
                      onChange={setContentHtml}
                      placeholder="Estruture aqui o Programa de Instrução (Objetivo, Pré-requisitos, Grade Prática, Escala, Critérios de Avaliação)..."
                    />
                  )}
                  {isEditing && (
                    <div>
                      <Label>Nota da revisão (para o histórico ao publicar)</Label>
                      <Input
                        value={changeNotes}
                        onChange={(e) => setChangeNotes(e.target.value)}
                        placeholder="Ex.: Atualização da grade de voo noturno e regra de carência"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="defaults" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Overrides de Shortcodes deste Programa</CardTitle>
                  <CardDescription>
                    Opcional. Campos preenchidos aqui sobrescrevem o padrão institucional nos contratos vinculados a este curso.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {CONTRACT_DEFAULT_FIELDS.map((field) => (
                    <div key={field.key}>
                      <Label>{field.label}</Label>
                      <Input
                        value={contractDefaults[field.key] || ''}
                        onChange={(e) =>
                          setContractDefaults((prev) => ({
                            ...prev,
                            [field.key]: e.target.value,
                          }))
                        }
                        placeholder={field.placeholder}
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {isEditing && (
              <TabsContent value="revisions" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Histórico de Revisões Publicadas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {revisions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhuma revisão publicada ainda. Clique em "Publicar Nova Revisão" para registrar o primeiro snapshot.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {revisions.map((rev) => (
                          <div
                            key={rev.id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border rounded-md p-3"
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">Rev. {rev.revision_code}</Badge>
                                {rev.revision_date && (
                                  <span className="text-xs text-muted-foreground">
                                    {rev.revision_date.split('-').reverse().join('/')}
                                  </span>
                                )}
                                {rev.edited_by_ai && (
                                  <Badge variant="secondary" className="text-xs">
                                    <Sparkles className="h-3 w-3 mr-1" /> Editado com IA
                                  </Badge>
                                )}
                              </div>
                              {rev.change_notes && (
                                <p className="text-sm text-muted-foreground mt-1">{rev.change_notes}</p>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => restoreMutation.mutate(rev.id)}
                              disabled={restoreMutation.isPending}
                            >
                              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                              Restaurar
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>

        {/* Coluna Lateral: Assistente de Edição por IA */}
        <div className="lg:col-span-4">
          <Card className="sticky top-6 flex flex-col max-h-[calc(100vh-4rem)]">
            <CardHeader className="pb-3 border-b bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-t-lg">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                Editar Programa com IA
              </CardTitle>
              <CardDescription className="text-xs">
                Peça para estruturar seções, revisar regras, atualizar a revisão ou preencher padrões contratuais. Nada é aplicado sem sua confirmação.
              </CardDescription>
              {useSectionMode && activeSection && (
                <div className="pt-1.5">
                  <Badge variant="secondary" className="text-[11px] font-medium max-w-full truncate">
                    Escopo IA: {activeSection.num}. {activeSection.title}
                  </Badge>
                </div>
              )}
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[280px]">
              {!isEditing ? (
                <div className="text-xs text-muted-foreground bg-muted/60 p-3 rounded-md">
                  Salve o rascunho inicial primeiro para habilitar o editor assistido por IA neste Programa de Instrução.
                </div>
              ) : aiMessages.length === 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Sugestões rápidas:</p>
                  {[
                    'Estruture este PI em seções claras: Objetivo, Pré-requisitos, Fases Práticas, Escala e Avaliação.',
                    'Atualize a revisão para 002A com data de hoje e adicione uma seção sobre regra de carência de 6 meses.',
                    'Revise a clareza jurídica e técnica do texto mantendo as regras atuais.',
                  ].map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setAiInput(sug)}
                      className="w-full text-left text-xs p-2.5 rounded-md border hover:bg-muted/60 transition-colors"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              ) : (
                aiMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg p-3 text-sm ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground ml-6'
                        : 'bg-muted mr-2 space-y-2'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs opacity-75 mb-1">
                      {msg.role === 'assistant' && <Bot className="h-3.5 w-3.5" />}
                      <span>{msg.role === 'user' ? 'Você' : 'Assistente IA'}</span>
                    </div>
                    <div className="whitespace-pre-wrap text-xs leading-relaxed">{msg.content}</div>

                    {msg.proposal && (msg.proposal.proposed_content_html || msg.proposal.proposed_metadata) && (
                      <div className="pt-2 border-t border-border/60 space-y-2">
                        {msg.proposal.change_summary && (
                          <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            Resumo: {msg.proposal.change_summary}
                          </div>
                        )}
                        <Button
                          size="sm"
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={() => applyAiProposal(msg.proposal!, msg.targetSectionIdx)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                          {msg.targetSectionLabel
                            ? `Aplicar na seção "${msg.targetSectionLabel.slice(0, 26)}"`
                            : 'Aplicar alterações ao rascunho'}
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}

              {aiLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Gerando proposta de edição...
                </div>
              )}
            </CardContent>

            <div className="p-3 border-t flex gap-2">
              <Textarea
                rows={2}
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                disabled={!isEditing || aiLoading}
                placeholder={isEditing ? 'Descreva a alteração desejada...' : 'Salve o rascunho primeiro...'}
                className="text-xs resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendAiInstruction();
                  }
                }}
              />
              <Button
                size="icon"
                disabled={!isEditing || aiLoading || !aiInput.trim()}
                onClick={handleSendAiInstruction}
                className="shrink-0 self-end"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
