import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useForm, type FieldErrors, type Path } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, CheckCircle, FileText as LucideFileText, User as LucideUser, ScrollText as LucideScrollText, Check as LucideCheck, Copy as LucideCopy, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { proposalService } from "@/services/proposalService";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getStudentFacingQuestionLabel,
  PUBLIC_PROPOSAL_QUESTIONS,
  PublicProposalQuestionKey,
  resolvePublicProposalQuestions,
  resolvePublicProposalRequiredQuestions,
  resolvePublicProposalSections,
} from "@/lib/publicProposalQuestions";

import { cpfApplyMask } from "@/lib/masks/cpf-apply-mask";
import { phoneApplyMask } from "@/lib/masks/phone-apply-mask";
import { cepApplyMask } from "@/lib/masks/cep-apply-mask";

const formatDate = (dateString?: string) => {
  if (!dateString) return 'N/A';
  // Check if it's already in DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return dateString;
  
  // Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  }
  
  // Try Date object parsing as fallback
  try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return dateString;
      return new Intl.DateTimeFormat('pt-BR').format(d);
  } catch {
      return dateString;
  }
};

const formSchema = z.object({
  foi_transferido: z.boolean().optional(),
  cma_em_dia: z.boolean().optional(),
  classe_cma: z.string().optional(),
  possui_banca: z.boolean().optional(),
  aluno_ciente_taxa_manutencao_alojamento: z.boolean().optional(),
  aluno_ciente_hora_seca: z.boolean().optional(),
  aluno_ciente_headset: z.boolean().optional(),
  aluno_ciente_prazo_estimado: z.boolean().optional(),
  aluno_ciente_limite_c150: z.boolean().optional(),
  aluno_ciente_documentacao_ground_school: z.boolean().optional(),
  aluno_ciente_uniforme: z.boolean().optional(),
});

type ApprovalFormData = z.infer<typeof formSchema>;

/**
 * normalizeMetaBoolean
 * pt-BR: Converte valores vindos do backend para booleanos compatíveis com checkboxes.
 * en-US: Converts backend values into booleans compatible with checkboxes.
 */
function normalizeMetaBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'sim', 's', 'yes', 'on'].includes(normalized);
}

/**
 * validateRequiredApprovalQuestions
 * pt-BR: Valida perguntas obrigatórias da etapa pública de aprovação.
 * en-US: Validates required questions for the public approval step.
 */
function validateRequiredApprovalQuestions(
  requiredKeys: PublicProposalQuestionKey[],
  values: ApprovalFormData
): Array<{ key: PublicProposalQuestionKey; message: string }> {
  const errors: Array<{ key: PublicProposalQuestionKey; message: string }> = [];

  requiredKeys.forEach((key) => {
    const definition = PUBLIC_PROPOSAL_QUESTIONS.find((question) => question.key === key);
    if (!definition) return;

    const rawValue = values[key];
    if (definition.kind === 'select') {
      if (!String(rawValue ?? '').trim()) {
        errors.push({ key, message: 'Seleção obrigatória.' });
      }
      return;
    }

    if (Boolean(rawValue) !== true) {
      errors.push({ key, message: 'Confirmação obrigatória.' });
    }
  });

  return errors;
}

