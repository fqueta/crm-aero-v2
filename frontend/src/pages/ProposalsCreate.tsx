import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { CONTRACT_SHORTCODES } from '@/lib/contractShortcodes';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
// Removido Select: campos de Funil/Etapa/Tag serão ocultados temporariamente
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useClientById, useClientsList } from '@/hooks/clients';
import { useResponsible, useResponsiblesList } from '@/hooks/responsaveis';
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
import { ArrowLeft, FileText, Save, CheckCircle, Plus, Pencil, User, Users, Layers, Wallet, Table as TableIcon, CircleDollarSign, MessageSquare, ArrowRight, Settings, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Combobox, useComboboxOptions } from '@/components/ui/combobox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

const DEFAULT_FUEL_TEXT = `<p>O custo estimado de combustível para esta proposta é de <strong>{valor}</strong>. É importante notar que este valor é uma estimativa e pode variar conforme os preços do combustível no momento do abastecimento. O cálculo final será baseado no preço vigente na data em que o combustível for abastecido, sendo assim, esse valor pode variar.</p>`;
import SelectGeraValor from '@/components/school/SelectGeraValor';
import { currencyApplyMask, currencyRemoveMaskToNumber, currencyRemoveMaskToString } from '@/lib/masks/currency';
import { phoneApplyMask, phoneRemoveMask } from '@/lib/masks/phone-apply-mask';
import { clientsService } from '@/services/clientsService';
import { responsaveisService } from '@/services/responsaveisService';
import BudgetPreview from '@/components/school/BudgetPreview';
import PaymentScheduleSection from '@/components/school/PaymentScheduleSection';
import { getParcelamentoProgramacao } from '@/lib/paymentSchedule';
import QuickResponsibleModal, { createEmptyQuickResponsibleData } from '@/components/proposals/QuickResponsibleModal';
import QuickTurmaModal from '@/components/school/QuickTurmaModal';

import { useAircraftList } from '@/hooks/aircraft';
import CourseModulesSelector from '@/components/school/CourseModulesSelector';

/**
 * ProposalFormData
 * pt-BR: Tipos do formulário de proposta. Todos os campos são strings para facilitar binding.
 * en-US: Proposal form types. All fields as strings for convenient binding.
 */
