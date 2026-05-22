import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useClientById, useClientsList } from '@/hooks/clients';
import { useResponsible, useResponsiblesList } from '@/hooks/responsaveis';
import { useUsersList, useUser } from '@/hooks/users';
import { useEnrollment, useUpdateEnrollment } from '@/hooks/enrollments';
import { useEnrollmentSituationsList } from '@/hooks/enrollmentSituations';
import { coursesService } from '@/services/coursesService';
import { turmasService } from '@/services/turmasService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { installmentsService } from '@/services/installmentsService';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Save, CheckCircle, Pencil, Plus, Trash2, ChevronDown, ChevronUp, CircleDollarSign, Wallet, Layers, Table as TableIcon, Info, MessageSquare, User, Users, Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import EditFooterBar from '@/components/ui/edit-footer-bar';

const DEFAULT_FUEL_TEXT = `<p>O custo estimado de combustível para esta proposta é de <strong>{valor}</strong>. É importante notar que este valor é uma estimativa e pode variar conforme os preços do combustível no momento do abastecimento. O cálculo final será baseado no preço vigente na data em que o combustível for abastecido, sendo assim, esse valor pode variar.</p>`;
import { Combobox, useComboboxOptions } from '@/components/ui/combobox';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import SelectGeraValor from '@/components/school/SelectGeraValor';
import { currencyApplyMask, currencyRemoveMaskToNumber, currencyRemoveMaskToString } from '@/lib/masks/currency';
import BudgetPreview from '@/components/school/BudgetPreview';
import { phoneApplyMask, phoneRemoveMask } from '@/lib/masks/phone-apply-mask';
import { cpfApplyMask } from '@/lib/masks/cpf-apply-mask';
import { cepApplyMask } from '@/lib/masks/cep-apply-mask';
import { responsaveisService } from '@/services/responsaveisService';
import QuickResponsibleModal, { createEmptyQuickResponsibleData } from '@/components/proposals/QuickResponsibleModal';

import { useAircraftList } from '@/hooks/aircraft';
import CourseModulesSelector from '@/components/school/CourseModulesSelector';

/**
 * ProposalEditSchema
 * pt-BR: Esquema do formulário de edição de proposta.
 * en-US: Schema for the proposal editing form.
 */
const proposalEditSchema = z.object({
  id_cliente: z.string().min(1, 'Selecione o cliente'),
  id_curso: z.string().min(1, 'Selecione o curso'),
  id_turma: z.string().min(1, 'Selecione a turma'),
  /**
   * parcelamento_id
   * pt-BR: ID da Tabela de Parcelamento selecionada para o curso (opcional).
   * en-US: Selected Installment Table ID for the course (optional).
   */
  parcelamento_id: z.string().optional(),
  obs: z.string().optional(),
  id_consultor: z.string().min(1, 'Selecione o consultor'),
  gera_valor: z.string().optional(),
  // pt-BR: Novo campo para vincular a situação via select (GET /situacoes-matricula)
  // en-US: New field to bind situation via select (GET /situacoes-matricula)
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
  meta_texto_combustivel: z.string().optional(),
  // Campo para desconto específico da Etapa 1 (não persistido diretamente no model, mas via meta/orc)
  etapa1_desconto: z.number().optional(),
  id: z.string().optional(),
});

type ProposalEditFormData = z.infer<typeof proposalEditSchema>;

/**
 * ProposalsEdit
 * pt-BR: Página para editar propostas existentes usando o endpoint `/matriculas/:id`.
 * en-US: Page to edit existing proposals using the `/matriculas/:id` endpoint.
 */
