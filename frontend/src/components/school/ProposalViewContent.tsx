import React, { useMemo, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEnrollment } from '@/hooks/enrollments';
import { useClientById } from '@/hooks/clients';
import { useQuery } from '@tanstack/react-query';
import { coursesService } from '@/services/coursesService';
import { currencyRemoveMaskToNumber } from '@/lib/masks/currency';
import BudgetPreview from '@/components/school/BudgetPreview';
import InstallmentPreviewCard from '@/components/school/InstallmentPreviewCard';
import SignatureLinkCard from '@/components/school/SignatureLinkCard';
import ResponsibleInfoCard from '@/components/school/ResponsibleInfoCard';
import ProposalContractsTab from './ProposalContractsTab';
import ProposalLogsTab from './ProposalLogsTab';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, Clock, User, Mail, Phone, BookOpen, Layers, Calendar, Hash, CircleDollarSign, Info, Loader2 } from 'lucide-react';

interface ProposalViewContentProps {
  /**
   * id
   * pt-BR: ID da matrícula/proposta para carregar dados.
   * en-US: Enrollment/Proposal ID to load data.
   */
  id: string;
}
/**
 * StatCard
 * pt-BR: Card de métrica para uso interno na visualização de proposta.
 * en-US: Metric card for internal use in proposal view.
 */
