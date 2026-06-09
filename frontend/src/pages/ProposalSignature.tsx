import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, type FieldErrors, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader2, Check, ArrowRight, X, CheckCircle, Clock, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { proposalService, ProposalData, SignProposalData } from '@/services/proposalService';
import BudgetPreview from '@/components/school/BudgetPreview';
import { useCep } from '@/hooks/useCep';
import { cpfApplyMask } from '@/lib/masks/cpf-apply-mask';
import { phoneApplyMask } from '@/lib/masks/phone-apply-mask';
import { cepApplyMask } from '@/lib/masks/cep-apply-mask';
import { validarCpf, getApiUrl } from '@/lib/qlib';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { useAuth } from '@/contexts/AuthContext';
import {
  getStudentFacingQuestionLabel,
  PUBLIC_PROPOSAL_QUESTIONS,
  PublicProposalQuestionKey,
  resolvePublicProposalQuestions,
  resolvePublicProposalRequiredQuestions,
  resolvePublicProposalSections,
} from '@/lib/publicProposalQuestions';

const formSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  cpf: z.string().min(11, 'CPF inválido').refine(validarCpf, 'CPF inválido'),
  celular: z.string().min(10, 'Celular inválido'),
  nascimento: z.string().min(10, 'Data de nascimento inválida'),
  pais_origem: z.string().min(1, 'País de origem é obrigatório'),
  canac: z.string().optional(),
  identidade: z.string().min(1, 'RG/Identidade é obrigatório'),
  cep: z.string().min(8, 'CEP obrigatório'),
  endereco: z.string().min(1, 'Endereço é obrigatório'),
  numero: z.string().min(1, 'Número é obrigatório'),
  complemento: z.string().optional(),
  bairro: z.string().min(1, 'Bairro é obrigatório'),
  cidade: z.string().min(1, 'Cidade é obrigatória'),
  estado: z.string().min(2, 'Estado é obrigatório'),
  nacionalidade: z.string().min(1, 'Nacionalidade é obrigatória'),
  profissao: z.string().min(1, 'Profissão é obrigatória'),
  sexo: z.string().min(1, 'Sexo é obrigatório'),
  altura: z.string().min(1, 'Altura é obrigatória').refine((val) => !isNaN(Number(val)) && Number(val) > 0, 'Altura inválida'),
  peso: z.string().min(1, 'Peso é obrigatório').refine((val) => !isNaN(Number(val)) && Number(val) > 0, 'Peso inválido'),
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

type FormData = z.infer<typeof formSchema>;

/**
 * normalizeMetaBoolean
 * pt-BR: Converte valores vindos da API/meta em booleano para hidratar checkboxes.
 * en-US: Converts API/meta values into booleans to hydrate checkboxes.
 */
function normalizeMetaBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'sim', 's', 'yes', 'on'].includes(normalized);
}

/**
 * validateRequiredPublicQuestions
 * pt-BR: Valida as perguntas obrigatórias configuradas no curso antes do envio.
 * en-US: Validates required course-configured questions before submit.
 */
