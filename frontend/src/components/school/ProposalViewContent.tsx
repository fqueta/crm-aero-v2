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
import ProposalContractsTab from './ProposalContractsTab';
import ProposalLogsTab from './ProposalLogsTab';
import { useLocation, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { CheckCircle, Clock } from 'lucide-react';

interface ProposalViewContentProps {
  /**
   * id
   * pt-BR: ID da matrícula/proposta para carregar dados.
   * en-US: Enrollment/Proposal ID to load data.
   */
  id: string;
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
  const hasLinksAssinados = Boolean(meta?.salvar_links_assinados) || Object.keys(meta || {}).some((k) => k.startsWith('salvar_links_assinados_'));
  const contratoAceito = String((enrollment as any)?.contrato?.aceito_contrato || '').toLowerCase() === 'on';
  const isAssinado = hasLinksAssinados || contratoAceito;
  const status = isAssinado ? 'assinado' : (statusAssinatura === 'aprovado' ? 'aprovado' : '');
  const statusMessage = isAssinado
    ? 'Está proposta ja está aprovada e assinada'
    : (status === 'aprovado' ? 'A proposta foi aprovada e está aguardando assinatura digital.' : '');

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3 lg:w-[600px] print:hidden">
           <TabsTrigger value="overview" asChild><a href="#overview">Visão Geral</a></TabsTrigger>
           <TabsTrigger value="contracts" asChild><a href="#contracts">Contratos</a></TabsTrigger>
           <TabsTrigger value="logs" asChild><a href="#logs">Logs</a></TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 mt-4 print:mt-0 print:space-y-0">
            <Card className="print:border-0 print:shadow-none">
                <CardHeader className="print:hidden">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>Visualizar Proposta</CardTitle>
                  {status && (
                    <Badge
                      variant={isAssinado ? 'default' : 'secondary'}
                      className={isAssinado ? 'bg-green-600 text-white' : 'bg-blue-600 text-white'}
                    >
                      <span className="inline-flex items-center gap-1">
                        {isAssinado ? <CheckCircle className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                        {isAssinado ? 'Assinada' : 'Aprovada'}
                      </span>
                    </Badge>
                  )}
                </div>
                </CardHeader>
                <CardContent className="print:p-0">
                <div className="space-y-4 print:space-y-0">
                    {statusMessage && (
                      <Alert className={`print:hidden ${isAssinado ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}`}>
                        {isAssinado ? <CheckCircle className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                        <AlertTitle>Status da Proposta</AlertTitle>
                        <AlertDescription>{statusMessage}</AlertDescription>
                      </Alert>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm hidden">
                    <div>
                        <div className="font-medium">Cliente</div>
                        <div>{clientName || '—'}</div>
                    </div>
                    <div>
                        <div className="font-medium">Curso</div>
                        <div>{(course as any)?.titulo || (course as any)?.nome || '—'}</div>
                    </div>
                    <div>
                        <div className="font-medium">Subtotal</div>
                        <div>{subtotalMasked || '—'}</div>
                    </div>
                    <div>
                        <div className="font-medium">Total</div>
                        <div>{totalMasked || '—'}</div>
                    </div>
                    </div>

                    {/* Link para assinatura */}
                    {linkAssinatura && (
                    <div className="print:hidden">
                    <SignatureLinkCard link={linkAssinatura} />
                    </div>
                    )}

                    <BudgetPreview
                        title="Proposta Comercial"
                        clientName={clientName}
                        clientId={client?.id ? String(client.id) : undefined}
                        clientPhone={clientPhone}
                        clientEmail={clientEmail}
                        course={course as any}
                        courseName={(course as any)?.titulo || (course as any)?.nome || (enrollment as any)?.curso_name || (enrollment as any)?.curso_nome}
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

                    {/* Card de Parcelamento abaixo do card de Proposta Comercial */}
                    <InstallmentPreviewCard title="Parcelamento" parcelamento={parcelamento} />
                </div>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="contracts" className="mt-4">
             {tab === 'contracts' && clientId && id ? (
                <ProposalContractsTab 
                  clientId={clientId} 
                  enrollmentId={id} 
                  meta={meta} 
                  courseName={(course as any)?.titulo || (course as any)?.nome || (enrollment as any)?.curso_name || (enrollment as any)?.curso_nome}
                  signatureLink={linkAssinatura}
                  onGoToOverview={() => handleTabChange('overview')}
                />
             ) : (
                <div className="text-center py-4 text-muted-foreground">
                    {tab === 'contracts' ? 'Carregando dados da matrícula...' : ''}
                </div>
             )}
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          {tab === 'logs' && id ? (
            <ProposalLogsTab enrollmentId={id} />
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              {tab === 'logs' ? 'Carregando dados da matrícula...' : ''}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
    </div>
  );
}
