import React, { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Calendar,
  FileText,
  Printer,
  Sparkles,
  Send,
  Bot,
  MessageSquare,
  X,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { instructionProgramService } from '@/services/instructionProgramService';
import { RagSourceCitation } from '@/types/instructionProgram';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: RagSourceCitation[];
}

export default function PublicInstructionProgram() {
  const { slug } = useParams<{ slug?: string }>();

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: listPrograms, isLoading: loadingList } = useQuery({
    queryKey: ['public-instruction-programs'],
    queryFn: () => instructionProgramService.listPublic(),
    enabled: !slug,
  });

  const {
    data: program,
    isLoading: loadingProgram,
    isError,
  } = useQuery({
    queryKey: ['public-instruction-program', slug],
    queryFn: () => instructionProgramService.getPublicBySlug(slug!),
    enabled: Boolean(slug),
  });

  const handleSendChat = async (customText?: string) => {
    const text = (customText ?? chatInput).trim();
    if (!text || !slug || chatLoading) return;

    const history = chatMessages.map((m) => ({ role: m.role, content: m.content }));
    setChatMessages((prev) => [...prev, { role: 'user', content: text }]);
    setChatInput('');
    setChatLoading(true);

    try {
      const resp = await instructionProgramService.sendPublicChat(slug, text, history);
      if (resp.success && resp.data) {
        setChatMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: resp.data.reply,
            sources: resp.data.sources,
          },
        ]);
      } else {
        throw new Error(resp.message || 'Não foi possível obter resposta.');
      }
    } catch (err: any) {
      setChatMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: err?.message || 'Assistente temporariamente indisponível. Tente novamente em instantes.',
        },
      ]);
    } finally {
      setChatLoading(false);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  };

  // Modo Catálogo (/programas-instrucao)
  if (!slug) {
    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4">
        <div className="max-w-5xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <Badge variant="outline" className="bg-white">
              Documentação Oficial de Ensino
            </Badge>
            <h1 className="text-3xl font-bold text-slate-900">Programas de Instrução</h1>
            <p className="text-slate-600 max-w-2xl mx-auto">
              Consulte as revisões vigentes dos Programas de Instrução e tire dúvidas com nosso assistente de IA.
            </p>
          </div>

          {loadingList ? (
            <div className="text-center py-12 text-slate-500">Carregando programas...</div>
          ) : (listPrograms || []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                Nenhum Programa de Instrução publicado no momento.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(listPrograms || []).map((item) => (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      {item.code && <Badge>{item.code}</Badge>}
                      <Badge variant="outline">Rev. {item.current_revision}</Badge>
                    </div>
                    <CardTitle className="text-lg mt-2">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {item.summary && <p className="text-sm text-slate-600 line-clamp-3">{item.summary}</p>}
                    <Link
                      to={`/programa-instrucao/${item.slug}`}
                      className="inline-flex items-center text-sm font-medium text-primary hover:underline"
                    >
                      Acessar Programa Completo
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loadingProgram) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-500">
        Carregando Programa de Instrução...
      </div>
    );
  }

  if (isError || !program) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center space-y-3">
        <BookOpen className="h-10 w-10 text-slate-400" />
        <h1 className="text-xl font-semibold text-slate-800">Programa de Instrução não encontrado</h1>
        <p className="text-sm text-slate-500">
          O link pode estar desatualizado ou o documento ainda não foi publicado.
        </p>
        <Link to="/programas-instrucao">
          <Button variant="outline">Ver Programas Disponíveis</Button>
        </Link>
      </div>
    );
  }

  const fmtDate = (iso?: string | null) =>
    iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split('-').reverse().join('/') : '—';

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Cabeçalho Institucional */}
      <header className="bg-white border-b print:border-none">
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {program.code && <Badge className="text-xs">{program.code}</Badge>}
              <Badge variant="outline" className="text-xs">
                Revisão {program.current_revision}
              </Badge>
              {program.curso?.nome && (
                <Badge variant="secondary" className="text-xs">
                  {program.curso.nome}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2 print:hidden">
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-1.5" />
                Imprimir / PDF
              </Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => setChatOpen(true)}>
                <Sparkles className="h-4 w-4 mr-1.5" />
                Tirar Dúvidas com IA
              </Button>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-slate-900">{program.title}</h1>
          {program.summary && <p className="text-slate-600 leading-relaxed">{program.summary}</p>}

          <div className="flex flex-wrap gap-6 pt-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Emissão PI: <strong className="text-slate-700">{fmtDate(program.revision_date)}</strong>
            </span>
            {program.mgr_revision && (
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                MGR: <strong className="text-slate-700">Rev. {program.mgr_revision}</strong>
                {program.mgr_date ? ` (${fmtDate(program.mgr_date)})` : ''}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Conteúdo Oficial */}
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <Card className="bg-white shadow-sm print:shadow-none print:border-none">
          <CardContent className="p-6 sm:p-10">
            <article
              className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-a:text-primary"
              dangerouslySetInnerHTML={{
                __html: program.content_html || '<p>Conteúdo em atualização.</p>',
              }}
            />
          </CardContent>
        </Card>

        {program.revisions && program.revisions.length > 0 && (
          <Card className="print:hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Histórico de Revisões</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {program.revisions.map((rev) => (
                <div key={rev.id} className="flex items-start justify-between gap-4 text-sm border-b last:border-none pb-2">
                  <div>
                    <span className="font-medium">Revisão {rev.revision_code}</span>
                    {rev.change_notes && <p className="text-xs text-slate-500">{rev.change_notes}</p>}
                  </div>
                  <span className="text-xs text-slate-500 shrink-0">{fmtDate(rev.revision_date)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>

      {/* Botão Flutuante + Drawer do Chat RAG Público */}
      <div className="fixed bottom-5 right-5 z-50 print:hidden">
        {!chatOpen ? (
          <Button
            size="lg"
            onClick={() => setChatOpen(true)}
            className="rounded-full shadow-lg bg-emerald-600 hover:bg-emerald-700 text-white h-14 px-5 gap-2"
          >
            <MessageSquare className="h-5 w-5" />
            Perguntar sobre o Programa
          </Button>
        ) : (
          <Card className="w-[360px] sm:w-[400px] h-[520px] flex flex-col shadow-2xl border-emerald-200">
            <CardHeader className="py-3 px-4 bg-emerald-600 text-white rounded-t-lg flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5" />
                <div>
                  <div className="text-sm font-semibold">Assistente do Programa</div>
                  <div className="text-[11px] opacity-90">
                    Baseado na Rev. {program.current_revision} (RAG)
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-emerald-700 h-8 w-8"
                onClick={() => setChatOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
              {chatMessages.length === 0 ? (
                <div className="space-y-2.5 text-xs">
                  <div className="bg-white border rounded-lg p-3 text-slate-700">
                    Olá! Posso responder dúvidas sobre o <strong>{program.title}</strong>, pré-requisitos, revisão vigente e regras oficiais.
                  </div>
                  {[
                    'Qual é a revisão vigente deste Programa de Instrução?',
                    'Quais são os principais requisitos e etapas do curso?',
                    'Como funciona a regra de faltas e escala?',
                  ].map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendChat(q)}
                      className="w-full text-left bg-white hover:bg-emerald-50 border rounded-md p-2 text-slate-700 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              ) : (
                chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`rounded-lg p-3 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-emerald-600 text-white ml-8'
                        : 'bg-white border text-slate-800 mr-4 space-y-2'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.sources && msg.sources.length > 0 && (
                      <div className="pt-1.5 border-t text-[10px] text-slate-500">
                        Fontes:{' '}
                        {msg.sources
                          .slice(0, 2)
                          .map((s) => `${s.section || s.title}${s.revision ? ` (Rev. ${s.revision})` : ''}`)
                          .join(' • ')}
                      </div>
                    )}
                  </div>
                ))
              )}

              {chatLoading && (
                <div className="flex items-center gap-2 text-xs text-slate-500 p-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Consultando o Programa de Instrução...
                </div>
              )}
              <div ref={chatEndRef} />
            </CardContent>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
              className="p-2.5 border-t bg-white flex gap-2 rounded-b-lg"
            >
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Digite sua dúvida..."
                disabled={chatLoading}
                className="text-xs h-9"
              />
              <Button
                type="submit"
                size="icon"
                disabled={chatLoading || !chatInput.trim()}
                className="h-9 w-9 bg-emerald-600 hover:bg-emerald-700 shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