export default function ProposalsEdit() {
  const { toast } = useToast();
  const { user } = useAuth();
  /**
   * queryClient
   * pt-BR: Cliente do React Query para revalidar listagens ao finalizar sem refresh.
   * en-US: React Query client to revalidate listings on finish without full refresh.
   */
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const idClienteFromUrl = searchParams.get('id_cliente') || '';

  // navState
  // pt-BR: Estado recebido via navegação contendo rota de retorno.
  // en-US: Navigation state containing the return route.
  const navState = (location?.state || {}) as { returnTo?: string; funnelId?: string; stageId?: string };

  /**
   * finishAfterSaveRef
   * pt-BR: Controla se ao salvar deve finalizar e voltar à origem com atualização.
   * en-US: Controls whether to finish and go back to origin with refresh after saving.
   */
  const finishAfterSaveRef = useRef(false);

  // UI
  const [showResponsible, setShowResponsible] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const [consultantSearch, setConsultantSearch] = useState('');
  const [courseSearch, setCourseSearch] = useState('');
  const [classSearch, setClassSearch] = useState('');
  const [responsibleSearch, setResponsibleSearch] = useState('');
  const [localResponsibles, setLocalResponsibles] = useState<any[]>([]);
  const [proposalCurrency, setProposalCurrency] = useState<'BRL' | 'USD'>('BRL');
  const [isQuickResponsibleOpen, setIsQuickResponsibleOpen] = useState(false);
  const [quickResponsibleData, setQuickResponsibleData] = useState(createEmptyQuickResponsibleData());
  const [quickResponsibleLoading, setQuickResponsibleLoading] = useState(false);
  const [quickResponsibleEditId, setQuickResponsibleEditId] = useState<string | null>(null);

  const [isFuelTextOpen, setIsFuelTextOpen] = useState(false);
  const [isParcelamentoCollapsed, setIsParcelamentoCollapsed] = useState(false);
  const [isBudgetPreviewCollapsed, setIsBudgetPreviewCollapsed] = useState(false);

  const handleOpenFuelText = () => {
      const current = form.getValues('meta_texto_combustivel');
      if (!current) {
          form.setValue('meta_texto_combustivel', DEFAULT_FUEL_TEXT);
      }
      setIsFuelTextOpen(true);
  };

  /**
   * handleQuickResponsibleSubmit
   * pt-BR: Cria um responsável pelo endpoint dedicado e o seleciona no formulário de edição.
   * en-US: Creates a guardian through the dedicated endpoint and selects it in the edit form.
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
    setQuickResponsibleEditId(null);
    setQuickResponsibleData(createEmptyQuickResponsibleData());
  }

  /**
   * handleEditResponsible
   * pt-BR: Abre o modal de responsavel preenchido com os dados do responsavel ja selecionado.
   * en-US: Opens the responsible modal pre-filled with data from the already selected responsible.
   */
  async function handleEditResponsible(responsibleId: string) {
    const idToEdit = String(responsibleId || '').trim();
    if (!idToEdit) return;
    setQuickResponsibleLoading(true);
    try {
      const resp = await responsaveisService.getById(idToEdit);
      const config = typeof (resp as any)?.config === 'string'
        ? (() => { try { return JSON.parse((resp as any).config); } catch { return {}; } })()
        : ((resp as any)?.config || {});
      const cpfRaw = String((resp as any)?.cpf || '').replace(/\D/g, '');
      const phoneRaw = String(config?.celular || '').replace(/\D/g, '');
      setQuickResponsibleData({
        name: (resp as any)?.name || '',
        email: (resp as any)?.email || '',
        cpf: cpfRaw ? cpfApplyMask(cpfRaw) : '',
        nationality: config?.nacionalidade || 'Brasileira',
        profession: config?.profissao || '',
        maritalStatus: config?.estado_civil || '',
        identity: config?.identidade || config?.rg || '',
        cep: config?.cep ? cepApplyMask(String(config.cep)) : '',
        address: config?.endereco || '',
        number: config?.numero || '',
        complement: config?.complemento || '',
        bairro: config?.bairro || '',
        city: config?.cidade || '',
        state: config?.uf || '',
        phone: phoneRaw ? phoneApplyMask(phoneRaw) : '',
      });
      setQuickResponsibleEditId(idToEdit);
      setIsQuickResponsibleOpen(true);
    } catch (err) {
      toast({ title: 'Erro', description: 'Nao foi possivel carregar dados do responsavel.', variant: 'destructive' });
    } finally {
      setQuickResponsibleLoading(false);
    }
  }

  /**
   * handleQuickResponsibleUpdate
   * pt-BR: Atualiza o responsavel existente via PATCH e fecha o modal.
   * en-US: Updates the existing responsible via PATCH and closes the modal.
   */
  async function handleQuickResponsibleUpdate() {
    if (!quickResponsibleEditId) return;
    if (!quickResponsibleData.name.trim()) {
      toast({ title: 'Erro', description: 'Nome e obrigatorio.', variant: 'destructive' });
      return;
    }
    const phoneClean = phoneRemoveMask(quickResponsibleData.phone);
    const cpfClean = String(quickResponsibleData.cpf || '').replace(/\D/g, '');
    const cepClean = String(quickResponsibleData.cep || '').replace(/\D/g, '');
    setQuickResponsibleLoading(true);
    try {
      const payload: any = {
        name: quickResponsibleData.name,
        email: quickResponsibleData.email || undefined,
        cpf: cpfClean || undefined,
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
      const updated = await responsaveisService.update(quickResponsibleEditId, payload);
      await queryClient.invalidateQueries({ queryKey: ['responsaveis'] });
      queryClient.setQueryData(['responsaveis', 'detail', quickResponsibleEditId], updated);
      setIsQuickResponsibleOpen(false);
      setQuickResponsibleEditId(null);
      setQuickResponsibleData(createEmptyQuickResponsibleData());
      toast({ title: 'Sucesso', description: 'Responsavel atualizado com sucesso.' });
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Erro ao atualizar responsavel.';
      toast({ title: 'Erro', description: msg, variant: 'destructive' });
    } finally {
      setQuickResponsibleLoading(false);
    }
  }

  /**
   * form
   * pt-BR: Inicializa com valores padrão; dados carregados do servidor sobrescrevem abaixo.
   * en-US: Initializes with defaults; server-loaded data overrides below.
   */
  const form = useForm<ProposalEditFormData>({
    resolver: zodResolver(proposalEditSchema),
    defaultValues: {
      id_cliente: idClienteFromUrl || '',
      id_curso: '',
      id_turma: '',
      // pt-BR: Campo opcional para vincular uma tabela de parcelamento.
      // en-US: Optional field to link an installment table.
      parcelamento_id: '',
      obs: '',
      id_consultor: '',
      gera_valor: '',
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
      id: id || '',
    },
  });



  // Data sources
  const { data: clientsData, isLoading: isLoadingClients } = useClientsList(
    { per_page: 20, search: clientSearch || undefined },
    { enabled: !idClienteFromUrl }
  );
  const { data: clientDetailData } = useClientById(idClienteFromUrl, { enabled: !!idClienteFromUrl });
  // Consultores: amplia per_page para aumentar chance do consultor selecionado estar na lista
  // Consultants: widen per_page to increase chance the selected consultant is present
  const { data: consultantsData, isLoading: isLoadingConsultants } = useUsersList({ consultores: true, per_page: 200, sort: 'name', search: consultantSearch || undefined });
  const { data: responsiblesData, isLoading: isLoadingResponsibles } = useResponsiblesList({ per_page: 50, search: responsibleSearch || undefined } as any);
  // Lista de todas as aeronaves para cálculo do curso tipo 2
  const { data: allAircraftData } = useAircraftList({ per_page: 200, active: true });
  const allAircraft = useMemo(() => {
    return Array.isArray(allAircraftData) ? allAircraftData : (allAircraftData as any)?.data || (allAircraftData as any)?.items || [];
  }, [allAircraftData]);

  const { data: enrollment, isLoading: isLoadingEnrollment } = useEnrollment(String(id || ''), { enabled: !!id });

  // Hidrata a moeda a partir dos dados carregados
  useEffect(() => {
    if (enrollment?.orc?.meta?.currency) {
        setProposalCurrency(enrollment.orc.meta.currency);
    }
  }, [enrollment]);

  const { data: courses, isLoading: isLoadingCourses } = useQuery({
    queryKey: ['courses', 'list', 200, courseSearch],
    queryFn: async () => coursesService.listCourses({ page: 1, per_page: 200, search: courseSearch || undefined } as any),
    staleTime: 5 * 60 * 1000,
  });
  const selectedCourseId = form.watch('id_curso');
  const selectedClientId = form.watch('id_cliente');
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

  /**
   * installmentDetailQuery
   * pt-BR: Carrega detalhes da tabela de parcelamento selecionada, incluindo `config`.
   * en-US: Loads details of the selected installment table, including `config`.
   */
  const selectedInstallmentId = form.watch('parcelamento_id');
  const { data: installmentDetail } = useQuery({
    queryKey: ['installments', 'detail', selectedInstallmentId],
    queryFn: async () => {
      if (!selectedInstallmentId) return null;
      return installmentsService.getById(String(selectedInstallmentId));
    },
    enabled: !!selectedInstallmentId,
    staleTime: 2 * 60 * 1000,
  });

  /**
   * discountRows
   * pt-BR: Linhas da tabela de desconto (parcelas, valor por parcela, desconto de pontualidade).
   * en-US: Discount table rows (total parcels, per-parcel value, punctuality discount).
   */
  const [discountRows, setDiscountRows] = useState<Array<{ parcela: string; valor: string; desconto: string }>>([]);
  /**
   * activeRowIndex
   * pt-BR: Índice da linha de desconto ativa (apenas uma linha visível/selecionável).
   * en-US: Index of the active discount row (only one row visible/selectable).
   */
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);
  /**
   * textoDescontoDirty
   * pt-BR: Marca quando o usuário editou manualmente o Texto de Desconto, para evitar sobrescrever.
   * en-US: Tracks if the user manually edited the Discount Text, to avoid overwriting.
   */
  const [textoDescontoDirty, setTextoDescontoDirty] = useState<boolean>(false);
  /**
   * lastHydratedInstallmentId
   * pt-BR: Guarda o último parcelamento_id que usamos para hidratar linhas/texto, permitindo rehidratação a cada mudança.
   * en-US: Stores the last installment_id used to hydrate rows/text, enabling rehydration on each change.
   */
  const [lastHydratedInstallmentId, setLastHydratedInstallmentId] = useState<string | null>(null);
  
  /**
   * isCustomInstallmentModalOpen
   * pt-BR: Controla visibilidade do modal de edição da estrutura de parcelas.
   * en-US: Controls visibility of the installment structure editing modal.
   */
  const [isCustomInstallmentModalOpen, setIsCustomInstallmentModalOpen] = useState(false);
  const [tempDiscountRows, setTempDiscountRows] = useState<Array<{ parcela: string; valor: string; desconto: string }>>([]);

  /**
   * clampActiveRowIndexOnRowsChange
   * pt-BR: Garante que o índice ativo seja válido quando a lista de linhas muda.
   * en-US: Ensures the active index remains valid when the rows list changes.
   */
  useEffect(() => {
    if (activeRowIndex >= (discountRows?.length || 0)) {
      setActiveRowIndex(0);
    }
  }, [discountRows, activeRowIndex]);

  /**
   * hydrateDiscountFromInstallment
   * pt-BR: Ao selecionar uma tabela, preenche Texto de Desconto com `obs` e hidrata tabela a partir de `config.parcelas`.
   * en-US: When an installment is selected, fills Discount Text with `obs` and hydrates table from `config.parcelas`.
   */
  useEffect(() => {
    /**
     * hydrateDiscountFromInstallment (on selection change)
     * pt-BR: Rehidrata linhas e texto sempre que o `parcelamento_id` mudar, usando `installmentDetail.config`.
     *        Só atualiza o texto se o usuário não tiver editado manualmente.
     * en-US: Rehydrates rows and text whenever `parcelamento_id` changes, using `installmentDetail.config`.
     *        Updates text only if the user hasn’t manually edited it.
     */
    if (!installmentDetail) return;
    const currentId = String(selectedInstallmentId || '');
    if (!currentId) return;
    if (lastHydratedInstallmentId === currentId) return;
    const cfg = (installmentDetail as any)?.config || {};
    const parcelasCfgObj = cfg?.parcelas || {};
    const parcelasCfgArr: any[] = Array.isArray(parcelasCfgObj) ? parcelasCfgObj : Object.values(parcelasCfgObj || {});
    const rows = parcelasCfgArr.map((p: any) => ({
      parcela: String(p?.parcela ?? ''),
      valor: String(p?.valor ?? ''),
      desconto: String(p?.desconto ?? ''),
    }));
    setDiscountRows(rows);
    // pt-BR: Ajusta valor da parcela da linha ativa de acordo com Total, se disponível.
    // en-US: Adjust active row installment value according to Total, if available.
    try {
      const totalNum = currencyRemoveMaskToNumber(String(form.getValues('total') || '')) || 0;
      const parcStr = String(rows?.[activeRowIndex]?.parcela || '');
      const parcNum = Number(parcStr) || 0;
      const fromTotal = totalNum > 0 && parcNum > 0 ? (totalNum / parcNum) : 0;
      if (fromTotal > 0) {
        setDiscountRows((prev) => {
          const next = [...prev];
          if (next[activeRowIndex]) {
            next[activeRowIndex] = { ...next[activeRowIndex], valor: formatCurrencyBRL(fromTotal) };
          }
          return next;
        });
      }
    } catch {}
    const obsInstallment = String((installmentDetail as any)?.obs || '');
    const currentText = String(form.getValues('meta_texto_desconto') || '');
    if (!textoDescontoDirty) {
      if (obsInstallment && obsInstallment.trim().length > 0) {
        form.setValue('meta_texto_desconto', obsInstallment);
      } else if (Array.isArray(cfg?.tx2) && cfg.tx2.length > 0) {
        const html = cfg.tx2.map((it: any) => `<p><strong>${String(it?.name_label || '')}:</strong> ${String(it?.name_valor || '')}</p>`).join('');
        form.setValue('meta_texto_desconto', html);
      } else if (rows.length > 0 && (!currentText || currentText.trim() === '')) {
        const html = rows.map((r) => `<p>${r.parcela}x de ${r.valor} com desconto de pontualidade ${r.desconto}</p>`).join('');
        form.setValue('meta_texto_desconto', html);
      }
    }
    setLastHydratedInstallmentId(currentId);
  }, [installmentDetail, selectedInstallmentId, textoDescontoDirty, lastHydratedInstallmentId, form, activeRowIndex]);

  /**
   * situationsQuery
   * pt-BR: Carrega lista de Situações de Matrícula do endpoint '/situacoes-matricula'.
   * en-US: Loads Enrollment Situations list from '/situacoes-matricula' endpoint.
   */
  const { data: situationsData, isLoading: isLoadingSituations } = useEnrollmentSituationsList({ page: 1, per_page: 200 });

  /**
   * situationsList
   * pt-BR: Normaliza e memoiza a lista de situações de matrícula.
   * en-US: Normalizes and memoizes enrollment situations list.
   */
  const situationsList = useMemo(() => {
    const list = (situationsData as any)?.data || (situationsData as any)?.items || situationsData || [];
    return Array.isArray(list) ? list : [];
  }, [situationsData]);

  const clientsList = useMemo(() => (clientsData?.data || clientsData?.items || []), [clientsData]);
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
  /**
   * consultantsList
   * pt-BR: Lista de consultores vinda da API (paginada).
   * en-US: Consultants list from API (paginated).
   */
  const consultantsList = useMemo(() => 
    (consultantsData?.data || consultantsData?.items || [])
    .filter((u: any) => (Number(u?.permission_id) || 0) < 6), 
  [consultantsData]);
  /**
   * consultantOptions
   * pt-BR: Opções do combobox geradas a partir da lista de consultores.
   * en-US: Combobox options generated from consultants list.
   */
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

  /**
   * selectedConsultantId
   * pt-BR: Observa o valor selecionado/definido do consultor no formulário.
   * en-US: Watches the selected/loaded consultant value from the form.
   */
  const selectedConsultantId = form.watch('id_consultor');

  /**
   * selectedConsultantDetail
   * pt-BR: Busca detalhes do consultor selecionado (caso ele não esteja na página atual da lista).
   * en-US: Fetches details for the selected consultant (if not present in current list page).
   */
  const { data: selectedConsultantDetail } = useUser(String(selectedConsultantId || ''), { enabled: !!selectedConsultantId });

  /**
   * consultantOptionsWithSelected
   * pt-BR: Garante que o consultor carregado pela matrícula apareça nas opções, mesmo fora da paginação atual.
   * en-US: Ensures the enrollment’s consultant appears in options even if not in current pagination.
   */
  const consultantOptionsWithSelected = useMemo(() => {
    const exists = consultantOptions.some((o) => o.value === String(selectedConsultantId || ''));
    if (exists || !selectedConsultantDetail) return consultantOptions;
    const desc = [selectedConsultantDetail.email || '',
                  selectedConsultantDetail?.config?.celular || selectedConsultantDetail?.config?.telefone_comercial || selectedConsultantDetail?.config?.telefone_residencial || '']
                  .filter(Boolean).join(' • ');
    return [
      { value: String(selectedConsultantDetail.id), label: String(selectedConsultantDetail.name), description: desc },
      ...consultantOptions,
    ];
  }, [consultantOptions, selectedConsultantDetail, selectedConsultantId]);
  const selectedResponsibleId = form.watch('id_responsavel');
  const { data: selectedResponsibleDetail } = useResponsible(String(selectedResponsibleId || ''), { enabled: !!selectedResponsibleId });
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
   * selectedCourse
   * pt-BR: Deriva o curso selecionado para usar no SelectGeraValor e no preview.
   * en-US: Derives selected course for SelectGeraValor and preview.
   */
  const selectedCourse = useMemo(() => {
    const id = selectedCourseId ? String(selectedCourseId) : '';
    const list = coursesList || [];
    return list.find((c: any) => String(c.id) === id);
  }, [coursesList, selectedCourseId]);

  // Efeito para preencher inscrição, subtotal e desconto automaticamente ao selecionar curso/turma
  useEffect(() => {
    if (selectedCourse) {
      const currentInscricao = form.getValues('inscricao');
      const currentSubtotal = form.getValues('subtotal');
      const currentDesconto = form.getValues('desconto');
      const courseInscricao = selectedCourse.inscricao || selectedCourse.valor_inscricao || 0;
      const courseValor = selectedCourse.valor || 0;
      const isTipo1 = String(selectedCourse?.tipo) === '1';
      
      // pt-BR: Determina se devemos forçar o recarregamento dos valores do payload (tipo 1 e troca de turma)
      // en-US: Determines if we should force reload values from payload (type 1 and class change)
      const turmaChanged = enrollment && String(form.watch('id_turma')) !== String(enrollment.id_turma);
      const shouldForceReload = isTipo1 && turmaChanged;

      // Preenchimento de Inscrição
      if (!currentInscricao || currentInscricao === 'R$ 0,00' || currentInscricao === '0,00' || shouldForceReload) {
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
          
          if (valNum >= 0 && (shouldForceReload || !currentSubtotal || currentSubtotal === 'R$ 0,00' || currentSubtotal === '0,00')) {
            form.setValue('subtotal', formatCurrencyBRL(valNum));
          }

          if (shouldForceReload || !currentDesconto || currentDesconto === 'R$ 0,00') {
            form.setValue('desconto', 'R$ 0,00');
          }

          // Para tipo 1, gera um orc_json básico se não existir, para o preview funcionar
          const currentOrc = form.getValues('orc_json');
          if (shouldForceReload || !currentOrc || currentOrc === '' || currentOrc === '{}' || currentOrc === '{"modulos":[]}') {
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
            try {
              form.setValue('orc_json', JSON.stringify(orc), { shouldDirty: true, shouldValidate: true });
            } catch {}
          }
      }
    }
  }, [selectedCourseId, form.watch('id_turma'), selectedCourse, enrollment]);

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

  /**
   * normalizeModuleForTipo4
   * pt-BR: Normaliza módulo de períodos (tipo=4) para o formato esperado
   *        pelo preview/Select (título e horas).
   * en-US: Normalizes period-based module (type=4) into the expected format
   *        for preview/Select (title and hours).
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
   * selectedCourseNormalized
   * pt-BR: Para tipo=4, ajusta módulos para incluir `titulo`, `limite` e `limite_pratico`.
   *        Quando é tipo=2, normaliza módulos para permitir seleção de aeronave.
   * en-US: For type=4, adjusts modules to include `titulo`, `limite`, and `limite_pratico`.
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

  // Observa o orc_json para garantir reatividade na hidratação
  const orcJsonWatched = form.watch('orc_json');

  const initialEtapa1Discount = useMemo(() => {
    const orc = (enrollment as any)?.orc;
    return Number(orc?.meta?.etapa1_desconto || 0);
  }, [enrollment]);

  const initialDollarRate = useMemo(() => {
    const orc = (enrollment as any)?.orc;
    return Number(orc?.meta?.dollarRate || 5.15);
  }, [enrollment]);

  /**
   * initialRateOverrides
   * pt-BR: Hidrata os overrides de tarifa de aeronave salvos no orc_json (modo edição).
   * en-US: Hydrates aircraft rate overrides saved in orc_json (edit mode).
   */
  const initialRateOverrides = useMemo(() => {
    const orc = (enrollment as any)?.orc;
    return orc?.meta?.rateOverrides || undefined;
  }, [enrollment]);

  /**
   * initialCurrency
   * pt-BR: Hidrata a moeda salva no orc_json (modo edição).
   * en-US: Hydrates currency saved in orc_json (edit mode).
   */
  const initialCurrency = useMemo(() => {
    const orc = (enrollment as any)?.orc;
    const saved = orc?.meta?.currency;
    return (saved === 'BRL' || saved === 'USD') ? saved : undefined;
  }, [enrollment]);

  const initialType2Selections = useMemo(() => {
    // Tenta hidratar as seleções iniciais a partir do orc salvo no banco (apenas se for o mesmo curso)
    try {
        const enrollmentCourseId = String((enrollment as any)?.id_curso || '');
        const currentCourseId = String(selectedCourseNormalized?.id || '');

        if (enrollmentCourseId !== currentCourseId) return undefined;

        const orc = (enrollment as any)?.orc;
        if (!orc || !Array.isArray(orc.modulos)) return undefined;
        
        // ... (rest of the logic remains same, just ensuring it's clearly bounded)
        // [Existing logic follows]
          
          // Mapeia os módulos salvos para o formato esperado pelo seletor
          const modsNorm = Array.isArray(selectedCourseNormalized?.modulos) ? selectedCourseNormalized!.modulos : [];
          const selections: Record<number, any> = {};
          
          // Helper para normalizar strings para comparação
          const normalizeStr = (s: string) => s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : '';
          // Helper para extrair número da etapa (ex: "etapa2" -> "2")
          const extractStageNum = (s: any) => String(s || '').replace(/\D/g, '');

          // Cria um mapa de contadores para cada etapa do curso para rastrear qual índice dentro da etapa estamos processando
          // Isso é necessário porque o loop no orc.modulos pode não estar na mesma ordem do curso
          // Vamos fazer o inverso: iterar sobre os módulos do CURSO e ver se tem correspondente no ORC
          
          modsNorm.forEach((courseMod: any, courseIdx: number) => {
              // Tenta achar no ORC um módulo que corresponda a este do curso
              const courseTitle = normalizeStr(courseMod.titulo || courseMod.nome || '');
              const courseEtapaRaw = String(courseMod.etapa || '').toLowerCase().replace(/\s/g, '');
              const isEtapa1 = courseEtapaRaw.includes('etapa1') || courseEtapaRaw.includes('teoria');
              const courseStageNum = extractStageNum(courseEtapaRaw);
              
              // 1. Tenta por título exato (considerando a etapa)
              let foundInOrc = orc.modulos.find((savedMod: any) => {
                  const savedTitle = normalizeStr(savedMod.titulo || savedMod.nome || '');
                  const savedEtapaRaw = String(savedMod.etapa || '').toLowerCase().replace(/\s/g, '');
                  const savedStageNum = extractStageNum(savedEtapaRaw);
                  return savedTitle === courseTitle && (savedStageNum === courseStageNum || (isEtapa1 && (savedEtapaRaw.includes('etapa1') || savedEtapaRaw.includes('teoria'))));
              });

              // 2. Se não achou por título exato, tenta por fases numeradas (ex: "Fase 1")
              if (!foundInOrc && courseStageNum && !isEtapa1) {
                  const extractPhaseNum = (t: string) => {
                      const match = t.match(/fase\s*(\d+)/i);
                      return match ? match[1] : null;
                  };
                  
                  const coursePhaseNum = extractPhaseNum(courseTitle);
                  
                  if (coursePhaseNum) {
                      foundInOrc = orc.modulos.find((savedMod: any) => {
                          const savedTitle = normalizeStr(savedMod.titulo || savedMod.nome || '');
                          const savedPhaseNum = extractPhaseNum(savedTitle);
                          const savedStageNum = extractStageNum(savedMod.etapa || '');
                          return savedPhaseNum === coursePhaseNum && savedStageNum === courseStageNum;
                      });
                  }
              }

              // 3. Fallback posicional AGRESSIVO para Etapa 1 (Teórica)
              // Para Etapa 1, confiamos na ordem da lista se o título falhar, pois a estrutura teórica é rígida
              if (!foundInOrc && isEtapa1) {
                  const savedStageMods = orc.modulos.filter((m: any) => {
                      const et = String(m.etapa || '').toLowerCase().replace(/\s/g, '');
                      return et.includes('etapa1') || et.includes('teoria') || extractStageNum(et) === '1';
                  });
                  const courseStageMods = modsNorm.filter((m: any) => {
                      const et = String(m.etapa || '').toLowerCase().replace(/\s/g, '');
                      return et.includes('etapa1') || et.includes('teoria') || extractStageNum(et) === '1';
                  });
                  
                  const relativeIdx = courseStageMods.findIndex((m: any) => m === courseMod);
                  if (relativeIdx !== -1 && savedStageMods[relativeIdx]) {
                      foundInOrc = savedStageMods[relativeIdx];
                  }
              }

              // Se achou correspondência no ORC, ele está selecionado
              if (foundInOrc) {
                  const rawValor = foundInOrc.valor !== undefined && foundInOrc.valor !== null ? foundInOrc.valor : 0;
                  const price = typeof rawValor === 'number' 
                      ? rawValor 
                      : currencyRemoveMaskToNumber(String(rawValor));
                  
                  const aircraftId = String(foundInOrc.aircraft_id || foundInOrc.aviao_id || '');
                  
                  selections[courseIdx] = {
                      selected: true,
                      credits: Number(foundInOrc.limite || courseMod.limite || 0),
                      aircraftId: aircraftId && aircraftId !== 'undefined' && aircraftId !== 'null' ? aircraftId : '',
                      price: price
                  };
              }
          });
          
          return selections;
      } catch {
          return undefined;
      }
  }, [enrollment, selectedCourseNormalized]);

  const selectedGeraValor = form.watch('gera_valor');
  const selectedModule = useMemo(() => {
    const idx = Number(String(selectedGeraValor || '').split('::')[1]);
    const mods: any[] = Array.isArray(selectedCourseNormalized?.modulos) ? selectedCourseNormalized!.modulos : [];
    return Number.isFinite(idx) && idx >= 0 ? mods[idx] : undefined;
  }, [selectedCourseNormalized, selectedGeraValor]);

  // Módulo derivado da matrícula carregada (fallback quando não há seleção atual)
  const cursoTipoFromEnrollment = String((enrollment as any)?.curso_tipo || '');
  const moduleFromEnrollment = useMemo(() => computeModulo(enrollment as any, cursoTipoFromEnrollment), [enrollment, cursoTipoFromEnrollment]);

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

  const selectedClient = useMemo(() => {
    if (clientDetailData && String(clientDetailData?.id || '') === String(selectedClientId || '')) {
      return clientDetailData as any;
    }
    const list = clientsList || [];
    const hit = list.find((c: any) => String(c.id) === String(selectedClientId || ''));
    return hit;
  }, [clientDetailData, clientsList, selectedClientId]);

  /**
   * normalizeMonetaryToPlain
   * pt-BR: Converte string monetária para número com ponto e 2 casas.
   * en-US: Converts monetary string into dot-decimal string with 2 decimals.
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
   * pt-BR: Formata número em BRL.
   * en-US: Formats number in BRL.
   */
  function formatCurrencyBRL(value: number): string {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value) || 0);
    } catch {
      return `R$ ${(Number(value) || 0).toFixed(2)}`;
    }
  }

  /**
   * computeModulo
   * pt-BR: Retorna o módulo correto baseado no `curso_tipo` e no objeto `orc`.
   *        Para tipo 4, usa o primeiro item de `orc.modulos`; caso contrário, `orc.modulo`.
   * en-US: Returns the proper module based on `curso_tipo` and `orc` object.
   *        For type 4, uses first item of `orc.modulos`; otherwise, `orc.modulo`.
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

  /**
   * recalcTotal
   * pt-BR: Recalcula total como (subtotal + inscrição - desconto).
   * en-US: Recalculates total as (subtotal + enrollment - discount).
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

  const subtotalWatched = form.watch('subtotal');
  const inscricaoWatched = form.watch('inscricao');
  const descontoWatched = form.watch('desconto');
  useEffect(() => {
    recalcTotal(subtotalWatched, inscricaoWatched, descontoWatched);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotalWatched, inscricaoWatched, descontoWatched]);

  /**
   * handleModulesSelectionChange
   * pt-BR: Handler para o seletor de módulos (checklist) de curso Tipo 2. Atualiza subtotal e JSON.
   * en-US: Handler for Type 2 course module selector (checklist). Updates subtotal and JSON.
   */
  function handleModulesSelectionChange({ modules, total, etapa1Discount, currency, dollarRate, rateOverrides }: { modules: any[]; total: number; etapa1Discount: number; currency?: 'BRL' | 'USD'; dollarRate?: number; rateOverrides?: Record<string, { brl: number; usd: number }> }) {
    if (currency) setProposalCurrency(currency);
    form.setValue('subtotal', formatValueByProposalCurrency(total));
    form.setValue('etapa1_desconto', etapa1Discount);
    
    // Atualiza gera_valor com string dummy se houver seleção, para validação visual se necessário
    if (modules.length > 0) {
      form.setValue('gera_valor', 'multiple_modules');
    } else {
      form.setValue('gera_valor', '');
    }

    // Monta orc_json com todos os módulos selecionados
    if (modules.length > 0) {
      const currentOrcStr = form.getValues('orc_json') || '{}';
      let currentOrc: any = {};
      try {
        currentOrc = JSON.parse(currentOrcStr);
      } catch {}
      
      const orc = {
        ...currentOrc,
        token: currentOrc.token || Math.random().toString(16).slice(2),
        id_curso: form.getValues('id_curso'),
        id_cliente: form.getValues('id_cliente'),
        campo_id: 'id',
        modulos: modules,
        meta: {
            ...(currentOrc.meta || {}),
            etapa1_desconto: etapa1Discount,
            currency: currency || 'BRL',
            dollarRate: dollarRate || 5.15,
            rateOverrides: rateOverrides || {}
        }
      };
      try {
        form.setValue('orc_json', JSON.stringify(orc), { shouldDirty: true, shouldValidate: true });
      } catch {}
    } else {
      // Se não houver módulos, talvez devêssemos limpar orc_json ou manter metadados?
      // Mantendo lógica similar ao create, mas preservando token se existir
      const currentOrcStr = form.getValues('orc_json') || '{}';
      try {
        const currentOrc = JSON.parse(currentOrcStr);
        currentOrc.modulos = [];
        form.setValue('orc_json', JSON.stringify(currentOrc));
      } catch {
        form.setValue('orc_json', '');
      }
    }
  }

  /**
   * handleGeraValorChange
   * pt-BR: Atualiza campos ao escolher módulo/valor.
   * en-US: Updates fields when choosing module/value.
   */
  function handleGeraValorChange(val: string) {
    const idxStr = String(val).split('::')[1];
    const idx = Number(idxStr);

    // Se for tipo 2, usamos o CourseModulesSelector, então esta função não deve ser chamada para tipo 2
    if (String(selectedCourse?.tipo) === '2') {
        return;
    }

    form.setValue('gera_valor', val);
    const [price] = String(val).split('::');
    const priceNormalized = normalizeMonetaryToPlain(price || '');
    const priceNumber = Number(priceNormalized || '0');
    form.setValue('subtotal', formatCurrencyBRL(priceNumber));
    const modsNorm: any[] = Array.isArray(selectedCourseNormalized?.modulos) ? selectedCourseNormalized!.modulos : [];
    const modsRaw: any[] = Array.isArray(selectedCourse?.modulos) ? selectedCourse!.modulos : [];
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
        form.setValue('orc_json', JSON.stringify(orc), { shouldDirty: true, shouldValidate: true });
      } catch {}
    }
  }

  const classOptionsWithFallback = useMemo(() => {
    const hasSelectedCourse = !!selectedCourseId;
    const list = classOptions || [];
    if (hasSelectedCourse && list.length === 0) {
      return [{ value: '0', label: 'Aguardar turma', description: 'Sem turmas disponíveis para este curso' }];
    }
    return list;
  }, [classOptions, selectedCourseId]);

  const updateEnrollment = useUpdateEnrollment({
    onSuccess: () => {
      // pt-BR: Após salvar, decide se permanece na página ou finaliza e volta.
      // en-US: After saving, decides whether to stay or finish and go back.
      if (finishAfterSaveRef.current) {
        // pt-BR: Invalida o cache para que a listagem revalide ao retornar
        // en-US: Invalidate cache so listing revalidates upon return
        try { queryClient.invalidateQueries(); } catch {}
        if (navState?.returnTo && typeof navState.returnTo === 'string') {
          navigate(navState.returnTo);
        } else if (navState?.funnelId) {
          navigate(`/admin/sales?funnel=${navState.funnelId}`);
        } else {
            // Se não houver state, tenta voltar para o histórico (origem)
            // Se o histórico for vazio ou indefinido, vai para sales
            if (window.history.state && window.history.state.idx > 0) {
                 navigate(-1);
            } else {
                 navigate('/admin/sales');
            }
        }
      } else {
        /**
         * Toast de sucesso padronizado
         * pt-BR: Usa API de objeto do useToast.
         * en-US: Uses object-based API from useToast.
         */
        toast({ title: 'Sucesso', description: 'Proposta atualizada com sucesso!' });
      }
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
            // pt-BR: Marca erro no campo correspondente (se existir no formulário)
            // en-US: Marks error on the corresponding field (if present in the form)
            try {
              form.setError(field as any, { type: 'server', message: firstMsg });
            } catch {}
          }
        });
      }

      const description = [apiMessage, ...collectedMsgs].filter(Boolean).join(' — ');
      toast({ title: 'Erro ao atualizar proposta', description, variant: 'destructive' });
    },
  });

  /**
   * buildPayload
   * pt-BR: Constrói payload no formato aceito pela API.
   *        Inclui meta.validade, meta.gera_valor e meta.gera_valor_preco (string decimal),
   *        derivada do valor selecionado no Select (formato "preco::idx").
   * en-US: Builds payload in format accepted by the API.
   *        Includes meta.validade, meta.gera_valor, and meta.gera_valor_preco (decimal string),
   *        derived from Select value (format "price::idx").
   */
  function buildPayload(values: ProposalEditFormData) {
    // Extrai preço do formato "preco::idx" e normaliza para string decimal
    const [rawPrice] = String(values.gera_valor || '').split('::');
    const geraValorPreco = currencyRemoveMaskToString(rawPrice || '') || '';
    const payload: any = {
      id_cliente: values.id_cliente,
      id_curso: values.id_curso,
      id_turma: values.id_turma,
      // pt-BR: ID da tabela de parcelamento selecionada (opcional).
      // en-US: Selected installment table ID (optional).
      parcelamento_id: values.parcelamento_id || undefined,
      obs: values.obs || '',
      id_consultor: values.id_consultor,
      // pt-BR: Envia também o campo "gera_valor" para persistir a escolha do módulo/valor
      // en-US: Also sends "gera_valor" to persist the chosen module/price
      
      id_responsavel: values.id_responsavel || '',
      desconto: normalizeMonetaryToPlain(values.desconto || '0,00') || '0.00',
      inscricao: normalizeMonetaryToPlain(values.inscricao || '') || '0.00',
      subtotal: normalizeMonetaryToPlain(values.subtotal || '') || '',
      total: normalizeMonetaryToPlain(values.total || '') || '',
      // pt-BR: Envia o novo campo situacao_id conforme seleção do usuário
      // en-US: Sends the new situacao_id field as selected by the user
      situacao_id: values.situacao_id ? String(values.situacao_id) : undefined,
      // pt-BR: Envia a validade (em dias) conforme valor do formulário
      // en-US: Sends validity (in days) as provided by the form
      meta: {
        validade: values.validade,
        gera_valor: values.gera_valor,
        /**
         * meta.texto_desconto
         * pt-BR: Texto livre exibido junto ao desconto (opcional).
         * en-US: Free text displayed alongside discount (optional).
         */
        texto_desconto: values.meta_texto_desconto || '',
        texto_combustivel: values.meta_texto_combustivel || '',
        // pt-BR: Preço normalizado (sem máscara) para facilitar consumo no backend
        // en-US: Normalized price (unmasked) to ease backend consumption
        gera_valor_preco: geraValorPreco,
        /**
         * meta.parcelamento_id
         * pt-BR: Espelho do ID da tabela de parcelamento (opcional).
         * en-US: Mirror of installment table ID (optional).
         */
        parcelamento_id: values.parcelamento_id,
        // pt-BR: Persiste o desconto da Etapa 1
        // en-US: Persists Etapa 1 discount
        etapa1_desconto: values.etapa1_desconto || 0,
      },
      id: values.id || '',
    };
    /**
     * pt-BR: Constrói/recupera o campo "orc" e injeta os dados de parcelamento.
     * en-US: Builds/recovers "orc" and injects the installment management data.
     */
    if (values.orc_json && values.orc_json.trim().length > 0) {
      try {
        const parsed = JSON.parse(values.orc_json);
        payload.orc = parsed;
      } catch {
        toast({ title: 'Atenção', description: 'JSON de orçamento inválido. Campo ignorado.' });
      }
    }
    // pt-BR: Se não houver orc válido, gera um orc mínimo para receber parcelamento.
    // en-US: If no valid orc exists, generate a minimal one to hold installment data.
    if (!payload.orc) {
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
     * parcelamentoForOrc
     * pt-BR: Persistir apenas a linha selecionada (ativa) para a proposta.
     * en-US: Persist only the selected (active) line for the proposal.
     */
    const activeRow = (discountRows || [])[activeRowIndex] || null;
    // pt-BR: Filtra linhas totalmente vazias ou sem parcela definida antes de salvar
    const filteredRows = (discountRows || []).filter(row => {
      return String(row.parcela || '').trim() !== '' || 
             String(row.valor || '').trim() !== '' || 
             String(row.desconto || '').trim() !== '';
    });
    const parcelamentoForOrc = {
      tabela_id: values.parcelamento_id || '',
      texto_desconto: values.meta_texto_desconto || '',
      /**
       * parcela_selecionada
       * pt-BR: Armazena qual das linhas foi a escolhida pelo usuário.
       * en-US: Stores which of the lines was chosen by the user.
       */
      parcela_selecionada: activeRow ? String(activeRow.parcela || '') : '',
      /**
       * texto_preview_html
       * pt-BR: HTML do texto de desconto com shortcodes resolvidos a partir da linha ativa.
       * en-US: Discount text HTML with shortcodes resolved from the active row.
       */
      texto_preview_html: String(discountPreviewHtml || ''),
      /**
       * linhas
       * pt-BR: Persiste todas as opções de parcelamento (as que aparecem no modal).
       * en-US: Persists all installment options (the ones that appear in the modal).
       */
      linhas: filteredRows.map(row => ({
        parcelas: String(row.parcela || ''),
        valor: currencyRemoveMaskToString(row.valor || '') || '',
        desconto: currencyRemoveMaskToString(row.desconto || '') || '',
      })),
    };
    payload.orc = { ...(payload.orc || {}), parcelamento: parcelamentoForOrc };
    return payload;
  }

  /**
   * mapEnrollmentToForm
   * pt-BR: Mapeia o registro da matrícula para preencher o formulário de edição.
   * en-US: Maps enrollment record to populate the edit form.
   */
  useEffect(() => {
    if (!enrollment) return;
    const safe = (k: string, fallback: string = '') => String((enrollment as any)[k] ?? fallback);
    const metaSafe = (k: string, fallback: string = '') => String(((enrollment as any)?.meta?.[k]) ?? fallback);
    // Aplica máscaras monetárias iniciais a partir dos dados da matrícula
    const descontoMaskedInit = formatCurrencyBRL(Number(safe('desconto', '0')) || 0);
    const inscricaoMaskedInit = formatCurrencyBRL(Number(safe('inscricao', '0')) || 0);
    const subtotalMaskedInit = formatCurrencyBRL(Number(safe('subtotal', '0')) || 0);
    const totalMaskedInit = formatCurrencyBRL(Number(safe('total', '0')) || 0);
    const currentRespId = safe('id_responsavel', '');
    // pt-BR: Só exibe a seção do responsável automaticamente se houver um ID válido (UUID/string não vazia e != '0')
    const hasStoredResponsible = currentRespId && 
                                currentRespId !== '0' && 
                                currentRespId !== '' && 
                                currentRespId !== 'null' && 
                                currentRespId !== 'undefined';
    
    if (hasStoredResponsible) {
      setShowResponsible(true);
    } else {
      setShowResponsible(false);
    }

    form.reset({
      id_cliente: safe('id_cliente', form.getValues('id_cliente')),
      id_curso: safe('id_curso', form.getValues('id_curso')),
      id_turma: safe('id_turma', form.getValues('id_turma')),
      // pt-BR: Observações devem ser preenchidas a partir de `descricao` quando existir;
      //        caso contrário, usa `obs` legado.
      // en-US: Observations should be hydrated from `descricao` when present;
      //        otherwise, falls back to legacy `obs`.
      obs: safe('descricao', safe('obs')),
      id_consultor: safe('id_consultor'),
      // pt-BR: Recupera meta.gera_valor com fallback para campo raiz (compatibilidade)
      // en-US: Restores meta.gera_valor with fallback to root field for compatibility
      gera_valor: metaSafe('gera_valor', safe('gera_valor', form.getValues('gera_valor'))),
      // pt-BR: Preenche situacao_id se existir no registro
      // en-US: Fills situacao_id if present in the record
      situacao_id: String(safe('situacao_id', '')),
      id_responsavel: currentRespId,
      orc_json: JSON.stringify((enrollment as any)?.orc ?? {}),
      desconto: descontoMaskedInit,
      inscricao: inscricaoMaskedInit,
      subtotal: subtotalMaskedInit,
      total: totalMaskedInit,
      // pt-BR: Recupera meta.validade com fallback para campo raiz (compatibilidade)
      // en-US: Restores meta.validade with fallback to root field for compatibility
      validade: metaSafe('validade', safe('validade', form.getValues('validade'))),
      // pt-BR: Recupera meta.texto_desconto para preencher o novo campo do formulário
      // en-US: Restores meta.texto_desconto to populate the new form field
      meta_texto_desconto: metaSafe('texto_desconto', ''),
      meta_texto_combustivel: metaSafe('texto_combustivel', ''),
      etapa1_desconto: Number(metaSafe('etapa1_desconto', '0')),
      id: String(id || ''),
    });
  }, [enrollment, id]);

  /**
   * textoDescontoWatched
   * pt-BR: Observa o conteúdo do campo Texto de Desconto para atualização dinâmica do preview.
   * en-US: Watches Discount Text content for dynamic preview updates.
   */
  const textoDescontoWatched = form.watch('meta_texto_desconto');

  /**
   * getValorDescFromConfig
   * pt-BR: Recupera valor e desconto de `installmentDetail.config` para a parcela indicada (fallback).
   * en-US: Retrieves value and discount from `installmentDetail.config` for the given installment (fallback).
   */
  function getValorDescFromConfig(parcela: string): { maskedValor: string; maskedDesc: string } {
    try {
      const cfg = (installmentDetail as any)?.config || {};
      const parcelasObj = cfg?.parcelas || {};
      const parcelasArr: any[] = Array.isArray(parcelasObj) ? parcelasObj : Object.values(parcelasObj || {});
      const chosen = parcelasArr.find((p: any) => String(p?.parcela ?? '') === String(parcela));
      const valor = chosen?.valor ?? cfg?.valor ?? '';
      const maskedValor = valor ? currencyApplyMask(String(valor), 'pt-BR', 'BRL') : '';
      const maskedDesc = chosen?.desconto ? currencyApplyMask(String(chosen.desconto), 'pt-BR', 'BRL') : '';
      return { maskedValor, maskedDesc };
    } catch {
      return { maskedValor: '', maskedDesc: '' };
    }
  }

  /**
   * activeRowResolved
   * pt-BR: Seleciona a primeira linha válida e completa seus campos com fallback da config, quando necessário.
   * en-US: Picks the first valid row and completes its fields using config fallback when needed.
   */
  const activeRowResolved = useMemo(() => {
    const row = (discountRows || [])[activeRowIndex] || (discountRows || []).find((r) => r.parcela) || (discountRows || [])[0] || null;
    if (!row) return null;
    const parcelaStr = String(row.parcela || '');
    const parcelaNum = Number(parcelaStr) || 0;
    const totalNum = currencyRemoveMaskToNumber(String(form.getValues('total') || '')) || 0;
    const fromTotal = parcelaNum > 0 && totalNum > 0 ? (totalNum / parcelaNum) : 0;
    const valorFromTotalMasked = fromTotal > 0 ? formatCurrencyBRL(fromTotal) : '';
    const { maskedValor, maskedDesc } = getValorDescFromConfig(parcelaStr);
    const valorMasked = String(row.valor || valorFromTotalMasked || maskedValor || '');
    const descontoMasked = String(row.desconto || maskedDesc || '');
    const valorNum = currencyRemoveMaskToNumber(valorMasked) || 0;
    const descontoNum = currencyRemoveMaskToNumber(descontoMasked) || 0;
    const parcelaComDescNum = valorNum > 0 ? Math.max(valorNum - descontoNum, 0) : 0;
    const parcelaComDescMasked = parcelaComDescNum > 0 ? formatCurrencyBRL(parcelaComDescNum) : '';
    return {
      parcela: parcelaStr,
      valor: valorMasked,
      desconto: descontoMasked,
      parcelaComDesconto: parcelaComDescMasked,
    };
  }, [discountRows, activeRowIndex, installmentDetail]);

  /**
   * resolveShortcodes
   * pt-BR: Substitui shortcodes no HTML do texto de desconto por valores dinâmicos da linha ativa.
   * en-US: Replaces shortcodes in discount text HTML with dynamic values from the active row.
   */
  function resolveShortcodes(baseHtml: string, row: { parcela?: string; valor?: string; desconto?: string } | null): string {
    const html = String(baseHtml || '');
    if (!row) return html;
    const totalParcStr = String(row.parcela || '');
    const valorParcelaStr = String(row.valor || '');
    const descPontualStr = String(row.desconto || '');
    const parcelaComDescStr = (row as any)?.parcelaComDesconto ? String((row as any).parcelaComDesconto) : '';
    return html
      .replace(/\{total_parcelas\}/gi, totalParcStr)
      .replace(/\{valor_parcela\}/gi, valorParcelaStr)
      .replace(/\{desconto_pontualidade\}/gi, descPontualStr)
      .replace(/\{parcela_com_desconto\}/gi, parcelaComDescStr);
  }

  /**
   * insertTag
   * pt-BR: Insere um shortcode na posição atual do cursor no editor contenteditable.
   * en-US: Inserts a shortcode at the current cursor position in the contenteditable editor.
   */
  function insertTag(tag: string) {
    const editor = document.querySelector('[contenteditable="true"]');
    if (editor) {
      // pt-BR: Se o editor estiver focado, document.execCommand insere na posição do cursor.
      // en-US: If the editor is focused, document.execCommand inserts at the cursor position.
      document.execCommand('insertText', false, tag);
    }
  }

  /**
   * discountPreviewHtml
   * pt-BR: HTML do preview com shortcodes resolvidos, atualizado em tempo real.
   * en-US: Preview HTML with resolved shortcodes, updated in real time.
   */
  const discountPreviewHtml = useMemo(() => {
    return resolveShortcodes(textoDescontoWatched || '', activeRowResolved);
  }, [textoDescontoWatched, activeRowResolved]);

  /**
   * hydrateInstallmentFromOrc
   * pt-BR: Hidrata o card "Gerenciamento de Parcelamento" a partir de `enrollment.orc.parcelamento`,
   *        preenchendo `parcelamento_id`, linhas da tabela e texto de desconto, quando disponíveis.
   * en-US: Hydrates the "Installment Management" card from `enrollment.orc.parcelamento`,
   *        filling `parcelamento_id`, table rows, and discount text when available.
   */
  useEffect(() => {
    try {
      const orc: any = (enrollment as any)?.orc;
      const parcelamento = orc?.parcelamento;
      if (!parcelamento) return;

      // Preferir o tabela_id do orc se o campo do formulário estiver vazio.
      const currentParcelamentoId = form.getValues('parcelamento_id');
      if ((!currentParcelamentoId || String(currentParcelamentoId).trim() === '') && parcelamento.tabela_id) {
        // pt-BR: Define parcelamento_id a partir do orc e marca como hidratado para evitar rehidratação por config.
        // en-US: Set parcelamento_id from orc and mark as hydrated to prevent config rehydration.
        const newId = String(parcelamento.tabela_id);
        form.setValue('parcelamento_id', newId);
        setLastHydratedInstallmentId(newId);
      }

      // Hidratar linhas da tabela se existirem em orc.parcelamento.linhas
      const linhas = Array.isArray(parcelamento.linhas) ? parcelamento.linhas : [];
      if (linhas.length > 0) {
        const rows = linhas.map((l: any) => ({
          parcela: String(l.parcelas ?? l.parcela ?? ''),
          valor: l.valor ? currencyApplyMask(String(l.valor), 'pt-BR', 'BRL') : '',
          desconto: l.desconto ? currencyApplyMask(String(l.desconto), 'pt-BR', 'BRL') : '',
        }));
        setDiscountRows(rows);
        // pt-BR: Se já temos um parcelamento_id (do orc ou do formulário), marca como hidratado.
        // en-US: If we already have a parcelamento_id (from orc or form), mark as hydrated.
        const idForHydration = String(form.getValues('parcelamento_id') || parcelamento.tabela_id || '');
        if (idForHydration) setLastHydratedInstallmentId(idForHydration);
      }

      // Hidratar texto de desconto do orc, se presente e o campo estiver vazio
      const currentTexto = form.getValues('meta_texto_desconto') || '';
      if ((!currentTexto || currentTexto.trim().length === 0) && parcelamento.texto_desconto) {
        form.setValue('meta_texto_desconto', String(parcelamento.texto_desconto));
      }

      // Hidratar parcela selecionada
      if (parcelamento.parcela_selecionada) {
        form.setValue('total_parcelas', String(parcelamento.parcela_selecionada));
        const idx = (rows || []).findIndex((r: any) => String(r.parcela) === String(parcelamento.parcela_selecionada));
        if (idx !== -1) setActiveRowIndex(idx);
      }
    } catch {
      // Silenciar erros de hidratação para não afetar UX
    }
  }, [enrollment, form]);

  /**
   * onSubmit
   * pt-BR: Envia atualização para `/matriculas/:id`.
   * en-US: Sends update to `/matriculas/:id`.
   */
  async function onSubmit(values: ProposalEditFormData) {
    const payload = buildPayload(values);
    await updateEnrollment.mutateAsync({ id: String(id || ''), data: payload } as any);
  }

  /**
   * handleBack
   * pt-BR: Volta para a página de origem (histórico) ou para `returnTo`.
   * en-US: Goes back to the origin page (history) or uses `returnTo`.
   */
  function handleBack() {
    if (navState?.returnTo && typeof navState.returnTo === 'string') {
      navigate(navState.returnTo);
      return;
    }
    // Preferir histórico para retornar exatamente à origem.
    navigate(-1);
  }

  /**
   * handleSaveContinue
   * pt-BR: Envia o formulário e permanece na página para continuar.
   * en-US: Submits the form and stays on the page to continue.
   */
  function handleSaveContinue() {
    finishAfterSaveRef.current = false;
    form.handleSubmit(onSubmit)();
  }

  /**
   * handleSaveFinish
   * pt-BR: Envia o formulário e finaliza, retornando com atualização.
   * en-US: Submits the form and finishes, returning with refresh.
   */
  function handleSaveFinish() {
    finishAfterSaveRef.current = true;
    form.handleSubmit(onSubmit)();
  }

  /**
   * handleView
   * pt-BR: Abre a visualização da proposta em uma nova aba.
   * en-US: Opens the proposal view in a new tab.
   */
  function handleView() {
    if (id) {
      navigate(`/admin/sales/proposals/view/${id}`);
    }
  }

  /**
   * handleEditClient
   * pt-BR: Navega para a edição do cliente selecionado e preserva o estado de retorno
   *        para que o usuário possa voltar a esta página após concluir a edição.
   * en-US: Navigates to the selected client's edit page and preserves a return
   *        state so the user can come back to this page after finishing the edit.
   */
  function handleEditClient(clientId: string | undefined) {
    const idToEdit = String(clientId || '').trim();
    if (!idToEdit) return;
    navigate(`/admin/clients/${idToEdit}/edit`, {
      state: {
        returnTo: {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        },
      },
    });
  }

  // Hidratação de parcelamento_id a partir da proposta carregada
  // Hydrate parcelamento_id from loaded proposal metadata
  useEffect(() => {
    try {
      // safe/metaSafe helpers are used elsewhere; reuse them here if available
      // Fallback to empty string when not present
      // @ts-ignore
      const getSafe = (k: string, d: any) => (typeof safe === 'function' ? safe(k, d) : d);
      // @ts-ignore
      const getMetaSafe = (k: string, d: any) => (typeof metaSafe === 'function' ? metaSafe(k, d) : d);
      const val = getMetaSafe('parcelamento_id', getSafe('parcelamento_id', ''));
      if (val !== undefined && val !== null && val !== '') {
        form.setValue('parcelamento_id', String(val));
      }
    } catch (e) {
      // ignore hydration errors silently
    }
  }, [form]);

  // Componente auxiliar para cards de métricas
  const StatCard = ({ label, value, icon: Icon, colorClass }: { label: string, value: string, icon: any, colorClass: string }) => (
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={handleBack} className="hover:bg-zinc-100 dark:hover:bg-zinc-800">
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao funil
        </Button>
        
        <div className="flex items-center gap-2">
          {enrollment && (
            <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-widest bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800">
              ID: {id}
            </Badge>
          )}
        </div>
      </div>

      <Card className="border-none shadow-none bg-transparent">
        <CardHeader className="px-0 pt-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl font-bold tracking-tight">Editar Proposta</CardTitle>
              <CardDescription className="text-zinc-500 dark:text-zinc-400 mt-1">Configure os detalhes comerciais, prazos e condições do curso.</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              type="button"
              className="h-9 px-4 rounded-full border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
              onClick={() => setShowResponsible((s) => !s)}
            >
              {showResponsible ? (
                <><Users className="w-4 h-4 mr-2 text-zinc-500" /> Ocultar Responsável</>
              ) : (
                <><User className="w-4 h-4 mr-2 text-blue-500" /> Selecionar Responsável</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              {/* Seção 1: Identificação */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="h-4 w-1 bg-blue-600 rounded-full"></div>
                  <h3 className="text-xs uppercase font-bold tracking-widest text-zinc-500">Identificação e Status</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 p-6 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800">
                  {/* Cliente */}
                  <FormField
                    control={form.control}
                    name="id_cliente"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2 block">Cliente vinculado</FormLabel>
                        {idClienteFromUrl ? (
                          <div className="flex items-center gap-2">
                            <div className="flex-1 text-sm py-2.5 px-4 border rounded-xl bg-white dark:bg-zinc-950 font-medium">
                              {clientDetailData?.name ? String(clientDetailData.name) : `Cliente ${idClienteFromUrl}`}
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 rounded-xl shrink-0"
                              onClick={() => handleEditClient(idClienteFromUrl)}
                              title="Editar Perfil do Cliente"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <Combobox
                                options={clientOptions}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="Selecione o cliente"
                                searchPlaceholder="Pesquisar..."
                                emptyText="Nenhum cliente"
                                disabled={isLoadingClients || isLoadingEnrollment}
                                loading={isLoadingClients || isLoadingEnrollment}
                                onSearch={setClientSearch}
                                searchTerm={clientSearch}
                                debounceMs={250}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 rounded-xl shrink-0"
                              onClick={() => handleEditClient(String(field.value || ''))}
                              disabled={!field.value}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
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
                        <FormLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2 block">Consultor Responsável</FormLabel>
                        <Combobox
                          options={consultantOptionsWithSelected}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Selecione o consultor"
                          searchPlaceholder="Pesquisar..."
                          emptyText="Nenhum consultor"
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

                  {/* Situação */}
                  <FormField
                    control={form.control}
                    name="situacao_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2 block">Situação atual</FormLabel>
                        <Select 
                          key={isLoadingSituations ? 'loading' : `loaded-${situationsList.length}`}
                          value={field.value || ''} 
                          onValueChange={field.onChange} 
                          disabled={isLoadingSituations}
                        >
                          <SelectTrigger className="w-full h-10 rounded-xl">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {situationsList.map((s: any) => (
                              <SelectItem key={String(s.id)} value={String(s.id)}>
                                {String(s.name || s.nome || `Situação ${s.id}`)}
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

              

              {/* Seção 2: Configuração da Proposta */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="h-4 w-1 bg-emerald-600 rounded-full"></div>
                  <h3 className="text-xs uppercase font-bold tracking-widest text-zinc-500">Configuração do Curso</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800">
                  {/* Curso */}
                  <FormField
                    control={form.control}
                    name="id_curso"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2 block">Curso Principal</FormLabel>
                        <Combobox
                          options={courseOptions}
                          value={field.value}
                          onValueChange={(val) => {
                            field.onChange(val);
                            form.setValue('id_turma', '');
                            form.setValue('parcelamento_id', '');
                          }}
                          placeholder="Selecione o curso"
                          searchPlaceholder="Pesquisar..."
                          emptyText="Nenhum curso"
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
                        <FormLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2 block">Turma e Semestre</FormLabel>
                        <Combobox
                          options={classOptionsWithFallback}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Selecione a turma"
                          searchPlaceholder="Pesquisar..."
                          emptyText={!selectedCourseId ? 'Selecione curso' : 'Nenhuma turma'}
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

                  {showResponsible && (
                    <FormField
                      control={form.control}
                      name="id_responsavel"
                      render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-2 block">Responsável Adicional</FormLabel>
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
                              <Combobox
                                options={responsibleOptionsWithSelected}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="Selecione o responsável"
                                searchPlaceholder="Pesquisar..."
                                emptyText="Nenhum responsável"
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
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 rounded-xl shrink-0"
                              onClick={() => handleEditResponsible(String(field.value || ''))}
                              disabled={!field.value}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>

              {/* Seção 3: Observações Internas */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="h-4 w-1 bg-amber-500 rounded-full"></div>
                  <h3 className="text-xs uppercase font-bold tracking-widest text-zinc-500">Observações Gerais</h3>
                </div>

                <FormField
                  control={form.control}
                  name="obs"
                  render={({ field }) => (
                    <FormItem className="rounded-2xl border bg-white dark:bg-zinc-950/50 shadow-sm overflow-hidden">
                      <div className="px-4 py-2 bg-zinc-50/80 dark:bg-zinc-900/50 flex items-center gap-2 border-b">
                        <MessageSquare className="w-4 h-4 text-zinc-500" />
                        <FormLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground m-0">Texto Interno</FormLabel>
                      </div>
                      <FormControl>
                        <RichTextEditor
                          value={field.value || ''}
                          onChange={field.onChange}
                          placeholder="Digite qualquer observação relevante para o histórico da proposta..."
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Seção 4: Configuração Técnica (Módulos/Gera Valor) */}
              {form.watch('id_turma') && String(selectedCourse?.tipo) !== '1' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <div className="h-4 w-1 bg-purple-600 rounded-full"></div>
                    <h3 className="text-xs uppercase font-bold tracking-widest text-zinc-500">Seleção de Módulos e Preços</h3>
                  </div>

                  <div className="p-6 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800">
                    {String(selectedCourse?.tipo) === '2' ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <FormLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block">Grade de Módulos do Curso</FormLabel>
                          <Button variant="ghost" size="sm" type="button" onClick={handleOpenFuelText} className="text-[10px] uppercase font-bold tracking-widest text-blue-600">
                            <Pencil className="w-3 h-3 mr-1" /> Editar Texto Combustível
                          </Button>
                        </div>
                        <CourseModulesSelector
                          course={selectedCourseNormalized}
                          aircrafts={allAircraft}
                          onChange={handleModulesSelectionChange}
                          getAircraftHourlyRate={getAircraftHourlyRate}
                          formatCurrencyBRL={formatCurrencyBRL}
                          initialSelections={initialType2Selections}
                          initialEtapa1Discount={initialEtapa1Discount}
                          initialDollarRate={initialDollarRate}
                          initialRateOverrides={initialRateOverrides}
                          initialCurrency={initialCurrency}
                        />
                      </div>
                    ) : (
                      <FormField
                        control={form.control}
                        name="gera_valor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-2">Comportamento de Preço</FormLabel>
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
                    )}
                  </div>
                </div>
              )}

              {/* Seção 5: Financeiro e Condições */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 px-1">
                  <div className="h-4 w-1 bg-indigo-600 rounded-full"></div>
                  <h3 className="text-xs uppercase font-bold tracking-widest text-zinc-500">Resumo e Condições Financeiras</h3>
                </div>

                {/* Cards de Métricas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <StatCard label="Subtotal Bruto" value={form.watch('subtotal')} icon={TableIcon} colorClass="bg-zinc-100" />
                  <StatCard label="Inscrição / Matrícula" value={form.watch('inscricao')} icon={Wallet} colorClass="bg-blue-100" />
                  <StatCard label="Desconto Aplicado" value={form.watch('desconto')} icon={CircleDollarSign} colorClass="bg-emerald-100" />
                  <StatCard label="Total Líquido" value={form.watch('total')} icon={CheckCircle} colorClass="bg-emerald-600 !text-white" />
                </div>

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

              {/**
               * ParcelamentoCard
               * pt-BR: Card para gerenciamento de parcelamento, posicionado abaixo do campo de validade.
               *        Contém o select de Tabela de Parcelamento e o campo Texto de Desconto.
               * en-US: Card for installment management, placed below the validity field.
               *        Contains the Installment Table select and the Discount Text field.
               */}
              <Card>
                <CardHeader 
                  className="flex flex-row items-center justify-between cursor-pointer group"
                  onClick={() => setIsParcelamentoCollapsed(!isParcelamentoCollapsed)}
                >
                  <div className="flex items-center gap-2">
                    {isParcelamentoCollapsed ? <ChevronDown className="h-5 w-5 transition-transform" /> : <ChevronUp className="h-5 w-5 transition-transform" />}
                    <CardTitle>Gerenciamento de Parcelamento</CardTitle>
                  </div>
                  {isParcelamentoCollapsed && activeRowResolved && (
                    <Badge variant="secondary" className="px-2 py-0 h-5 text-[10px]">
                      {activeRowResolved.parcela}x de {activeRowResolved.parcelaComDesconto || activeRowResolved.valor}
                    </Badge>
                  )}
                </CardHeader>
                {!isParcelamentoCollapsed && (
                  <CardContent className="animate-in fade-in duration-300">
                  {/* Seleção de Tabela de Parcelamento */}
                  <div className="grid grid-cols-1 gap-4">
                    <FormField
                      control={form.control}
                      name="parcelamento_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Tabela de Parcelamento</FormLabel>
                          <div className="flex items-start gap-2">
                            <div className="flex-1">
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
                            </div>
                            {field.value && (
                              <Button
                                type="button"
                                variant="outline"
                                className="h-10 px-3 rounded-xl border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0"
                                onClick={() => {
                                  field.onChange('');
                                }}
                                title="Limpar seleção de tabela"
                              >
                                Limpar
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="h-10 w-10 rounded-xl shrink-0 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              onClick={() => {
                                setTempDiscountRows([...discountRows]);
                                setIsCustomInstallmentModalOpen(true);
                              }}
                              title="Editar/Personalizar Estrutura de Parcelas"
                            >
                              <Settings className="h-4 w-4 text-zinc-500" />
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/**
                   * DiscountEditableTable
                   * pt-BR: Tabela de desconto com edição das colunas solicitadas.
                   *        Alimentada por `config.parcelas` da tabela selecionada.
                   * en-US: Discount table with editable requested columns.
                   *        Fed by `config.parcelas` from the selected table.
                   */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="min-w-full text-sm border">
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-left border">Total de Parcelas</th>
                          <th className="p-2 text-left border">Valor da Parcela</th>
                          <th className="p-2 text-left border">Desconto</th>
                          <th className="p-2 text-left border">Parcela com Desconto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const row = (discountRows || [])[activeRowIndex];
                          if (!row) return null;
                          const idx = activeRowIndex;
                          return (
                          <tr key={`descrow-${idx}`}>
                            <td className="p-2 border">
                              {installmentDetail ? (
                                /**
                                 * ParcelasSelect
                                 * pt-BR: Select com opções vindo de config.parcelas da tabela selecionada.
                                 * en-US: Select options from config.parcelas of the selected installment.
                                 */
                                <Select
                                  value={row.parcela || ''}
                                  onValueChange={(val) => {
                                   setDiscountRows((prev) => {
                                     const next = [...prev];
                                     const cfg = (installmentDetail as any)?.config || {};
                                     const parcelasObj = cfg?.parcelas || {};
                                     const parcelasArr: any[] = Array.isArray(parcelasObj) ? parcelasObj : Object.values(parcelasObj || {});
                                     const chosen = parcelasArr.find((p: any) => String(p?.parcela ?? '') === String(val));
                                      // pt-BR: Recalcula valor da parcela a partir do Total quando possível.
                                      // en-US: Recalculate installment value from Total when possible.
                                      const totalNum = currencyRemoveMaskToNumber(String(form.getValues('total') || '')) || 0;
                                      const parcNum = Number(val) || 0;
                                      const fromTotal = totalNum > 0 && parcNum > 0 ? (totalNum / parcNum) : 0;
                                      const maskedValor = fromTotal > 0
                                        ? formatCurrencyBRL(fromTotal)
                                        : (chosen?.valor ? currencyApplyMask(String(chosen.valor), 'pt-BR', 'BRL') : (cfg?.valor ? currencyApplyMask(String(cfg.valor), 'pt-BR', 'BRL') : ''));
                                      const maskedDesc = chosen?.desconto ? currencyApplyMask(String(chosen.desconto), 'pt-BR', 'BRL') : '';
                                      next[idx] = {
                                        ...next[idx],
                                        parcela: String(val),
                                        valor: maskedValor,
                                        desconto: maskedDesc,
                                      };
                                      return next;
                                    });
                                  }}
                                >
                                  <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Selecione" /></SelectTrigger>
                                  <SelectContent>
                                    {(() => {
                                      const cfg = (installmentDetail as any)?.config || {};
                                      const parcelasObj = cfg?.parcelas || {};
                                      const parcelasArr: any[] = Array.isArray(parcelasObj) ? parcelasObj : Object.values(parcelasObj || {});
                                      const opts = parcelasArr.map((p: any, i: number) => ({ key: i, value: String(p?.parcela ?? ''), label: String(p?.parcela ?? '') }));
                                      return opts.map((opt) => (
                                        <SelectItem key={`opt-parc-${opt.key}`} value={opt.value}>{opt.label}</SelectItem>
                                      ));
                                    })()}
                                  </SelectContent>
                                </Select>
                              ) : (
                                /**
                                 * Input Manual
                                 * pt-BR: Permite digitar qualquer número de parcelas quando não há tabela selecionada.
                                 * en-US: Allows typing any number of installments when no table is selected.
                                 */
                                <Input
                                  value={row.parcela || ''}
                                  placeholder="Ex: 12"
                                  className="h-9 font-medium"
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setDiscountRows((prev) => {
                                      const next = [...prev];
                                      // pt-BR: Recalcula valor da parcela a partir do Total quando possível.
                                      // en-US: Recalculate installment value from Total when possible.
                                      const totalNum = currencyRemoveMaskToNumber(String(form.getValues('total') || '')) || 0;
                                      const parcNum = Number(val) || 0;
                                      const fromTotal = totalNum > 0 && parcNum > 0 ? (totalNum / parcNum) : 0;
                                      const maskedValor = fromTotal > 0
                                        ? formatCurrencyBRL(fromTotal)
                                        : next[idx]?.valor || '';
                                      next[idx] = {
                                        ...next[idx],
                                        parcela: val,
                                        valor: maskedValor,
                                      };
                                      return next;
                                    });
                                  }}
                                />
                              )}
                            </td>
                            <td className="p-2 border">
                              <Input
                                value={row.valor}
                                inputMode="numeric"
                                className="h-9 font-mono text-xs"
                                onChange={(e) => {
                                  const v = currencyApplyMask(e.target.value, 'pt-BR', 'BRL');
                                  setDiscountRows((prev) => prev.map((r, i) => i === idx ? { ...r, valor: v } : r));
                                }}
                              />
                            </td>
                            <td className="p-2 border">
                             <Input
                               value={row.desconto}
                               inputMode="numeric"
                               className="h-9 font-mono text-xs"
                               onChange={(e) => {
                                 const v = currencyApplyMask(e.target.value, 'pt-BR', 'BRL');
                                 setDiscountRows((prev) => prev.map((r, i) => i === idx ? { ...r, desconto: v } : r));
                                }}
                             />
                            </td>
                            <td className="p-2 border">
                              {/**
                               * ParcelaComDesconto (read-only)
                               * pt-BR: Campo derivado (Valor da Parcela - Desconto), usado pelo shortcode.
                               * en-US: Derived field (Installment Value - Discount), used by the shortcode.
                               */}
                              <Input value={activeRowResolved?.parcelaComDesconto || ''} readOnly className="h-9 font-mono text-xs bg-zinc-50 dark:bg-zinc-900/50" />
                            </td>
                          </tr>
                          );
                        })()}
                        {discountRows.length === 0 && (
                          <tr>
                            <td colSpan={4} className="p-6 text-center text-muted-foreground">
                              <p className="mb-2 text-xs">Nenhuma opção de parcelamento configurada.</p>
                              <div className="flex justify-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 rounded-lg text-xs"
                                  onClick={() => {
                                    setDiscountRows([{ parcela: '', valor: '', desconto: '' }]);
                                  }}
                                >
                                  <Plus className="w-3 h-3 mr-1" /> Adicionar Parcela Personalizada
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/**
                   * DiscountTextUnderTable
                   * pt-BR: O campo Texto de Desconto (WYSIWYG) foi movido para baixo da tabela, conforme solicitado.
                   * en-US: The Discount Text (WYSIWYG) field is placed under the table as requested.
                   */}
                  <div className="mt-4">
                    <FormField
                      control={form.control}
                      name="meta_texto_desconto"
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center justify-between">
                            <FormLabel>Texto de Desconto</FormLabel>
                            
                            {/* pt-BR: Atalhos para shortcodes do parcelamento */}
                            <div className="flex flex-wrap gap-1.5">
                              {[
                                { label: '{total_parcelas}', desc: 'Total de Parc.' },
                                { label: '{valor_parcela}', desc: 'Valor da Parc.' },
                                { label: '{desconto_pontualidade}', desc: 'Desconto' },
                                { label: '{parcela_com_desconto}', desc: 'Líquido' }
                              ].map((v) => (
                                <button
                                  key={v.label}
                                  type="button"
                                  className="text-[10px] bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-400 font-mono hover:bg-blue-100 transition-colors"
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    insertTag(v.label);
                                  }}
                                  title={v.desc}
                                >
                                  {v.label}
                                </button>
                              ))}
                            </div>
                          </div>
                          <FormControl>
                            <RichTextEditor
                              value={field.value || ''}
                              onChange={(val) => {
                                // pt-BR: Marca o texto como editado pelo usuário para evitar rehidratação automática.
                                // en-US: Marks the text as user-edited to avoid automatic rehydration.
                                try { setTextoDescontoDirty(true); } catch {}
                                field.onChange(val);
                              }}
                              placeholder="Digite ou edite o texto de desconto (suporta HTML)"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/**
                   * DiscountPreviewCard
                   * pt-BR: Card de preview que renderiza os shortcodes com os valores em tempo real.
                   * en-US: Preview card that renders shortcodes with real-time values.
                   */}
                  <Card className="mt-4">
                    <CardHeader>
                      <CardTitle>Preview de Parcelamento</CardTitle>
                      <CardDescription>Valores e texto com shortcodes resolvidos em tempo real</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Chips resumindo os valores da linha ativa */}
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs">
                          Total de Parcelas: {activeRowResolved?.parcela || '-'}
                        </span>
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs">
                          Valor da Parcela: {activeRowResolved?.valor || '-'}
                        </span>
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs">
                          Desconto: {activeRowResolved?.desconto || '-'}
                        </span>
                        <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs">
                          Parcela c/ Desconto: {activeRowResolved?.parcelaComDesconto || '-'}
                        </span>
                      </div>

                      {/* Render do texto com shortcodes aplicados */}
                      <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: discountPreviewHtml }} />
                    </CardContent>
                  </Card>
                  </CardContent>
                )}
              </Card>

              <div className="mt-6">
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
                        module={normalizeModuleForTipo4(selectedModule ?? moduleFromEnrollment) as any}
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
                          linhas: discountRows,
                          texto_desconto: form.watch('meta_texto_desconto')
                        }}
                      />
                    </CardContent>
                  )}
                </Card>
              </div>

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
                                  <div className="flex items-center justify-between mb-1">
                                      <FormLabel>Texto Personalizado</FormLabel>
                                      <button
                                          type="button"
                                          className="text-[10px] bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-400 font-mono hover:bg-blue-100 transition-colors"
                                          onMouseDown={(e) => {
                                              e.preventDefault();
                                              insertTag('{valor}');
                                          }}
                                          title="Insere o valor calculado de combustível"
                                      >
                                          {'{valor}'}
                                      </button>
                                  </div>
                                  <FormControl>
                                      <RichTextEditor
                                          value={field.value || ''}
                                          onChange={field.onChange}
                                          placeholder="Digite o texto personalizado"
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

              <QuickResponsibleModal
                open={isQuickResponsibleOpen}
                loading={quickResponsibleLoading}
                data={quickResponsibleData}
                onChange={setQuickResponsibleData}
                onClose={handleCloseQuickResponsibleModal}
                mode={quickResponsibleEditId ? 'edit' : 'create'}
                onSubmit={quickResponsibleEditId ? handleQuickResponsibleUpdate : handleQuickResponsibleSubmit}
              />

              {/* Espaço para o rodapé fixo não cobrir o conteúdo */}
              <div className="h-16" />
            </form>
          </Form>
        </CardContent>
      </Card>
      <EditFooterBar
        onBack={handleBack}
        onContinue={handleSaveContinue}
        onFinish={handleSaveFinish}
        onView={handleView}
        showView={!!id}
        disabled={Boolean(isLoadingEnrollment || (updateEnrollment as any)?.isPending)}
      />
      {/* Modal de Personalização de Parcelamento */}
      <Dialog open={isCustomInstallmentModalOpen} onOpenChange={setIsCustomInstallmentModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <TableIcon className="w-5 h-5 text-blue-600" />
              </div>
              Personalizar Estrutura de Parcelamento
            </DialogTitle>
            <DialogDescription>
              Adicione ou remova opções de parcelas e ajuste os valores e descontos. Estes ajustes serão aplicados apenas nesta proposta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 dark:bg-zinc-900 border-b">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-bold text-[10px] uppercase tracking-wider text-zinc-500">Parcelas</th>
                    <th className="px-4 py-2.5 text-left font-bold text-[10px] uppercase tracking-wider text-zinc-500">Valor da Parcela</th>
                    <th className="px-4 py-2.5 text-left font-bold text-[10px] uppercase tracking-wider text-zinc-500">Desconto</th>
                    <th className="px-4 py-2.5 text-right font-bold text-[10px] uppercase tracking-wider text-zinc-500">Parcela com Desconto</th>
                    <th className="px-4 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {tempDiscountRows.map((row, idx) => {
                    const vNum = currencyRemoveMaskToNumber(String(row.valor || '0')) || 0;
                    const dNum = currencyRemoveMaskToNumber(String(row.desconto || '0')) || 0;
                    const net = Math.max(vNum - dNum, 0);

                    return (
                      <tr key={`edit-parc-${idx}`} className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                        <td className="p-2">
                          <Input
                            value={row.parcela}
                            className="h-9 font-medium"
                            placeholder="Ex: 12"
                            onChange={(e) => {
                              const next = [...tempDiscountRows];
                              next[idx] = { ...next[idx], parcela: e.target.value };
                              setTempDiscountRows(next);
                            }}
                          />
                        </td>
                        <td className="p-2">
                          <div className="relative">
                            <Input
                              value={row.valor}
                              className="h-9 pl-7 font-mono text-xs"
                              placeholder="0,00"
                              onChange={(e) => {
                                const next = [...tempDiscountRows];
                                next[idx] = { ...next[idx], valor: currencyApplyMask(e.target.value, 'pt-BR', 'BRL') };
                                setTempDiscountRows(next);
                              }}
                            />
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400">R$</span>
                          </div>
                        </td>
                        <td className="p-2">
                          <div className="relative">
                            <Input
                              value={row.desconto}
                              className="h-9 pl-7 font-mono text-xs"
                              placeholder="0,00"
                              onChange={(e) => {
                                const next = [...tempDiscountRows];
                                next[idx] = { ...next[idx], desconto: currencyApplyMask(e.target.value, 'pt-BR', 'BRL') };
                                setTempDiscountRows(next);
                              }}
                            />
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-zinc-400">R$</span>
                          </div>
                        </td>
                        <td className="p-2 text-right">
                           <div className="font-mono text-xs font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1.5 rounded border border-green-100 dark:border-green-800/50">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(net)}
                           </div>
                        </td>
                        <td className="p-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                            onClick={() => setTempDiscountRows((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {tempDiscountRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-zinc-400 text-xs italic">
                        Nenhuma linha definida. Clique em "Adicionar Linha" para começar.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg h-9 border-zinc-200 dark:border-zinc-800"
                onClick={() => setTempDiscountRows([...tempDiscountRows, { parcela: '', valor: '', desconto: '' }])}
              >
                <Plus className="w-4 h-4 mr-2" /> Adicionar Linha
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-lg h-9 text-zinc-500"
                onClick={() => {
                  const totalNum = currencyRemoveMaskToNumber(String(form.getValues('total') || '')) || 0;
                  if (totalNum <= 0) return;
                  
                  const recalculated = tempDiscountRows.map(row => {
                    const pNum = Number(row.parcela) || 0;
                    if (pNum > 0) {
                      return { ...row, valor: formatCurrencyBRL(totalNum / pNum) };
                    }
                    return row;
                  });
                  setTempDiscountRows(recalculated);
                }}
              >
                <Layers className="w-4 h-4 mr-2" /> Recalcular pelo Total
              </Button>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsCustomInstallmentModalOpen(false)}>Cancelar</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6"
              onClick={() => {
                setDiscountRows(tempDiscountRows);
                setIsCustomInstallmentModalOpen(false);
                toast({ title: 'Tabela personalizada', description: 'As novas opções de parcelamento foram aplicadas apenas a esta proposta.' });
              }}
            >
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
  // Removido: o recálculo é feito na troca do Total de Parcelas, conforme solicitado.