export default function ProposalApproval() {
  const { compositeId } = useParams<{ compositeId: string }>();
  const [id_cliente, id_matricula] = compositeId ? compositeId.split('_') : [null, null];
  
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [proposal, setProposal] = useState<any>(null);
  const [contracts, setContracts] = useState<any[]>([]);

  const form = useForm<ApprovalFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      foi_transferido: false,
      cma_em_dia: false,
      classe_cma: '',
      possui_banca: false,
      aluno_ciente_taxa_manutencao_alojamento: false,
      aluno_ciente_hora_seca: false,
      aluno_ciente_headset: false,
      aluno_ciente_prazo_estimado: false,
      aluno_ciente_limite_c150: false,
      aluno_ciente_documentacao_ground_school: false,
      aluno_ciente_uniforme: false,
    },
  });

  /**
   * focusFieldByName
   * pt-BR: Centraliza o primeiro campo inválido na tela e tenta aplicar foco ao controle correspondente.
   * en-US: Centers the first invalid field on screen and tries to focus its matching control.
   */
  function focusFieldByName(fieldName?: Path<ApprovalFormData>) {
    if (!fieldName || typeof document === "undefined") return;

    window.setTimeout(() => {
      const fieldKey = String(fieldName);
      const container = document.querySelector<HTMLElement>(`[data-field="${fieldKey}"]`);
      const control =
        document.querySelector<HTMLElement>(`[name="${fieldKey}"]`) ||
        container?.querySelector<HTMLElement>('input, textarea, button, [role="combobox"], [role="checkbox"]');

      const scrollTarget = container || control;
      if (scrollTarget) {
        scrollTarget.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      try {
        form.setFocus(fieldName);
      } catch {
        control?.focus?.({ preventScroll: true });
      }

      if (document.activeElement === document.body) {
        control?.focus?.({ preventScroll: true });
      }
    }, 0);
  }

  /**
   * handleInvalidSubmit
   * pt-BR: Leva o usuário até o primeiro campo com erro na etapa de aprovação.
   * en-US: Takes the user to the first invalid field on the approval step.
   */
  function handleInvalidSubmit(errors: FieldErrors<ApprovalFormData>) {
    const firstFieldName = Object.keys(errors)[0] as Path<ApprovalFormData> | undefined;
    focusFieldByName(firstFieldName);
  }

  useEffect(() => {
    async function loadData() {
      if (!id_cliente || !id_matricula) {
          // If no proper IDs, maybe redirect to home or show error?
          // But for now, just let it stay loading or return.
          // Better: set loading false and show error.
          console.error("IDs not found from compositeId:", compositeId);
          setLoading(false);
          return;
      }

      try {
        const [data, contractsData] = await Promise.all([
            proposalService.getProposal(id_cliente, id_matricula),
            proposalService.getContractsHtml(id_cliente, id_matricula)
        ]);
        
        setProposal(data);
        const meta = (data as any)?.meta || {};
        form.reset({
          foi_transferido: normalizeMetaBoolean(meta?.foi_transferido),
          cma_em_dia: normalizeMetaBoolean(meta?.cma_em_dia),
          classe_cma: String(meta?.classe_cma || ''),
          possui_banca: normalizeMetaBoolean(meta?.possui_banca),
          aluno_ciente_taxa_manutencao_alojamento: normalizeMetaBoolean(meta?.aluno_ciente_taxa_manutencao_alojamento),
          aluno_ciente_hora_seca: normalizeMetaBoolean(meta?.aluno_ciente_hora_seca),
          aluno_ciente_headset: normalizeMetaBoolean(meta?.aluno_ciente_headset),
          aluno_ciente_prazo_estimado: normalizeMetaBoolean(meta?.aluno_ciente_prazo_estimado),
          aluno_ciente_limite_c150: normalizeMetaBoolean(meta?.aluno_ciente_limite_c150),
          aluno_ciente_documentacao_ground_school: normalizeMetaBoolean(meta?.aluno_ciente_documentacao_ground_school),
          aluno_ciente_uniforme: normalizeMetaBoolean(meta?.aluno_ciente_uniforme),
        });
        if (Array.isArray(contractsData)) {
            setContracts(contractsData);
        } else {
            console.warn("Contracts data received is not an array", contractsData);
            setContracts([]);
        }

        // Check if Step 1 is done
        // Note: data.matricula might be null if not found, but service throws usually.
        // Assuming data structure matches backend response.
        const step1Done = data.config?.step1_done;
        
        if (!step1Done) {
             toast.error("Você precisa completar a primeira etapa antes.");
             navigate(`/aluno/matricula/${id_cliente}_${id_matricula}/1`);
             return;
        }

      } catch (error) {
        console.error("Erro ao carregar proposta:", error);
        toast.error("Erro ao carregar dados da proposta.");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [form, id_cliente, id_matricula, navigate]);

  const onSubmit = async (data: ApprovalFormData) => {
    if (!id_cliente || !id_matricula) return;
    if (isProposalExpired) {
      toast.error(proposalExpirationMessage);
      return;
    }
    
    setSubmitting(true);
    try {
        const requiredErrors = validateRequiredApprovalQuestions(approvalRequiredQuestions, data);
        if (requiredErrors.length > 0) {
          requiredErrors.forEach((error) => {
            form.setError(error.key, { type: 'manual', message: error.message });
          });
          focusFieldByName(requiredErrors[0]?.key);
          toast.error('Preencha as perguntas obrigatórias.');
          return;
        }
        approvalRequiredQuestions.forEach((key) => form.clearErrors(key));
        const payload = approvalVisibleQuestions.reduce<Partial<ApprovalFormData>>((acc, key) => {
          acc[key] = data[key];
          return acc;
        }, {});
        const resp: any = await proposalService.approveProposal(id_cliente, id_matricula, payload);
        if (resp?.redirect) {
          window.location.href = resp.redirect;
          return;
        }
        toast.success(resp?.message || "Proposta aprovada com sucesso!");
        setProposal((prev: any) => {
          if (!prev) return prev;
          const next = { ...prev, config: { ...(prev.config || {}), step2_done: true, step2_at: new Date().toISOString() } };
          return next;
        });
    } catch (error) {
        console.error("Erro ao aprovar:", error);
        const errorMessage =
          (error as any)?.body?.message ||
          (error as any)?.message ||
          "Erro ao realizar a aprovação.";
        toast.error(errorMessage);
    } finally {
        setSubmitting(false);
    }
  };

  const step2Done = proposal?.config?.step2_done;
  const approvalVisibleQuestions = useMemo<PublicProposalQuestionKey[]>(
    () => resolvePublicProposalQuestions((proposal as any)?.curso?.config, 'approval', (proposal as any)?.curso_tipo),
    [proposal]
  );
  const approvalRequiredQuestions = useMemo<PublicProposalQuestionKey[]>(
    () => resolvePublicProposalRequiredQuestions((proposal as any)?.curso?.config, 'approval', (proposal as any)?.curso_tipo),
    [proposal]
  );
  const approvalVisibleSections = useMemo(
    () => resolvePublicProposalSections((proposal as any)?.curso?.config, 'approval', (proposal as any)?.curso_tipo),
    [proposal]
  );
  const visibleQuestionDefinitions = useMemo(
    () => PUBLIC_PROPOSAL_QUESTIONS.filter((question) => approvalVisibleQuestions.includes(question.key)),
    [approvalVisibleQuestions]
  );
  const statusQuestions = visibleQuestionDefinitions.filter((question) => question.section === 'status');
  const infoQuestions = visibleQuestionDefinitions.filter((question) => question.section === 'info');
  const showStatusSection = approvalVisibleSections.status && statusQuestions.length > 0;
  const showInfoSection = approvalVisibleSections.info && infoQuestions.length > 0;
  const showApprovalQuestions = showStatusSection || showInfoSection;
  const isProposalExpired = Boolean(proposal?.is_expired);
  const proposalExpirationMessage = proposal?.expiration_message || 'A validade desta proposta expirou. Solicite uma nova proposta para continuar.';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
         <PublicHeader />
         <div className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
            <p className="text-red-500">Proposta não encontrada.</p>
         </div>
         <PublicFooter />
      </div>
    );
  }
  if (step2Done) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col">
            <PublicHeader />
            <div className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center justify-center max-w-2xl">
                <Card className="w-full">
                    <CardHeader className="text-center">
                        <div className="mx-auto bg-green-100 text-green-600 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
                            <CheckCircle className="w-8 h-8" />
                        </div>
                        <CardTitle className="text-2xl text-green-800">Proposta Aguardado Assinatura Digital!</CardTitle>
                        <CardDescription>
                            A proposta foi aprovada e está aguardando assinatura digital.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center space-y-4">
                        <p className="text-gray-600">
                           Obrigado, <strong>{proposal.cliente?.name}</strong>. Em breve voce receberá uma mensagem com o link para assinar a proposta.
                        </p>

                        {proposal.processo_assinatura?.signers?.[0]?.sign_url && (
                          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-4 text-left">
                            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 block">Link para Assinatura</label>
                            <div className="flex gap-2 items-center">
                              <code className="flex-1 bg-white border border-slate-200 rounded px-3 py-2 text-sm text-slate-600 overflow-hidden text-ellipsis whitespace-nowrap h-10 flex items-center">
                                {proposal.processo_assinatura.signers[0].sign_url}
                              </code>
                              <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 shrink-0"
                                onClick={() => {
                                  navigator.clipboard.writeText(proposal.processo_assinatura.signers[0].sign_url);
                                  toast.success("Link copiado!");
                                }}
                                title="Copiar Link"
                              >
                                <LucideCopy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="default"
                                className="h-10 shrink-0 bg-blue-600 hover:bg-blue-700"
                                onClick={() => window.open(proposal.processo_assinatura.signers[0].sign_url, '_blank')}
                                title="Abrir Assinatura"
                              >
                                Assinar
                              </Button>
                            </div>
                          </div>
                        )}

                        <div className="pt-4">
                             <Button variant="outline" onClick={() => window.open('https://aeroclubejf.com.br', '_blank')}>
                                Voltar ao site
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
            <PublicFooter />
        </div>
      );
  }

  if (isProposalExpired) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <PublicHeader />
        <main className="flex-1 container mx-auto px-4 py-10 md:py-12">
          <div className="max-w-3xl mx-auto">
            <Card className="border-0 shadow-lg ring-1 ring-slate-900/5 overflow-hidden">
              <CardHeader className="text-center">
                <div className="mx-auto bg-red-100 text-red-600 rounded-full p-3 w-16 h-16 flex items-center justify-center mb-4">
                  <AlertTriangle className="w-8 h-8" />
                </div>
                <CardTitle className="text-2xl text-red-800">Proposta vencida</CardTitle>
                <CardDescription>
                  Esta proposta não pode mais ser aprovada com este link.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert variant="destructive" className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Solicite uma nova proposta</AlertTitle>
                  <AlertDescription>
                    {proposalExpirationMessage} Entre em contato com o atendimento para receber um novo link.
                  </AlertDescription>
                </Alert>
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => window.open('https://aeroclubejf.com.br', '_blank')}>
                    Voltar ao site
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <PublicHeader />

      <main className="flex-1 container mx-auto px-4 py-10 md:py-12">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Header Section */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center space-x-2 bg-blue-100/50 text-blue-700 px-4 py-1.5 rounded-full text-sm font-medium">
               <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
               <span>Aguardando Aprovação</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Aprovação de Proposta</h1>
            <p className="text-slate-500 text-lg max-w-2xl mx-auto">
              Confira os detalhes da sua matrícula e aceite os termos para finalizar o processo.
            </p>
          </div>

          <div className="grid gap-8">
            {/* Proposal Info Card */}
            <Card className="border-0 shadow-lg ring-1 ring-slate-900/5 overflow-hidden">
                <div className="bg-slate-50/50 p-6 border-b border-slate-100 flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg text-blue-600">
                       <LucideFileText className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Detalhes da Proposta</h2>
                        <p className="text-sm text-slate-500">Resumo do curso e valores</p>
                    </div>
                </div>
                <CardContent className="p-6 md:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Curso</label>
                                <div className="text-lg font-medium text-slate-900">{proposal.curso_nome || 'N/A'}</div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Turma</label>
                                <div className="text-base text-slate-700">{proposal.turma_nome || 'N/A'}</div>
                            </div>
                            
                            {/* Display Period information if course type is 4 */}
                            {(proposal.curso_tipo === '4' || proposal.curso_tipo === 4) && proposal.orc?.modulos?.[0]?.nome && (
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Período</label>
                                    <div className="text-base text-slate-700 bg-blue-50 px-2 py-1 rounded inline-block">
                                        {proposal.orc.modulos[0].nome}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="space-y-6 md:text-right">
                             <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">Valor Total</label>
                                <div className="text-2xl font-bold text-slate-900">
                                   {proposal.total 
                                     ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proposal.total) 
                                     : 'R$ 0,00'}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1 block">ID da Matrícula</label>
                                <div className="font-mono text-sm text-slate-500 bg-slate-100 inline-block px-2 py-1 rounded">
                                    #{id_matricula}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Student Info Card */}
            <Card className="border-0 shadow-lg ring-1 ring-slate-900/5 overflow-hidden">
                <div className="bg-slate-50/50 p-6 border-b border-slate-100 flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                       <LucideUser className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">Dados do Aluno</h2>
                        <p className="text-sm text-slate-500">Informações pessoais cadastradas</p>
                    </div>
                </div>
                <CardContent className="p-6 md:p-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-6 gap-x-8">
                         <div className="space-y-1">
                             <label className="text-xs font-medium text-slate-500">Nome Completo</label>
                             <div className="font-medium text-slate-900 break-words">{proposal.cliente?.name}</div>
                         </div>
                         <div className="space-y-1">
                             <label className="text-xs font-medium text-slate-500">Email</label>
                             <div className="text-slate-900 break-all">{proposal.cliente?.email}</div>
                         </div>
                         <div className="space-y-1">
                             <label className="text-xs font-medium text-slate-500">Telefone</label>
                             <div className="text-slate-900">{phoneApplyMask(proposal.cliente?.celular || '')}</div>
                         </div>
                         
                         <div className="col-span-full border-t border-slate-100 my-2"></div>

                         <div className="space-y-1">
                             <label className="text-xs font-medium text-slate-500">CPF</label>
                             <div className="text-slate-900">{cpfApplyMask(proposal.cliente?.cpf || '')}</div>
                         </div>
                         <div className="space-y-1">
                             <label className="text-xs font-medium text-slate-500">RG / Identidade</label>
                             <div className="text-slate-900">{proposal.cliente?.config?.identidade || '-'}</div>
                         </div>
                         <div className="space-y-1">
                             <label className="text-xs font-medium text-slate-500">Data de Nascimento</label>
                             <div className="text-slate-900">{formatDate(proposal.cliente?.config?.nascimento || proposal.cliente?.nascimento)}</div>
                         </div>

                         <div className="col-span-full border-t border-slate-100 my-2"></div>

                         {/* Address Section */}
                         <div className="space-y-1">
                             <label className="text-xs font-medium text-slate-500">CEP</label>
                             <div className="text-slate-900">{cepApplyMask(proposal.cliente?.config?.cep || '')}</div>
                         </div>
                         <div className="space-y-1 md:col-span-2">
                             <label className="text-xs font-medium text-slate-500">Endereço</label>
                             <div className="text-slate-900">
                                {proposal.cliente?.config?.endereco}, {proposal.cliente?.config?.numero}
                                {proposal.cliente?.config?.complemento ? ` - ${proposal.cliente?.config?.complemento}` : ''}
                             </div>
                         </div>
                         <div className="space-y-1">
                             <label className="text-xs font-medium text-slate-500">Bairro</label>
                             <div className="text-slate-900">{proposal.cliente?.config?.bairro}</div>
                         </div>
                         <div className="space-y-1">
                             <label className="text-xs font-medium text-slate-500">Cidade/UF</label>
                             <div className="text-slate-900">
                                {proposal.cliente?.config?.cidade} / {proposal.cliente?.config?.estado}
                             </div>
                         </div>
                    </div>
                </CardContent>
            </Card>

            {/* Contracts Display */}
            {false && contracts.length > 0 && (
                <Card className="border-0 shadow-lg ring-1 ring-slate-900/5 overflow-hidden">
                    <div className="bg-slate-50/50 p-6 border-b border-slate-100 flex items-center gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                            <LucideScrollText className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-slate-900">Termos do Contrato</h2>
                            <p className="text-sm text-slate-500">Leia atentamente os termos antes de aprovar</p>
                        </div>
                    </div>
                    <CardContent className="p-6 md:p-8">
                        <div className="space-y-8">
                            {contracts.map((contract: any, index: number) => (
                                <div key={contract.id || index} className="space-y-3">
                                    <h3 className="font-semibold text-lg border-b pb-2">{contract.nome || 'Contrato'}</h3>
                                    <div 
                                        className="prose prose-sm max-w-none text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200 overflow-y-auto max-h-[500px]"
                                        dangerouslySetInnerHTML={{ __html: contract.conteudo }}
                                    ></div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Action Buttons - Terms Card removed temporarily */}
            <div className="mt-8">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit, handleInvalidSubmit)} className="space-y-6">
                        {showApprovalQuestions && (
                          <Card className="border-0 shadow-lg ring-1 ring-slate-900/5 overflow-hidden">
                            <div className="bg-slate-50/50 p-6 border-b border-slate-100">
                              <h2 className="text-lg font-semibold text-slate-900">Confirmações Adicionais</h2>
                              <p className="text-sm text-slate-500">
                                Responda às perguntas configuradas para concluir a aprovação da proposta.
                              </p>
                            </div>
                            <CardContent className="p-6 md:p-8 space-y-8">
                              {showStatusSection && (
                                <div className="space-y-4">
                                  <h3 className="font-medium text-lg">Situação Atual</h3>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {statusQuestions.map((question) => (
                                      <FormField
                                        key={question.key}
                                        control={form.control}
                                        name={question.key}
                                        render={({ field }) => (
                                          question.kind === 'select' ? (
                                            <FormItem data-field={question.key}>
                                              <FormLabel>
                                                {getStudentFacingQuestionLabel(question.label, question.section)}{approvalRequiredQuestions.includes(question.key) ? ' *' : ''}
                                              </FormLabel>
                                              <Select onValueChange={field.onChange} value={field.value || ""}>
                                                <FormControl>
                                                  <SelectTrigger>
                                                    <SelectValue placeholder="Selecione" />
                                                  </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                  {question.options?.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                      {option.label}
                                                    </SelectItem>
                                                  ))}
                                                </SelectContent>
                                              </Select>
                                              <FormMessage />
                                            </FormItem>
                                          ) : (
                                            <FormItem data-field={question.key} className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                              <FormControl>
                                                <Checkbox checked={Boolean(field.value)} onCheckedChange={(checked) => field.onChange(Boolean(checked))} />
                                              </FormControl>
                                              <div className="space-y-1 leading-none">
                                                <FormLabel>{getStudentFacingQuestionLabel(question.label, question.section)}{approvalRequiredQuestions.includes(question.key) ? ' *' : ''}</FormLabel>
                                                <FormMessage />
                                              </div>
                                            </FormItem>
                                          )
                                        )}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}

                              {showInfoSection && (
                                <div className="space-y-4">
                                  {showStatusSection && <div className="border-t border-slate-100 pt-8" />}
                                  <h3 className="font-medium text-lg">Informações Passadas</h3>
                                  <div className="space-y-3">
                                    {infoQuestions.map((question) => (
                                      <FormField
                                        key={question.key}
                                        control={form.control}
                                        name={question.key}
                                        render={({ field }) => (
                                          <FormItem data-field={question.key} className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                                            <FormControl>
                                              <Checkbox checked={Boolean(field.value)} onCheckedChange={(checked) => field.onChange(Boolean(checked))} />
                                            </FormControl>
                                            <div className="space-y-1 leading-none">
                                              <FormLabel>{getStudentFacingQuestionLabel(question.label, question.section)}{approvalRequiredQuestions.includes(question.key) ? ' *' : ''}</FormLabel>
                                              <FormMessage />
                                            </div>
                                          </FormItem>
                                        )}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        )}

                        <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4 pt-4">
                            <Button type="button" variant="ghost" 
                                onClick={() => navigate(`/aluno/matricula/${compositeId}/1`)}
                                className="text-slate-500 hover:text-slate-900 w-full sm:w-auto"
                            >
                                ❮ Voltar e Editar
                            </Button>
                            <Button type="submit" 
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-6 px-8 text-lg w-full sm:w-auto shadow-lg shadow-green-600/20 transition-all hover:scale-[1.02]" 
                                disabled={submitting}
                            >
                                {submitting ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Processando...
                                </>
                                ) : (
                                <>
                                    Aprovar Proposta
                                    <LucideCheck className="ml-2 h-5 w-5" />
                                </>
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
          </div>

        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
