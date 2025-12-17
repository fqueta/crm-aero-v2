import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// Removido Select: campos de Funil/Etapa/Tag serão ocultados temporariamente
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useClientById, useClientsList } from '@/hooks/clients';
import { useUsersList } from '@/hooks/users';
// Removido hooks de funis/etapas: campos desativados temporariamente
import { useCreateEnrollment } from '@/hooks/enrollments';
import { useEnrollmentSituationsList } from '@/hooks/enrollmentSituations';
import { coursesService } from '@/services/coursesService';
import { turmasService } from '@/services/turmasService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { installmentsService } from '@/services/installmentsService';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText, Save, CheckCircle } from 'lucide-react';
import { Combobox, useComboboxOptions } from '@/components/ui/combobox';
import SelectGeraValor from '@/components/school/SelectGeraValor';
import { currencyApplyMask, currencyRemoveMaskToNumber, currencyRemoveMaskToString } from '@/lib/masks/currency';
import BudgetPreview from '@/components/school/BudgetPreview';

/**
 * ProposalFormData
 * pt-BR: Tipos do formulário de proposta. Todos os campos são strings para facilitar binding.
 * en-US: Proposal form types. All fields as strings for convenient binding.
 */
const proposalSchema = z.object({
  id_cliente: z.string().min(1, 'Selecione o cliente'),
  id_curso: z.string().min(1, 'Selecione o curso'),
  id_turma: z.string().min(1, 'Selecione a turma'),
  /**
   * parcelamento_id
   * pt-BR: ID da Tabela de Parcelamento selecionada para o curso. Opcional.
   * en-US: Selected Installment Table ID for the course. Optional.
   */
  parcelamento_id: z.string().optional(),
  obs: z.string().optional(),
  id_consultor: z.string().min(1, 'Selecione o consultor'),
  // Campos removidos temporariamente: tag, stage_id, funell_id
  // Campo novo opcional: valor gerado a partir de módulos do curso
  gera_valor: z.string().optional(),
  // Novo campo: identificador de situação da matrícula selecionada no formulário
  // New field: enrollment situation identifier selected from the form
  situacao_id: z.string().optional(),
  id_responsavel: z.string().optional(),
  orc_json: z.string().optional(),
  desconto: z.string().optional(),
  inscricao: z.string().optional(),
  subtotal: z.string().optional(),
  total: z.string().optional(),
  validade: z.string().optional(),
  // Novo campo do formulário para meta.texto_desconto
  // New form field backing meta.texto_desconto
  meta_texto_desconto: z.string().optional(),
  id: z.string().optional(),
});

type ProposalFormData = z.infer<typeof proposalSchema>;

/**
 * ProposalsCreate
 * pt-BR: Página para cadastro de propostas que antecedem a matrícula, enviando payload ao endpoint `/matriculas`.
 * en-US: Page to create proposals preceding enrollment, sending the payload to `/matriculas`.
 */