function validateRequiredPublicQuestions(
  requiredKeys: PublicProposalQuestionKey[],
  values: FormData
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

export default function ProposalSignature() {
  const { compositeId } = useParams<{ compositeId: string }>();
  const [clientId, matriculaId] = compositeId ? compositeId.split('_') : [null, null];
  const { isAuthenticated } = useAuth();

  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  const [showBudget, setShowBudget] = useState(false);
  
  const { fetchCep, loading: loadingCep } = useCep();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      cpf: '',
      celular: '',
      nascimento: '',
      pais_origem: 'Brasil', 
      canac: '',
      identidade: '',
      cep: '',
      endereco: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      nacionalidade: 'Brasileira',
      profissao: '',
      sexo: '',
      altura: '',
      peso: '',
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
    }
  });

  /**
   * focusFieldByName
   * pt-BR: Rola a tela até o primeiro campo inválido e tenta posicionar o foco no controle visível.
   * en-US: Scrolls to the first invalid field and tries to focus the visible control.
   */
  function focusFieldByName(fieldName?: Path<FormData>) {
    if (!fieldName || typeof document === 'undefined') return;

    window.setTimeout(() => {
      const fieldKey = String(fieldName);
      const container = document.querySelector<HTMLElement>(`[data-field="${fieldKey}"]`);
      const control =
        document.querySelector<HTMLElement>(`[name="${fieldKey}"]`) ||
        container?.querySelector<HTMLElement>('input, textarea, button, [role="combobox"], [role="checkbox"]');

      const scrollTarget = container || control;
      if (scrollTarget) {
        scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
   * pt-BR: Move o usuário para o primeiro campo com erro retornado pela validação do formulário.
   * en-US: Moves the user to the first field that failed form validation.
   */
  function handleInvalidSubmit(errors: FieldErrors<FormData>) {
    const firstFieldName = Object.keys(errors)[0] as Path<FormData> | undefined;
    focusFieldByName(firstFieldName);
  }

  useEffect(() => {
    async function loadData() {
      if (!clientId || !matriculaId) {
        toast.error('Link inválido');
        setLoading(false);
        return;
      }

      try {
        const data = await proposalService.getProposal(clientId, matriculaId);
        const status = (data as any)?.status;
        const successRedirect = (data as any)?.redirect;
        if (status === 'aprovado' || status === 'assinado') {
          toast.info((data as any)?.message || 'Proposta já aprovada. Redirecionando...');
          if (successRedirect) {
            window.location.href = successRedirect;
          } else {
            window.location.href = `/aluno/matricula/${clientId}_${matriculaId}/2`;
          }
          return;
        }
        setProposal(data);
        try {
          const token = localStorage.getItem('auth_token');
          const base = getApiUrl();
          const meta = (data as any)?.meta || {};
          const payload = {
            status_assinatura: meta?.status_assinatura,
            step1_done: (data as any)?.config?.step1_done || false,
            step2_done: (data as any)?.config?.step2_done || false,
          };
          await fetch(`${base}/event-logs`, {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
              ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              entity_type: 'matriculas',
              entity_id: String(matriculaId),
              action: 'view_public_status',
              description: `Visualização status pública da matrícula ${matriculaId}`,
              payload,
            }),
          }).catch(() => {});
        } catch {}
        
        // Populate form with existing client data
        if (data.cliente) {
          const meta = (data as any)?.meta || {};
          form.reset({
            name: data.cliente.name || '',
            email: data.cliente.email || '',
            cpf: cpfApplyMask(data.cliente.cpf || ''),
            celular: phoneApplyMask(data.cliente.celular || ''),
            nascimento: (() => {
              const rawDate = data.cliente.nascimento || data.cliente.config?.nascimento || '';
              if (!rawDate) return '';
              // Format DD/MM/YYYY to YYYY-MM-DD for input type="date"
              if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
                const [day, month, year] = rawDate.split('/');
                return `${year}-${month}-${day}`;
              }
              return rawDate;
            })(),
            cep: data.cliente.config?.cep ? cepApplyMask(data.cliente.config.cep) : '',
            endereco: data.cliente.config?.endereco || '',
            numero: data.cliente.config?.numero || '',
            complemento: data.cliente.config?.complemento || '',
            bairro: data.cliente.config?.bairro || '',
            cidade: data.cliente.config?.cidade || '',
            estado: data.cliente.config?.estado || '',
            pais_origem: data.cliente.config?.pais_origem || 'Brasil',
            nacionalidade: data.cliente.config?.nacionalidade || 'Brasileira',
            profissao: data.cliente.config?.profissao || '',
            identidade: data.cliente.config?.identidade || '',
            canac: data.cliente.config?.canac || '',
            altura: data.cliente.config?.altura ? String(data.cliente.config.altura) : '',
            peso: data.cliente.config?.peso ? String(data.cliente.config.peso) : '',
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
            sexo: (() => {
              const val = data.cliente.sexo || data.cliente.genero || data.cliente.config?.sexo || '';
              if (['m', 'masculino'].includes(val.toLowerCase())) return 'M';
              if (['f', 'feminino'].includes(val.toLowerCase())) return 'F';
              // If 'ni', return empty to force selection (show placeholder 'Selecionar')
              if (['ni', 'nao informar', 'não informar'].includes(val.toLowerCase())) return ''; 
              return val;
            })(),
          });
        }
      } catch (error: any) {
        console.error(error);
        toast.error('Erro ao carregar dados da proposta');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [clientId, matriculaId, form]);

  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length === 8) {
      const address = await fetchCep(cep);
      if (address) {
        form.setValue('endereco', address.endereco);
        form.setValue('bairro', address.bairro);
        form.setValue('cidade', address.cidade);
        form.setValue('estado', address.uf);
        form.setFocus('numero');
      }
    }
  };

  async function onSubmit(data: FormData) {
    if (!clientId || !matriculaId) return;
    if (isProposalExpired) {
      toast.error(proposalExpirationMessage);
      return;
    }

    try {
      setLoading(true);
      const requiredErrors = validateRequiredPublicQuestions(signatureRequiredQuestions, data);
      if (requiredErrors.length > 0) {
        requiredErrors.forEach((error) => {
          form.setError(error.key, { type: 'manual', message: error.message });
        });
        focusFieldByName(requiredErrors[0]?.key);
        toast.error('Preencha as perguntas obrigatórias.');
        return;
      }
      signatureRequiredQuestions.forEach((key) => form.clearErrors(key));
      const publicQuestionPayload = signatureVisibleQuestions.reduce<Partial<SignProposalData>>((acc, key) => {
        const value = data[key];
        if (typeof value !== 'undefined') {
          (acc as any)[key] = value;
        }
        return acc;
      }, {});
      const cleanData: SignProposalData = {
        ...data,
        name: data.name,
        email: data.email,
        cpf: data.cpf.replace(/\D/g, ''),
        celular: data.celular.replace(/\D/g, ''),
        nascimento: data.nascimento,
        cep: data.cep?.replace(/\D/g, '') || undefined,
        altura: data.altura ? Number(data.altura) : undefined,
        peso: data.peso ? Number(data.peso) : undefined,
        ...publicQuestionPayload,
      } as SignProposalData;

        const response = await proposalService.signProposal(clientId!, matriculaId!, cleanData);
        
        // Success redirect
        if ((response as any).redirect) {
          window.location.href = (response as any).redirect;
        } else {
          toast.success('Assinatura realizada com sucesso!');
        }
    } catch (error: any) {
      console.error(error);

      if (error.status === 422 && (error.body?.code === 'proposal_expired' || isProposalExpired)) {
        toast.error(error.body?.message || proposalExpirationMessage);
        return;
      }
      
      // Validação de erros do backend
      if (error.status === 422 && error.body && error.body.messages) {
        const messages = error.body.messages;
        let hasFieldErrors = false;

        if (messages.cpf) {
          form.setError('cpf', { type: 'manual', message: messages.cpf[0] });
          hasFieldErrors = true;
        }

        if (messages.email) {
          form.setError('email', { type: 'manual', message: messages.email[0] });
          hasFieldErrors = true;
        }

        if (messages.celular) {
          form.setError('celular', { type: 'manual', message: messages.celular[0] });
          hasFieldErrors = true;
        }

        if (hasFieldErrors) {
          const firstBackendField = (['cpf', 'email', 'celular'] as Array<Path<FormData>>).find((field) => Boolean(messages[field]));
          focusFieldByName(firstBackendField);
          toast.error('Verifique os campos com erro.');
          return;
        }
      }

      toast.error('Erro ao salvar os dados');
    } finally {
      setLoading(false);
    }
  }

  const signatureVisibleQuestions = useMemo<PublicProposalQuestionKey[]>(
    () => resolvePublicProposalQuestions((proposal as any)?.curso?.config, 'signature', (proposal as any)?.curso_tipo),
    [proposal]
  );
  const signatureRequiredQuestions = useMemo<PublicProposalQuestionKey[]>(
    () => resolvePublicProposalRequiredQuestions((proposal as any)?.curso?.config, 'signature', (proposal as any)?.curso_tipo),
    [proposal]
  );
  const signatureVisibleSections = useMemo(
    () => resolvePublicProposalSections((proposal as any)?.curso?.config, 'signature', (proposal as any)?.curso_tipo),
    [proposal]
  );
  const visibleQuestionDefinitions = useMemo(
    () => PUBLIC_PROPOSAL_QUESTIONS.filter((question) => signatureVisibleQuestions.includes(question.key)),
    [signatureVisibleQuestions]
  );
  const statusQuestions = visibleQuestionDefinitions.filter((question) => question.section === 'status');
  const infoQuestions = visibleQuestionDefinitions.filter((question) => question.section === 'info');
  const showStatusSection = signatureVisibleSections.status && statusQuestions.length > 0;
  const showInfoSection = signatureVisibleSections.info && infoQuestions.length > 0;
  const showAdministrativeQuestions = showStatusSection || showInfoSection;
  const isProposalExpired = Boolean(proposal?.is_expired);
  const proposalExpirationMessage = proposal?.expiration_message || 'A validade desta proposta expirou. Solicite uma nova proposta para continuar.';

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-sm text-center max-w-md">
          <X className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Proposta não encontrada</h1>
          <p className="text-muted-foreground">O link que você acessou pode estar expirado ou incorreto.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <PublicHeader />
      
      <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Proposal Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Informações da Proposta</CardTitle>
              <CardDescription>Revise os detalhes da sua matrícula</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-muted-foreground">Curso</Label>
                  <p className="text-lg font-medium">{proposal.curso_nome}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Turma</Label>
                  <p className="text-lg font-medium">{proposal.turma_nome}</p>
                </div>
                {(proposal as any)?.curso_tipo && ((proposal as any).curso_tipo === '4' || (proposal as any).curso_tipo === 4) && (proposal as any)?.orc?.modulos?.[0]?.nome && (
                  <div>
                    <Label className="text-muted-foreground">Período</Label>
                    <p className="text-base text-slate-700 bg-blue-50 px-2 py-1 rounded inline-block">
                      {(proposal as any).orc.modulos[0].nome}
                    </p>
                  </div>
                )}
                <div>
                  <Label className="text-muted-foreground">Valor Total</Label>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <p className="text-lg font-medium">
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proposal.total)}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-blue-600 hover:text-blue-800 border-blue-200 bg-blue-50 hover:bg-blue-100 sm:ml-4"
                      onClick={() => setShowBudget(!showBudget)}
                      type="button"
                    >
                      {showBudget ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                      {showBudget ? 'Ocultar Detalhes' : 'Ver Detalhes'}
                    </Button>
                  </div>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div className={`${isProposalExpired ? 'bg-red-50 border-red-100' : 'bg-blue-50 border-blue-100'} p-4 rounded-md border`}>
                <h4 className={`${isProposalExpired ? 'text-red-800' : 'text-blue-800'} font-medium mb-1`}>Status da Matrícula</h4>
                <p className={`${isProposalExpired ? 'text-red-700' : 'text-blue-600'} text-sm`}>
                  {isProposalExpired
                    ? proposalExpirationMessage
                    : 'Aguardando assinatura e confirmação de dados.'}
                </p>
              </div>
              
              {/* Admin Status Card */}
              {isAuthenticated && (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                {(() => {
                  const meta: any = (proposal as any)?.meta || {};
                  const statusAssinatura: string | undefined = meta?.status_assinatura;
                  const hasLinksAssinados =
                    Boolean(meta?.salvar_links_assinados) ||
                    Object.keys(meta || {}).some((k) => k.startsWith('salvar_links_assinados_'));
                  const step1 = Boolean((proposal as any)?.config?.step1_done);
                  const step2 = Boolean((proposal as any)?.config?.step2_done);
                  const isAssinado = hasLinksAssinados;
                  const isAprovado = statusAssinatura === 'aprovado' || step2;
                  const label = isAssinado ? 'Assinada' : (isAprovado ? 'Aprovada' : 'Em andamento');
                  const icon = isAssinado ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Clock className="h-4 w-4 text-blue-600" />;
                  const desc = isAssinado
                    ? 'Está proposta já está aprovada e assinada.'
                    : (isAprovado ? 'A proposta foi aprovada e está aguardando assinatura digital.' : 'Proposta em andamento. Aguarde conclusão da etapa 1 e aprovação.');
                  return (
                    <div className="space-y-2">
                      <h4 className="font-medium text-slate-800">Status para Administrador</h4>
                      <div className="flex items-center gap-2">
                        {icon}
                        <span className={`text-sm ${isAssinado ? 'text-green-700' : (isAprovado ? 'text-blue-700' : 'text-slate-700')}`}>{label}</span>
                      </div>
                      <p className="text-xs text-slate-600">{desc}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-600">
                        <span>Etapa 1: {step1 ? 'Concluída' : 'Pendente'}</span>
                        <span>Etapa 2: {step2 ? 'Concluída' : 'Aguardando'}</span>
                      </div>
                      {(isAssinado || isAprovado) && (
                        <div className="pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => window.open(`/aluno/matricula/${clientId}_${matriculaId}/2/aprovado`, '_self')}
                          >
                            Ver tela “Aguardando Assinatura Digital”
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
              )}
            </CardContent>
          </Card>

          {isProposalExpired && (
            <Alert variant="destructive" className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Proposta vencida</AlertTitle>
              <AlertDescription>
                {proposalExpirationMessage} Solicite uma nova proposta ao atendimento para seguir com a matrícula.
              </AlertDescription>
            </Alert>
          )}

          {showBudget && (
            <Card className="animate-in fade-in slide-in-from-top-4 duration-300">
              <CardHeader>
                <CardTitle>Detalhamento do Orçamento</CardTitle>
                <CardDescription>Confira os itens inclusos na sua proposta</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <BudgetPreview
                  clientName={proposal.cliente?.name || ''}
                  course={{
                    ...(proposal as any).curso,
                    nome: proposal.curso_nome,
                    tipo: (proposal as any).curso_tipo,
                  }}
                  modules={(proposal as any).orc?.modulos || []}
                  totalMasked={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proposal.total)}
                  fuelExternalText={(proposal as any).meta?.texto_combustivel}
                  validityDays={(proposal as any).validade}
                  etapa1Discount={(proposal as any).desconto}
                  parcelamento={(proposal as any).orc?.parcelamento}
                />
              </CardContent>
            </Card>
          )}

          {/* Student Form */}
          {!isProposalExpired && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit, handleInvalidSubmit)} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Seus Dados</CardTitle>
                    <CardDescription>Confirme e complete suas informações cadastrais</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                  
                    {/* Personal Info Section */}
                    <div className="space-y-4">
                      <h3 className="font-medium text-lg">Dados Pessoais</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome Completo</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>E-mail</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="cpf"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>CPF</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  onChange={(e) => field.onChange(cpfApplyMask(e.target.value))}
                                  maxLength={14}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="celular"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Celular (WhatsApp)</FormLabel>
                              <FormControl>
                                <Input 
                                  {...field} 
                                  onChange={(e) => field.onChange(phoneApplyMask(e.target.value))}
                                  maxLength={20}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="nascimento"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Data de Nascimento</FormLabel>
                              <FormControl>
                                <Input type="date" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="sexo"
                          render={({ field }) => (
                            <FormItem data-field="sexo">
                              <FormLabel>Sexo</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value || ""}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecionar" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="M">Masculino</SelectItem>
                                  <SelectItem value="F">Feminino</SelectItem>
                                  <SelectItem value="ni">Não informar</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                  <Separator />

                  {/* Additional Info Section */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-lg">Documentos e Físico</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="identidade"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>RG / Identidade</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="canac"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CANAC (se houver)</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="profissao"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Profissão</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="altura"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Altura (m)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.01"
                                {...field}
                                onBlur={(e) => {
                                  const raw = (e.target.value || '').toString().replace(',', '.');
                                  const num = parseFloat(raw);
                                  if (!isNaN(num)) {
                                    const normalized = num >= 3 ? (num / 100) : num; // aceita cm (ex.: 180)
                                    field.onChange(normalized.toFixed(2));
                                  }
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="peso"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Peso (kg)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                step="0.1"
                                {...field}
                                onBlur={(e) => {
                                  const raw = (e.target.value || '').toString().replace(',', '.');
                                  const num = parseFloat(raw);
                                  if (!isNaN(num)) {
                                    field.onChange(num.toString());
                                  }
                                }}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Address Section */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-lg">Endereço</h3>
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                       <FormField
                        control={form.control}
                        name="cep"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CEP</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  {...field} 
                                  onChange={(e) => field.onChange(cepApplyMask(e.target.value))}
                                  onBlur={handleCepBlur}
                                  maxLength={9}
                                />
                                {loadingCep && (
                                  <div className="absolute right-3 top-2.5">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endereco"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Endereço</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="numero"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="complemento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Complemento</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="bairro"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bairro</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="cidade"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cidade</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="estado"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado</FormLabel>
                            <FormControl>
                              <Input {...field} maxLength={2} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                     </div>
                  </div>

                  {showAdministrativeQuestions && (
                    <>
                      <Separator />

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
                                        {getStudentFacingQuestionLabel(question.label, question.section)}{signatureRequiredQuestions.includes(question.key) ? ' *' : ''}
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
                                        <FormLabel>{getStudentFacingQuestionLabel(question.label, question.section)}{signatureRequiredQuestions.includes(question.key) ? ' *' : ''}</FormLabel>
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
                        <>
                          {showStatusSection && <Separator />}
                          <div className="space-y-4">
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
                                        <FormLabel>{getStudentFacingQuestionLabel(question.label, question.section)}{signatureRequiredQuestions.includes(question.key) ? ' *' : ''}</FormLabel>
                                        <FormMessage />
                                      </div>
                                    </FormItem>
                                  )}
                                />
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </>
                  )}

                  </CardContent>
                  <CardFooter className="flex justify-between border-t p-6">
                    <Button variant="outline" type="button" onClick={() => navigate(-1)}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={loading} size="lg" className="bg-primary hover:bg-primary/90">
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          Salvar e Avançar
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </form>
            </Form>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}>{children}</label>;
}