const proposalSchema = z.object({
  id_cliente: z.string().min(1, 'Selecione o cliente'),
  id_curso: z.string().min(1, 'Selecione o curso'),
  id_turma: z.string().optional().nullable(),
  /**
   * parcelamento_id
   * pt-BR: ID da Tabela de Parcelamento selecionada para o curso. Opcional.
   * en-US: Selected Installment Table ID for the course. Optional.
   */
  parcelamento_id: z.string().optional().nullable(),
  /**
   * Programação de pagamento
   * pt-BR: Parcela do financiamento + primeira parcela (valor/data) + dia do pagamento.
   * en-US: Financing installment + first installment (value/date) + due day.
   */
  parcela_selecionada: z.string().optional().nullable(),
  primeira_parcela_valor: z.string().optional().nullable(),
  primeira_parcela_data: z.string().optional().nullable(),
  dia_pagamento: z.string().optional().nullable(),
  recebimento_matricula: z.string().optional().nullable(),
  matricula_vencimento_data: z.string().optional().nullable(),
  vencimentos_personalizados: z.any().optional().nullable(),
  obs: z.string().optional().nullable(),
  id_consultor: z.string().optional().nullable(),
  // Campos removidos temporariamente: tag, stage_id, funell_id
  // Campo novo opcional: valor gerado a partir de módulos do curso
  gera_valor: z.string().optional().nullable(),
  // Novo campo: identificador de situação da matrícula selecionada no formulário
  // New field: enrollment situation identifier selected from the form
  situacao_id: z.string().optional().nullable(),
  id_responsavel: z.string().optional().nullable(),
  orc_json: z.string().optional().nullable(),
  desconto: z.string().optional().nullable(),
  // Campo para desconto específico da Etapa 1 (não persistido diretamente no model, mas via meta/orc)
  etapa1_desconto: z.any().optional().nullable(),
  inscricao: z.string().optional().nullable(),
  subtotal: z.string().optional().nullable(),
  total: z.string().optional().nullable(),
  validade: z.string().optional().nullable(),
  // Novo campo do formulário para meta.texto_desconto
  // New form field backing meta.texto_desconto
  meta_texto_desconto: z.string().optional().nullable(),
  meta_texto_combustivel: z.string().optional().nullable(),
  id: z.string().optional().nullable(),
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
  const [searchParams, setSearchParams] = useSearchParams();
  const idClienteFromUrl = searchParams.get('id_cliente') || '';
  /**
   * idCursoFromUrl
   * pt-BR: ID do curso pré-selecionado via query string (?id_curso=128).
   * en-US: Pre-selected course ID from query string (?id_curso=128).
   */
  const idCursoFromUrl = searchParams.get('id_curso') || '';
  const funnelFromUrl = searchParams.get('funnel') || '';
  const stageFromUrl = searchParams.get('stage_id') || searchParams.get('stage') || '';

  const effectiveFunnelId = navState?.funnelId || funnelFromUrl;
  const effectiveStageId = navState?.stageId || stageFromUrl;
  const effectiveReturnTo = navState?.returnTo || (effectiveFunnelId ? `/admin/sales?funnel=${effectiveFunnelId}` : undefined);

  const [activeTab, setActiveTab] = useState<'dados' | 'modulos' | 'pagamento' | 'preview'>(
    () => {
      const t = searchParams.get('tab');
      if (t === 'dados' || t === 'modulos' || t === 'pagamento' || t === 'preview') {
        return t;
      }
      return 'dados';
    }
  );

  const scrollToWizardTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      const el = document.getElementById('proposal-create-wizard-top');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch {
      window.scrollTo(0, 0);
    }
  };

  const handleTabChange = (val: string) => {
    setActiveTab(val as any);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', val);
      return next;
    }, { replace: true });
    scrollToWizardTop();
  };

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'dados' || t === 'modulos' || t === 'pagamento' || t === 'preview') {
      setActiveTab(t);
      scrollToWizardTop();
    }
  }, [searchParams]);

  const [isBudgetPreviewCollapsed, setIsBudgetPreviewCollapsed] = useState(false);
  const [isParcelamentoCollapsed, setIsParcelamentoCollapsed] = useState(false);

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
  const [localResponsibles, setLocalResponsibles] = useState<any[]>([]);
  const [proposalCurrency, setProposalCurrency] = useState<'BRL' | 'USD'>('BRL');


  
  /**
   * finishAfterSaveRef
   * pt-BR: Sinaliza se o envio atual deve finalizar e retornar à página de origem.
   * en-US: Flags whether the current submission should finish and return to origin page.
   */
  const finishAfterSaveRef = useRef(false);
  const nextTabOnSuccessRef = useRef<string>('');
  /**
   * lastCreatedIdRef
   * pt-BR: Armazena o último ID criado para permitir abrir a visualização.
   * en-US: Stores the last created ID to allow opening the view page.
   */
  const lastCreatedIdRef = useRef<string>('');
  
  // Quick Client Creation State
  const [isQuickClientOpen, setIsQuickClientOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickEmail, setQuickEmail] = useState('');
  const [quickPhone, setQuickPhone] = useState('');
  const [quickConsultantId, setQuickConsultantId] = useState(user?.id?.toString() || '');
  const [quickClientLoading, setQuickClientLoading] = useState(false);
  const [isQuickResponsibleOpen, setIsQuickResponsibleOpen] = useState(false);
  const [quickResponsibleData, setQuickResponsibleData] = useState(createEmptyQuickResponsibleData());
  const [quickResponsibleLoading, setQuickResponsibleLoading] = useState(false);
  const [isQuickTurmaOpen, setIsQuickTurmaOpen] = useState(false);

  const [isFuelTextOpen, setIsFuelTextOpen] = useState(false);

  const handleOpenFuelText = () => {
      const current = form.getValues('meta_texto_combustivel');
      if (!current) {
          form.setValue('meta_texto_combustivel', DEFAULT_FUEL_TEXT);
      }
      setIsFuelTextOpen(true);
  };

  /**
   * handleQuickClientSubmit
   * pt-BR: Cria um cliente de forma rápida e o seleciona no formulário.
   * en-US: Creates a client quickly and selects it in the form.
   */
  async function handleQuickClientSubmit() {
    if (!quickName.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório.', variant: 'destructive' });
      return;
    }
    // Validation for phone could be added here if needed, consistent with "New Lead" form
    const phoneClean = phoneRemoveMask(quickPhone);
    if (quickPhone && phoneClean.length < 10) {
         toast({ title: 'Erro', description: 'Telefone inválido.', variant: 'destructive' });
         return;
    }

    setQuickClientLoading(true);
    try {
      const payload: any = {
        name: quickName,
        email: quickEmail,
        celular: phoneClean,
        tipo_pessoa: 'pf',
        status: 'actived',
        // Associate consultant if selected
        autor: quickConsultantId || undefined, 
        // Campos obrigatórios mínimos para passar na validação do backend (se houver)
        // Minimum required fields to pass backend validation (if any)
        config: {
          celular: phoneClean
        },
      };
      
      const created = await clientsService.createClient(payload);
      
      // Atualiza o cache de lista de clientes para incluir o novo
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      
      // Seleciona o novo cliente no formulário
      // Selects the new client in the form
      // Pequeno delay para garantir que o cache invalidado propagou (embora invalidateQueries seja async)
      setTimeout(() => {
        form.setValue('id_cliente', String(created.id));
        setClientSearch(created.name); // Atualiza termo de busca para mostrar o novo cliente
        setIsQuickClientOpen(false);
        // Limpa campos
        setQuickName('');
        setQuickEmail('');
        setQuickPhone('');
        setQuickConsultantId('');
        toast({ title: 'Sucesso', description: `Cliente ${created.name} criado e selecionado.` });
      }, 200);

    } catch (error: any) {
      console.error(error);
      const data = error?.response?.data ?? error?.body;
      const apiMessage = (data && typeof data === 'object' && 'message' in data) ? String((data as any).message || '') : '';
      const errorsObj = (data && typeof data === 'object' && 'errors' in data) ? (data as any).errors : undefined;
      const collectedMsgs: string[] = [];
      if (errorsObj && typeof errorsObj === 'object') {
        Object.values(errorsObj).forEach((messages: any) => {
          if (Array.isArray(messages) && messages[0]) collectedMsgs.push(String(messages[0]));
          else if (typeof messages === 'string' && messages) collectedMsgs.push(messages);
        });
      }
      const msg = (collectedMsgs.filter(Boolean)[0]) || apiMessage || error?.message || 'Erro ao criar cliente.';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    } finally {
      setQuickClientLoading(false);
    }
  }

  /**
   * handleQuickResponsibleSubmit
   * pt-BR: Cria um responsável rapidamente pelo endpoint dedicado e o seleciona no formulário.
   * en-US: Quickly creates a guardian through the dedicated endpoint and selects it in the form.
   */
  async function handleQuickResponsibleSubmit() {
    if (!quickResponsibleData.name.trim()) {
      toast({ title: 'Erro', description: 'Nome é obrigatório.', variant: 'destructive' });
      return;
    }

    const phoneClean = phoneRemoveMask(quickResponsibleData.phone);
    const cpfClean = String(quickResponsibleData.cpf || '').replace(/\D/g, '');
    const cepClean = String(quickResponsibleData.cep || '').replace(/\D/g, '');
    if (quickResponsibleData.phone && phoneClean.length < 10) {
      toast({ title: 'Erro', description: 'Telefone inválido.', variant: 'destructive' });
      return;
    }
    if (cpfClean && cpfClean.length !== 11) {
      toast({ title: 'Erro', description: 'CPF inválido.', variant: 'destructive' });
      return;
    }

    setQuickResponsibleLoading(true);
    try {
      const payload: any = {
        name: quickResponsibleData.name,
        email: quickResponsibleData.email || undefined,
        cpf: cpfClean || undefined,
        tipo_pessoa: 'pf',
        genero: 'ni',
        status: 'actived',
        autor: form.getValues('id_consultor') || user?.id || undefined,
        config: {
          celular: phoneClean || undefined,
          nacionalidade: quickResponsibleData.nationality || undefined,
          profissao: quickResponsibleData.profession || undefined,
          estado_civil: quickResponsibleData.maritalStatus || undefined,
          identidade: quickResponsibleData.identity || undefined,
          rg: quickResponsibleData.identity || undefined,
          cep: cepClean || undefined,
          endereco: quickResponsibleData.address || undefined,
          numero: quickResponsibleData.number || undefined,
          complemento: quickResponsibleData.complement || undefined,
          bairro: quickResponsibleData.bairro || undefined,
          cidade: quickResponsibleData.city || undefined,
          uf: quickResponsibleData.state || undefined,
        },
      };

      const created = await responsaveisService.create(payload);

      const normalizedCreated = {
        ...created,
        config: typeof (created as any)?.config === 'string'
          ? (() => {
              try {
                return JSON.parse((created as any).config);
              } catch {
                return {};
              }
            })()
          : ((created as any)?.config || {}),
      };

      setLocalResponsibles((prev) => {
        const next = prev.filter((item) => String(item?.id) !== String(normalizedCreated.id));
        return [normalizedCreated, ...next];
      });
      queryClient.setQueryData(['responsaveis', 'detail', String(normalizedCreated.id)], normalizedCreated);
      await queryClient.invalidateQueries({ queryKey: ['responsaveis'] });

      setTimeout(() => {
        form.setValue('id_responsavel', String(normalizedCreated.id));
        setResponsibleSearch('');
        setShowResponsible(true);
        setIsQuickResponsibleOpen(false);
        setQuickResponsibleData(createEmptyQuickResponsibleData());
        toast({ title: 'Sucesso', description: `Responsável ${normalizedCreated.name} criado e selecionado.` });
      }, 200);
    } catch (error: any) {
      console.error(error);
      const data = error?.response?.data ?? error?.body;
      const apiMessage = (data && typeof data === 'object' && 'message' in data) ? String((data as any).message || '') : '';
      const errorsObj = (data && typeof data === 'object' && 'errors' in data) ? (data as any).errors : undefined;
      const collectedMsgs: string[] = [];
      if (errorsObj && typeof errorsObj === 'object') {
        Object.values(errorsObj).forEach((messages: any) => {
          if (Array.isArray(messages) && messages[0]) collectedMsgs.push(String(messages[0]));
          else if (typeof messages === 'string' && messages) collectedMsgs.push(messages);
        });
      }
      const msg = (collectedMsgs.filter(Boolean)[0]) || apiMessage || error?.message || 'Erro ao criar responsável.';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    } finally {
      setQuickResponsibleLoading(false);
    }
  }

  /**
   * handleCloseQuickResponsibleModal
   * pt-BR: Fecha o modal e limpa os dados temporarios do responsavel.
   * en-US: Closes the modal and clears temporary responsible data.
   */
  function handleCloseQuickResponsibleModal() {
    setIsQuickResponsibleOpen(false);
    setQuickResponsibleData(createEmptyQuickResponsibleData());
  }

  // Form setup
  const form = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      id_cliente: idClienteFromUrl || '',
      id_curso: idCursoFromUrl || '',

      id_turma: '',
      // pt-BR: Campo opcional para vincular uma tabela de parcelamento.
      // en-US: Optional field to link an installment table.
      parcelamento_id: '',
      // pt-BR: Programação de pagamento (vale para a matrícula).
      // en-US: Payment schedule (applies to the enrollment).
      parcela_selecionada: '',
      primeira_parcela_valor: '',
      primeira_parcela_data: '',
      dia_pagamento: '',
      recebimento_matricula: 'diluida',
      matricula_vencimento_data: '',
      vencimentos_personalizados: {},
      obs: '',
      id_consultor: user?.id ? String(user.id) : '',
      // tag, stage_id e funell_id removidos temporariamente
      // gera_valor inicia vazio; será definido quando usuário escolher a turma
      gera_valor: '',
      // pt-BR: Valor padrão vazio para situacao_id até o usuário selecionar.
      // en-US: Empty default for situacao_id until user selects.
      situacao_id: '',
      id_responsavel: '',
      orc_json: '',
      desconto: '0,00',
      inscricao: '',
    subtotal: '',
    total: '',
    validade: '14',
    // Valor padrão vazio para meta.texto_desconto
    // Default empty value for meta.texto_desconto
    meta_texto_desconto: '',
    meta_texto_combustivel: '',
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
  // Responsáveis: usar endpoint dedicado para listar e criar guardianes/responsáveis
  // Responsibles: use the dedicated endpoint to list and create guardians
  const { data: responsiblesData, isLoading: isLoadingResponsibles } = useResponsiblesList({ per_page: 50, search: responsibleSearch || undefined } as any);
  // Lista de todas as aeronaves para cálculo do curso tipo 2
  const { data: allAircraftData } = useAircraftList({ per_page: 200, active: true });
  const allAircraft = useMemo(() => {
    return Array.isArray(allAircraftData) ? allAircraftData : (allAircraftData as any)?.data || (allAircraftData as any)?.items || [];
  }, [allAircraftData]);

  // Removido: fontes de dados para funis/etapas enquanto campos não são usados
  // Pré-seleciona consultor com usuário logado, se ainda não houver valor
  useEffect(() => {
    const current = form.getValues('id_consultor');
    if (!current && user?.id) {
      form.setValue('id_consultor', String(user.id));
      if (!consultantSearch && user?.name) {
        setConsultantSearch(user.name);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

  /**
   * Pré-popula o campo de busca do curso quando vem da URL (?id_curso=X).
   * Assim o Combobox exibe o nome do curso selecionado em vez de ficar em branco.
   * Pre-populates the course search term from URL param so the Combobox shows the label.
   */
  useEffect(() => {
    if (!idCursoFromUrl) return;
    const coursesList: any[] =
      (courses as any)?.data ||
      (courses as any)?.items ||
      (Array.isArray(courses) ? courses : []);
    const found = coursesList.find((c: any) => String(c.id) === String(idCursoFromUrl));
    if (found) {
      const label = found.nome || found.titulo || '';
      if (label) setCourseSearch(label);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courses, idCursoFromUrl]);

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
  const consultantsList = useMemo(() => 
    (consultantsData?.data || consultantsData?.items || [])
    .filter((u: any) => {
      const p = Number(u?.permission_id) || 0;
      return p > 0 && p !== 7 && p !== 8 && p !== 5;
    }),
  [consultantsData]);
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
  const selectedResponsibleId = form.watch('id_responsavel');
  const { data: selectedResponsibleDetail } = useResponsible(String(selectedResponsibleId || ''), { enabled: !!selectedResponsibleId });
  // Opções de responsáveis usando o endpoint dedicado
  // Responsible options using the dedicated endpoint
  const responsiblesList = useMemo(() => {
    const apiList = (responsiblesData?.data || responsiblesData?.items || []);
    const merged = [...localResponsibles, ...apiList];
    return merged.filter((item, index, arr) => index === arr.findIndex((candidate) => String(candidate?.id) === String(item?.id)));
  }, [responsiblesData, localResponsibles]);
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
  const responsibleOptionsWithSelected = useMemo(() => {
    const exists = responsibleOptions.some((option) => option.value === String(selectedResponsibleId || ''));
    if (exists || !selectedResponsibleDetail) return responsibleOptions;
    const desc = [
      selectedResponsibleDetail?.email || '',
      selectedResponsibleDetail?.config?.celular || selectedResponsibleDetail?.config?.telefone_residencial || '',
    ].filter(Boolean).join(' • ');
    return [
      { value: String(selectedResponsibleDetail.id), label: String(selectedResponsibleDetail.name), description: desc },
      ...responsibleOptions,
    ];
  }, [responsibleOptions, selectedResponsibleDetail, selectedResponsibleId]);
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
  const installmentsList = useMemo(() => (installmentsByCourse?.data || installmentsByCourse?.items || []), [installmentsByCourse]);  const installmentOptions = useComboboxOptions<any>(
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
   * scheduleLines
   * pt-BR: Linhas da tabela de parcelamento selecionada (config.parcelas) para
   *        a Programação de Pagamento e o payload orc.parcelamento.linhas.
   * en-US: Rows of the selected installment table (config.parcelas) for the
   *        Payment Schedule and the orc.parcelamento.linhas payload.
   */
  const selectedParcelamentoId = form.watch('parcelamento_id');
  const scheduleLines = useMemo(() => {
    const table: any = (installmentsList || []).find((t: any) => String(t?.id) === String(selectedParcelamentoId || ''));
    const cfg = table?.config || {};
    const raw = cfg?.parcelas;
    const arr: any[] = Array.isArray(raw) ? raw : Object.values(raw || {});
    return arr
      .filter((p: any) => String(p?.parcela ?? '').trim() !== '')
      .map((p: any) => ({
        parcelas: String(p?.parcela ?? ''),
        valor: String(p?.valor ?? ''),
        desconto: String(p?.desconto ?? ''),
      }));
  }, [installmentsList, selectedParcelamentoId]);
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
   * pt-BR: Busca a lista de situações de matrícula ativas.
   * en-US: Fetches active enrollment situations list.
   */
  const { data: enrollmentSituationsData, isLoading: isLoadingEnrollmentSituations } =
    useEnrollmentSituationsList({ page: 1, per_page: 200, ativo: 's' });
  const enrollmentSituations = useMemo(() => normalizeSituationsList(enrollmentSituationsData), [enrollmentSituationsData]);

  // Define "Interessado" como padrão ao criar a proposta
  useEffect(() => {
    const current = form.getValues('situacao_id');
    if (!current && Array.isArray(enrollmentSituations) && enrollmentSituations.length > 0) {
      const interessado = enrollmentSituations.find(
        (s: any) => String(s?.slug || '').toLowerCase() === 'int' || 
                    String(s?.name || s?.label || s?.nome || '').toLowerCase().includes('interessad')
      );
      if (interessado?.id) {
        form.setValue('situacao_id', String(interessado.id));
      } else if (enrollmentSituations[0]?.id) {
        form.setValue('situacao_id', String(enrollmentSituations[0].id));
      }
    }
  }, [enrollmentSituations]);

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
   * getAircraftHourlyRate
   * pt-BR: Obtém o valor da hora da aeronave a partir dos pacotes configurados.
   * en-US: Gets the aircraft hourly rate from configured packages.
   */
  function getAircraftHourlyRate(aircraft: any): number {
    if (!aircraft?.pacotes) return 0;
    try {
        const pacotes = typeof aircraft.pacotes === 'string' ? JSON.parse(aircraft.pacotes) : aircraft.pacotes;
        // Pega o primeiro pacote disponível (geralmente "1")
        const firstPkgKey = Object.keys(pacotes)[0];
        if (!firstPkgKey) return 0;
        const pkg = pacotes[firstPkgKey];
        
        // Tenta encontrar o valor da hora em chaves comuns
        const keysToCheck = ['piloto-privado-aviao', 'instrutor-de-voo', 'hora-seca', 'custo_real'];
        for (const key of keysToCheck) {
            if (pkg[key]) {
                const val = currencyRemoveMaskToNumber(String(pkg[key]));
                if (val > 0) return val;
            }
        }
        return 0;
    } catch {
        return 0;
    }
  }

  // Efeito para preencher inscrição, subtotal e desconto automaticamente ao selecionar curso/turma
  useEffect(() => {
    if (selectedCourse) {
      const currentInscricao = form.getValues('inscricao');
      const currentSubtotal = form.getValues('subtotal');
      const currentDesconto = form.getValues('desconto');
      const courseInscricao = selectedCourse.inscricao || selectedCourse.valor_inscricao || 0;
      const courseValor = selectedCourse.valor || 0;
      const isTipo1 = String(selectedCourse?.tipo) === '1';
      
      // Preenchimento de Inscrição
      if (!currentInscricao || currentInscricao === 'R$ 0,00' || currentInscricao === '0,00' || isTipo1) {
          const valNum = typeof courseInscricao === 'number' 
            ? courseInscricao 
            : currencyRemoveMaskToNumber(String(courseInscricao));
          
          if (valNum >= 0) {
            form.setValue('inscricao', formatCurrencyBRL(valNum));
          }
      }

      // Preenchimento de Subtotal e Desconto para Tipo 1
      if (isTipo1) {
          const valNum = typeof courseValor === 'number' 
            ? courseValor 
            : currencyRemoveMaskToNumber(String(courseValor));
          
          if (valNum >= 0 && (!currentSubtotal || currentSubtotal === 'R$ 0,00' || currentSubtotal === '0,00')) {
            form.setValue('subtotal', formatCurrencyBRL(valNum));
          }

          if (!currentDesconto || currentDesconto === 'R$ 0,00') {
            form.setValue('desconto', 'R$ 0,00');
          }

          // Para tipo 1, gera um orc_json básico se não existir, para o preview funcionar
          const currentOrc = form.getValues('orc_json');
          if (!currentOrc || currentOrc === '' || currentOrc === '{}') {
            const orc = {
              token: Math.random().toString(16).slice(2),
              id_curso: String(selectedCourse.id),
              id_cliente: form.getValues('id_cliente'),
              campo_id: 'id',
              modulos: [
                {
                  titulo: selectedCourse.titulo || selectedCourse.nome || 'Curso',
                  valor: valNum,
                  limite: selectedCourse.duracao || 0,
                }
              ],
            };
            form.setValue('orc_json', JSON.stringify(orc));
          }
      }
    }
  }, [selectedCourseId, form.watch('id_turma'), selectedCourse]);

  /**
   * normalizeCourseForSelect
   * pt-BR: Quando o curso é tipo=4, mapeia cada módulo (período) para incluir
   *        campos `titulo`, `limite` e `limite_pratico`.
   *        Quando é tipo=2, normaliza módulos para permitir seleção de aeronave.
   * en-US: When course is type=4, maps each module (period) to include
   *        `titulo`, `limite`, and `limite_pratico` fields.
   *        When type=2, normalizes modules to allow aircraft selection.
   */
  const selectedCourseNormalized = useMemo(() => {
    if (!selectedCourse) return selectedCourse;
    const tipo = String(selectedCourse?.tipo ?? '');
    const isTipo4 = tipo === '4';
    const isTipo2 = tipo === '2';

    if (isTipo4) {
      const mods = Array.isArray(selectedCourse?.modulos) ? selectedCourse!.modulos : [];
      const modsNorm = mods.map((m: any) => normalizeModuleForTipo4(m));
      return { ...selectedCourse, modulos: modsNorm };
    }

    if (isTipo2) {
      const mods = Array.isArray(selectedCourse?.modulos) ? selectedCourse!.modulos : [];
      const modsNorm = mods.map((m: any) => ({
        ...m,
        titulo: m?.titulo || m?.nome || 'Módulo',
        // Para tipo 2, preserva o valor original se existir (ex: Etapa 1), senão null
        valor: m?.valor !== undefined && m?.valor !== null && m?.valor !== '' ? m.valor : null,
        limite: String(m?.limite || ''),
        aviao: m?.aviao || []
      }));
      return { ...selectedCourse, modulos: modsNorm };
    }

    return selectedCourse;
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
   * formatValueByProposalCurrency
   * pt-BR: Formata o valor monetário de acordo com a moeda selecionada na proposta.
   */
  function formatValueByProposalCurrency(value: number): string {
    if (proposalCurrency === 'USD') {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value) || 0);
    }
    return formatCurrencyBRL(value);
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

  const hasModulesTab = Boolean(form.watch('id_turma') && String(selectedCourse?.tipo) !== '1');

  /**
   * wizardSteps
   * pt-BR: Etapas dinâmicas do fluxo tipo wizard com seus respectivos rótulos, ícones e estados.
   * en-US: Dynamic wizard steps with their respective labels, icons and states.
   */
  const wizardSteps = useMemo(() => {
    const steps = [
      { id: 'dados' as const, label: 'Dados & Curso', description: 'Cliente, turma e observações', icon: User },
    ];
    if (hasModulesTab) {
      steps.push({ id: 'modulos' as const, label: 'Módulos & Preços', description: 'Grade de horas e aeronaves', icon: Layers });
    }
    steps.push(
      { id: 'pagamento' as const, label: 'Condições & Parcelamento', description: 'Valores, prazos e descontos', icon: Wallet },
      { id: 'preview' as const, label: 'Preview da Proposta', description: 'Revisão final antes de enviar', icon: FileText }
    );
    return steps;
  }, [hasModulesTab]);

  const currentStepIndex = wizardSteps.findIndex((s) => s.id === activeTab);
  const safeCurrentStepIndex = currentStepIndex === -1 ? 0 : currentStepIndex;
  const prevStep = safeCurrentStepIndex > 0 ? wizardSteps[safeCurrentStepIndex - 1] : null;
  const nextStep = safeCurrentStepIndex < wizardSteps.length - 1 ? wizardSteps[safeCurrentStepIndex + 1] : null;

  const handleNextStep = () => {
    if (nextStep) {
      const clienteId = form.getValues('id_cliente');
      const cursoId = form.getValues('id_curso');
      // Se os dados essenciais da proposta estão preenchidos, salva no backend e avança para a próxima etapa na edição
      if (clienteId && cursoId) {
        finishAfterSaveRef.current = false;
        nextTabOnSuccessRef.current = nextStep.id;
        form.handleSubmit(onSubmit, onInvalid)();
      } else {
        // Dispara validação dos campos obrigatórios
        form.handleSubmit(onSubmit, onInvalid)();
      }
    }
  };

  const handlePrevStep = () => {
    if (prevStep) {
      handleTabChange(prevStep.id);
    }
  };

  // Componente auxiliar para cards de métricas
  const StatCard = ({ label, value, icon: Icon, colorClass }: { label: string; value: string; icon: any; colorClass: string }) => (
    <div className="bg-white dark:bg-zinc-950 p-4 rounded-xl border shadow-sm flex items-center gap-4 transition-all hover:shadow-md">
      <div className={`p-3 rounded-lg ${colorClass} bg-opacity-10 dark:bg-opacity-20`}>
        <Icon className={`w-5 h-5 ${colorClass.replace('bg-', 'text-')}`} />
      </div>
      <div>
        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{label}</p>
        <p className="text-lg font-bold tracking-tight">{value || 'R$ 0,00'}</p>
      </div>
    </div>
  );

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
    const maskedTotal = formatValueByProposalCurrency(totNum);
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
   * handleModulesSelectionChange
   * pt-BR: Handler para o seletor de módulos (checklist). Atualiza subtotal e JSON.
   * en-US: Handler for module selector (checklist). Updates subtotal and JSON.
   */
  function handleModulesSelectionChange({ modules, total, etapa1Discount, currency, dollarRate, rateOverrides }: { modules: any[]; total: number; etapa1Discount: number; currency?: 'BRL' | 'USD'; dollarRate?: number; rateOverrides?: Record<string, { brl: number; usd: number }> }) {
    if (currency) setProposalCurrency(currency);
    form.setValue('subtotal', formatValueByProposalCurrency(total));
    // Salva o desconto da etapa 1 no estado do form para persistência
    form.setValue('etapa1_desconto', etapa1Discount);
    
    // Atualiza gera_valor com string dummy se houver seleção, para validação visual se necessário
    if (modules.length > 0) {
      form.setValue('gera_valor', 'multiple_modules');
    } else {
      form.setValue('gera_valor', '');
    }

    // Monta orc_json com todos os módulos selecionados
    if (modules.length > 0) {
      const orc = {
        token: Math.random().toString(16).slice(2),
        id_curso: form.getValues('id_curso'),
        id_cliente: form.getValues('id_cliente'),
        campo_id: 'id',
        modulos: modules,
        meta: {
            etapa1_desconto: etapa1Discount,
            currency: currency || 'BRL',
            dollarRate: dollarRate || 5.15,
            rateOverrides: rateOverrides || {}
        }
      };
      try {
        form.setValue('orc_json', JSON.stringify(orc));
      } catch {}
    } else {
      form.setValue('orc_json', '');
    }
  }

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
    form.setValue('gera_valor', val);
    const [price, idxStr] = String(val).split('::');
    const idx = Number(idxStr);

    // Se for tipo 2, usamos o CourseModulesSelector, então esta função não deve ser chamada para tipo 2
    // Mas por segurança mantemos um return vazio ou limpamos
    if (String(selectedCourse?.tipo) === '2') {
        return;
    }

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
    if (!hasSelectedCourse) return [];
    const list = classOptions || [];
    const aguardarOption = { value: '0', label: 'Aguardar turma', description: 'Aguardando abertura de turma / Sem turma definida' };
    if (!list.some(item => String(item.value) === '0')) {
      return [aguardarOption, ...list];
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
      if (effectiveFunnelId) qs.set('funnel', String(effectiveFunnelId));
      if (effectiveStageId) qs.set('stage_id', String(effectiveStageId));

      // Captura o ID retornado e guarda para "Ver detalhes"
      const idStr = String(result?.id ?? result?.data?.id ?? '');
      if (idStr) {
        lastCreatedIdRef.current = idStr;
      }

      // Fluxo “Salvar e Continuar” ou “Próximo”: abrir página de edição com o id da resposta
      if (!finishAfterSaveRef.current) {
        if (idStr) {
          const targetTab = nextTabOnSuccessRef.current || activeTab;
          if (targetTab) qs.set('tab', targetTab);
          const suffix = qs.toString() ? `?${qs.toString()}` : '';
          navigate(`/admin/sales/proposals/edit/${idStr}${suffix}`, {
            state: { returnTo: effectiveReturnTo, funnelId: effectiveFunnelId, stageId: effectiveStageId },
          });
          form.reset();
        } else {
          toast({ title: 'Sucesso', description: 'Proposta enviada, mas não foi possível obter o ID.' });
        }
        return;
      }

      // Fluxo “Salvar e Finalizar”: voltar para origem/lista
      try { queryClient.invalidateQueries(); } catch {}
      if (effectiveReturnTo && typeof effectiveReturnTo === 'string') {
        const url = new URL(effectiveReturnTo, window.location.origin);
        if (idStr) url.searchParams.set('highlight_matricula', idStr);
        navigate(url.pathname + url.search);
      } else if (effectiveFunnelId) {
        navigate(`/admin/sales?funnel=${effectiveFunnelId}`);
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
      funnel_id: effectiveFunnelId ? Number(effectiveFunnelId) : undefined,
      stage_id: effectiveStageId ? Number(effectiveStageId) : undefined,
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
        texto_combustivel: values.meta_texto_combustivel || '',
        // pt-BR: Preço normalizado (sem máscara), útil para processamento no backend
        // en-US: Normalized price (unmasked), useful for backend processing
        gera_valor_preco: geraValorPreco,
        // pt-BR: Persiste o desconto da Etapa 1
        // en-US: Persists Etapa 1 discount
        etapa1_desconto: values.etapa1_desconto || 0,
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
      /**
       * parcela_selecionada + programação de pagamento
       * pt-BR: Parcela do financiamento e 1ª parcela/dia (vale para a matrícula,
       * alimenta `{tabela_parcelas}` no contrato e a cobrança).
       */
      parcela_selecionada: values.parcela_selecionada || '',
      ...getParcelamentoProgramacao(values),
      /**
       * linhas
       * pt-BR: Na criação, as linhas vêm da tabela selecionada (config.parcelas),
       * para a validação cruzada do backend (selecionada ∈ linhas).
       */
      linhas: ((discountRows || []).length > 0 ? discountRows : scheduleLines).map((r: any) => ({
        parcelas: String(r.parcela || r.parcelas || ''),
        valor: currencyRemoveMaskToString(String(r.valor || '')) || '',
        desconto: currencyRemoveMaskToString(String(r.desconto || '')) || '',
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

  const onInvalid = (errors: any) => {
    console.error('Validation errors on create submit:', errors);
    const messages = Object.entries(errors)
      .map(([k, v]: [string, any]) => `${k}: ${v?.message || 'inválido'}`)
      .join(', ');

    if (errors.id_cliente || errors.id_curso || errors.id_turma || errors.id_responsavel) {
      handleTabChange('dados');
    } else if (errors.desconto || errors.inscricao || errors.subtotal || errors.validade || errors.parcelamento_id) {
      handleTabChange('pagamento');
    }

    toast({
      title: 'Atenção ao salvar proposta',
      description: messages || 'Verifique os campos obrigatórios da proposta.',
      variant: 'destructive',
    });
  };

  /**
   * handleSaveContinue
   * pt-BR: Envia o formulário e permanece na página para continuar editando.
   * en-US: Submits the form and keeps the user on the page to continue.
   */
  function handleSaveContinue() {
    finishAfterSaveRef.current = false;
    nextTabOnSuccessRef.current = '';
    form.handleSubmit(onSubmit, onInvalid)();
  }

  /**
   * handleSaveFinish
   * pt-BR: Envia o formulário e redireciona à página de origem, atualizando-a.
   * en-US: Submits the form and redirects to the origin page, refreshing it.
   */
  function handleSaveFinish() {
    finishAfterSaveRef.current = true;
    nextTabOnSuccessRef.current = '';
    form.handleSubmit(onSubmit, onInvalid)();
  }

  /**
   * handleBack
   * pt-BR: Volta à página de origem, priorizando:
   *   1. `navState.returnTo` (passado via `navigate(..., { state: { returnTo } })`)
   *   2. Funil de vendas via `navState.funnelId`
   *   3. Fallback para /admin/sales
   * en-US: Returns to the originating page, prioritizing:
   *   1. `navState.returnTo` (passed via navigate state)
   *   2. Sales funnel via `navState.funnelId`
   *   3. Fallback to /admin/sales
   */
  function handleBack() {
    if (effectiveReturnTo && typeof effectiveReturnTo === 'string') {
      navigate(effectiveReturnTo);
      return;
    }
    if (effectiveFunnelId) {
      navigate(`/admin/sales?funnel=${effectiveFunnelId}`);
      return;
    }
    navigate('/admin/sales');
  }

  /**
   * backLabel
   * pt-BR: Rótulo dinâmico do botão Voltar baseado na origem da navegação.
   * en-US: Dynamic label for the Back button based on navigation origin.
   */
  const backLabel = (() => {
    const returnTo = effectiveReturnTo;
    if (!returnTo) return 'Voltar ao funil';
    if (returnTo.includes('formation-control')) return 'Controle de Formação';
    if (returnTo.includes('school/enroll'))     return 'Matrículas';
    if (returnTo.includes('school/'))           return 'Escola';
    if (returnTo.includes('clients/'))          return 'Clientes';
    if (returnTo.includes('sales'))             return 'Vendas';
    return 'Voltar';
  })();


  // Modules list for preview (Type 2)
  const previewModules = useMemo(() => {
    try {
        const orcStr = form.watch('orc_json');
        const orc = JSON.parse(orcStr || '{}');
        if (Array.isArray(orc.modulos) && orc.modulos.length > 0) {
            return orc.modulos;
        }
    } catch {}
    return undefined;
  }, [form.watch('orc_json')]);

  return (
    <div className="container mx-auto py-3 space-y-3">
      {/* Cabeçalho Compacto: Botão Voltar + Título na mesma linha */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleBack}
            className="h-8 px-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold shrink-0"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> {backLabel}
          </Button>
          <div className="h-4 w-[1px] bg-border hidden sm:block" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">Nova Proposta</h1>
            <p className="text-xs text-muted-foreground hidden md:block">Configure os detalhes comerciais, prazos e condições do curso.</p>
          </div>
        </div>
      </div>

      <div className="px-0">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4">
            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
              {/* Wizard Header Sticky com Stepper e Barra de Progresso */}
              <div id="proposal-create-wizard-top" className="sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 border-b shadow-xs rounded-xl overflow-hidden">
                  {/* Barra de Progresso Fina no Topo */}
                  <div className="w-full h-1 bg-muted/80 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 transition-all duration-300 ease-out"
                      style={{ width: `${((safeCurrentStepIndex + 1) / wizardSteps.length) * 100}%` }}
                    />
                  </div>

                  <div className="px-4 sm:px-6 py-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* Stepper Interativo de Etapas */}
                    <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                      {wizardSteps.map((step, idx) => {
                        const Icon = step.icon;
                        const isCurrent = step.id === activeTab;
                        const isCompleted = idx < safeCurrentStepIndex;

                        return (
                          <React.Fragment key={step.id}>
                            <button
                              type="button"
                              onClick={() => handleTabChange(step.id)}
                              className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                                isCurrent
                                  ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                                  : isCompleted
                                  ? 'bg-muted/70 text-foreground border-border hover:bg-muted hover:border-zinc-300 dark:hover:border-zinc-700'
                                  : 'bg-background/50 text-muted-foreground border-transparent hover:bg-muted/40 hover:text-foreground'
                              }`}
                            >
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
                                  isCurrent
                                    ? 'bg-primary-foreground text-primary'
                                    : isCompleted
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-muted text-muted-foreground group-hover:bg-muted-foreground/20'
                                }`}
                              >
                                {isCompleted ? '✓' : idx + 1}
                              </div>
                              <span className="truncate max-w-[130px] sm:max-w-none">{step.label}</span>
                            </button>

                            {idx < wizardSteps.length - 1 && (
                              <div className="hidden sm:block text-muted-foreground/40 text-xs px-0.5">
                                →
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {/* Controles de Navegação Rápida do Wizard */}
                    <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handlePrevStep}
                        disabled={!prevStep}
                        className="h-8 text-xs px-2.5 rounded-lg"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                        <span className="hidden sm:inline">Anterior</span>
                      </Button>

                      {nextStep ? (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={handleNextStep}
                          className="h-8 text-xs px-2.5 rounded-lg font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                        >
                          <span>Próximo: {nextStep.label}</span>
                          <ArrowRight className="w-3.5 h-3.5 ml-1" />
                        </Button>
                      ) : (
                        <Badge variant="outline" className="h-8 px-2.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 text-[11px] font-semibold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          Etapa Final
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="px-2 sm:px-4 pt-4 pb-2">
                  {/* Aba 1: Dados do Cliente, Curso e Observações */}
                  <TabsContent value="dados" forceMount className={`space-y-8 ${activeTab !== 'dados' ? 'hidden' : ''}`}>
                    {/* Seção 1: Identificação */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <User className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Identificação e Status</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Cliente */}
                        <FormField
                          control={form.control}
                          name="id_cliente"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
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
                                  header={({ setOpen }) => (
                                    <Button 
                                      variant="ghost" 
                                      className="w-full justify-start h-auto py-2 px-2 text-primary hover:text-primary hover:bg-primary/10"
                                      onClick={() => {
                                        setIsQuickClientOpen(true);
                                        setOpen(false);
                                      }}
                                    >
                                      <Plus className="h-4 w-4 mr-2" />
                                      Criar Novo Cliente
                                    </Button>
                                  )}
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

                      {/* Situação */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
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
                      </div>
                    </div>

                    {/* Seção 2: Curso e Turma */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <Layers className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Configuração do Curso</h3>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                  field.onChange(val);
                                  form.setValue('id_turma', '');
                                  form.setValue('parcelamento_id', '');
                                  form.setValue('parcela_selecionada', '');
                                  form.setValue('primeira_parcela_valor', '');
                                  form.setValue('primeira_parcela_data', '');
                                  form.setValue('dia_pagamento', '');
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
                                header={({ setOpen }) => (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full justify-start h-auto py-2 px-2 text-primary hover:text-primary hover:bg-primary/10 text-xs font-medium"
                                    onClick={() => {
                                      setIsQuickTurmaOpen(true);
                                      setOpen(false);
                                    }}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Cadastrar Nova Turma
                                  </Button>
                                )}
                              />
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Responsável Adicional (Opcional) */}
                        <FormField
                          control={form.control}
                          name="id_responsavel"
                          render={({ field }) => (
                            <FormItem className="md:col-span-2">
                              <FormLabel>Responsável Adicional (Opcional)</FormLabel>
                              <Combobox
                                options={responsibleOptionsWithSelected}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="Selecione o responsável"
                                searchPlaceholder="Pesquisar responsável pelo nome..."
                                emptyText={responsibleOptionsWithSelected.length === 0 ? 'Nenhum responsável encontrado' : 'Digite para filtrar'}
                                disabled={isLoadingResponsibles}
                                loading={isLoadingResponsibles}
                                onSearch={setResponsibleSearch}
                                searchTerm={responsibleSearch}
                                debounceMs={250}
                                header={({ setOpen }) => (
                                  <Button
                                    variant="ghost"
                                    className="w-full justify-start h-auto py-2 px-2 text-primary hover:text-primary hover:bg-primary/10"
                                    onClick={() => {
                                      setIsQuickResponsibleOpen(true);
                                      setOpen(false);
                                    }}
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Cadastrar Novo Responsável
                                  </Button>
                                )}
                              />
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Seção 3: Observações Gerais */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Observações Gerais</h3>
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="obs"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <RichTextEditor
                                value={field.value || ''}
                                onChange={field.onChange}
                                placeholder="Digite observações internas ou comerciais... Digite { ou Shift+Espaço para ver os shortcodes."
                                enableShortcodeHints
                                shortcodes={CONTRACT_SHORTCODES}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                  </TabsContent>

                  {/* Aba 2: Módulos do Curso (se aplicável) */}
                  {hasModulesTab && (
                    <TabsContent value="modulos" forceMount className={`space-y-6 ${activeTab !== 'modulos' ? 'hidden' : ''}`}>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between border-b pb-3">
                          <div className="flex items-center gap-2">
                            <Layers className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Seleção de Módulos e Preços</h3>
                          </div>
                          {String(selectedCourse?.tipo) === '2' && (
                            <Button variant="ghost" size="sm" type="button" onClick={handleOpenFuelText}>
                              <Pencil className="w-3.5 h-3.5 mr-1" /> Editar Texto Combustível
                            </Button>
                          )}
                        </div>

                        {String(selectedCourse?.tipo) === '2' ? (
                          <CourseModulesSelector
                            course={selectedCourseNormalized}
                            aircrafts={allAircraft}
                            onChange={handleModulesSelectionChange}
                            getAircraftHourlyRate={getAircraftHourlyRate}
                            formatCurrencyBRL={formatCurrencyBRL}
                          />
                        ) : (
                          <FormField
                            control={form.control}
                            name="gera_valor"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>
                                  {selectedCourseNormalized?.tipo === '4' ? 'Selecionar período' : 'Gerar Valor'}
                                </FormLabel>
                                <SelectGeraValor
                                  course={selectedCourseNormalized}
                                  value={field.value}
                                  onChange={handleGeraValorChange}
                                  name="gera_valor"
                                  disabled={!selectedCourse}
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        
                        {/* Reprodução dos Ajustes Financeiros na Aba 2 */}
                        <div className="mt-6 pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
                          <div className="flex items-center gap-2">
                            <div className="h-3 w-1 bg-emerald-600 rounded-full"></div>
                            <h4 className="text-[11px] uppercase font-bold tracking-wider text-muted-foreground">Ajustes Financeiros e Taxas</h4>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-zinc-100/60 dark:bg-zinc-950/40 border border-zinc-200/80 dark:border-zinc-800/80">
                            {/* Desconto Input */}
                            <FormField control={form.control} name="desconto" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1.5 block">Valor do Desconto</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input
                                      className="pl-8 bg-white dark:bg-zinc-900"
                                      placeholder="R$ 0,00"
                                      value={field.value || ''}
                                      onChange={(e) => field.onChange(currencyApplyMask(e.target.value, 'pt-BR', 'BRL'))}
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono">R$</span>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                            
                            {/* Inscrição Input */}
                            <FormField control={form.control} name="inscricao" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1.5 block">Taxa de Inscrição</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input
                                      className="pl-8 bg-white dark:bg-zinc-900"
                                      placeholder="R$ 0,00"
                                      value={field.value || ''}
                                      onChange={(e) => field.onChange(currencyApplyMask(e.target.value, 'pt-BR', 'BRL'))}
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono">R$</span>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />

                            {/* Subtotal Input */}
                            <FormField control={form.control} name="subtotal" render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-1.5 block">Ajuste de Subtotal</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Input
                                      className="pl-8 bg-white dark:bg-zinc-900"
                                      placeholder="R$ 0,00"
                                      value={field.value || ''}
                                      onChange={(e) => field.onChange(currencyApplyMask(e.target.value, 'pt-BR', 'BRL'))}
                                    />
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono">R$</span>
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )} />
                          </div>
                        </div>
                      </div>

                    </TabsContent>
                  )}

                  {/* Aba 3: Condições Comerciais e Parcelamento */}
                  <TabsContent value="pagamento" forceMount className={`space-y-8 ${activeTab !== 'pagamento' ? 'hidden' : ''}`}>
                    {/* Seção 1: Resumo e Condições Financeiras */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 border-b pb-2">
                        <Wallet className="w-4 h-4 text-primary" />
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Resumo e Condições Financeiras</h3>
                      </div>

                      {/* Cards de Métricas */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                          label="Subtotal Bruto"
                          value={form.watch('subtotal')}
                          icon={CircleDollarSign}
                          colorClass="bg-blue-500 text-blue-500"
                        />
                        <StatCard
                          label="Taxa de Inscrição"
                          value={form.watch('inscricao')}
                          icon={TableIcon}
                          colorClass="bg-amber-500 text-amber-500"
                        />
                        <StatCard
                          label="Desconto Aplicado"
                          value={form.watch('desconto')}
                          icon={CircleDollarSign}
                          colorClass="bg-rose-500 text-rose-500"
                        />
                        <StatCard
                          label="Total Líquido"
                          value={form.watch('total')}
                          icon={Wallet}
                          colorClass="bg-emerald-500 text-emerald-500"
                        />
                      </div>

                      {/* Inputs Financeiros */}
                      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800">
                        {/* Desconto Input */}
                        <FormField control={form.control} name="desconto" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2 block">Valor do Desconto</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  className="pl-8"
                                  placeholder="R$ 0,00"
                                  value={field.value || ''}
                                  onChange={(e) => field.onChange(currencyApplyMask(e.target.value, 'pt-BR', 'BRL'))}
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono">R$</span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                        
                        {/* Inscrição Input */}
                        <FormField control={form.control} name="inscricao" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2 block">Taxa de Inscrição</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  className="pl-8"
                                  placeholder="R$ 0,00"
                                  value={field.value || ''}
                                  onChange={(e) => field.onChange(currencyApplyMask(e.target.value, 'pt-BR', 'BRL'))}
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono">R$</span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        {/* Subtotal Input */}
                        <FormField control={form.control} name="subtotal" render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2 block">Ajuste de Subtotal</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input
                                  className="pl-8"
                                  placeholder="R$ 0,00"
                                  value={field.value || ''}
                                  onChange={(e) => field.onChange(currencyApplyMask(e.target.value, 'pt-BR', 'BRL'))}
                                />
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs font-mono">R$</span>
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />

                        {/* Validade */}
                        <FormField
                          control={form.control}
                          name="validade"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2 block">Validade da Proposta</FormLabel>
                              <Select value={field.value || ''} onValueChange={field.onChange}>
                                <SelectTrigger className="w-full h-10 rounded-xl">
                                  <SelectValue placeholder="Selecione prazo..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="7">7 dias</SelectItem>
                                  <SelectItem value="14">14 dias</SelectItem>
                                  <SelectItem value="30">30 dias</SelectItem>
                                  <SelectItem value="60">60 dias</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Card de Gerenciamento de Parcelamento */}
                    {shouldShowInstallmentAndDiscountFields() && (
                      <Card>
                        <CardHeader 
                          className="flex flex-row items-center justify-between cursor-pointer group"
                          onClick={() => setIsParcelamentoCollapsed(!isParcelamentoCollapsed)}
                        >
                          <div className="flex items-center gap-2">
                            {isParcelamentoCollapsed ? <ChevronDown className="h-5 w-5 transition-transform" /> : <ChevronUp className="h-5 w-5 transition-transform" />}
                            <CardTitle>Gerenciamento de Parcelamento</CardTitle>
                          </div>
                        </CardHeader>
                        {!isParcelamentoCollapsed && (
                          <CardContent className="animate-in fade-in duration-300 space-y-6">
                            {/* Seleção de Tabela de Parcelamento */}
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

                            {/* Programação de Pagamento da matrícula */}
                            <PaymentScheduleSection
                              control={form.control}
                              setValue={form.setValue}
                              lines={scheduleLines}
                            />

                            {/* Texto de Desconto */}
                            <div className="space-y-2">
                              <FormField
                                control={form.control}
                                name="meta_texto_desconto"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>Texto de Desconto</FormLabel>
                                    <FormControl>
                                      <RichTextEditor
                                        placeholder="Digite um texto opcional para exibir junto ao desconto (suporta HTML). Digite { ou Shift+Espaço para ver os shortcodes."
                                        value={field.value || ''}
                                        onChange={field.onChange}
                                        enableShortcodeHints
                                        shortcodes={CONTRACT_SHORTCODES}
                                      />
                                    </FormControl>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            </div>
                          </CardContent>
                        )}
                      </Card>
                    )}

                  </TabsContent>

                  {/* Aba 4: Preview da Proposta Comercial */}
                  <TabsContent value="preview" forceMount className={`space-y-4 ${activeTab !== 'preview' ? 'hidden' : ''}`}>
                    <Card>
                      <CardHeader 
                        className="flex flex-row items-center justify-between cursor-pointer group"
                        onClick={() => setIsBudgetPreviewCollapsed(!isBudgetPreviewCollapsed)}
                      >
                        <div className="flex items-center gap-2">
                          {isBudgetPreviewCollapsed ? <ChevronDown className="h-5 w-5 transition-transform" /> : <ChevronUp className="h-5 w-5 transition-transform" />}
                          <CardTitle>Proposta Comercial (Preview)</CardTitle>
                        </div>
                      </CardHeader>
                      {!isBudgetPreviewCollapsed && (
                        <CardContent className="animate-in fade-in duration-300">
                          <BudgetPreview
                            title="Proposta Comercial"
                            clientName={selectedClient?.name || selectedClient?.nome || ''}
                            clientId={selectedClient?.id ? String(selectedClient.id) : undefined}
                            clientPhone={selectedClient?.config?.celular || selectedClient?.config?.telefone_residencial || ''}
                            clientEmail={selectedClient?.email || ''}
                            course={selectedCourseNormalized as any}
                            courseName={selectedCourseNormalized?.titulo || selectedCourseNormalized?.nome || ''}
                            turmaName={classOptionsWithFallback.find(t => String(t.value) === String(form.watch('id_turma')))?.label || ''}
                            module={normalizeModuleForTipo4(selectedModule) as any}
                            modules={previewModules}
                            discountLabel="Desconto"
                            discountAmountMasked={form.watch('desconto') || ''}
                            subtotalMasked={form.watch('subtotal') || ''}
                            totalMasked={form.watch('total') || ''}
                            validityDate={computeValidityDate(form.watch('validade'))}
                            validityDays={form.watch('validade')}
                            etapa1Discount={form.watch('etapa1_desconto') || 0}
                            inscricaoMasked={form.watch('inscricao') || ''}
                            fuelExternalText={form.watch('meta_texto_combustivel')}
                            parcelamento={{
                              linhas: scheduleLines.map((l: any) => ({ parcela: l.parcelas, valor: l.valor, desconto: l.desconto })),
                              texto_desconto: form.watch('meta_texto_desconto')
                            }}
                          />
                        </CardContent>
                      )}
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>

              <Dialog open={isFuelTextOpen} onOpenChange={setIsFuelTextOpen}>
                  <DialogContent className="max-w-3xl">
                      <DialogHeader>
                          <DialogTitle>Editar Texto de Estimativa de Combustível</DialogTitle>
                          <DialogDescription>
                              Personalize o texto exibido na seção de combustível. Use <strong>{'{valor}'}</strong> onde deseja que o valor calculado apareça.
                          </DialogDescription>
                      </DialogHeader>
                      <FormField
                          control={form.control}
                          name="meta_texto_combustivel"
                          render={({ field }) => (
                              <FormItem>
                                  <FormControl>
                                      <RichTextEditor
                                          value={field.value || ''}
                                          onChange={field.onChange}
                                          placeholder="Digite o texto personalizado. Digite { para ver os shortcodes."
                                          enableShortcodeHints
                                          shortcodes={CONTRACT_SHORTCODES}
                                      />
                                  </FormControl>
                              </FormItem>
                          )}
                      />
                      <DialogFooter>
                          <Button onClick={() => setIsFuelTextOpen(false)}>Concluir</Button>
                      </DialogFooter>
                  </DialogContent>
              </Dialog>

              {/* Espaço para o rodapé fixo não cobrir o conteúdo */}
              <div className="h-16" />
            </form>
          </Form>
        </div>
      {/* Rodapé fixo com ações e navegação do Wizard */}
      <div className="fixed bottom-0 left-0 md:left-[var(--sidebar-width)] right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 shadow-lg">
        <div className="container mx-auto py-2.5 px-4 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {/* Lado Esquerdo: Navegação de Etapas (Anterior / Contador), Ver Detalhes e Total */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-start">
            {/* Botão Anterior (se estiver na 1ª etapa, volta ao funil) */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={prevStep ? handlePrevStep : handleBack}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1" />
              <span>{prevStep ? 'Anterior' : backLabel}</span>
            </Button>

            <span className="text-xs text-muted-foreground font-medium px-1">
              {safeCurrentStepIndex + 1} de {wizardSteps.length}
            </span>

            {/* Botão Ver Detalhes (quando ID existir) */}
            {lastCreatedIdRef.current && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleViewDetails}
                className="h-8 px-2.5 text-xs border-blue-200 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
              >
                <FileText className="h-3.5 w-3.5 mr-1" /> Ver detalhes
              </Button>
            )}

            <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

            {/* Total Inline Discreto */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/60 text-xs">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                {form.watch('total') ? (typeof form.watch('total') === 'number' ? `R$ ${form.watch('total').toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : form.watch('total')) : 'R$ 0,00'}
              </span>
            </div>
          </div>

          {/* Lado Direito: Ações de Salvar e Avançar */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSaveContinue}
              disabled={createEnrollment.isPending}
              className="h-8 px-3 text-xs"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" /> Salvar e Continuar
            </Button>

            {nextStep ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={handleNextStep}
                disabled={createEnrollment.isPending}
                className="h-8 px-3.5 text-xs font-semibold shadow-xs"
              >
                <span>Próximo: {nextStep.label}</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleSaveFinish}
                disabled={createEnrollment.isPending}
                className="h-8 px-3.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs"
              >
                <CheckCircle className="h-3.5 w-3.5 mr-1.5" /> Salvar e Finalizar
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Criação Rápida de Cliente */}
      {isQuickClientOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIsQuickClientOpen(false)}>
          <div className="w-full max-w-[600px] bg-background rounded-lg shadow-lg border" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b">
               <div className="font-medium">Novo Cliente</div>
               <div className="text-xs text-muted-foreground">Preencha os dados básicos para cadastro rápido</div>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium mb-1.5 block">Nome completo *</label>
                  <Input 
                    value={quickName} 
                    onChange={(e) => setQuickName(e.target.value)} 
                    placeholder="Ex.: João da Silva"
                    className={!quickName.trim() ? '' : ''} // Simple validation visual if needed
                  />
                  {!quickName.trim() && (
                     <p className="text-[10px] text-muted-foreground mt-1">Nome é obrigatório</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block">Email</label>
                  <Input 
                    value={quickEmail} 
                    onChange={(e) => setQuickEmail(e.target.value)} 
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium mb-1.5 block">Telefone</label>
                  <Input 
                    value={quickPhone} 
                    onChange={(e) => setQuickPhone(phoneApplyMask(e.target.value))} 
                    placeholder="+55 (11) 99999-9999"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block">Consultor</label>
                  <Combobox
                    options={consultantOptions}
                    value={quickConsultantId}
                    onValueChange={setQuickConsultantId}
                    placeholder="Selecione um consultor"
                    searchPlaceholder="Pesquisar consultores..."
                    emptyText="Nenhum consultor encontrado."
                    loading={isLoadingConsultants}
                    onSearch={setConsultantSearch}
                    searchTerm={consultantSearch}
                  />
                </div>
              </div>
            </div>
            <div className="p-4 flex items-center justify-end gap-2 border-t bg-muted/20 rounded-b-lg">
              <Button variant="outline" onClick={() => setIsQuickClientOpen(false)} disabled={quickClientLoading}>
                Cancelar
              </Button>
              <Button onClick={handleQuickClientSubmit} disabled={quickClientLoading}>
                {quickClientLoading ? 'Criando...' : 'Criar Cliente'}
              </Button>
            </div>
          </div>
        </div>
      )}
      <QuickResponsibleModal
        open={isQuickResponsibleOpen}
        loading={quickResponsibleLoading}
        data={quickResponsibleData}
        onChange={setQuickResponsibleData}
        onClose={handleCloseQuickResponsibleModal}
        onSubmit={handleQuickResponsibleSubmit}
      />
      <QuickTurmaModal
        open={isQuickTurmaOpen}
        onOpenChange={setIsQuickTurmaOpen}
        idCurso={selectedCourseId}
        courseName={selectedCourse?.nome || selectedCourse?.titulo}
        onSuccess={(newTurma) => {
          if (newTurma?.id) {
            form.setValue('id_turma', String(newTurma.id), { shouldDirty: true, shouldValidate: true });
          }
        }}
      />
    </div>
  );
}
