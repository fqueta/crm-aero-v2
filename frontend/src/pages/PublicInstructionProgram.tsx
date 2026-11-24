import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Printer,
  Sparkles,
  Send,
  Bot,
  MessageSquare,
  X,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  Menu,
  Search,
  History,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { instructionProgramService } from '@/services/instructionProgramService';
import { RagSourceCitation } from '@/types/instructionProgram';
import { parseProgramSections } from '@/lib/instructionProgramSections';
import '@/styles/instruction-program-viewer.css';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  sources?: RagSourceCitation[];
}

interface SearchHit {
  sectionIndex: number;
  sectionNum: string;
  sectionTitle: string;
  before: string;
  match: string;
  after: string;
}

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export default function PublicInstructionProgram() {
  const { slug } = useParams<{ slug?: string }>();

  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Estados do leitor interativo
  const [activeSecIdx, setActiveSecIdx] = useState(0);
  const [openSecs, setOpenSecs] = useState<Record<number, boolean>>({ 0: true });
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllSections, setShowAllSections] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showRevisionsModal, setShowRevisionsModal] = useState(false);

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

  // Resetar estado ao trocar de documento
  useEffect(() => {
    setActiveSecIdx(0);
    setOpenSecs({ 0: true });
    setSearchQuery('');
    setShowAllSections(false);
    setMobileNavOpen(false);
    setChatMessages([]);
  }, [slug]);

  const sections = useMemo(
    () => (program ? parseProgramSections(program.content_html, program.title) : []),
    [program]
  );

  // Filtro do índice + busca full-text nas seções
  const { filteredSectionIndices, searchHits } = useMemo(() => {
    const q = normalizeText(searchQuery.trim());
    if (!q || q.length < 2) {
      return {
        filteredSectionIndices: sections.map((_, i) => i),
        searchHits: [] as SearchHit[],
      };
    }

    const indices: number[] = [];
    const hits: SearchHit[] = [];

    sections.forEach((sec, idx) => {
      const titleHit =
        normalizeText(sec.title).includes(q) ||
        sec.subs.some((sub) => normalizeText(sub.title).includes(q));
      const normBody = normalizeText(sec.plainText);
      const pos = normBody.indexOf(q);

      if (titleHit || pos >= 0) {
        indices.push(idx);
      }

      if (pos >= 0 && hits.length < 30) {
        const start = Math.max(0, pos - 45);
        const end = Math.min(sec.plainText.length, pos + q.length + 75);
        const before = (start > 0 ? '…' : '') + sec.plainText.slice(start, pos);
        const match = sec.plainText.slice(pos, pos + q.length);
        const after = sec.plainText.slice(pos + q.length, end) + (end < sec.plainText.length ? '…' : '');
        hits.push({
          sectionIndex: idx,
          sectionNum: sec.num,
          sectionTitle: sec.title,
          before,
          match,
          after,
        });
      }
    });

    return { filteredSectionIndices: indices, searchHits: hits };
  }, [sections, searchQuery]);

  const selectSection = (idx: number, anchorId?: string) => {
    setActiveSecIdx(idx);
    setOpenSecs((prev) => ({ ...prev, [idx]: true }));
    setMobileNavOpen(false);

    setTimeout(() => {
      if (anchorId) {
        const target = document.getElementById(anchorId);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          return;
        }
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 40);
  };

  const toggleSectionAccordion = (idx: number) => {
    const isAlreadyActive = activeSecIdx === idx;
    setActiveSecIdx(idx);
    setOpenSecs((prev) => ({
      ...prev,
      [idx]: isAlreadyActive ? !prev[idx] : true,
    }));
    setMobileNavOpen(false);
    if (!showAllSections) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setTimeout(() => {
        document.getElementById(`sec-wrap-${idx}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 30);
    }
  };

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

  // =========================================================================
  // MODO CATÁLOGO (/programas-instrucao)
  // =========================================================================
  if (!slug) {
    return (
      <div className="min-h-screen bg-[#d9dee4]">
        <header className="bg-[#13202e] text-[#e6edf4] border-b border-[#2a3d52] py-8 px-4">
          <div className="max-w-5xl mx-auto text-center space-y-2">
            <span className="inline-block text-[11px] font-semibold uppercase tracking-widest px-3 py-1 rounded-full bg-[#1b2b3c] border border-[#2a3d52] text-[#e0a526]">
              Documentação Oficial de Ensino e Operações
            </span>
            <h1 className="text-3xl font-bold tracking-tight">Programas de Instrução & Manuais</h1>
            <p className="text-sm text-[#93a6ba] max-w-2xl mx-auto">
              Consulte as revisões vigentes dos Programas de Instrução, POHs e SOPs com navegação interativa e assistente de IA.
            </p>
          </div>
        </header>

        <div className="max-w-5xl mx-auto py-8 px-4">
          {loadingList ? (
            <div className="text-center py-12 text-slate-600">Carregando documentos...</div>
          ) : (listPrograms || []).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                Nenhum Programa de Instrução publicado no momento.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(listPrograms || []).map((item) => (
                <Card key={item.id} className="bg-white hover:shadow-md transition-shadow border-slate-300/80">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      {item.code && (
                        <Badge className="bg-[#13202e] text-[#e0a526] hover:bg-[#1b2b3c]">
                          {item.code}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        Rev. {item.current_revision}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg mt-2 text-slate-900">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {item.summary && <p className="text-sm text-slate-600 line-clamp-3">{item.summary}</p>}
                    <Link
                      to={`/programa-instrucao/${item.slug}`}
                      className="inline-flex items-center text-sm font-semibold text-[#13202e] hover:text-[#b47f0e]"
                    >
                      Acessar Documento Interativo
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

  // =========================================================================
  // LOADING / NOT FOUND
  // =========================================================================
  if (loadingProgram) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#d9dee4] text-slate-700 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando documento...
      </div>
    );
  }

  if (isError || !program) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#d9dee4] p-6 text-center space-y-3">
        <BookOpen className="h-10 w-10 text-slate-500" />
        <h1 className="text-xl font-semibold text-slate-800">Documento não encontrado</h1>
        <p className="text-sm text-slate-600">
          O link pode estar desatualizado ou o documento ainda não foi publicado.
        </p>
        <Link to="/programas-instrucao">
          <Button variant="outline" className="bg-white">Ver Documentos Disponíveis</Button>
        </Link>
      </div>
    );
  }

  const fmtDate = (iso?: string | null) =>
    iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split('-').reverse().join('/') : null;

  const revDateFormatted = fmtDate(program.revision_date);
  const subtitleParts = [
    program.code || null,
    program.curso?.nome || null,
    program.current_revision ? `Rev. ${program.current_revision}` : null,
    revDateFormatted,
    program.mgr_revision ? `MGR ${program.mgr_revision}` : null,
  ].filter(Boolean);

  const visibleSections = showAllSections
    ? sections
    : sections[activeSecIdx]
    ? [sections[activeSecIdx]]
    : [];

  return (
    <div className={`pi-viewer ${mobileNavOpen ? 'nav-open' : ''}`}>
      {/* ==================== TOP BAR ESCURA ==================== */}
      <header className="pi-topbar">
        <button
          type="button"
          className="pi-tb-btn pi-menu-btn"
          onClick={() => setMobileNavOpen((v) => !v)}
          aria-label="Abrir índice"
        >
          <Menu className="h-4 w-4" />
        </button>

        <Link
          to="/programas-instrucao"
          className="pi-tb-btn"
          title="Voltar para o catálogo de programas e manuais"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="pi-lbl">Catálogo</span>
        </Link>

        <div className="pi-topbar-brand">
          <b>{program.title}</b>
          <span>{subtitleParts.join(' · ')}</span>
        </div>

        {program.revisions && program.revisions.length > 0 && (
          <button
            type="button"
            className="pi-tb-btn"
            onClick={() => setShowRevisionsModal((v) => !v)}
            title="Ver histórico de revisões"
          >
            <History className="h-4 w-4" />
            <span className="pi-lbl">Revisões</span>
          </button>
        )}

        <button
          type="button"
          className="pi-tb-btn"
          onClick={() => window.print()}
          title="Imprimir / Salvar PDF"
        >
          <Printer className="h-4 w-4" />
          <span className="pi-lbl">Imprimir</span>
        </button>

        <button
          type="button"
          className="pi-tb-btn accent"
          onClick={() => setChatOpen(true)}
          title="Tirar dúvidas com o Assistente de IA"
        >
          <Sparkles className="h-4 w-4" />
          <span className="pi-lbl">Tirar Dúvidas com IA</span>
        </button>
      </header>

      {/* Backdrop mobile */}
      <div
        className="pi-sidebar-backdrop"
        onClick={() => setMobileNavOpen(false)}
      />

      {/* ==================== SIDEBAR DE NAVEGAÇÃO ==================== */}
      <aside className="pi-sidebar">
        <div className="pi-search-wrap">
          <div className="relative">
            <input
              type="text"
              className="pi-search-input"
              placeholder="Buscar (ex.: matrícula, FASE 5, SBJF)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#93a6ba] hover:text-white"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <Search className="h-3.5 w-3.5 text-[#93a6ba] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            )}
          </div>
          <div className="pi-search-hint">
            Filtra o índice e pesquisa o texto de todas as seções.
          </div>
        </div>

        {/* Resultados da busca full-text */}
        {searchQuery.trim().length >= 2 && (
          <div className="pi-search-results">
            <h4>
              {searchHits.length > 0
                ? `${searchHits.length} ocorrência(s) no texto`
                : 'Nenhuma ocorrência encontrada'}
            </h4>
            {searchHits.map((hit, i) => (
              <button
                key={i}
                type="button"
                className="pi-search-result-item"
                onClick={() => selectSection(hit.sectionIndex)}
              >
                <div>
                  <b>{hit.sectionNum}</b>
                  <span>{hit.sectionTitle}</span>
                </div>
                <div className="text-[11px] text-[#b8c7d8] mt-0.5">
                  {hit.before}
                  <mark>{hit.match}</mark>
                  {hit.after}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Índice Hierárquico (Acordeão) */}
        <nav className="pi-toc" aria-label="Índice do documento">
          <ul>
            {filteredSectionIndices.map((idx) => {
              const sec = sections[idx];
              const isActive = !showAllSections && activeSecIdx === idx;
              const isOpen = Boolean(openSecs[idx]);
              return (
                <li
                  key={sec.id}
                  className={`pi-toc-sec ${isActive ? 'active' : ''}`}
                >
                  <button
                    type="button"
                    className="pi-toc-sec-btn"
                    onClick={() => toggleSectionAccordion(idx)}
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 mt-0.5 text-[#93a6ba] shrink-0 transition-transform ${
                        isOpen && sec.subs.length > 0 ? 'rotate-90' : ''
                      }`}
                    />
                    <span className="pi-toc-num">{sec.num}</span>
                    <span className="flex-1">{sec.title}</span>
                  </button>

                  {isOpen && sec.subs.length > 0 && (
                    <ul className="pb-1">
                      {sec.subs.map((sub) => (
                        <li key={sub.anchorId}>
                          <button
                            type="button"
                            className={`pi-toc-sub-btn ${sub.level === 3 ? 'lvl3' : ''}`}
                            onClick={() => selectSection(idx, sub.anchorId)}
                          >
                            {sub.title}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Rodapé da Sidebar: modo de leitura */}
        <div className="pi-sidebar-footer">
          <span>{sections.length} seções</span>
          <button
            type="button"
            onClick={() => setShowAllSections((v) => !v)}
            className="text-[#e0a526] hover:underline font-medium inline-flex items-center gap-1"
          >
            <FileText className="h-3.5 w-3.5" />
            {showAllSections ? 'Ver por seção' : 'Ver tudo contínuo'}
          </button>
        </div>
      </aside>

      {/* ==================== ÁREA PRINCIPAL ==================== */}
      <main className="pi-main">
        {/* Banner de resumo / aviso oficial */}
        {program.summary && (
          <div className="pi-disclaimer">
            <strong>Versão digital interativa.</strong> {program.summary}
          </div>
        )}

        {/* Painel opcional de Histórico de Revisões */}
        {showRevisionsModal && program.revisions && program.revisions.length > 0 && (
          <div className="max-w-[840px] mx-auto mb-5 bg-white rounded-md border border-slate-300 shadow-sm p-4 pi-no-print">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                <History className="h-4 w-4 text-[#13202e]" />
                Histórico de Revisões ({program.revisions.length})
              </h3>
              <button
                type="button"
                onClick={() => setShowRevisionsModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              {program.revisions.map((rev) => (
                <div
                  key={rev.id}
                  className="flex items-start justify-between gap-4 text-xs border-b last:border-none pb-2"
                >
                  <div>
                    <span className="font-semibold text-slate-800">Revisão {rev.revision_code}</span>
                    {rev.change_notes && <p className="text-slate-500 mt-0.5">{rev.change_notes}</p>}
                  </div>
                  <span className="text-slate-500 shrink-0">{fmtDate(rev.revision_date) || '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Folhas de Conteúdo */}
        <div className="pi-doc-container">
          {visibleSections.map((sec) => {
            const actualIdx = sections.findIndex((s) => s.id === sec.id);
            return (
              <div key={sec.id} id={`sec-wrap-${actualIdx}`}>
                {sec.hasPg ? (
                  <div dangerouslySetInnerHTML={{ __html: sec.html }} />
                ) : (
                  <div className="pi-doc-fallback-paper">
                    <div className="pg-head">
                      <div className="ttl">
                        <small>{subtitleParts.join(' · ')}</small>
                        {sec.title}
                      </div>
                      <div className="no">Seção {sec.num}</div>
                    </div>
                    <div
                      className="pg-body"
                      dangerouslySetInnerHTML={{ __html: sec.html }}
                    />
                  </div>
                )}
              </div>
            );
          })}

          {/* Navegação Anterior / Próxima seção */}
          {!showAllSections && sections.length > 1 && (
            <div className="flex items-center justify-between gap-3 pt-2 pb-4 pi-no-print">
              <Button
                variant="outline"
                size="sm"
                className="bg-white border-slate-300 text-slate-800 hover:bg-slate-50"
                disabled={activeSecIdx <= 0}
                onClick={() => selectSection(activeSecIdx - 1)}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {activeSecIdx > 0
                  ? `${sections[activeSecIdx - 1].num}. ${sections[activeSecIdx - 1].title.slice(0, 32)}`
                  : 'Seção anterior'}
              </Button>

              <span className="text-xs text-slate-600 font-medium">
                {activeSecIdx + 1} / {sections.length}
              </span>

              <Button
                variant="outline"
                size="sm"
                className="bg-white border-slate-300 text-slate-800 hover:bg-slate-50"
                disabled={activeSecIdx >= sections.length - 1}
                onClick={() => selectSection(activeSecIdx + 1)}
              >
                {activeSecIdx < sections.length - 1
                  ? `${sections[activeSecIdx + 1].num}. ${sections[activeSecIdx + 1].title.slice(0, 32)}`
                  : 'Próxima seção'}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </main>

      {/* ==================== CHAT RAG PÚBLICO ==================== */}
      <div className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-50 pi-no-print max-w-[calc(100vw-1.5rem)]">
        {!chatOpen ? (
          <Button
            size="lg"
            onClick={() => setChatOpen(true)}
            className="rounded-full shadow-lg bg-[#13202e] hover:bg-[#1b2b3c] text-[#e0a526] border border-[#2a3d52] h-12 sm:h-13 px-4 sm:px-5 gap-2 text-xs sm:text-sm"
          >
            <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
            <span>Perguntar sobre este Documento</span>
          </Button>
        ) : (
          <Card className="w-[calc(100vw-1.5rem)] sm:w-[400px] h-[min(75dvh,520px)] flex flex-col shadow-2xl border-[#2a3d52]">
            <CardHeader className="py-3 px-4 bg-[#13202e] text-white rounded-t-lg flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-[#e0a526]" />
                <div>
                  <div className="text-sm font-semibold">Assistente IA</div>
                  <div className="text-[11px] text-[#93a6ba]">
                    Baseado em {program.code || program.title} (Rev. {program.current_revision})
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-[#1b2b3c] h-8 w-8"
                onClick={() => setChatOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-3 space-y-3 bg-slate-50">
              {chatMessages.length === 0 ? (
                <div className="space-y-2.5 text-xs">
                  <div className="bg-white border rounded-lg p-3 text-slate-700">
                    Olá! Posso responder dúvidas sobre <strong>{program.title}</strong>, procedimentos, revisão vigente e regras oficiais.
                  </div>
                  {[
                    'Qual é a revisão vigente deste documento?',
                    'Quais são os principais requisitos e procedimentos?',
                    'Resuma as regras mais importantes deste documento.',
                  ].map((q, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSendChat(q)}
                      className="w-full text-left bg-white hover:bg-amber-50 border rounded-md p-2 text-slate-700 transition-colors"
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
                        ? 'bg-[#13202e] text-white ml-8'
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
                  Consultando o documento...
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
                className="h-9 w-9 bg-[#13202e] hover:bg-[#1b2b3c] text-[#e0a526] shrink-0"
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