export default function ProposalsCreate() {
  const { toast } = useToast();
  const { user } = useAuth();
  /**
   * queryClient
   * pt-BR: Cliente do React Query para invalidar/atualizar cache sem refresh.
   * en-US: React Query client used to invalidate/update cache without refresh.
   */
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  // navState
  // pt-BR: Estado recebido via navegação contendo IDs do funil e da etapa.
  // en-US: Navigation state containing funnel and stage IDs.
  const navState = (location?.state || {}) as { returnTo?: string; funnelId?: string; stageId?: string };
  const [searchParams] = useSearchParams();
  const idClienteFromUrl = searchParams.get('id_cliente') || '';
  const [clientSearch, setClientSearch] = useState('');
  // Termos de busca para autocompletes
  // Search terms for autocompletes
  const [courseSearch, setCourseSearch] = useState('');
  const [consultantSearch, setConsultantSearch] = useState('');
  const [classSearch, setClassSearch] = useState('');
  // Responsável: controle de exibição e busca
  // Responsible: visibility toggle and search term
  const [showResponsible, setShowResponsible] = useState(false);
  const [responsibleSearch, setResponsibleSearch] = useState('');
  
  /**
   * finishAfterSaveRef
   * pt-BR: Sinaliza se o envio atual deve finalizar e retornar à página de origem.
   * en-US: Flags whether the current submission should finish and return to origin page.
   */
  const finishAfterSaveRef = useRef(false);
  /**
   * lastCreatedIdRef
   * pt-BR: Armazena o último ID criado para permitir abrir a visualização.
   * en-US: Stores the last created ID to allow opening the view page.
   */
  const lastCreatedIdRef = useRef<string>('');

  // Form setup
  const form = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      id_cliente: idClienteFromUrl || '',
      id_curso: '',
      id_turma: '',
      // pt-BR: Campo opcional para vincular uma tabela de parcelamento.
      // en-US: Optional field to link an installment table.
      parcelamento_id: '',
      obs: '',
      id_consultor: '',
      // tag, stage_id e funell_id removidos temporariamente
      // gera_valor inicia vazio; será definido quando usuário escolher a turma
      gera_valor: '',
      // pt-BR: Valor padrão vazio para situacao_id até o usuário selecionar.
      // en-US: Empty default for situacao_id until user selects.
      situacao_id: '',
      id_responsavel: user?.id || '',
      orc_json: '',
      desconto: '0,00',
      inscricao: '',
    subtotal: '',
    total: '',
    validade: '14',
    // Valor padrão vazio para meta.texto_desconto
    // Default empty value for meta.texto_desconto
    meta_texto_desconto: '',
    id: '',
  },
  });

  // Data sources
  const { data: clientsData, isLoading: isLoadingClients } = useClientsList(
    { per_page: 20, search: clientSearch || undefined },
    { enabled: !idClienteFromUrl }
  );
  const { data: clientDetailData } = useClientById(idClienteFromUrl, { enabled: !!idClienteFromUrl });
  const { data: consultantsData, isLoading: isLoadingConsultants } = useUsersList({ consultores: true, per_page: 20, sort: 'name', search: consultantSearch || undefined });
  // Responsáveis: clientes com permission_id = 8
  // Responsibles: clients filtered by permission_id = 8
  const { data: responsiblesData, isLoading: isLoadingResponsibles } = useClientsList({ per_page: 50, search: responsibleSearch || undefined, permission_id: 8 } as any);
  // Removido: fontes de dados para funis/etapas enquanto campos não são usados

  // Courses and classes
  // Cursos: busca remota com paginação
  // Courses: remote search with pagination
  const { data: courses, isLoading: isLoadingCourses } = useQuery({
    queryKey: ['courses', 'list', 200, courseSearch],
    queryFn: async () => coursesService.listCourses({ page: 1, per_page: 200, search: courseSearch || undefined } as any),
    staleTime: 5 * 60 * 1000,
  });
  const selectedCourseId = form.watch('id_curso');
  const selectedClientId = form.watch('id_cliente');
  // Turmas: busca remota filtrando por curso selecionado
  // Classes: remote search filtered by selected course
  const { data: classes, isLoading: isLoadingClasses } = useQuery({
    queryKey: ['classes', 'list', selectedCourseId, classSearch],
    queryFn: async () => turmasService.listTurmas({ page: 1, per_page: 200, search: classSearch || undefined, id_curso: selectedCourseId ? Number(selectedCourseId) : undefined } as any),
    enabled: !!selectedCourseId,
    staleTime: 5 * 60 * 1000,
  });

  /**
   * installmentsByCourse
   * pt-BR: Lista tabelas de parcelamento filtradas pelo curso selecionado.
   * en-US: Lists installment tables filtered by the selected course.
   */
  const { data: installmentsByCourse, isLoading: isLoadingInstallments } = useQuery({
    queryKey: ['installments', 'by-course', selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return { data: [], items: [] } as any;
      return installmentsService.list({ page: 1, per_page: 100, id_curso: selectedCourseId });
    },
    enabled: !!selectedCourseId,
    staleTime: 5 * 60 * 1000,
  });

  const clientsList = useMemo(() => (clientsData?.data || clientsData?.items || []), [clientsData]);
  // Mapeia clientes para opções do Combobox, incluindo descrição (email • telefone)
  const clientOptions = useComboboxOptions<any>(
    clientsList,
    'id',
    'name',
    undefined,
    (c: any) => {
      const email = c?.email || '';
      const phone = c?.config?.celular || c?.config?.telefone_residencial || '';
      return [email, phone].filter(Boolean).join(' • ');
    }
  );
  const consultantsList = useMemo(() => (consultantsData?.data || consultantsData?.items || []), [consultantsData]);
  const consultantOptions = useComboboxOptions<any>(
    consultantsList,
    'id',
    'name',
    undefined,
    (u: any) => {
      const email = u?.email || '';
      const phone = u?.config?.celular || u?.config?.telefone_comercial || u?.config?.telefone_residencial || '';
      return [email, phone].filter(Boolean).join(' • ');
    }
  );
  // Opções de responsáveis a partir de clientes com permission_id=8
  // Responsible options from clients with permission_id=8
  const responsiblesList = useMemo(() => (responsiblesData?.data || responsiblesData?.items || []), [responsiblesData]);
  const responsibleOptions = useComboboxOptions<any>(
    responsiblesList,
    'id',
    'name',
    undefined,
    (c: any) => {
      const email = c?.email || '';
      const phone = c?.config?.celular || c?.config?.telefone_residencial || '';
      return [email, phone].filter(Boolean).join(' • ');
    }
  );
  // Removido: listas de funis e etapas
  const coursesList = useMemo(() => (courses?.data || courses?.items || []), [courses]);
  const classesList = useMemo(() => (classes?.data || classes?.items || []), [classes]);
  const courseOptions = useComboboxOptions<any>(
    coursesList,
    'id',
    'titulo',
    undefined,
    (c: any) => {
      const nome = c?.nome || '';
      const valor = c?.valor ? `R$ ${c.valor}` : '';
      return [nome, valor].filter(Boolean).join(' • ');
    }
  );
  const classOptions = useComboboxOptions<any>(
    classesList,
    'id',
    'nome',
    undefined,
    (t: any) => {
      const inicio = t?.inicio || '';
      const fim = t?.fim || '';
      return [inicio && `Início: ${inicio}`, fim && `Fim: ${fim}`].filter(Boolean).join(' • ');
    }
  );

  /**
   * installmentOptions
   * pt-BR: Opções do Combobox para tabelas de parcelamento do curso.
   * en-US: Combobox options for the course's installment tables.
   */
  const installmentsList = useMemo(() => (installmentsByCourse?.data || installmentsByCourse?.items || []), [installmentsByCourse]);
  const installmentOptions = useComboboxOptions<any>(
    installmentsList,
    'id',
    'nome',
    undefined,
    (rec: any) => {
      const valor = rec?.valor ? `R$ ${rec.valor}` : '';
      return [valor].filter(Boolean).join(' ');
    }
  );

  /**
   * normalizeSituationsList
   * pt-BR: Normaliza a resposta do hook de situações de matrícula em uma lista simples.
   * en-US: Normalizes the enrollment situations hook response into a plain list.
   */
  function normalizeSituationsList(source: any): any[] {
    const list = source?.data || source?.items || source || [];
    return Array.isArray(list) ? list : [];
  }

  /**
   * useEnrollmentSituationsList
   * pt-BR: Busca a lista de situações de matrícula usando paginação fixa
   *        conforme solicitado (GET /situacoes-matricula?page=1&per_page=1).
   * en-US: Fetches enrollment situations list using fixed pagination
   *        as requested (GET /situacoes-matricula?page=1&per_page=1).
   */
  const { data: enrollmentSituationsData, isLoading: isLoadingEnrollmentSituations } =
    useEnrollmentSituationsList({ page: 1, per_page: 1 });
  const enrollmentSituations = useMemo(() => normalizeSituationsList(enrollmentSituationsData), [enrollmentSituationsData]);

  /**
   * selectedCourse
   * pt-BR: Deriva o objeto do curso selecionado para montar opções do SelectGeraValor.
   * en-US: Derives the selected course object to build SelectGeraValor options.
   */
  const selectedCourse = useMemo(() => {
    const id = selectedCourseId ? String(selectedCourseId) : '';
    const list = coursesList || [];
    return list.find((c: any) => String(c.id) === id);
  }, [coursesList, selectedCourseId]);

  /**
   * normalizeModuleForTipo4
   * pt-BR: Normaliza um módulo vindo de períodos (tipo=4) para o formato esperado
   *        pelo preview/Select, ajustando título e horas.
   * en-US: Normalizes a module coming from periods (type=4) into the format
   *        expected by preview/Select, fixing title and hours.
   */
  function normalizeModuleForTipo4(m?: any) {
    if (!m) return m;
    const titulo = m?.titulo || m?.nome || 'Módulo';
    const limite = String(m?.limite ?? m?.h_teoricas ?? '');
    const limite_pratico = String(m?.limite_pratico ?? m?.h_praticas ?? '');
    const valor = typeof m?.valor === 'number' ? String(m.valor) : String(m?.valor ?? '');
    return { ...m, titulo, limite, limite_pratico, valor };
  }

  /**
   * normalizeCourseForSelect
   * pt-BR: Quando o curso é tipo=4, mapeia cada módulo (período) para incluir
   *        campos `titulo`, `limite` e `limite_pratico`.
   * en-US: When course is type=4, maps each module (period) to include
   *        `titulo`, `limite`, and `limite_pratico` fields.
   */
  const selectedCourseNormalized = useMemo(() => {
    if (!selectedCourse) return selectedCourse;
    const isTipo4 = String(selectedCourse?.tipo ?? '') === '4';
    if (!isTipo4) return selectedCourse;
    const mods = Array.isArray(selectedCourse?.modulos) ? selectedCourse!.modulos : [];
    const modsNorm = mods.map((m: any) => normalizeModuleForTipo4(m));
    return { ...selectedCourse, modulos: modsNorm };
  }, [selectedCourse]);

  /**
   * selectedModule
   * pt-BR: Deriva o módulo selecionado a partir do valor de "gera_valor" (formato "preco::idx").
   * en-US: Derives selected module from "gera_valor" value (format "price::idx").
   */
  const selectedGeraValor = form.watch('gera_valor');
  const selectedModule = useMemo(() => {
    const idx = Number(String(selectedGeraValor || '').split('::')[1]);
    const mods: any[] = Array.isArray(selectedCourseNormalized?.modulos) ? selectedCourseNormalized!.modulos : [];
    return Number.isFinite(idx) && idx >= 0 ? mods[idx] : undefined;
  }, [selectedCourseNormalized, selectedGeraValor]);

  /**
   * selectedClient
   * pt-BR: Obtém informações básicas do cliente selecionado para exibir no cabeçalho da proposta.
   * en-US: Gets basic info about the selected client to show in the proposal header.
   */
  const selectedClient = useMemo(() => {
    // Prioriza detalhes do cliente quando id vem por URL
    if (clientDetailData && String(clientDetailData?.id || '') === String(selectedClientId || '')) {
      return clientDetailData as any;
    }
    const list = clientsList || [];
    const hit = list.find((c: any) => String(c.id) === String(selectedClientId || ''));
    return hit;
  }, [clientDetailData, clientsList, selectedClientId]);

  /**
   * normalizeMonetaryToPlain
   * pt-BR: Converte string monetária brasileira (ex.: "23.820,00") para um
   *        número em string com ponto decimal (ex.: "23820.00"). Caso não
   *        seja possível converter, retorna string vazia.
   * en-US: Converts Brazilian monetary string (e.g., "23.820,00") into a plain
   *        number string with dot decimal (e.g., "23820.00"). Returns empty
   *        string if conversion fails.
   */
  /**
   * normalizeMonetaryToPlain
   * pt-BR: Converte string monetária (com ou sem máscara) para número com ponto e 2 casas.
   * en-US: Converts a monetary string (masked or not) into a dot-decimal string with 2 decimals.
   */
  function normalizeMonetaryToPlain(input: string): string {
    const s = String(input || '').trim();
    if (!s) return '';
    return currencyRemoveMaskToString(s);
  }

  /**
   * formatCurrencyBRL
   * pt-BR: Formata número em BRL para exibição (ex.: "R$ 23.820,00").
   * en-US: Formats a number into BRL for display (e.g., "R$ 23.820,00").
   */
  function formatCurrencyBRL(value: number): string {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
    } catch {
      return `R$ ${(Number(value) || 0).toFixed(2)}`;
    }
  }

  /**
   * recalcTotal
   * pt-BR: Recalcula automaticamente o campo "total" como (subtotal + inscrição - desconto)
   *        utilizando valores normalizados. Se não for possível, mantém total
   *        igual ao subtotal.
   * en-US: Automatically recalculates the "total" field as (subtotal + enrollment - discount)
   *        using normalized values. If not possible, keeps total equal to subtotal.
   */
  /**
   * recalcTotal
   * pt-BR: Recalcula o campo "total" como (subtotal + inscrição - desconto) e aplica máscara BRL.
   * en-US: Recalculates "total" as (subtotal + enrollment - discount) and applies BRL mask.
   */
  function recalcTotal(sub: string, insc: string, desc: string) {
    const subNum = currencyRemoveMaskToNumber(sub || '');
    const inscNum = currencyRemoveMaskToNumber(insc || '');
    const descNum = currencyRemoveMaskToNumber(desc || '');
    const totNum = (subNum || 0) + (inscNum || 0) - (descNum || 0);
    const maskedTotal = formatCurrencyBRL(totNum);
    form.setValue('total', maskedTotal);
  }

  /**
   * computeValidityDate
   * pt-BR: Calcula e formata a data de validade somando N dias à data atual.
   *        Retorna uma string no formato brasileiro "dd/MM/yyyy" ou vazio se N inválido.
   * en-US: Computes and formats the validity end date by adding N days to today.
   *        Returns a string in Brazilian format "dd/MM/yyyy" or empty if N is invalid.
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
   * shouldShowInstallmentAndDiscountFields
   * pt-BR: Define se os campos "Tabela de Parcelamento" e "Texto de Desconto"
   *        devem ser exibidos. Mantido como false para ocultá-los temporariamente.
   * en-US: Controls whether "Installment Table" and "Discount Text" fields
   *        should be shown. Kept as false to temporarily hide them.
   */
  function shouldShowInstallmentAndDiscountFields(): boolean {
    return false;
  }

  // Observa mudanças em subtotal e desconto para atualizar total
  const subtotalWatched = form.watch('subtotal');
  const inscricaoWatched = form.watch('inscricao');
  const descontoWatched = form.watch('desconto');
  useEffect(() => {
    recalcTotal(subtotalWatched, inscricaoWatched, descontoWatched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotalWatched, inscricaoWatched, descontoWatched]);

  /**
   * handleGeraValorChange
   * pt-BR: Quando o usuário seleciona uma opção em "Gerar Valor", atualiza o
   *        campo do Select (gera_valor), preenche o campo "subtotal" com o preço
   *        escolhido e monta um orçamento mínimo (orc_json) com o módulo
   *        selecionado.
   * en-US: When the user selects an option in "Gerar Valor", updates the Select
   *        field (gera_valor), sets the "subtotal" with the chosen price, and
   *        builds a minimal budget (orc_json) including the selected module.
   */
  function handleGeraValorChange(val: string) {
    // Expect format "<price>::<idx>"; e.g., "23.820,00::1"
    form.setValue('gera_valor', val);
    const [price, idxStr] = String(val).split('::');
    const idx = Number(idxStr);

    // Atualiza subtotal com o preço escolhido (mascarado para exibição)
    const priceNormalized = normalizeMonetaryToPlain(price || '');
    const priceNumber = Number(priceNormalized || '0');
    form.setValue('subtotal', formatCurrencyBRL(priceNumber));

    // Monta orc_json mínimo contendo o módulo escolhido, se existir
    // Usamos lista normalizada para preview e lista original para persistência do orc_json
    const modsNorm: any[] = Array.isArray(selectedCourseNormalized?.modulos) ? selectedCourseNormalized!.modulos : [];
    const modsRaw: any[] = Array.isArray(selectedCourse?.modulos) ? selectedCourse!.modulos : [];
    const chosenNorm = Number.isFinite(idx) && idx >= 0 ? modsNorm[idx] : null;
    const chosenRaw = Number.isFinite(idx) && idx >= 0 ? modsRaw[idx] : null;
    if (chosenRaw) {
      const orc = {
        token: Math.random().toString(16).slice(2),
        id_curso: form.getValues('id_curso'),
        id_cliente: form.getValues('id_cliente'),
        campo_id: 'id',
        modulos: [chosenRaw],
      };
      try {
        form.setValue('orc_json', JSON.stringify(orc));
      } catch (_e) {
        // Em caso de falha de serialização, mantém campo orc_json intacto
      }
    }
  }

  // classOptionsWithFallback
  // pt-BR: Quando o curso selecionado não possui turmas, adiciona opção "Aguardar turma" (valor "0").
  // en-US: When the selected course has no classes, add a "Wait for class" option (value "0").
  const classOptionsWithFallback = useMemo(() => {
    const hasSelectedCourse = !!selectedCourseId;
    const list = classOptions || [];
    if (hasSelectedCourse && list.length === 0) {
      return [
        {
          value: '0',
          label: 'Aguardar turma',
          description: 'Sem turmas disponíveis para este curso',
        },
      ];
    }
    return list;
  }, [classOptions, selectedCourseId]);

  // Mutation
  const createEnrollment = useCreateEnrollment({
    /**
     * onSuccess
     * pt-BR: Após salvar, decide entre finalizar (voltar) ou continuar (abrir edição) usando o id retornado.
     * en-US: After saving, decides between finishing (go back) or continuing (open edit) using the returned id.
     */
    onSuccess: (result: any) => {
      /**
       * buildEditQueryParams
       * pt-BR: Monta query params para a página de edição (funnel, stage_id) a partir do estado de navegação.
       * en-US: Builds query params for the edit page (funnel, stage_id) from navigation state.
      */
      console.log('result', result);
      const qs = new URLSearchParams();
      if (navState?.funnelId) qs.set('funnel', String(navState.funnelId));
      if (navState?.stageId) qs.set('stage_id', String(navState.stageId));

      // Captura o ID retornado e guarda para "Ver detalhes"
      const idStr = String(result?.id ?? result?.data?.id ?? '');
      if (idStr) {
        lastCreatedIdRef.current = idStr;
      }

      // Fluxo “Salvar e Continuar”: abrir página de edição com o id da resposta
      if (!finishAfterSaveRef.current) {
        if (idStr) {
          const suffix = qs.toString() ? `?${qs.toString()}` : '';
          navigate(`/admin/sales/proposals/edit/${idStr}${suffix}`, {
            state: { returnTo: navState?.returnTo, funnelId: navState?.funnelId, stageId: navState?.stageId },
          });
          form.reset();
        } else {
          toast({ title: 'Sucesso', description: 'Proposta enviada, mas não foi possível obter o ID.' });
        }
        return;
      }

      // Fluxo “Salvar e Finalizar”: voltar para origem/lista
      try { queryClient.invalidateQueries(); } catch {}
      if (navState?.returnTo && typeof navState.returnTo === 'string') {
        navigate(navState.returnTo);
      } else if (navState?.funnelId) {
        navigate(`/admin/sales?funnel=${navState.funnelId}`);
      } else {
        navigate('/admin/sales');
      }
      form.reset();
    },
    onError: (error: any) => {
      /**
       * handleApiValidationErrors
       * pt-BR: Converte resposta de validação da API em erros de formulário e toast.
       * en-US: Converts API validation response into form errors and a toast.
       */
      const data = error?.response?.data || {};
      const apiMessage: string = data?.message || 'Erro de validação';
      const errorsObj: Record<string, string[] | string> = data?.errors || {};

      const collectedMsgs: string[] = [];
      if (errorsObj && typeof errorsObj === 'object') {
        Object.entries(errorsObj).forEach(([field, messages]) => {
          const firstMsg = Array.isArray(messages) ? String(messages[0] || '') : String(messages || '');
          if (firstMsg) {
            collectedMsgs.push(firstMsg);
            // pt-BR: Marca erro no campo correspondente (se existir no formulário).
            // en-US: Marks error on the corresponding field (if present in the form).
            try {
              form.setError(field as any, { type: 'server', message: firstMsg });
            } catch {}
          }
        });
      }

      const description = [apiMessage, ...collectedMsgs].filter(Boolean).join(' — ');
      toast({ title: 'Erro ao enviar proposta', description, variant: 'destructive' });
    },
  });

  /**
   * handleViewDetails
   * pt-BR: Abre a página de detalhes da proposta recém-criada, se houver ID disponível.
   * en-US: Opens the proposal details page for the last created record, if available.
   */
  function handleViewDetails() {
    const idStr = String(lastCreatedIdRef.current || '');
    if (!idStr) {
      toast({ title: 'Ação indisponível', description: 'Salve a proposta para habilitar a visualização.' });
      return;
    }
    const qs = new URLSearchParams();
    if (navState?.funnelId) qs.set('funnel', String(navState.funnelId));
    if (navState?.stageId) qs.set('stage_id', String(navState.stageId));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    navigate(`/admin/sales/proposals/view/${idStr}${suffix}`, {
      state: { returnTo: navState?.returnTo, funnelId: navState?.funnelId, stageId: navState?.stageId },
    });
  }

  /**
   * discountRows
   * pt-BR: Linhas de parcelamento (parcela, valor, desconto) utilizadas para montar
   *        `orc.parcelamento.linhas`. Na tela de criação ainda não há edição dessas linhas,
   *        portanto iniciamos como lista vazia para evitar erros de referência.
   * en-US: Installment rows (installments, value, discount) used to compose
   *        `orc.parcelamento.linhas`. Creation screen does not edit these rows yet,
   *        so we start with an empty list to avoid reference errors.
   */
  const discountRows: Array<{ parcela: string; valor: string; desconto: string }> = [];

  /**
   * buildPayload
   * pt-BR: Constrói o payload exatamente como a API espera, colocando
   *        "validade" e "gera_valor" dentro de "meta" e incluindo orc (JSON opcional).
   *        Inclui também "meta.gera_valor_preco" normalizado (string decimal),
   *        derivado do valor selecionado no Select (formato "preco::idx").
   * en-US: Builds the payload exactly as the API expects, placing
   *        "validade" and "gera_valor" inside "meta" and including optional orc JSON.
   *        Also includes normalized "meta.gera_valor_preco" (decimal string),
   *        derived from Select value (format "price::idx").
   */
  function buildPayload(values: ProposalFormData) {
    // Extrai preço do formato "preco::idx" e normaliza para string decimal
    const [rawPrice] = String(values.gera_valor || '').split('::');
    const geraValorPreco = currencyRemoveMaskToString(rawPrice || '') || '';
    const payload: any = {
      id_cliente: values.id_cliente,
      id_curso: values.id_curso,
      id_turma: values.id_turma,
      // pt-BR: Vincula a tabela de parcelamento selecionada (opcional)
      // en-US: Links the selected installment table (optional)
      parcelamento_id: values.parcelamento_id || '',
      obs: values.obs || '',
      id_consultor: values.id_consultor,
      // Removido: stage_id e funell_id
      // Removido: campo legado "situacao"; usamos somente situacao_id
      // pt-BR: Envia também o identificador da Situação selecionada no formulário
      // en-US: Also sends the identifier of the selected Situation from the form
      situacao_id: values.situacao_id || '',
      id_responsavel: values.id_responsavel || '',
      // Normaliza campos monetários para formato plain number string
      desconto: normalizeMonetaryToPlain(values.desconto || '0,00') || '0.00',
      inscricao: normalizeMonetaryToPlain(values.inscricao || '') || '0.00',
      subtotal: normalizeMonetaryToPlain(values.subtotal || '') || '',
      total: normalizeMonetaryToPlain(values.total || '') || '',
      // pt-BR: Envia meta com validade e gera_valor
      // en-US: Sends meta containing validade and gera_valor
      meta: {
        validade: values.validade,
        gera_valor: values.gera_valor,
        // pt-BR: Espelha também o parcelamento_id dentro de meta
        // en-US: Mirror parcelamento_id inside meta for backend consumption
        parcelamento_id: values.parcelamento_id,
        /**
         * meta.texto_desconto
         * pt-BR: Texto livre exibido junto ao desconto (opcional).
         * en-US: Free text displayed alongside discount (optional).
         */
        texto_desconto: values.meta_texto_desconto || '',
        // pt-BR: Preço normalizado (sem máscara), útil para processamento no backend
        // en-US: Normalized price (unmasked), useful for backend processing
        gera_valor_preco: geraValorPreco,
      },
      id: values.id || '',
    };

    // Removido: envio de tag[] temporariamente

    // orc como JSON opcional
    if (values.orc_json && values.orc_json.trim().length > 0) {
      try {
        const parsed = JSON.parse(values.orc_json);
        payload.orc = parsed;
      } catch (_e) {
        // se JSON inválido, ignora e avisa via toast
        /**
         * Toast de aviso padronizado
         * pt-BR: Usa título "Atenção" com descrição.
         * en-US: Uses title "Attention" with description.
         */
        toast({ title: 'Atenção', description: 'JSON de orçamento inválido. Campo ignorado.' });
      }
    } else {
      // Gera um orc mínimo com curso/cliente selecionados
      payload.orc = {
        token: Math.random().toString(16).slice(2),
        id_curso: values.id_curso,
        id_cliente: values.id_cliente,
        campo_id: 'id',
        modulos: [],
      };
    }

    /**
     * pt-BR: Monta objeto orc.parcelamento com os campos da UI:
     *        tabela selecionada, texto de desconto e linhas (parcelas/valor/desconto).
     * en-US: Builds orc.parcelamento with UI fields:
     *        selected table, discount text and lines (installments/value/discount).
     */
    /**
     * resolveShortcodes
     * pt-BR: Substitui shortcodes no HTML do texto de desconto por valores da linha ativa.
     * en-US: Replaces shortcodes in discount text HTML with values from the active row.
     */
    function resolveShortcodes(baseHtml: string, row: { parcela?: string; valor?: string; desconto?: string; parcelaComDesconto?: string } | null): string {
      const html = String(baseHtml || '');
      if (!row) return html;
      const totalParcStr = String(row.parcela || '');
      const valorParcelaStr = String(row.valor || '');
      const descPontualStr = String(row.desconto || '');
      const parcelaComDescStr = String(row.parcelaComDesconto || '');
      return html
        .replace(/\{total_parcelas\}/gi, totalParcStr)
        .replace(/\{valor_parcela\}/gi, valorParcelaStr)
        .replace(/\{desconto_pontualidade\}/gi, descPontualStr)
        .replace(/\{parcela_com_desconto\}/gi, parcelaComDescStr);
    }

    /**
     * activeRowForPreview
     * pt-BR: Seleciona a primeira linha válida e calcula parcela com desconto para preview.
     * en-US: Picks the first valid row and computes discounted installment for preview.
     */
    const activeRowForPreview = (() => {
      const row = (discountRows || []).find((r: any) => r?.parcela) || (discountRows || [])[0] || null;
      if (!row) return null;
      const valorNum = currencyRemoveMaskToNumber(String(row.valor || '')) || 0;
      const descontoNum = currencyRemoveMaskToNumber(String(row.desconto || '')) || 0;
      const parcelaComDescNum = valorNum > 0 ? Math.max(valorNum - descontoNum, 0) : 0;
      const parcelaComDescMasked = parcelaComDescNum > 0 ? formatCurrencyBRL(parcelaComDescNum) : '';
      return { parcela: String(row.parcela || ''), valor: String(row.valor || ''), desconto: String(row.desconto || ''), parcelaComDesconto: parcelaComDescMasked };
    })();

    /**
     * discountPreviewHtml
     * pt-BR: HTML do preview com shortcodes resolvidos, baseado na linha ativa.
     * en-US: Preview HTML with resolved shortcodes, based on the active row.
     */
    const discountPreviewHtml = resolveShortcodes(values.meta_texto_desconto || '', activeRowForPreview);

    const parcelamentoForOrc = {
      tabela_id: values.parcelamento_id || '',
      texto_desconto: values.meta_texto_desconto || '',
      /**
       * texto_preview_html
       * pt-BR: HTML do texto de desconto com shortcodes resolvidos a partir da linha ativa.
       * en-US: Discount text HTML with shortcodes resolved from the active row.
       */
      texto_preview_html: String(discountPreviewHtml || ''),
      linhas: (discountRows || []).map((r) => ({
        parcelas: String(r.parcela || ''),
        valor: currencyRemoveMaskToString(r.valor || '') || '',
        desconto: currencyRemoveMaskToString(r.desconto || '') || '',
      })),
    };
    payload.orc = { ...(payload.orc || {}), parcelamento: parcelamentoForOrc };
    return payload;
  }

  /**
   * onSubmit
   * pt-BR: Handler de envio — monta payload e usa createEnrollment para POST em `/matriculas`.
   * en-US: Submit handler — builds payload and uses createEnrollment to POST to `/matriculas`.
   */
  async function onSubmit(values: ProposalFormData) {
    const payload = buildPayload(values);
    // Tipos do hook aceitam CreateEnrollmentInput, fazemos cast para any para compatibilidade com a API real
    await createEnrollment.mutateAsync(payload as any);
  }

  /**
   * handleSaveContinue
   * pt-BR: Envia o formulário e permanece na página para continuar editando.
   * en-US: Submits the form and keeps the user on the page to continue.
   */
  function handleSaveContinue() {
    finishAfterSaveRef.current = false;
    form.handleSubmit(onSubmit)();
  }

  /**
   * handleSaveFinish
   * pt-BR: Envia o formulário e redireciona à página de origem, atualizando-a.
   * en-US: Submits the form and redirects to the origin page, refreshing it.
   */
  function handleSaveFinish() {
    finishAfterSaveRef.current = true;
    form.handleSubmit(onSubmit)();
  }

  /**
   * handleBack
   * pt-BR: Volta ao funil de vendas de origem, usando o estado de navegação.
   * en-US: Returns to the originating sales funnel, using navigation state.
   */
  function handleBack() {
    if (navState?.returnTo && typeof navState.returnTo === 'string') {
      navigate(navState.returnTo);
      return;
    }
    if (navState?.funnelId) {
      navigate(`/admin/sales?funnel=${navState.funnelId}`);
      return;
    }
    navigate('/admin/sales');
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center">
        <Button variant="ghost" size="sm" onClick={handleBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao funil
        </Button>
      </div>
      <Card>
        <CardHeader>
          {/*
           * HeaderWithToggle
           * pt-BR: Cabeçalho com título e botão para mostrar/ocultar o campo Responsável.
           * en-US: Header with title and button to toggle Responsible field visibility.
           */}
          <div className="flex items-center justify-between">
            <CardTitle>Nova Proposta</CardTitle>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setShowResponsible((s) => !s)}
              aria-label={showResponsible ? 'Ocultar Responsável' : 'Selecionar Responsável'}
            >
              {showResponsible ? 'Ocultar Responsável' : 'Selecionar Responsável'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Cliente */}
                <FormField
                  control={form.control}
                  name="id_cliente"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente *</FormLabel>
                      {idClienteFromUrl ? (
                        <div className="text-sm py-2 px-3 border rounded-md bg-muted/30">
                          {clientDetailData?.name ? String(clientDetailData.name) : `Cliente ${idClienteFromUrl}`}
                        </div>
                      ) : (
                        <Combobox
                          options={clientOptions}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Selecione o cliente"
                          searchPlaceholder="Pesquisar cliente pelo nome..."
                          emptyText={clientOptions.length === 0 ? 'Nenhum cliente encontrado' : 'Digite para filtrar'}
                          disabled={isLoadingClients}
                          loading={isLoadingClients}
                          onSearch={setClientSearch}
                          searchTerm={clientSearch}
                          debounceMs={250}
                        />
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Consultor */}
                <FormField
                  control={form.control}
                  name="id_consultor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Consultor *</FormLabel>
                      <Combobox
                        options={consultantOptions}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Selecione o consultor"
                        searchPlaceholder="Pesquisar consultor pelo nome..."
                        emptyText={consultantOptions.length === 0 ? 'Nenhum consultor encontrado' : 'Digite para filtrar'}
                        disabled={isLoadingConsultants}
                        loading={isLoadingConsultants}
                        onSearch={setConsultantSearch}
                        searchTerm={consultantSearch}
                        debounceMs={250}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Curso */}
                <FormField
                  control={form.control}
                  name="id_curso"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Curso *</FormLabel>
                      <Combobox
                        options={courseOptions}
                        value={field.value}
                        onValueChange={(val) => {
                          // Ao mudar o curso, limpamos a turma selecionada
                          // When changing course, clear selected class
                          field.onChange(val);
                          form.setValue('id_turma', '');
                          // Ao mudar o curso, limpamos parcelamento selecionado
                          // When changing course, clear selected installment table
                          form.setValue('parcelamento_id', '');
                        }}
                        placeholder="Selecione o curso"
                        searchPlaceholder="Pesquisar curso pelo nome..."
                        emptyText={courseOptions.length === 0 ? 'Nenhum curso encontrado' : 'Digite para filtrar'}
                        disabled={isLoadingCourses}
                        loading={isLoadingCourses}
                        onSearch={setCourseSearch}
                        searchTerm={courseSearch}
                        debounceMs={250}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Turma */}
                <FormField
                  control={form.control}
                  name="id_turma"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Turma *</FormLabel>
                      <Combobox
                        options={classOptionsWithFallback}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Selecione a turma"
                        searchPlaceholder="Pesquisar turma pelo nome..."
                        emptyText={
                          !selectedCourseId
                            ? 'Selecione um curso primeiro'
                            : classOptionsWithFallback.length === 0
                              ? 'Nenhuma turma encontrada'
                              : 'Digite para filtrar'
                        }
                        disabled={!selectedCourseId || isLoadingClasses}
                        loading={isLoadingClasses}
                        onSearch={setClassSearch}
                        searchTerm={classSearch}
                        debounceMs={250}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Tabela de Parcelamento */}
              {shouldShowInstallmentAndDiscountFields() && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="parcelamento_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tabela de Parcelamento</FormLabel>
                        <Combobox
                          options={installmentOptions}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Selecione a tabela de parcelamento"
                          searchPlaceholder="Pesquisar tabela pelo nome..."
                          emptyText={
                            !selectedCourseId
                              ? 'Selecione um curso primeiro'
                              : installmentOptions.length === 0
                                ? 'Nenhuma tabela encontrada'
                                : 'Digite para filtrar'
                          }
                          disabled={!selectedCourseId || isLoadingInstallments}
                          loading={isLoadingInstallments}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/**
               * Texto de Desconto
               * pt-BR: Campo de texto livre para adicionar observações sobre o desconto.
               *        Posicionado imediatamente abaixo de "Validade (dias)" e ocupa toda a largura.
               * en-US: Free text field to add notes about the discount.
               *        Placed right below "Validity (days)" and spans full width.
               */}
              {shouldShowInstallmentAndDiscountFields() && (
                <FormField
                  control={form.control}
                  name="meta_texto_desconto"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Texto de Desconto</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Digite um texto opcional para exibir junto ao desconto"
                          className="w-full"
                          value={field.value || ''}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Toggle button moved to header (above). */}

              {showResponsible && (
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="id_responsavel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Responsável</FormLabel>
                        <Combobox
                          options={responsibleOptions}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Selecione o responsável"
                          searchPlaceholder="Pesquisar responsável pelo nome..."
                          emptyText={responsibleOptions.length === 0 ? 'Nenhum responsável encontrado' : 'Digite para filtrar'}
                          disabled={isLoadingResponsibles}
                          loading={isLoadingResponsibles}
                          onSearch={setResponsibleSearch}
                          searchTerm={responsibleSearch}
                          debounceMs={250}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Campos de Funil e Etapa removidos temporariamente */}

              {/* Observações */}
              <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                <FormField
                  control={form.control}
                  name="obs"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observações</FormLabel>
                      <FormControl>
                        {/**
                         * pt-BR: Usa WYSIWYG para Observações, salvando HTML em `obs`.
                         * en-US: Use WYSIWYG for Observations, saving HTML into `obs`.
                         */}
                        <RichTextEditor
                          value={field.value || ''}
                          onChange={field.onChange}
                          placeholder="Digite qualquer observação"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* SelectGeraValor — renderiza quando turma selecionada */}
              {form.watch('id_turma') && (
                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                  <FormField
                    control={form.control}
                    name="gera_valor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gerar Valor</FormLabel>
                        <SelectGeraValor
                          course={selectedCourse}
                          value={field.value}
                          onChange={handleGeraValorChange}
                          name="gera_valor"
                          disabled={!selectedCourse}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* (relocado) Campo de Validade movido para a linha de Status/Total */}

              {/* Valores opcionais */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="desconto" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Desconto</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="R$ 0,00"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(currencyApplyMask(e.target.value, 'pt-BR', 'BRL'))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="inscricao" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inscrição</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="R$ 0,00"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(currencyApplyMask(e.target.value, 'pt-BR', 'BRL'))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="subtotal" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subtotal</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="R$ 0,00"
                        value={field.value || ''}
                        onChange={(e) => field.onChange(currencyApplyMask(e.target.value, 'pt-BR', 'BRL'))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="total" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="R$ 0,00"
                        value={field.value || ''}
                        readOnly
                        onChange={(e) => field.onChange(currencyApplyMask(e.target.value, 'pt-BR', 'BRL'))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                {/* Situação — substitui o antigo campo Status */}
                <FormField
                  control={form.control}
                  name="situacao_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Situação</FormLabel>
                      <Select value={field.value || ''} onValueChange={field.onChange} disabled={isLoadingEnrollmentSituations}>
                        <SelectTrigger className="w-full h-10">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {enrollmentSituations.map((s: any) => (
                            <SelectItem key={String(s?.id)} value={String(s?.id)}>
                              {s?.label || s?.name || s?.nome || s?.description || `Situação ${String(s?.id ?? '')}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {/* Validade (dias) — substitui o antigo campo ID (opcional) */}
                <FormField
                  control={form.control}
                  name="validade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Validade (dias)</FormLabel>
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full h-10">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="7">7</SelectItem>
                          <SelectItem value="14">14</SelectItem>
                          <SelectItem value="30">30</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Preview visual do orçamento (substitui o campo JSON) */}
              <BudgetPreview
                title="Proposta Comercial"
                clientName={selectedClient?.name || selectedClient?.nome || ''}
                clientId={selectedClient?.id ? String(selectedClient.id) : undefined}
                clientPhone={selectedClient?.config?.celular || selectedClient?.config?.telefone_residencial || ''}
                clientEmail={selectedClient?.email || ''}
                course={selectedCourseNormalized as any}
                module={normalizeModuleForTipo4(selectedModule) as any}
                discountLabel="Desconto de Pontualidade"
                discountAmountMasked={form.watch('desconto') || ''}
                subtotalMasked={form.watch('subtotal') || ''}
                totalMasked={form.watch('total') || ''}
                validityDate={computeValidityDate(form.watch('validade'))}
              />

              {/* Espaço para o rodapé fixo não cobrir o conteúdo */}
              <div className="h-16" />
            </form>
          </Form>
        </CardContent>
      </Card>
      {/* Rodapé fixo com ações */}
      <div className="fixed bottom-0 left-0 md:left-[var(--sidebar-width)] right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto py-3 flex flex-wrap items-center gap-2 justify-start">
          <Button type="button" variant="ghost" onClick={handleBack}>
            {/**
             * pt-BR: Ícone de seta para esquerda para o botão Voltar.
             * en-US: Left arrow icon for the Back button.
             */}
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <Button type="button" variant="outline" onClick={handleViewDetails} disabled={!lastCreatedIdRef.current}>
            {/**
             * pt-BR: Botão para ver detalhes da proposta criada.
             * en-US: Button to view details of the created proposal.
             */}
            <FileText className="h-4 w-4 mr-2" /> Ver detalhes
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button type="button" onClick={handleSaveContinue} disabled={createEnrollment.isPending}>
              {/**
               * pt-BR: Ícone de salvar para o fluxo “Salvar e Continuar”.
               * en-US: Save icon for the “Save and Continue” flow.
               */}
              <Save className="h-4 w-4 mr-2" /> Salvar e Continuar
            </Button>
            <Button type="button" onClick={handleSaveFinish} disabled={createEnrollment.isPending}>
              {/**
               * pt-BR: Ícone de confirmação para o fluxo “Salvar e Finalizar”.
               * en-US: Confirmation icon for the “Save and Finish” flow.
               */}
              <CheckCircle className="h-4 w-4 mr-2" /> Salvar e Finalizar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}