function StatCard({ label, value, icon: Icon, colorClass = "text-primary", bgClass = "bg-primary/10" }: any) {
  return (
    <Card className="border-none shadow-sm bg-zinc-50/50 dark:bg-zinc-900/50 backdrop-blur-sm overflow-hidden transition-all hover:shadow-md hover:bg-white dark:hover:bg-zinc-900 border border-border/40">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-2xl ${bgClass} ${colorClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{label}</span>
          <span className="text-lg font-bold tracking-tight text-foreground">{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * ProposalViewContent
 * pt-BR: Componente de visualização de proposta somente leitura, com abas para Visão Geral e Contratos.
 * en-US: Read-only proposal view component, with tabs for Overview and Contracts.
 */
export default function ProposalViewContent({ id }: ProposalViewContentProps) {
  const { data: enrollment } = useEnrollment(String(id || ''));
  const location = useLocation();
  const navigate = useNavigate();

  const infoResponsavel = (enrollment as any)?.responsavel;
  const rawZapsignResp = (enrollment as any)?.meta?.processo_assinatura_responsavel;
  const zapsignDataResp = useMemo(() => {
    if (!rawZapsignResp) return null;
    try {
      return typeof rawZapsignResp === 'string' ? JSON.parse(rawZapsignResp) : rawZapsignResp;
    } catch {
      return null;
    }
  }, [rawZapsignResp]);
  const signatureLinkResp = zapsignDataResp?.signers?.[0]?.sign_url || zapsignDataResp?.signers?.[0]?.signing_link || '';

  /**
   * getInitialTab
   * pt-BR: Obtém a aba inicial da URL: hash (#overview | #contracts) ou query (?tab=...).
   * en-US: Gets initial tab from URL: hash (#overview | #contracts) or query (?tab=...).
   */
  const getInitialTab = useMemo(() => {
    const hash = String(location.hash || '').replace('#', '');
    if (hash === 'overview' || hash === 'contracts' || hash === 'logs') return hash;
    const qs = new URLSearchParams(location.search || '');
    const t = qs.get('tab');
    if (t === 'overview' || t === 'contracts' || t === 'logs') return t;
    return 'overview';
  }, [location.hash, location.search]);

  /**
   * tab
   * pt-BR: Estado controlado da aba atual, sincronizado com a URL.
   * en-US: Controlled state of the current tab, synchronized with the URL.
   */
  const [tab, setTab] = useState<string>(getInitialTab);

  /**
   * syncTabFromUrl
   * pt-BR: Atualiza o estado quando o hash/query muda externamente.
   * en-US: Updates state when hash/query changes externally.
   */
  useEffect(() => {
    setTab(getInitialTab);
  }, [getInitialTab]);

  /**
   * handleTabChange
   * pt-BR: Atualiza aba e escreve o hash na URL (#overview | #contracts).
   * en-US: Updates tab and writes hash in the URL (#overview | #contracts).
   */
  function handleTabChange(next: string) {
    setTab(next);
    navigate(
      { pathname: location.pathname, search: location.search, hash: `#${next}` },
      { replace: true }
    );
  }

  const clientId = useMemo(() => {
    const v = (enrollment as any)?.id_cliente ?? (enrollment as any)?.client_id;
    return v ? String(v) : '';
  }, [enrollment]);
  const { data: client } = useClientById(clientId, { enabled: !!clientId });

  const courseId = useMemo(() => {
    const v = (enrollment as any)?.id_curso ?? (enrollment as any)?.course_id;
    return v ? Number(v) : undefined;
  }, [enrollment]);
  const { data: course } = useQuery({
    queryKey: ['courses', 'byId', courseId],
    queryFn: async () => (courseId ? coursesService.getById(courseId) : null),
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
  });

  /**
   * computeValidityDate
   * pt-BR: Soma N dias à data atual e formata dd/MM/yyyy.
   * en-US: Adds N days to today and formats dd/MM/yyyy.
   */
  function computeValidityDate(daysStr?: string): string {
    const days = parseInt(String(daysStr ?? ''), 10);
    if (!Number.isFinite(days) || days <= 0) return '';
    const d = new Date();
    d.setDate(d.getDate() + days);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }

  /**
   * formatCurrencyBRL
   * pt-BR: Formata número em BRL (R$).
   * en-US: Formats number into BRL (R$).
   */
  function formatCurrencyBRL(value: number): string {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
    } catch {
      return `R$ ${(Number(value) || 0).toFixed(2)}`;
    }
  }

  /**
   * maskMonetaryDisplay
   * pt-BR: Aplica máscara monetária para exibição; retorna vazio se não houver valor.
   * en-US: Applies monetary mask for display; returns empty when no value.
   */
  function maskMonetaryDisplay(raw: string | number | undefined | null): string {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    const num = currencyRemoveMaskToNumber(s);
    return formatCurrencyBRL(num);
  }

  /**
   * computeModulo
   * pt-BR: Retorna módulo correto baseado no tipo de curso.
   * en-US: Returns proper module based on course type.
   */
  function computeModulo(enr: any, cursoTipo: string) {
    try {
      if (String(cursoTipo) === '4') {
        return enr?.orc?.modulos?.[0] ?? '';
      }
      return enr?.orc?.modulo ?? '';
    } catch {
      return '';
    }
  }

  const subtotalMasked = useMemo(() => maskMonetaryDisplay((enrollment as any)?.subtotal), [enrollment]);
  const totalMasked = useMemo(() => maskMonetaryDisplay((enrollment as any)?.total), [enrollment]);
  const descontoMasked = useMemo(() => maskMonetaryDisplay((enrollment as any)?.desconto), [enrollment]);
  const validadeDias = useMemo(() => String((enrollment as any)?.validade || '14'), [enrollment]);
  const clientName = client?.name || (client as any)?.nome || '';
  const clientPhone = client?.config?.celular || client?.config?.telefone_residencial || '';
  const clientEmail = client?.email || '';
  const curso_tipo = String((enrollment as any)?.curso_tipo || '');
  const modulo = computeModulo(enrollment as any, curso_tipo);
  const modulesList = useMemo(() => {
    const list = (enrollment as any)?.orc?.modulos;
    return Array.isArray(list) ? list : undefined;
  }, [enrollment]);

  const etapa1Discount = useMemo(() => {
    try {
        const orc = (enrollment as any)?.orc;
        return Number(orc?.meta?.etapa1_desconto || 0);
    } catch {
        return 0;
    }
  }, [enrollment]);

  const fuelExternalText = (enrollment as any)?.meta?.texto_combustivel || '';

  const linkAssinatura = (enrollment as any)?.link_assinatura || '';

  const parcelamento = useMemo(() => {
    return ((enrollment as any)?.orc?.parcelamento ?? null) as any;
  }, [enrollment]);

  const meta = (enrollment as any)?.meta || {};
  const statusAssinatura = meta?.status_assinatura;

  // ZapSign Status Check
  const rawZapsign = meta?.processo_assinatura;
  const zapsignBase = typeof rawZapsign === 'string' ? (JSON.parse(rawZapsign) || {}) : (rawZapsign || {});
  const zapsignData = zapsignBase?.enviar?.response || zapsignBase;
  const hasZapsign = zapsignData && typeof zapsignData === 'object' && (zapsignData.token || zapsignData.signers);
  
  // pt-BR: Só considera assinado via ZapSign se o status for explicitamente 'signed' ou 'completed'
  const isZapsignSigned = hasZapsign && (zapsignData.status === 'signed' || zapsignData.status === 'completed');
  
  const hasLinksAssinados = Boolean(meta?.salvar_links_assinados) || Object.keys(meta || {}).some((k) => k.startsWith('salvar_links_assinados_'));
  const contratoAceito = String((enrollment as any)?.contrato?.aceito_contrato || '').toLowerCase() === 'on';
  
  // pt-BR: Se tem ZapSign, a palavra final é do status do ZapSign. Se não tem, olha para o manual/local.
  const isAssinado = hasZapsign ? isZapsignSigned : (hasLinksAssinados || contratoAceito);
  
  const isZapsignPending = hasZapsign && !isZapsignSigned;

  const status = isAssinado ? 'assinado' : (isZapsignPending ? 'em_andamento' : (statusAssinatura === 'aprovado' ? 'aprovado' : ''));
  
  const statusMessage = isAssinado
    ? 'Está proposta ja está aprovada e assinada.'
    : (isZapsignPending 
        ? 'Assinatura digital em andamento (ZapSign).' 
        : (status === 'aprovado' ? 'A proposta foi aprovada e está aguardando assinatura digital.' : ''));
  
  const badgeLabel = isAssinado ? 'Assinada' : (isZapsignPending ? 'Assinatura em Andamento' : 'Aprovada');
  const badgeColor = isAssinado ? 'bg-green-600' : (isZapsignPending ? 'bg-amber-500' : 'bg-blue-600');

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
           <TabsList className="grid grid-cols-3 w-full md:w-[400px] bg-muted/50 p-1 rounded-xl print:hidden">
              <TabsTrigger value="overview" asChild className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"><a href="#overview">Geral</a></TabsTrigger>
              <TabsTrigger value="contracts" asChild className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"><a href="#contracts">Contratos</a></TabsTrigger>
              <TabsTrigger value="logs" asChild className="rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"><a href="#logs">Auditoria</a></TabsTrigger>
           </TabsList>
           
           <div className="flex items-center gap-2 print:hidden">
              <Badge className={`${badgeColor} text-white border-none py-1.5 px-4 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm`}>
                <span className="inline-flex items-center gap-2">
                  {isAssinado ? <CheckCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                  {badgeLabel}
                </span>
              </Badge>
           </div>
        </div>

        <TabsContent value="overview" className="space-y-8 mt-0 print:mt-0 animate-in fade-in slide-in-from-bottom-2 duration-500">
            {/* KPI Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
              <StatCard label="Total da Proposta" value={totalMasked || 'R$ 0,00'} icon={CircleDollarSign} colorClass="text-green-600" bgClass="bg-green-50" />
              <StatCard label="ID da Matrícula" value={`#${id}`} icon={Hash} colorClass="text-zinc-600" bgClass="bg-zinc-100" />
              <StatCard label="Validade" value={computeValidityDate(validadeDias) || 'Expirada'} icon={Calendar} colorClass="text-blue-600" bgClass="bg-blue-50" />
              <StatCard label="Consultor" value={(enrollment as any)?.autor_name || 'Sistema'} icon={User} colorClass="text-purple-600" bgClass="bg-purple-50" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
               {/* Main Content (Left) */}
               <div className="lg:col-span-8 space-y-8">
                  {statusMessage && (
                    <Alert className={`border-none shadow-sm print:hidden ${isAssinado ? 'bg-green-50/50 text-green-800' : (isZapsignPending ? 'bg-amber-50/50 text-amber-800' : 'bg-blue-50/50 text-blue-800')} rounded-2xl p-4 flex items-start gap-4`}>
                      <div className={`p-2 rounded-xl scale-110 ${isAssinado ? 'bg-green-100' : (isZapsignPending ? 'bg-amber-100' : 'bg-blue-100')}`}>
                        {isAssinado ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <AlertTitle className="text-xs font-bold uppercase tracking-widest opacity-70">Status Atual</AlertTitle>
                        <AlertDescription className="text-sm font-medium">{statusMessage}</AlertDescription>
                      </div>
                    </Alert>
                  )}

                  {/* Detalhes da Proposta Comercial */}
                  <BudgetPreview
                      title="Proposta Comercial"
                      clientName={clientName}
                      clientId={client?.id ? String(client.id) : undefined}
                      clientPhone={clientPhone}
                      clientEmail={clientEmail}
                      course={course as any}
                      courseName={(course as any)?.titulo || (course as any)?.nome || (enrollment as any)?.course_name || (enrollment as any)?.curso_nome}
                      turmaName={(enrollment as any)?.turma_name || (enrollment as any)?.turma_nome}
                      module={modulo}
                      modules={modulesList}
                      discountLabel="Desconto"
                      discountAmountMasked={descontoMasked}
                      subtotalMasked={subtotalMasked}
                      totalMasked={totalMasked}
                      validityDate={computeValidityDate(validadeDias)}
                      validityDays={validadeDias}
                      etapa1Discount={etapa1Discount}
                      fuelExternalText={fuelExternalText}
                  />

                  <InstallmentPreviewCard title="Gestão de Parcelamento" parcelamento={parcelamento} />
               </div>

               {/* Sidebar (Right) */}
               <div className="lg:col-span-4 space-y-6 print:hidden">
                  <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-zinc-50/30">
                    <CardHeader className="pb-3 border-b border-border/40">
                      <div className="flex items-center gap-2">
                         <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                            <Info className="h-4 w-4" />
                         </div>
                         <CardTitle className="text-xs font-bold uppercase tracking-widest">Resumo Operacional</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-5 space-y-6">
                       {/* Identificação */}
                       <div className="space-y-4">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1">Identificação</span>
                          <div className="space-y-3">
                             <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-border/40 shadow-sm">
                                <div className="p-2 rounded-lg bg-zinc-100 text-zinc-500"><User className="h-4 w-4" /></div>
                                <div className="flex flex-col min-w-0">
                                   <span className="text-[10px] font-bold opacity-50 uppercase leading-none mb-0.5">Cliente</span>
                                   <span className="text-sm font-bold leading-tight truncate">{clientName || '—'}</span>
                                </div>
                             </div>
                             <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-border/40 shadow-sm">
                                <div className="p-2 rounded-lg bg-zinc-100 text-zinc-500"><Mail className="h-4 w-4" /></div>
                                <div className="flex flex-col min-w-0">
                                   <span className="text-[10px] font-bold opacity-50 uppercase leading-none mb-0.5">E-mail</span>
                                   <span className="text-sm font-bold leading-tight truncate">{clientEmail || '—'}</span>
                                </div>
                             </div>
                             <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-border/40 shadow-sm">
                                <div className="p-2 rounded-lg bg-zinc-100 text-zinc-500"><Phone className="h-4 w-4" /></div>
                                <div className="flex flex-col min-w-0">
                                   <span className="text-[10px] font-bold opacity-50 uppercase leading-none mb-0.5">WhatsApp</span>
                                   <span className="text-sm font-bold leading-tight truncate">{clientPhone || '—'}</span>
                                </div>
                             </div>
                          </div>
                       </div>

                       {/* Acadêmico */}
                       <div className="space-y-4">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-1">Acadêmico</span>
                          <div className="space-y-3">
                             <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-border/40 shadow-sm">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary"><BookOpen className="h-4 w-4" /></div>
                                <div className="flex flex-col min-w-0">
                                   <span className="text-[10px] font-bold opacity-50 uppercase leading-none mb-0.5">Curso</span>
                                   <span className="text-sm font-bold leading-tight truncate">{(course as any)?.titulo || (course as any)?.nome || '—'}</span>
                                </div>
                             </div>
                             <div className="flex items-center gap-3 p-3 rounded-xl bg-white dark:bg-zinc-900 border border-border/40 shadow-sm">
                                <div className="p-2 rounded-lg bg-primary/10 text-primary"><Layers className="h-4 w-4" /></div>
                                <div className="flex flex-col min-w-0">
                                   <span className="text-[10px] font-bold opacity-50 uppercase leading-none mb-0.5">Turma</span>
                                   <span className="text-sm font-bold leading-tight truncate">{(enrollment as any)?.turma_name || (enrollment as any)?.turma_nome || '—'}</span>
                                </div>
                             </div>
                          </div>
                       </div>
                    </CardContent>
                  </Card>

                  {/* Link para assinatura */}
                  {linkAssinatura && <SignatureLinkCard link={linkAssinatura} />}

                  {/* Dados do Responsável Financeiro */}
                  {infoResponsavel && <ResponsibleInfoCard data={infoResponsavel} signatureLink={signatureLinkResp} />}
               </div>
            </div>
        </TabsContent>

        <TabsContent value="contracts" className="mt-0 pt-4 animate-in fade-in slide-in-from-right-2 duration-500 outline-none">
             {tab === 'contracts' && clientId && id ? (
                <ProposalContractsTab 
                  clientId={clientId} 
                  enrollmentId={id} 
                  meta={meta} 
                  courseName={(course as any)?.titulo || (course as any)?.nome || (enrollment as any)?.course_name || (enrollment as any)?.curso_nome}
                  signatureLink={linkAssinatura}
                  onGoToOverview={() => handleTabChange('overview')}
                  responsavel={infoResponsavel}
                />
             ) : (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                    <Loader2 className="h-8 w-8 animate-spin opacity-20" />
                    <span className="text-sm font-medium">Carregando documentos...</span>
                </div>
             )}
        </TabsContent>
        
        <TabsContent value="logs" className="mt-0 pt-4 animate-in fade-in slide-in-from-right-2 duration-500 outline-none">
          {tab === 'logs' && id ? (
            <ProposalLogsTab enrollmentId={id} />
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                <Loader2 className="h-8 w-8 animate-spin opacity-20" />
                <span className="text-sm font-medium">Carregando histórico...</span>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
