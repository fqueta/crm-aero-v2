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

interface AiChatEntry {
  role: 'user' | 'assistant';
  content: string;
  proposal?: AiEditProposal;
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
      setContentHtml(program.content_html || '');
      setContractDefaults(program.contract_defaults || {});
    }
  }, [program]);

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
          content_html: contentHtml,
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

  const applyAiProposal = (proposal: AiEditProposal) => {
    if (proposal.proposed_content_html) {
      setContentHtml(proposal.proposed_content_html);
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
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Texto Oficial do Programa de Instrução</CardTitle>
                  <CardDescription>
                    Use títulos (H2/H3) para separar seções — o motor RAG indexa automaticamente por seção para respostas precisas.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RichTextEditor
                    value={contentHtml}
                    onChange={setContentHtml}
                    placeholder="Estruture aqui o Programa de Instrução (Objetivo, Pré-requisitos, Grade Prática, Escala, Critérios de Avaliação)..."
                  />
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
                          onClick={() => applyAiProposal(msg.proposal!)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                          Aplicar alterações ao rascunho
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
