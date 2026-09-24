import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, type FieldErrors, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { 
  Loader2, 
  Check, 
  ArrowRight, 
  ArrowLeft,
  X, 
  CheckCircle, 
  Clock, 
  Eye, 
  EyeOff, 
  AlertTriangle,
  CreditCard,
  User,
  MapPin,
  ClipboardCheck,
  Calendar,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { proposalService, ProposalData, SignProposalData } from '@/services/proposalService';
import BudgetPreview from '@/components/school/BudgetPreview';
import { useCep } from '@/hooks/useCep';
import { cpfApplyMask } from '@/lib/masks/cpf-apply-mask';
import { phoneApplyMask } from '@/lib/masks/phone-apply-mask';
import { cepApplyMask } from '@/lib/masks/cep-apply-mask';
import { currencyRemoveMaskToNumber } from '@/lib/masks/currency';
import { validarCpf, getApiUrl } from '@/lib/qlib';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

function normalizeMetaBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'sim', 's', 'yes', 'on'].includes(normalized);
}

function formatCurrencyBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

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
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  
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

  function handleInvalidSubmit(errors: FieldErrors<FormData>) {
    const firstFieldName = Object.keys(errors)[0] as Path<FormData> | undefined;
    
    // Check if error is in step 2 fields
    const step2Fields: Array<Path<FormData>> = [
      'name', 'email', 'cpf', 'celular', 'nascimento', 'sexo',
      'identidade', 'canac', 'profissao', 'altura', 'peso',
      'cep', 'endereco', 'numero', 'complemento', 'bairro', 'cidade', 'estado'
    ];

    if (firstFieldName && step2Fields.includes(firstFieldName)) {
      setCurrentStep(2);
    } else {
      setCurrentStep(3);
    }

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

  /**
   * parcelamentoSummary
   * pt-BR: Interpreta o objeto de parcelamento da proposta e gera os textos detalhados para o aluno.
   */
  const parcelamentoSummary = useMemo(() => {
    const parcelamento = (proposal as any)?.orc?.parcelamento;
    if (!parcelamento) return null;

    const linhas = Array.isArray(parcelamento.linhas) ? parcelamento.linhas : [];
    const parcelaSel = String(parcelamento.parcela_selecionada || '').trim();
    const activeLine = (parcelaSel && linhas.find((l: any) => String(l.parcela || l.parcelas || '').trim() === parcelaSel))
      || linhas[0]
      || null;

    const qtdParcelas = parseInt(parcelaSel || String(activeLine?.parcela || activeLine?.parcelas || '0'), 10) || 0;
    if (qtdParcelas <= 0 && !activeLine) return null;

    let valorParcelaNum = 0;
    if (activeLine?.valor) {
      valorParcelaNum = typeof activeLine.valor === 'number'
        ? activeLine.valor
        : (currencyRemoveMaskToNumber(String(activeLine.valor)) || 0);
    }
    const descPontualidadeNum = activeLine?.desconto
      ? (typeof activeLine.desconto === 'number' ? activeLine.desconto : (currencyRemoveMaskToNumber(String(activeLine.desconto)) || 0))
      : 0;

    const valorEfetivoParcela = Math.max(0, valorParcelaNum - descPontualidadeNum);

    const recebimentoMatricula = String(parcelamento.recebimento_matricula || 'diluida').trim();
    const matriculaValorRaw = (proposal as any)?.orc?.inscricao ?? (proposal as any)?.inscricao ?? 0;
    const matriculaValorNum = typeof matriculaValorRaw === 'number'
      ? matriculaValorRaw
      : (currencyRemoveMaskToNumber(String(matriculaValorRaw)) || 0);

    const matriculaVencimentoData = parcelamento.matricula_vencimento_data || '';

    // Entrada / primeira parcela
    const primeiraParcelaValorRaw = parcelamento.primeira_parcela_valor;
    const primeiraParcelaValorNum = primeiraParcelaValorRaw !== undefined && primeiraParcelaValorRaw !== null && primeiraParcelaValorRaw !== ''
      ? (typeof primeiraParcelaValorRaw === 'number' ? primeiraParcelaValorRaw : (currencyRemoveMaskToNumber(String(primeiraParcelaValorRaw)) || 0))
      : null;

    // Se recebimento for junto com a 1ª parcela, computa o valor da 1ª parcela com matrícula
    const primeiraParcelaComMatriculaNum = recebimentoMatricula === 'primeira_parcela' && matriculaValorNum > 0
      ? (primeiraParcelaValorNum !== null ? primeiraParcelaValorNum + matriculaValorNum : valorEfetivoParcela + matriculaValorNum)
      : null;

    const valorParcelaFormatted = formatCurrencyBRL(valorEfetivoParcela > 0 ? valorEfetivoParcela : valorParcelaNum);

    let summaryText = '';
    const hasEntrada = primeiraParcelaValorNum !== null && primeiraParcelaValorNum > 0;

    if (recebimentoMatricula === 'primeira_parcela' && primeiraParcelaComMatriculaNum !== null) {
      const entradaComMatFormatted = formatCurrencyBRL(primeiraParcelaComMatriculaNum);
      const restantes = Math.max(0, qtdParcelas - 1);
      if (restantes > 0) {
        summaryText = `1ª Parcela de ${entradaComMatFormatted} (com matrícula) + ${restantes}x de ${valorParcelaFormatted}`;
      } else {
        summaryText = `1x de ${entradaComMatFormatted} (Curso + Matrícula)`;
      }
    } else if (hasEntrada) {
      const entradaFormatted = formatCurrencyBRL(primeiraParcelaValorNum);
      const restantes = Math.max(0, qtdParcelas - 1);
      if (restantes > 0) {
        summaryText = `Entrada de ${entradaFormatted} + ${restantes}x de ${valorParcelaFormatted}`;
      } else {
        summaryText = `1x de ${entradaFormatted} (À vista / Entrada)`;
      }
    } else if (qtdParcelas === 1) {
      summaryText = `1x de ${valorParcelaFormatted} (À vista)`;
    } else if (qtdParcelas > 1) {
      summaryText = `${qtdParcelas}x de ${valorParcelaFormatted}`;
    } else {
      summaryText = valorParcelaFormatted;
    }

    let paymentMethod = 'Boleto / Carnê Bancário';
    const diaPagamento = parcelamento.dia_pagamento;
    if (diaPagamento) {
      paymentMethod += ` • Vencimento dia ${diaPagamento}`;
    }

    const dataPrimeiraParcela = parcelamento.primeira_parcela_data;

    return {
      summaryText,
      paymentMethod,
      qtdParcelas,
      valorParcelaFormatted,
      descPontualidadeNum,
      descPontualidadeFormatted: descPontualidadeNum > 0 ? formatCurrencyBRL(descPontualidadeNum) : null,
      hasEntrada,
      dataPrimeiraParcela,
      diaPagamento,
      activeLine,
      recebimentoMatricula,
      matriculaValorNum,
      matriculaValorFormatted: matriculaValorNum > 0 ? formatCurrencyBRL(matriculaValorNum) : null,
      matriculaVencimentoData,
      primeiraParcelaComMatriculaNum,
      primeiraParcelaComMatriculaFormatted: primeiraParcelaComMatriculaNum !== null ? formatCurrencyBRL(primeiraParcelaComMatriculaNum) : null,
    };
  }, [proposal]);

  // Validation step-by-step
  const handleValidateStep2AndProceed = async () => {
    const fieldsToValidate: Array<Path<FormData>> = [
      'name', 'email', 'cpf', 'celular', 'nascimento', 'sexo',
      'identidade', 'altura', 'peso',
      'cep', 'endereco', 'numero', 'bairro', 'cidade', 'estado'
    ];

    const isValid = await form.trigger(fieldsToValidate);
    if (!isValid) {
      const errors = form.formState.errors;
      const firstInvalid = fieldsToValidate.find((field) => Boolean(errors[field]));
      focusFieldByName(firstInvalid);
      toast.error('Preencha os campos obrigatórios antes de prosseguir.');
      return;
    }

    setCurrentStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
        setCurrentStep(3);
        focusFieldByName(requiredErrors[0]?.key);
        toast.error('Preencha as confirmações obrigatórias.');
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
          setCurrentStep(2);
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
    <div className="min-h-screen bg-slate-50/60 flex flex-col">
      <PublicHeader />
      
      <main className="flex-grow py-3 sm:py-8 px-2.5 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto space-y-4 sm:space-y-6">

          {/* Stepper Header (Wizard) */}
          <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-5 shadow-sm border border-slate-200/80">
            <div className="flex items-center justify-between relative px-2 sm:px-4">
              {/* Progress Line */}
              <div className="absolute top-1/2 left-10 right-10 -translate-y-1/2 h-1 bg-slate-100 -z-0">
                <div 
                  className="h-full bg-primary transition-all duration-300"
                  style={{
                    width: currentStep === 1 ? '0%' : currentStep === 2 ? '50%' : '100%'
                  }}
                />
              </div>

              {/* Step 1 Item */}
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none group"
              >
                <div 
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    currentStep === 1 
                      ? 'bg-primary text-white ring-4 ring-primary/20 shadow-sm' 
                      : currentStep > 1 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {currentStep > 1 ? <Check className="w-5 h-5" /> : '1'}
                </div>
                <span className={`text-[11px] sm:text-xs font-medium ${currentStep === 1 ? 'text-primary font-bold' : 'text-slate-500'}`}>
                  Proposta
                </span>
              </button>

              {/* Step 2 Item */}
              <button
                type="button"
                onClick={() => {
                  if (currentStep > 2) setCurrentStep(2);
                  else if (currentStep === 1) setCurrentStep(2);
                }}
                className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none group"
              >
                <div 
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    currentStep === 2 
                      ? 'bg-primary text-white ring-4 ring-primary/20 shadow-sm' 
                      : currentStep > 2 
                        ? 'bg-emerald-600 text-white' 
                        : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {currentStep > 2 ? <Check className="w-5 h-5" /> : '2'}
                </div>
                <span className={`text-[11px] sm:text-xs font-medium ${currentStep === 2 ? 'text-primary font-bold' : 'text-slate-500'}`}>
                  Seus Dados
                </span>
              </button>

              {/* Step 3 Item */}
              <button
                type="button"
                onClick={() => {
                  if (currentStep < 3) handleValidateStep2AndProceed();
                }}
                className="relative z-10 flex flex-col items-center gap-1.5 focus:outline-none group"
              >
                <div 
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    currentStep === 3 
                      ? 'bg-primary text-white ring-4 ring-primary/20 shadow-sm' 
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  3
                </div>
                <span className={`text-[11px] sm:text-xs font-medium ${currentStep === 3 ? 'text-primary font-bold' : 'text-slate-500'}`}>
                  Aceitação
                </span>
              </button>
            </div>
          </div>

          {/* Expired Proposal Alert */}
          {isProposalExpired && (
            <Alert variant="destructive" className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Proposta vencida</AlertTitle>
              <AlertDescription>
                {proposalExpirationMessage} Solicite uma nova proposta ao atendimento para seguir com a matrícula.
              </AlertDescription>
            </Alert>
          )}

          {/* Form Context */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit, handleInvalidSubmit)} className="space-y-6">

              {/* ========================================================================= */}
              {/* ETAPA 1: RESUMO DA PROPOSTA E CONDIÇÕES DE PAGAMENTO                     */}
              {/* ========================================================================= */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-300">
                  <Card className="border-slate-200/80 shadow-sm overflow-hidden">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/30 border-b p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div>
                          <CardTitle className="text-lg sm:text-xl font-bold text-slate-900">Resumo da Sua Matrícula</CardTitle>
                          <CardDescription className="text-xs sm:text-sm mt-0.5">Confira os valores e a forma de pagamento combinada</CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-white text-blue-700 border-blue-200 font-semibold px-2.5 py-0.5 sm:py-1 self-start sm:self-center text-[11px] sm:text-xs">
                          Passo 1 de 3
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="p-5 sm:p-6 space-y-6">
                      {/* Top Info Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1">
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Curso</span>
                          <p className="text-base sm:text-lg font-bold text-slate-900">{proposal.curso_nome}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1">
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Turma</span>
                          <p className="text-base sm:text-lg font-bold text-slate-900">{proposal.turma_nome}</p>
                        </div>
                      </div>

                      {/* Period Badge if Course Type 4 */}
                      {(proposal as any)?.curso_tipo && ((proposal as any).curso_tipo === '4' || (proposal as any).curso_tipo === 4) && (proposal as any)?.orc?.modulos?.[0]?.nome && (
                        <div className="p-3 rounded-lg bg-blue-50/60 border border-blue-100 flex items-center gap-2">
                          <span className="text-xs font-semibold text-blue-900">Período Selecionado:</span>
                          <span className="text-xs font-bold text-blue-800 bg-white px-2.5 py-0.5 rounded border border-blue-200">
                            {(proposal as any).orc.modulos[0].nome}
                          </span>
                        </div>
                      )}

                      {/* Main Payment & Investment Card */}
                      <div className="rounded-2xl border-2 border-emerald-500/20 bg-gradient-to-br from-emerald-50/40 via-white to-teal-50/20 p-5 sm:p-6 space-y-5">
                        <div className="flex items-center justify-between border-b border-emerald-100/80 pb-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
                              <CreditCard className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-950">Condição de Pagamento</h3>
                              <p className="text-xs text-emerald-700">Plano acordado na sua proposta</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[11px] font-semibold uppercase text-slate-500 block">Total do Curso</span>
                            <span className="text-lg sm:text-2xl font-black text-slate-900">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proposal.total)}
                            </span>
                          </div>
                        </div>

                        {/* Parcelamento Highlights */}
                        {parcelamentoSummary ? (
                          <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-white border border-emerald-200/60 shadow-sm">
                              <div>
                                <span className="text-xs text-muted-foreground block font-medium">Plano Escolhido:</span>
                                <span className="text-lg sm:text-xl font-black text-emerald-700">
                                  {parcelamentoSummary.summaryText}
                                </span>
                              </div>
                              <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300 font-semibold text-xs py-1 px-3 self-start sm:self-center">
                                Condição Aprovada
                              </Badge>
                            </div>

                            {/* Condição da Matrícula */}
                            {parcelamentoSummary.recebimentoMatricula === 'avulsa' && parcelamentoSummary.matriculaValorFormatted && (
                              <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-amber-200/80 text-amber-900 flex items-center justify-center font-bold text-xs">
                                    0
                                  </div>
                                  <div>
                                    <span className="text-xs font-bold text-amber-950 block">
                                      Taxa de Inscrição / Matrícula (Parcela Avulsa)
                                    </span>
                                    <span className="text-[11px] text-amber-800">
                                      Cobrança separada prévia para efetivação da vaga
                                      {parcelamentoSummary.matriculaVencimentoData ? ` • Vencimento em ${parcelamentoSummary.matriculaVencimentoData.split('-').reverse().join('/')}` : ''}
                                    </span>
                                  </div>
                                </div>
                                <span className="text-base font-black text-amber-950 sm:text-right">
                                  {parcelamentoSummary.matriculaValorFormatted}
                                </span>
                              </div>
                            )}

                            {parcelamentoSummary.recebimentoMatricula === 'primeira_parcela' && parcelamentoSummary.matriculaValorFormatted && (
                              <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <span className="text-xs font-bold text-blue-950 block">
                                    1ª Parcela Inclui Taxa de Matrícula ({parcelamentoSummary.matriculaValorFormatted})
                                  </span>
                                  <span className="text-[11px] text-blue-800">
                                    O valor da matrícula é pago conjuntamente na 1ª mensalidade/entrada.
                                  </span>
                                </div>
                                <Badge className="bg-blue-100 text-blue-800 border-blue-300 self-start sm:self-center text-xs">
                                  Matrícula na Entrada
                                </Badge>
                              </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div className="p-3 rounded-lg bg-white/80 border border-slate-200/60 flex items-center gap-2">
                                <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                                <div>
                                  <span className="text-slate-500 block">Forma de Pagamento:</span>
                                  <span className="font-semibold text-slate-800">{parcelamentoSummary.paymentMethod}</span>
                                </div>
                              </div>

                              {parcelamentoSummary.descPontualidadeFormatted ? (
                                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center gap-2">
                                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <div>
                                    <span className="text-emerald-700 block">Desconto Pontualidade:</span>
                                    <span className="font-bold text-emerald-900">
                                      {parcelamentoSummary.descPontualidadeFormatted} / parcela até o vencimento
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div className="p-3 rounded-lg bg-white/80 border border-slate-200/60 flex items-center gap-2">
                                  <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <div>
                                    <span className="text-slate-500 block">Status da Matrícula:</span>
                                    <span className="font-semibold text-slate-800">
                                      {parcelamentoSummary.recebimentoMatricula === 'diluida' 
                                        ? 'Diluída nas mensalidades' 
                                        : parcelamentoSummary.recebimentoMatricula === 'avulsa' 
                                          ? 'Boleto/Cobrança avulsa' 
                                          : 'Integrada na 1ª parcela'}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="p-4 rounded-xl bg-white border border-slate-200 text-sm text-slate-700">
                            Condição de pagamento à vista no valor integral de{' '}
                            <strong>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proposal.total)}</strong>.
                          </div>
                        )}

                        {/* View Budget Details Toggle Button */}
                        <div className="pt-2 flex justify-center sm:justify-start">
                          <Button
                            variant="ghost"
                            size="sm"
                            type="button"
                            className="text-blue-700 hover:text-blue-900 hover:bg-blue-50 font-medium text-xs gap-1.5"
                            onClick={() => setShowBudget(!showBudget)}
                          >
                            {showBudget ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            {showBudget ? 'Ocultar tabela completa de orçamento' : 'Ver detalhamento completo do orçamento e módulos'}
                          </Button>
                        </div>
                      </div>

                      {/* Collapsible Budget Preview */}
                      {showBudget && (
                        <div className="p-4 rounded-xl border border-slate-200 bg-white overflow-x-auto shadow-inner animate-in fade-in zoom-in-95 duration-200">
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
                        </div>
                      )}

                      {/* Admin Quick Status (if logged in) */}
                      {isAuthenticated && (
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-1.5">
                          <div className="flex items-center gap-2 font-semibold text-slate-800">
                            <ShieldCheck className="w-4 h-4 text-blue-600" />
                            Painel Operacional (Acesso Administrativo)
                          </div>
                          <p className="text-slate-600">
                            Etapa 1: {(proposal as any)?.config?.step1_done ? 'Concluída' : 'Pendente'} • 
                            Etapa 2: {(proposal as any)?.config?.step2_done ? 'Concluída' : 'Aguardando'}
                          </p>
                        </div>
                      )}
                    </CardContent>

                    <CardFooter className="bg-slate-50/80 border-t p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-center gap-3">
                      <span className="text-xs text-slate-500 order-2 sm:order-1 text-center sm:text-left">
                        Revise os dados antes de prosseguir para o cadastro.
                      </span>
                      <Button
                        type="button"
                        size="lg"
                        className="w-full sm:w-auto font-bold bg-primary hover:bg-primary/90 order-1 sm:order-2 shadow-sm gap-2"
                        onClick={() => {
                          setCurrentStep(2);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        Avançar para Meus Dados
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              )}

              {/* ========================================================================= */}
              {/* ETAPA 2: DADOS PESSOAIS & ENDEREÇO                                        */}
              {/* ========================================================================= */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <Card className="border-slate-200/80 shadow-sm">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/30 border-b p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div>
                          <CardTitle className="text-lg sm:text-xl font-bold text-slate-900">Seus Dados Cadastrais</CardTitle>
                          <CardDescription className="text-xs sm:text-sm mt-0.5">Confirme e complete as informações para confecção do seu contrato</CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-white text-blue-700 border-blue-200 font-semibold px-2.5 py-0.5 sm:py-1 self-start sm:self-center text-[11px] sm:text-xs">
                          Passo 2 de 3
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="p-5 sm:p-6 space-y-6">
                      {/* Dados Pessoais */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-slate-800 font-bold text-sm uppercase tracking-wide border-b pb-2">
                          <User className="w-4 h-4 text-primary" />
                          <span>Identificação Pessoal</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nome Completo *</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Digite seu nome completo" />
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
                                <FormLabel>E-mail *</FormLabel>
                                <FormControl>
                                  <Input type="email" {...field} placeholder="seu@email.com" />
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
                                <FormLabel>CPF *</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    inputMode="numeric"
                                    placeholder="000.000.000-00"
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
                                <FormLabel>Celular (WhatsApp) *</FormLabel>
                                <FormControl>
                                  <Input 
                                    {...field} 
                                    inputMode="tel"
                                    placeholder="(00) 00000-0000"
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
                                <FormLabel>Data de Nascimento *</FormLabel>
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
                                <FormLabel>Sexo *</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value || ""}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione" />
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

                      {/* Documentos & Físico */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-slate-800 font-bold text-sm uppercase tracking-wide border-b pb-2">
                          <FileText className="w-4 h-4 text-primary" />
                          <span>Documentos & Dados Físicos</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          <FormField
                            control={form.control}
                            name="identidade"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>RG / Identidade *</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Número do RG" />
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
                                <FormLabel>CANAC (se possuir)</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Código CANAC" />
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
                                <FormLabel>Profissão *</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Sua profissão" />
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
                                <FormLabel>Altura (m) *</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    inputMode="decimal"
                                    placeholder="Ex: 1.75"
                                    {...field}
                                    onBlur={(e) => {
                                      const raw = (e.target.value || '').toString().replace(',', '.');
                                      const num = parseFloat(raw);
                                      if (!isNaN(num)) {
                                        const normalized = num >= 3 ? (num / 100) : num;
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
                                <FormLabel>Peso (kg) *</FormLabel>
                                <FormControl>
                                  <Input
                                    type="number"
                                    step="0.1"
                                    inputMode="decimal"
                                    placeholder="Ex: 75.0"
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

                      {/* Endereço */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 text-slate-800 font-bold text-sm uppercase tracking-wide border-b pb-2">
                          <MapPin className="w-4 h-4 text-primary" />
                          <span>Endereço Residencial</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                          <FormField
                            control={form.control}
                            name="cep"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>CEP *</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input 
                                      {...field} 
                                      inputMode="numeric"
                                      placeholder="00000-000"
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
                              <FormItem className="sm:col-span-2">
                                <FormLabel>Rua / Logradouro *</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Av., Rua, Travessa..." />
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
                                <FormLabel>Número *</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="123" />
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
                                  <Input {...field} placeholder="Apto, Bloco..." />
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
                                <FormLabel>Bairro *</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Bairro" />
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
                                <FormLabel>Cidade *</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Cidade" />
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
                                <FormLabel>UF *</FormLabel>
                                <FormControl>
                                  <Input {...field} maxLength={2} placeholder="UF" className="uppercase" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter className="bg-slate-50/80 border-t p-4 sm:p-6 flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3">
                      <Button
                        variant="outline"
                        type="button"
                        className="w-full sm:w-auto h-11 sm:h-10 text-sm justify-center"
                        onClick={() => {
                          setCurrentStep(1);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Voltar para Proposta
                      </Button>

                      <Button
                        type="button"
                        size="lg"
                        className="w-full sm:w-auto font-bold bg-primary hover:bg-primary/90 shadow-sm h-11 sm:h-10 text-sm justify-center"
                        onClick={handleValidateStep2AndProceed}
                      >
                        Continuar para Aceitação
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              )}

              {/* ========================================================================= */}
              {/* ETAPA 3: CONFIRMAÇÕES OPERACIONAIS & ASSINATURA FINAL                    */}
              {/* ========================================================================= */}
              {currentStep === 3 && (
                <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                  <Card className="border-slate-200/80 shadow-sm">
                    <CardHeader className="bg-gradient-to-r from-slate-50 to-blue-50/30 border-b p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div>
                          <CardTitle className="text-lg sm:text-xl font-bold text-slate-900">Termos e Aceitação</CardTitle>
                          <CardDescription className="text-xs sm:text-sm mt-0.5">Confirme as diretrizes operacionais e aceite a proposta para emissão do contrato</CardDescription>
                        </div>
                        <Badge variant="outline" className="bg-white text-blue-700 border-blue-200 font-semibold px-2.5 py-0.5 sm:py-1 self-start sm:self-center text-[11px] sm:text-xs">
                          Passo 3 de 3
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="p-5 sm:p-6 space-y-6">
                      {/* Summary Box before finalizing */}
                      <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase text-blue-900">Resumo da Contratação</span>
                          <span className="text-xs font-bold text-blue-900">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proposal.total)}
                          </span>
                        </div>
                        <p className="text-xs text-blue-800">
                          <strong>Aluno:</strong> {form.watch('name') || proposal.cliente?.name} • <strong>Curso:</strong> {proposal.curso_nome}
                        </p>
                        {parcelamentoSummary && (
                          <p className="text-xs text-blue-800">
                            <strong>Condição:</strong> {parcelamentoSummary.summaryText} ({parcelamentoSummary.paymentMethod})
                          </p>
                        )}
                      </div>

                      {/* Termos e Declarações Operacionais */}
                      {showAdministrativeQuestions && (
                        <div className="space-y-6">
                          {showStatusSection && (
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm uppercase tracking-wide border-b pb-2">
                                <ClipboardCheck className="w-4 h-4 text-primary" />
                                <span>Situação Atual do Aluno</span>
                              </div>

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
                                            {getStudentFacingQuestionLabel(question.label, question.section)}
                                            {signatureRequiredQuestions.includes(question.key) ? ' *' : ''}
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
                                        <FormItem data-field={question.key} className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border border-slate-200 p-4 hover:bg-slate-50/60 transition-colors">
                                          <FormControl>
                                            <Checkbox 
                                              checked={Boolean(field.value)} 
                                              onCheckedChange={(checked) => field.onChange(Boolean(checked))} 
                                              className="mt-0.5"
                                            />
                                          </FormControl>
                                          <div className="space-y-1 leading-none">
                                            <FormLabel className="text-xs font-medium cursor-pointer">
                                              {getStudentFacingQuestionLabel(question.label, question.section)}
                                              {signatureRequiredQuestions.includes(question.key) ? ' *' : ''}
                                            </FormLabel>
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
                              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm uppercase tracking-wide border-b pb-2">
                                <ShieldCheck className="w-4 h-4 text-primary" />
                                <span>Declarações e Ciências Obrigatórias</span>
                              </div>

                              <div className="space-y-3">
                                {infoQuestions.map((question) => (
                                  <FormField
                                    key={question.key}
                                    control={form.control}
                                    name={question.key}
                                    render={({ field }) => (
                                      <FormItem data-field={question.key} className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border border-slate-200 p-4 hover:bg-slate-50/60 transition-colors">
                                        <FormControl>
                                          <Checkbox 
                                            checked={Boolean(field.value)} 
                                            onCheckedChange={(checked) => field.onChange(Boolean(checked))} 
                                            className="mt-0.5"
                                          />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                          <FormLabel className="text-xs sm:text-sm font-medium leading-relaxed cursor-pointer">
                                            {getStudentFacingQuestionLabel(question.label, question.section)}
                                            {signatureRequiredQuestions.includes(question.key) ? ' *' : ''}
                                          </FormLabel>
                                          <FormMessage />
                                        </div>
                                      </FormItem>
                                    )}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* General consent notice */}
                      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                        Ao clicar em <strong>"Aceitar Proposta e Concluir"</strong>, você declara que todas as informações prestadas são verídicas e que está de acordo com as condições de pagamento e diretrizes do curso contratado. A assinatura digital do contrato será realizada via ZapSign.
                      </div>
                    </CardContent>

                    <CardFooter className="bg-slate-50/80 border-t p-4 sm:p-6 flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-3">
                      <Button
                        variant="outline"
                        type="button"
                        className="w-full sm:w-auto h-11 sm:h-10 text-sm justify-center"
                        onClick={() => {
                          setCurrentStep(2);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Revisar Meus Dados
                      </Button>

                      <Button
                        type="submit"
                        disabled={loading}
                        size="lg"
                        className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 font-bold text-white shadow-md gap-2 h-11 sm:h-10 text-sm justify-center"
                      >
                        {loading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Processando...
                          </>
                        ) : (
                          <>
                            Aceitar Proposta e Concluir
                            <CheckCircle className="w-5 h-5" />
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              )}

            </form>
          </Form>

        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
