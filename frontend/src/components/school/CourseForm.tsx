import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, FormProvider, useFieldArray } from 'react-hook-form';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Plus, X, Trash2, GripVertical, ArrowUp, ArrowDown, PencilLine } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { aircraftSettingsService } from '@/services/aircraftSettingsService';
import { contractsService } from '@/services/contractsService';
import { periodsService } from '@/services/periodsService';
import { CoursePayload, CourseRecord, CourseModule } from '@/types/courses';
import {
  PUBLIC_PROPOSAL_QUESTIONS,
  PUBLIC_PROPOSAL_QUESTION_KEYS,
  PUBLIC_PROPOSAL_SECTIONS,
  getDefaultPublicProposalQuestions,
  getDefaultPublicProposalRequiredQuestions,
  getDefaultPublicProposalSections,
} from '@/lib/publicProposalQuestions';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { currencyApplyMask, currencyRemoveMaskToNumber } from '@/lib/masks/currency';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { CourseContractsTab } from '@/components/school/CourseContractsTab';

/**
 * formatCurrencyBRLDisplay
 * pt-BR: Formata valores para exibição em BRL. Se número (ex.: 17820),
 *        trata como reais e aplica Intl para "R$ 17.820,00". Se string,
 *        mantém a máscara usando utilitário existente.
 * en-US: Formats values for BRL display. If a number (e.g., 17820),
 *        treats as reais and uses Intl for "R$ 17.820,00". If string,
 *        preserves mask using existing utility.
 */
function formatCurrencyBRLDisplay(val?: number | string): string {
  if (val === undefined || val === null || String(val) === '') return '';
  if (typeof val === 'number') {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(val);
  }
  const s = String(val);
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(n);
  }
  return currencyApplyMask(s, 'pt-BR', 'BRL');
}

/**
 * normalizeCurrencyToBRString
 * pt-BR: Remove a máscara e retorna string BR com vírgula (ex.: "900,00").
 * en-US: Removes mask and returns BR string with comma (e.g., "900,00").
 */
function normalizeCurrencyToBRString(val?: string): string | undefined {
  if (!val) return undefined;
  const num = currencyRemoveMaskToNumber(val);
  if (Number.isNaN(num)) return undefined;
  return num.toFixed(2).replace('.', ',');
}

/**
 * getPeriodsFilterUrl
 * pt-BR: Constrói a URL da listagem de períodos com `id_curso` para filtro.
 * en-US: Builds the periods list URL with `id_curso` for filtering.
 */
function getPeriodsFilterUrl(id?: string | number): string {
  const cid = id ? String(id) : '';
  const base = '/admin/school/periods';
  return cid ? `${base}?id_curso=${cid}` : base;
}

/**
 * getModulesTabLabel
 * pt-BR: Retorna o rótulo da aba de módulos, usando "Períodos" para cursos do tipo 4.
 * en-US: Returns the modules tab label, using "Periods" for type-4 courses.
 */
function getModulesTabLabel(courseType?: string | number): string {
  return String(courseType ?? '') === '4' ? 'Períodos' : 'Módulos';
}

/**
 * getPeriodEditUrl
 * pt-BR: Monta a URL de edição de um período preservando o filtro do curso atual.
 * en-US: Builds the period edit URL preserving the current course filter.
 */
function getPeriodEditUrl(periodId: string | number, courseId?: string | number): string {
  const base = `/admin/school/periods/${periodId}/edit`;
  const cid = courseId ? String(courseId) : '';
  return cid ? `${base}?id_curso=${cid}` : base;
}

type CoursePeriodListItem = {
  id: string;
  nome: string;
  valor?: number | string;
  id_contratos: (number | string)[];
};

/**
 * SortableModuleItem
 * pt-BR: Componente wrapper para tornar o módulo ordenável.
 * en-US: Wrapper component to make the module sortable.
 */
function SortableModuleItem({ id, children }: { id: string; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    position: 'relative' as const,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex gap-2">
      <div 
        {...attributes} 
        {...listeners} 
        className="flex items-center justify-center p-2 cursor-grab text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-md self-start mt-6"
        title="Arraste para reordenar"
      >
        <GripVertical className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        {children}
      </div>
    </div>
  );
}

/**
 * CourseForm
 * pt-BR: Formulário tabulado para criar/editar cursos. Agrupa campos em abas
 *        (Informações, Valores, Configurações, Aeronaves, Módulos).
 * en-US: Tabbed form to create/edit courses. Groups fields into tabs
 *        (Info, Pricing, Config, Aircrafts, Modules).
 */
export function CourseForm({
  initialData,
  onSubmit,
  isSubmitting,
  onSubmitRef,
}: {
  initialData?: CourseRecord | CoursePayload | null;
  onSubmit: (data: CoursePayload) => Promise<void> | void;
  isSubmitting?: boolean;
  /**
   * onSubmitRef
   * pt-BR: Referência externa para disparar submissão programaticamente.
   * en-US: External ref to trigger submit programmatically.
   */
  onSubmitRef?: React.MutableRefObject<(() => void) | null>;
}) {
  /**
   * resolveInitialTab
   * pt-BR: Lê `tab` da URL e valida contra as abas disponíveis. Retorna 'info'
   *        quando o parâmetro estiver ausente ou inválido.
   * en-US: Reads `tab` from URL and validates against available tabs. Returns
   *        'info' when the parameter is missing or invalid.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const allowedTabs = ['info', 'pricing', 'config', 'aircrafts', 'modules', 'contracts'];
  const tabParam = (searchParams.get('tab') || '').trim();
  const initialTab = allowedTabs.includes(tabParam) ? tabParam : 'info';
  /**
   * navigation
   * pt-BR: Navegação SPA para abrir a página de períodos com filtro.
   * en-US: SPA navigation to open periods page with filter.
   */
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  /**
   * courseSchema
   * pt-BR: Valida campos principais e valores monetários (aba "Valores").
   * en-US: Validates core fields and monetary values ("Valores" tab).
   */
  const moduleSchema = z.object({
    etapa: z.coerce.string().optional(),
    titulo: z.coerce.string().optional(),
    limite: z.coerce.string().optional(),
    valor: z.coerce.string().optional(),
    aviao: z.array(z.string()).optional(),
  });
  const courseSchema = z.object({
    nome: z.string().min(1, 'Nome interno é obrigatório'),
    // pt-BR: Título deixa de ser obrigatório e será copiado do nome.
    // en-US: Title is no longer required and will copy from name.
    titulo: z.string().optional(),
    ativo: z.enum(['s', 'n']).optional(),
    destaque: z.enum(['s', 'n']).optional(),
    publicar: z.enum(['s', 'n']).optional(),
    // pt-BR: Remove obrigatoriedade; aceita número e coage para string.
    // en-US: Not required; accepts numeric and coerces to string.
    duracao: z
      .coerce.string()
      .optional()
      .refine((v) => (v === undefined || v === '' || /^\d+$/.test(String(v).trim())), 'Duração deve ser um número inteiro'),
    // pt-BR: Remove obrigatoriedade; aceita vazio.
    // en-US: Not required; accepts empty.
    unidade_duracao: z.enum(['Hrs', 'Min']).optional(),
    // pt-BR: Remove obrigatoriedade; aceita vazio.
    // en-US: Not required; accepts empty.
    tipo: z.coerce.string().optional(),
    categoria: z.coerce.string().optional(),

    // pt-BR: Valores opcionais; validam somente quando presentes.
    // en-US: Optional values; validate only when provided.
    inscricao: z
      .coerce.string()
      .optional()
      .refine((v) => (v === undefined || currencyRemoveMaskToNumber(v) >= 0), 'Inscrição inválida'),
    valor: z
      .coerce.string()
      .optional()
      .refine((v) => (v === undefined || currencyRemoveMaskToNumber(v) >= 0), 'Valor inválido'),
    parcelas: z.preprocess(
      (value) => {
        const normalized = String(value ?? '').trim();
        return normalized === '' ? undefined : normalized;
      },
      z
        .string()
        .optional()
        .refine((v) => (v === undefined || (/^\d+$/.test(String(v).trim()) && parseInt(String(v).trim(), 10) >= 1)), 'Parcelas deve ser inteiro >= 1')
    ),
    valor_parcela: z
      .coerce.string()
      .optional()
      .refine((v) => (v === undefined || v === '' || currencyRemoveMaskToNumber(v) >= 0), 'Valor da parcela inválido'),

    aeronaves: z.array(z.string()).optional(),
    modulos: z.array(moduleSchema),
    config: z.object({
        proximo_curso: z.coerce.string().optional(),
        gratis: z.any().optional(),
        comissao: z.coerce.string().optional(),
        tx2: z.array(z.object({ name_label: z.coerce.string().optional(), name_valor: z.coerce.string().optional() })).optional(),
        taxas: z.array(z.object({ titulo: z.coerce.string().optional(), valor: z.coerce.string().optional() })).optional(),
        tipo_desconto_taxa: z.any().optional(),
        desconto_taxa: z.coerce.string().optional(),
        pagina_divulgacao: z.coerce.string().optional(),
        video: z.coerce.string().optional(),
        pagina_venda: z.object({ link: z.coerce.string().optional(), label: z.coerce.string().optional() }).optional(),
        adc: z.object({ recheck: z.any().optional(), recorrente: z.any().optional(), cor: z.coerce.string().optional() }).optional(),
        ead: z.object({ id_eadcontrol: z.coerce.string().optional() }).optional(),
        public_signature_questions: z.array(z.string()).optional(),
        public_approval_questions: z.array(z.string()).optional(),
        public_signature_required_questions: z.array(z.string()).optional(),
        public_approval_required_questions: z.array(z.string()).optional(),
        public_signature_sections: z.object({
          status: z.boolean().optional(),
          info: z.boolean().optional(),
        }).optional(),
        public_approval_sections: z.object({
          status: z.boolean().optional(),
          info: z.boolean().optional(),
        }).optional(),
    }).optional(),
  });

  const { toast } = useToast();
  const form = useForm<CoursePayload>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      nome: '',
      titulo: '',
      ativo: 's',
      destaque: 'n',
      publicar: 's',
      duracao: '0',
      unidade_duracao: 'Hrs',
      tipo: '2',
      categoria: 'cursos_online',
      config: {
        proximo_curso: '',
        gratis: 'n',
        comissao: '0,00',
        tx2: [{ name_label: '', name_valor: '' }],
        taxas: [],
        tipo_desconto_taxa: 'v',
        desconto_taxa: '',
        pagina_divulgacao: '',
        video: '',
        pagina_venda: { link: '', label: '' },
        adc: { recheck: 'n', recorrente: 'n', cor: 'FFFFFF' },
        ead: { id_eadcontrol: '' },
        public_signature_questions: getDefaultPublicProposalQuestions('signature', '2'),
        public_approval_questions: getDefaultPublicProposalQuestions('approval', '2'),
        public_signature_required_questions: getDefaultPublicProposalRequiredQuestions('signature', '2'),
        public_approval_required_questions: getDefaultPublicProposalRequiredQuestions('approval', '2'),
        public_signature_sections: getDefaultPublicProposalSections('signature', '2'),
        public_approval_sections: getDefaultPublicProposalSections('approval', '2'),
      },
      inscricao: '0,00',
      valor: '0,00',
      // Parcelas opcional: deixa vazio por padrão
      parcelas: '',
      // Valor da parcela opcional: inicia vazio
      valor_parcela: '',
      aeronaves: [],
      modulos: [],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "modulos",
  });

  const { fields: taxasFields, append: appendTaxa, remove: removeTaxa, move: moveTaxa } = useFieldArray({
    control: form.control,
    name: "config.taxas",
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex((item) => item.id === active.id);
      const newIndex = fields.findIndex((item) => item.id === over.id);
      move(oldIndex, newIndex);
    }
  }

  /**
   * togglePublicQuestionVisibility
   * pt-BR: Liga/desliga a exibição de uma pergunta pública em cada etapa.
   * en-US: Toggles the visibility of a public question for each step.
   */
  function togglePublicQuestionVisibility(stage: 'signature' | 'approval', key: string, checked: boolean) {
    const fieldName = stage === 'signature'
      ? 'config.public_signature_questions'
      : 'config.public_approval_questions';
    const requiredFieldName = stage === 'signature'
      ? 'config.public_signature_required_questions'
      : 'config.public_approval_required_questions';
    const current = form.getValues(fieldName) ?? [];
    const sanitized = current.filter((item) => PUBLIC_PROPOSAL_QUESTION_KEYS.includes(item as any));
    const next = checked
      ? Array.from(new Set([...sanitized, key]))
      : sanitized.filter((item) => item !== key);

    form.setValue(fieldName, next, { shouldDirty: true, shouldValidate: true });
    if (!checked) {
      const currentRequired = form.getValues(requiredFieldName) ?? [];
      form.setValue(
        requiredFieldName,
        currentRequired.filter((item) => item !== key),
        { shouldDirty: true, shouldValidate: true }
      );
    }

    if (checked) {
      const question = PUBLIC_PROPOSAL_QUESTIONS.find((item) => item.key === key);
      if (question) {
        togglePublicSectionVisibility(stage, question.section, true);
      }
    }
  }

  /**
   * togglePublicSectionVisibility
   * pt-BR: Liga/desliga a exibição de uma seção pública em cada etapa.
   * en-US: Toggles the visibility of a public section for each step.
   */
  function togglePublicSectionVisibility(
    stage: 'signature' | 'approval',
    section: 'status' | 'info',
    checked: boolean
  ) {
    const fieldName = stage === 'signature'
      ? 'config.public_signature_sections'
      : 'config.public_approval_sections';
    const current = form.getValues(fieldName)
      ?? getDefaultPublicProposalSections(stage, form.getValues('tipo'));

    form.setValue(
      fieldName,
      { ...current, [section]: checked },
      { shouldDirty: true, shouldValidate: true }
    );
  }

  /**
   * togglePublicQuestionRequired
   * pt-BR: Define se uma pergunta visível deve ser opcional ou obrigatória.
   * en-US: Sets whether a visible question should be optional or required.
   */
  function togglePublicQuestionRequired(stage: 'signature' | 'approval', key: string, checked: boolean) {
    const fieldName = stage === 'signature'
      ? 'config.public_signature_required_questions'
      : 'config.public_approval_required_questions';
    const current = form.getValues(fieldName) ?? [];
    const sanitized = current.filter((item) => PUBLIC_PROPOSAL_QUESTION_KEYS.includes(item as any));
    const next = checked
      ? Array.from(new Set([...sanitized, key]))
      : sanitized.filter((item) => item !== key);

    form.setValue(fieldName, next, { shouldDirty: true, shouldValidate: true });
    if (checked) {
      togglePublicQuestionVisibility(stage, key, true);
    }
  }

  /**
   * onInvalid
   * pt-BR: Exibe mensagem amigável quando validação falha (ex.: módulo sem título).
   * en-US: Shows a friendly message when validation fails (e.g., module without title).
   */
  const onInvalid = () => {
    const errors = form.formState.errors as any;
    
    // Função recursiva para extrair mensagens de erro
    const getErrorMessages = (errObj: any): string[] => {
      let messages: string[] = [];
      if (!errObj) return messages;

      if (typeof errObj.message === 'string') {
        messages.push(errObj.message);
      }

      // Se for objeto, percorre chaves
      if (typeof errObj === 'object') {
        Object.values(errObj).forEach((val) => {
          if (val) {
             messages = [...messages, ...getErrorMessages(val)];
          }
        });
      }
      return messages;
    };

    const allMsgs = getErrorMessages(errors);
    // Dedup messages
    const uniqueMsgs = Array.from(new Set(allMsgs));

    toast({
      title: 'Erro de validação',
      description: uniqueMsgs.length > 0 ? uniqueMsgs.join('\n') : 'Verifique os campos obrigatórios.',
      variant: 'destructive',
    });
  };

  /**
   * exposeSubmitRef
   * pt-BR: Expõe o handleSubmit via referência opcional.
   * en-US: Exposes handleSubmit via optional ref.
   */
  useEffect(() => {
    if (onSubmitRef) {
      onSubmitRef.current = form.handleSubmit((raw) => {
        /**
         * Normalização de envio
         * pt-BR: Remove campos opcionais vazios e padroniza moedas para string BR.
         * en-US: Removes empty optional fields and normalizes currency to BR string.
         */
        const normalized: CoursePayload = { ...raw };
        // Parcelas opcional: omite quando vazio
        if (!normalized.parcelas) delete (normalized as any).parcelas;
        if (!normalized.valor_parcela) delete (normalized as any).valor_parcela;
        // Moedas: converte para string com vírgula (sem prefixo R$) para API
        if (normalized.inscricao) normalized.inscricao = normalizeCurrencyToBRString(normalized.inscricao) ?? '';
        if (normalized.valor) normalized.valor = normalizeCurrencyToBRString(normalized.valor) ?? '';
        if (normalized.valor_parcela) normalized.valor_parcela = normalizeCurrencyToBRString(normalized.valor_parcela) ?? '';
        
        // Normaliza taxas no config
        if (normalized.config?.taxas) {
          normalized.config.taxas = normalized.config.taxas.map((t) => ({
            ...t,
            valor: normalizeCurrencyToBRString(t.valor) ?? '',
          }));
        }

        return onSubmit(normalized);
      }, onInvalid);
    }
  }, [onSubmitRef, form, onSubmit, onInvalid]);

  /**
   * applyInitialData
   * pt-BR: Aplica dados iniciais no formulário quando em modo edição.
   * en-US: Applies initial form data when in edit mode.
   */
  useEffect(() => {
    if (!initialData) return;
    const c = initialData as CourseRecord;
    form.reset({
      ...c,
      config: {
        proximo_curso: c.config?.proximo_curso ?? '',
        gratis: c.config?.gratis ?? 'n',
        comissao: c.config?.comissao ?? '',
        tx2: c.config?.tx2?.length ? c.config.tx2 : [{ name_label: '', name_valor: '' }],
        taxas: c.config?.taxas ?? [],
        tipo_desconto_taxa: c.config?.tipo_desconto_taxa ?? 'v',
        desconto_taxa: c.config?.desconto_taxa ?? '',
        pagina_divulgacao: c.config?.pagina_divulgacao ?? '',
        video: c.config?.video ?? '',
        pagina_venda: c.config?.pagina_venda ?? { link: '', label: '' },
        adc: c.config?.adc ?? { recheck: 'n', recorrente: 'n', cor: 'FFFFFF' },
        ead: c.config?.ead ?? { id_eadcontrol: '' },
        public_signature_questions: c.config?.public_signature_questions ?? getDefaultPublicProposalQuestions('signature', c.tipo),
        public_approval_questions: c.config?.public_approval_questions ?? getDefaultPublicProposalQuestions('approval', c.tipo),
        public_signature_required_questions: c.config?.public_signature_required_questions ?? getDefaultPublicProposalRequiredQuestions('signature', c.tipo),
        public_approval_required_questions: c.config?.public_approval_required_questions ?? getDefaultPublicProposalRequiredQuestions('approval', c.tipo),
        public_signature_sections: c.config?.public_signature_sections ?? getDefaultPublicProposalSections('signature', c.tipo),
        public_approval_sections: c.config?.public_approval_sections ?? getDefaultPublicProposalSections('approval', c.tipo),
      },
      aeronaves: c.aeronaves ?? [],
      modulos: c.modulos ?? [],
    });
  }, [initialData]);

  /**
   * syncTituloFromNome
   * pt-BR: Copia o valor do "nome" para o campo oculto "titulo".
   * en-US: Copies "nome" value into hidden "titulo" field.
   */
  useEffect(() => {
    const nome = form.watch('nome');
    const tituloAtual = form.getValues('titulo');
    if (nome && tituloAtual !== nome) {
      form.setValue('titulo', nome, { shouldValidate: false });
    }
  }, [form.watch('nome')]);

  const publicSignatureQuestions = form.watch('config.public_signature_questions') ?? [];
  const publicApprovalQuestions = form.watch('config.public_approval_questions') ?? [];
  const publicSignatureRequiredQuestions = form.watch('config.public_signature_required_questions') ?? [];
  const publicApprovalRequiredQuestions = form.watch('config.public_approval_required_questions') ?? [];
  const publicSignatureSections = form.watch('config.public_signature_sections')
    ?? getDefaultPublicProposalSections('signature', form.watch('tipo'));
  const publicApprovalSections = form.watch('config.public_approval_sections')
    ?? getDefaultPublicProposalSections('approval', form.watch('tipo'));

  // Aeronaves para seleção
  const aircraftsQuery = useQuery({
    queryKey: ['aeronaves', 'list', 200],
    queryFn: async () => aircraftSettingsService.list({ page: 1, per_page: 200 }),
  });
  const aircraftOptions = useMemo(
    () => (aircraftsQuery.data?.data ?? []).map((a: any) => ({ id: String(a.id), nome: a.nome ?? a.codigo ?? String(a.id) })),
    [aircraftsQuery.data]
  );

  /**
   * periodsQueryByCourse
   * pt-BR: Lista períodos do curso sendo editado para uso nos módulos quando tipo=4.
   * en-US: Lists periods of the course being edited to use in modules when tipo=4.
   */
  const courseId = useMemo(() => {
    const idFromInitial = (initialData as CourseRecord | undefined)?.id;
    const idFromForm = (form.getValues('id') as any) ?? undefined;
    return idFromInitial || idFromForm || undefined;
  }, [initialData]);
  const periodsQuery = useQuery({
    queryKey: ['periodos', 'by_course', courseId],
    queryFn: async () => {
      if (!courseId) return { data: [] } as any;
      return periodsService.listPeriods({ page: 1, per_page: 200, id_curso: courseId as any });
    },
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const periodItems = useMemo(() => {
    const res = periodsQuery.data as any;
    return ((res?.data || res?.items || []) as any[]).map((p: any) => ({
      id: String(p.id),
      nome: String(p?.nome || p?.title || p.id),
      valor: p?.valor,
      id_contratos: Array.isArray(p?.id_contratos) ? p.id_contratos : [],
    })) as CoursePeriodListItem[];
  }, [periodsQuery.data]);
  const [orderedPeriodItems, setOrderedPeriodItems] = useState<CoursePeriodListItem[]>([]);
  const [isSavingPeriodOrder, setIsSavingPeriodOrder] = useState(false);
  const [highlightedPeriodId, setHighlightedPeriodId] = useState<string | null>(null);
  const periodCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  useEffect(() => {
    if (!isSavingPeriodOrder) {
      setOrderedPeriodItems(periodItems);
    }
  }, [periodItems, isSavingPeriodOrder]);

  /**
   * contractsQueryByCourse
   * pt-BR: Busca os contratos do curso atual para exibir os vínculos de cada período.
   * en-US: Fetches contracts for the current course to display each period's linked contracts.
   */
  const contractsQueryByCourse = useQuery({
    queryKey: ['contracts', 'by_course', courseId],
    queryFn: async () => {
      if (!courseId) return { data: [] } as any;
      return contractsService.listContracts({ page: 1, per_page: 200, id_curso: courseId as any });
    },
    enabled: !!courseId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const courseContractItems = useMemo(() => {
    const res = contractsQueryByCourse.data as any;
    return (res?.data || res?.items || []) as any[];
  }, [contractsQueryByCourse.data]);

  /**
   * handleCreatePeriod
   * pt-BR: Abre a criação de período com curso pré-preenchido e retorno para a aba atual do curso.
   * en-US: Opens period creation with the course prefilled and a return path to the current course tab.
   */
  function handleCreatePeriod() {
    if (!courseId) return;
    navigate(`/admin/school/periods/create?id_curso=${encodeURIComponent(String(courseId))}`, {
      state: {
        prefillData: { id_curso: Number(courseId) },
        returnPath: `${location.pathname}${location.search}`,
      },
    });
  }

  /**
   * handleCreateContractForPeriod
   * pt-BR: Abre a criação de contrato para o curso atual e retorna para a edição do período selecionado.
   * en-US: Opens contract creation for the current course and returns to the selected period edit screen.
   */
  function handleCreateContractForPeriod(periodId: string | number) {
    if (!courseId) return;
    navigate('/admin/school/contracts/create', {
      state: {
        prefillData: { id_curso: Number(courseId) },
        returnPath: getPeriodEditUrl(periodId, courseId),
      },
    });
  }

  /**
   * handleEditContractFromPeriod
   * pt-BR: Abre a edição do contrato vinculado ao período e retorna para a aba atual do curso.
   * en-US: Opens contract editing from a linked period and returns to the current course tab.
   */
  function handleEditContractFromPeriod(contractId: string | number) {
    navigate(`/admin/school/contracts/${encodeURIComponent(String(contractId))}/edit`, {
      state: {
        returnPath: `${location.pathname}${location.search}`,
      },
    });
  }

  /**
   * handleManagePeriodContracts
   * pt-BR: Abre a edição do período para gerenciar os contratos vinculados e demais dados.
   * en-US: Opens period editing to manage linked contracts and other settings.
   */
  function handleManagePeriodContracts(periodId: string | number) {
    navigate(getPeriodEditUrl(periodId, courseId), {
      state: {
        returnPath: `${location.pathname}${location.search}`,
      },
    });
  }

  /**
   * getPeriodContractLabels
   * pt-BR: Resolve os nomes dos contratos associados a um período com base na lista do curso.
   * en-US: Resolves the names of contracts linked to a period based on the course list.
   */
  function getPeriodContractLabels(period: { id_contratos?: (string | number)[] }): string[] {
    const ids = Array.isArray(period?.id_contratos) ? period.id_contratos : [];
    return ids.map((cid) => {
      const item = courseContractItems.find((contract: any) => String(contract?.id) === String(cid));
      return String(item?.nome || item?.title || item?.slug || cid);
    });
  }

  /**
   * getPeriodContracts
   * pt-BR: Retorna os contratos completos vinculados ao período para exibir ações rápidas.
   * en-US: Returns the full contracts linked to the period to render quick actions.
   */
  function getPeriodContracts(period: { id_contratos?: (string | number)[] }) {
    const ids = Array.isArray(period?.id_contratos) ? period.id_contratos : [];
    return ids.map((cid) => {
      const item = courseContractItems.find((contract: any) => String(contract?.id) === String(cid));
      return {
        id: item?.id ?? cid,
        label: String(item?.nome || item?.title || item?.slug || cid),
      };
    });
  }

  /**
   * handleUpdatePeriodContracts
   * pt-BR: Atualiza os contratos vinculados ao período diretamente pela aba do curso.
   * en-US: Updates the contracts linked to a period directly from the course tab.
   */
  async function handleUpdatePeriodContracts(periodId: string | number, nextContractIds: (string | number)[]) {
    await periodsService.updatePeriod(periodId, { id_contratos: nextContractIds });
    setOrderedPeriodItems((current) => current.map((item) => (
      String(item.id) === String(periodId)
        ? { ...item, id_contratos: nextContractIds }
        : item
    )));
    queryClient.invalidateQueries({ queryKey: ['periodos'] });
    queryClient.invalidateQueries({ queryKey: ['periods'] });
    await periodsQuery.refetch();
  }

  /**
   * restorePeriodViewport
   * pt-BR: Mantém o usuário próximo ao período atualizado, restaurando a rolagem
   *        e destacando temporariamente o card alterado.
   * en-US: Keeps the user near the updated period by restoring scroll position
   *        and temporarily highlighting the changed card.
   */
  function restorePeriodViewport(periodId: string | number, scrollTop?: number) {
    const targetId = String(periodId);
    window.setTimeout(() => {
      if (typeof scrollTop === 'number') {
        window.scrollTo({ top: scrollTop, behavior: 'auto' });
      }
      const node = periodCardRefs.current[targetId];
      node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      setHighlightedPeriodId(targetId);
      window.setTimeout(() => setHighlightedPeriodId((current) => (current === targetId ? null : current)), 2200);
    }, 0);
  }

  /**
   * handlePeriodDragEnd
   * pt-BR: Reordena os períodos da aba e persiste a nova sequência no backend.
   * en-US: Reorders periods in the tab and persists the new sequence in the backend.
   */
  async function handlePeriodDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) return;

    const oldIndex = orderedPeriodItems.findIndex((item) => String(item.id) === activeId);
    const newIndex = orderedPeriodItems.findIndex((item) => String(item.id) === overId);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(orderedPeriodItems, oldIndex, newIndex);
    setOrderedPeriodItems(next);
    setIsSavingPeriodOrder(true);

    try {
      await periodsService.reorderPeriods(next.map((item) => item.id), courseId);
      toast({ title: 'Ordem atualizada', description: 'A nova ordem dos períodos foi salva com sucesso.' });
      await periodsQuery.refetch();
    } catch (error: any) {
      setOrderedPeriodItems(periodItems);
      toast({
        title: 'Erro ao salvar ordem',
        description: String(error?.response?.data?.message || error?.body?.message || error?.message || 'Não foi possível salvar a nova ordem dos períodos.'),
        variant: 'destructive',
      });
    } finally {
      setIsSavingPeriodOrder(false);
    }
  }

  /**
   * SortablePeriodCard
   * pt-BR: Item ordenável da lista de períodos com ações rápidas para contratos e edição.
   * en-US: Sortable period list item with quick actions for contracts and editing.
   */
  function SortablePeriodCard({ period, index }: { period: CoursePeriodListItem; index: number }) {
    const id = String(period.id);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 50 : 'auto',
      position: 'relative' as const,
      opacity: isDragging ? 0.3 : 1,
    };

    return (
      <div
        ref={(node) => {
          setNodeRef(node);
          periodCardRefs.current[id] = node;
        }}
        style={style}
        className={`group flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between rounded-lg border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md hover:border-primary/20 ${
          highlightedPeriodId === id ? 'ring-2 ring-primary/40 border-primary/40 bg-primary/5' : ''
        }`}
      >
        <div className="flex items-start gap-3 w-full md:w-auto">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="mt-1 flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed transition-colors"
            title="Arraste para reordenar"
            disabled={isSavingPeriodOrder}
          >
            <GripVertical className="h-5 w-5" />
          </button>
          
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs bg-muted/50 font-normal">
                {index + 1}º Período
              </Badge>
              <span className="text-base font-semibold">{period.nome}</span>
              <span className="text-xs text-muted-foreground">#{period.id}</span>
            </div>
            
            <div className="flex items-center gap-2">
              {period.valor ? (
                <Badge variant="secondary" className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                  Valor: {formatCurrencyBRLDisplay(period.valor)}
                </Badge>
              ) : (
                <Badge variant="secondary" className="bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                  Valor não informado
                </Badge>
              )}
            </div>

            <div className="pt-2">
              {contractsQueryByCourse.isLoading || contractsQueryByCourse.isFetching ? (
                <p className="text-xs text-muted-foreground animate-pulse">Carregando contratos...</p>
              ) : getPeriodContracts(period).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {getPeriodContracts(period).map((contract) => (
                    <div
                      key={`${period.id}-${contract.id}`}
                      className="inline-flex items-center gap-1 rounded-md border bg-background px-1.5 py-1 shadow-sm"
                    >
                      <Badge variant="outline" className="text-xs font-normal">
                        {contract.label}
                      </Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() => handleEditContractFromPeriod(contract.id)}
                        title={`Editar contrato ${contract.label}`}
                      >
                        <PencilLine className="mr-1 h-3 w-3" />
                        Editar contrato
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Nenhum contrato vinculado a este período.</p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end md:self-center ml-10 md:ml-0">
          <PeriodContractsSelector period={period} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleCreateContractForPeriod(period.id)}
            className="h-8"
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Contrato
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => handleManagePeriodContracts(period.id)}
            className="h-8"
          >
            <PencilLine className="mr-1.5 h-3.5 w-3.5" />
            Editar
          </Button>
        </div>
      </div>
    );
  }

  /**
   * PeriodContractsSelector
   * pt-BR: Popover para selecionar contratos já existentes e vinculá-los ao período atual.
   * en-US: Popover to select existing contracts and link them to the current period.
   */
  function PeriodContractsSelector({ period }: { period: CoursePeriodListItem }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [draftIds, setDraftIds] = useState<(string | number)[]>(period.id_contratos || []);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
      setDraftIds(period.id_contratos || []);
    }, [period.id_contratos]);

    const filteredContracts = useMemo(() => {
      const term = query.trim().toLowerCase();
      if (!term) return courseContractItems;
      return courseContractItems.filter((contract: any) =>
        String(contract?.nome || contract?.title || contract?.slug || '')
          .toLowerCase()
          .includes(term)
      );
    }, [query]);

    const hasChanges = JSON.stringify(draftIds.map(String).sort()) !== JSON.stringify((period.id_contratos || []).map(String).sort());

    /**
     * handleSaveContracts
     * pt-BR: Persiste os contratos selecionados para o período atual.
     * en-US: Persists the selected contracts for the current period.
     */
    async function handleSaveContracts() {
      const currentScrollTop = typeof window !== 'undefined' ? window.scrollY : undefined;
      setIsSaving(true);
      try {
        await handleUpdatePeriodContracts(period.id, draftIds);
        toast({
          title: 'Contratos atualizados',
          description: 'Os contratos do período foram atualizados com sucesso.',
        });
        setOpen(false);
        restorePeriodViewport(period.id, currentScrollTop);
      } catch (error: any) {
        toast({
          title: 'Erro ao atualizar contratos',
          description: String(error?.response?.data?.message || error?.body?.message || error?.message || 'Não foi possível atualizar os contratos do período.'),
          variant: 'destructive',
        });
      } finally {
        setIsSaving(false);
      }
    }

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" size="sm">
            Selecionar contratos
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-3" align="end">
          <div className="space-y-3">
            <Input
              placeholder="Buscar contrato existente..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ScrollArea className="h-56 pr-2">
              <div className="space-y-1">
                {filteredContracts.map((contract: any) => {
                  const id = contract.id;
                  const checked = draftIds.map(String).includes(String(id));
                  const label = String(contract?.nome || contract?.title || contract?.slug || id);
                  return (
                    <label
                      key={String(id)}
                      className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(nextChecked) => {
                          const next = new Set(draftIds.map(String));
                          if (nextChecked) {
                            next.add(String(id));
                          } else {
                            next.delete(String(id));
                          }
                          setDraftIds(Array.from(next));
                        }}
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  );
                })}
                {filteredContracts.length === 0 && (
                  <div className="py-4 text-center text-xs text-muted-foreground">
                    Nenhum contrato encontrado.
                  </div>
                )}
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between border-t pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDraftIds([])}
                disabled={isSaving}
              >
                Limpar
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  disabled={isSaving}
                >
                  Fechar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveContracts}
                  disabled={!hasChanges || isSaving}
                >
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  /**
   * formatPeriodModuleTitle
   * pt-BR: Rótulo do período no módulo: "id - nome" e, se houver valor,
   *        exibe em BRL. Números ou strings só com dígitos são tratados
   *        como reais (ex.: 17820 -> R$ 17.820,00). Strings já mascaradas
   *        mantêm a máscara.
   * en-US: Period label in module: "id - name" and, if there's a value,
   *        shows BRL. Numbers or digit-only strings are treated as reais
   *        (e.g., 17820 -> R$ 17,820.00). Pre-masked strings keep their mask.
   */
  function formatPeriodModuleTitle(p: { id: string; nome: string; valor?: number | string }): string {
    const hasValor = p.valor !== undefined && p.valor !== null && String(p.valor) !== '';
    const valorMask = hasValor ? formatCurrencyBRLDisplay(p.valor as any) : '';
    return hasValor ? `${p.id} - ${p.nome} (${valorMask})` : `${p.id} - ${p.nome}`;
  }

  /**
   * addModule
   * pt-BR: Adiciona um módulo ao curso.
   * en-US: Adds a module to the course.
   */

  const addModule = () => {
    append({ etapa: 'etapa1', nome: '', titulo: '', limite: '1', valor: '' });
  };

  /**
   * removeModule
   * pt-BR: Remove um módulo pelo índice.
   * en-US: Removes a module by index.
   */
  const removeModule = (index: number) => {
    remove(index);
  };

  /**
   * ModuleAircraftSelect
   * pt-BR: Seletor múltiplo de aeronaves por linha de módulo.
   * en-US: Per-row module aircraft multi-select component.
   */
  const ModuleAircraftSelect = ({
    value,
    onChange,
  }: {
    value: string[];
    onChange: (next: string[]) => void;
  }) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const filtered = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return aircraftOptions;
      return aircraftOptions.filter((a) => a.nome.toLowerCase().includes(q));
    }, [query, aircraftOptions]);

    const label = value.length
      ? aircraftOptions
          .filter((a) => value.includes(a.id))
          .map((a) => a.nome)
          .join(', ')
      : 'Selecione uma aeronave';

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="justify-between w-full">
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-2">
          <div className="space-y-2">
            <Input placeholder="Buscar aeronave..." value={query} onChange={(e) => setQuery(e.target.value)} />
            <ScrollArea className="h-52">
              <div className="space-y-1">
                {filtered.map((a) => {
                  const checked = value.includes(a.id);
                  return (
                    <label key={a.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(c) => {
                          const next = new Set(value);
                          if (c) next.add(a.id); else next.delete(a.id);
                          onChange(Array.from(next));
                        }}
                      />
                      <span className="text-sm">{a.nome}</span>
                    </label>
                  );
                })}
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between pt-1">
              <Button type="button" variant="ghost" onClick={() => onChange([])}>Limpar</Button>
              <Button type="button" onClick={() => setOpen(false)}>Concluir</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  /**
   * handleSubmit
   * pt-BR: Encaminha valores do formulário para o callback externo.
   * en-US: Forwards form values to external submit callback.
   */
  const handleSubmit = (data: CoursePayload) => {
    return onSubmit(data);
  };


  /**
   * RequiredMark
   * pt-BR: Indicador visual para marcar campos obrigatórios.
   * en-US: Visual indicator to mark required fields.
   */
  const RequiredMark = () => (<span className="text-red-600 ml-1">*</span>);

  // Passar o tipo do curso para o componente da aba
  const courseType = form.watch('tipo');

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit, onInvalid)} className="space-y-6">
      <Tabs 
        value={initialTab} 
        onValueChange={(val) => setSearchParams({ tab: val }, { replace: true })}
        className="w-full"
      >
          <TabsList>
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="pricing">Valores</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
            <TabsTrigger value="aircrafts">Aeronaves</TabsTrigger>
            <TabsTrigger value="modules">{getModulesTabLabel(courseType)}</TabsTrigger>
            {(form.watch('tipo') === '1' || form.watch('tipo') === '2') && (
              <TabsTrigger value="contracts">Termos e Contratos</TabsTrigger>
            )}
          </TabsList>
          <p className="text-xs text-muted-foreground mt-2">Campos marcados com <span className="text-red-600">*</span> são obrigatórios.</p>

          {/* Informações */}
          {/* Informações */}
          <TabsContent value="info" className="space-y-4 pt-4">
            <Card>
              <CardHeader>
                <CardTitle>Informações Gerais</CardTitle>
                <CardDescription>Dados principais do curso.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome interno<RequiredMark /></Label>
                    <Input placeholder="Nome interno (admin)" {...form.register('nome')} className={form.formState.errors?.nome ? 'border-red-500' : ''} />
                    {form.formState.errors?.nome && (
                      <p className="text-xs text-red-600">{String(form.formState.errors.nome.message)}</p>
                    )}
                  </div>
                  {/* Campo oculto para Título (aluno) */}
                  <input type="hidden" {...form.register('titulo')} />

                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Input placeholder="2" {...form.register('tipo')} className={form.formState.errors?.tipo ? 'border-red-500' : ''} />
                    {form.formState.errors?.tipo && (
                      <p className="text-xs text-red-600">{String(form.formState.errors.tipo.message)}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Categoria</Label>
                    <Input placeholder="cursos_online" {...form.register('categoria')} className={form.formState.errors?.categoria ? 'border-red-500' : ''} />
                    {form.formState.errors?.categoria && (
                      <p className="text-xs text-red-600">{String(form.formState.errors.categoria.message)}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Duração</Label>
                    <div className="flex gap-2">
                      <Input placeholder="0" {...form.register('duracao')} className={form.formState.errors?.duracao ? 'border-red-500 w-24' : 'w-24'} />
                      <Select value={form.watch('unidade_duracao')} onValueChange={(v) => form.setValue('unidade_duracao', v)}>
                        <SelectTrigger className="w-[120px]"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Hrs">Hora(s)</SelectItem>
                          <SelectItem value="Min">Minuto(s)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.formState.errors?.duracao && (
                        <p className="text-xs text-red-600">{String(form.formState.errors.duracao.message)}</p>
                    )}
                    {form.formState.errors?.unidade_duracao && (
                        <p className="text-xs text-red-600">{String((form.formState.errors as any).unidade_duracao?.message)}</p>
                    )}
                  </div>
                </div>

                <Separator className="my-4" />
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5">
                      <Label>Ativar</Label>
                      <p className="text-xs text-muted-foreground">Disponibiliza o curso</p>
                    </div>
                    <Switch checked={form.watch('ativo') === 's'} onCheckedChange={(checked) => form.setValue('ativo', checked ? 's' : 'n')} />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5"><Label>Destaque</Label></div>
                    <Switch checked={form.watch('destaque') === 's'} onCheckedChange={(checked) => form.setValue('destaque', checked ? 's' : 'n')} />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div className="space-y-0.5"><Label>Publicar</Label></div>
                    <Switch checked={form.watch('publicar') === 's'} onCheckedChange={(checked) => form.setValue('publicar', checked ? 's' : 'n')} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Valores */}
          <TabsContent value="pricing" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Inscrição</Label>
                <Input
                  placeholder="R$ 0,00"
                  value={form.watch('inscricao') || ''}
                  onChange={(e) => {
                    /**
                     * Aplica máscara BRL aos valores de inscrição.
                     */
                    const v = currencyApplyMask(e.target.value, 'pt-BR', 'BRL');
                    form.setValue('inscricao', v, { shouldValidate: true });
                  }}
                  className={form.formState.errors?.inscricao ? 'border-red-500' : ''}
                />
                {form.formState.errors?.inscricao && (
                  <p className="text-xs text-red-600">{String(form.formState.errors.inscricao.message)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input
                  placeholder="R$ 900,00"
                  value={form.watch('valor') || ''}
                  onChange={(e) => {
                    /**
                     * Aplica máscara BRL ao valor total do curso.
                     */
                    const v = currencyApplyMask(e.target.value, 'pt-BR', 'BRL');
                    form.setValue('valor', v, { shouldValidate: true });
                  }}
                  className={form.formState.errors?.valor ? 'border-red-500' : ''}
                />
                {form.formState.errors?.valor && (
                  <p className="text-xs text-red-600">{String(form.formState.errors.valor.message)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Parcelas</Label>
                <Input
                  placeholder="Opcional (ex.: 1)"
                  value={form.watch('parcelas') || ''}
                  onChange={(e) => {
                    /**
                     * Aceita apenas dígitos e não trata vazio como erro.
                     */
                    const onlyDigits = e.target.value.replace(/\D/g, '');
                    form.setValue('parcelas', onlyDigits, {
                      shouldDirty: true,
                      shouldValidate: onlyDigits.length > 0,
                    });
                    if (!onlyDigits.length) {
                      form.clearErrors('parcelas');
                    }
                  }}
                  className={form.formState.errors?.parcelas ? 'border-red-500' : ''}
                />
                {form.formState.errors?.parcelas && (
                  <p className="text-xs text-red-600">{String(form.formState.errors.parcelas.message)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Valor da parcela</Label>
                <Input
                  placeholder="R$ 900,00"
                  value={form.watch('valor_parcela') || ''}
                  onChange={(e) => {
                    /**
                     * Aplica máscara BRL ao valor de cada parcela.
                     */
                    const raw = e.target.value;
                    const v = raw ? currencyApplyMask(raw, 'pt-BR', 'BRL') : '';
                    form.setValue('valor_parcela', v, { shouldValidate: true });
                  }}
                  className={form.formState.errors?.valor_parcela ? 'border-red-500' : ''}
                />
                {form.formState.errors?.valor_parcela && (
                  <p className="text-xs text-red-600">{String(form.formState.errors.valor_parcela.message)}</p>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Configurações */}
          {/* Configurações */}
          <TabsContent value="config" className="space-y-6 pt-4">
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Geral</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Próximo curso</Label><Input {...form.register('config.proximo_curso')} /></div>
                <div className="space-y-2">
                  <Label>Grátis</Label>
                  <Select value={form.watch('config.gratis')} onValueChange={(v) => form.setValue('config.gratis', v as any)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent><SelectItem value="s">Sim</SelectItem><SelectItem value="n">Não</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Comissão</Label><Input placeholder="3,00" {...form.register('config.comissao')} /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Seções e Perguntas Públicas</CardTitle>
                <CardDescription>
                  Defina quais seções e perguntas aparecem no fluxo público de assinatura: etapa 1 de conferência e etapa 2 de aprovação.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <div className="col-span-8">Seção</div>
                    <div className="col-span-2 text-center">Assinatura 1</div>
                    <div className="col-span-2 text-center">Assinatura 2</div>
                  </div>

                  {PUBLIC_PROPOSAL_SECTIONS.map((section) => (
                    <div
                      key={section.key}
                      className="grid grid-cols-12 gap-2 items-center rounded-lg border px-3 py-3"
                    >
                      <div className="col-span-12 md:col-span-8">
                        <div className="text-sm font-medium">{section.label}</div>
                        <div className="text-xs text-muted-foreground">
                          Controla a exibição do título e do grupo de perguntas desta seção.
                        </div>
                      </div>
                      <div className="col-span-6 md:col-span-2 flex items-center justify-center">
                        <Checkbox
                          checked={Boolean(publicSignatureSections[section.key])}
                          onCheckedChange={(checked) => togglePublicSectionVisibility('signature', section.key, Boolean(checked))}
                        />
                      </div>
                      <div className="col-span-6 md:col-span-2 flex items-center justify-center">
                        <Checkbox
                          checked={Boolean(publicApprovalSections[section.key])}
                          onCheckedChange={(checked) => togglePublicSectionVisibility('approval', section.key, Boolean(checked))}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                <div className="grid grid-cols-12 gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <div className="col-span-8">Pergunta</div>
                  <div className="col-span-2 text-center">Assinatura 1</div>
                  <div className="col-span-2 text-center">Assinatura 2</div>
                </div>

                <div className="space-y-2">
                  {PUBLIC_PROPOSAL_QUESTIONS.map((question) => {
                    const signatureChecked = publicSignatureQuestions.includes(question.key);
                    const approvalChecked = publicApprovalQuestions.includes(question.key);
                    const signatureRequired = publicSignatureRequiredQuestions.includes(question.key);
                    const approvalRequired = publicApprovalRequiredQuestions.includes(question.key);

                    return (
                      <div
                        key={question.key}
                        className="grid grid-cols-12 gap-2 items-center rounded-lg border px-3 py-3"
                      >
                        <div className="col-span-12 md:col-span-8">
                          <div className="text-sm font-medium">{question.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {question.section === 'status' ? 'Situação atual' : 'Informações passadas'}
                          </div>
                        </div>
                        <div className="col-span-6 md:col-span-2 flex flex-col items-center justify-center gap-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={signatureChecked}
                              onCheckedChange={(checked) => togglePublicQuestionVisibility('signature', question.key, Boolean(checked))}
                            />
                            <span className="text-xs text-muted-foreground">Exibir</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={signatureRequired}
                              onCheckedChange={(checked) => togglePublicQuestionRequired('signature', question.key, Boolean(checked))}
                            />
                            <span className="text-xs text-muted-foreground">Obrig.</span>
                          </div>
                        </div>
                        <div className="col-span-6 md:col-span-2 flex flex-col items-center justify-center gap-2">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={approvalChecked}
                              onCheckedChange={(checked) => togglePublicQuestionVisibility('approval', question.key, Boolean(checked))}
                            />
                            <span className="text-xs text-muted-foreground">Exibir</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={approvalRequired}
                              onCheckedChange={(checked) => togglePublicQuestionRequired('approval', question.key, Boolean(checked))}
                            />
                            <span className="text-xs text-muted-foreground">Obrig.</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Custos e Taxas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                
                {/* Taxas List */}
                <div className="space-y-2">
                   <div className="flex justify-between items-center">
                      <Label className="text-sm font-medium">Taxas</Label>
                   </div>
                   <div className="border rounded-md">
                      <div className="grid grid-cols-12 gap-2 p-2 bg-muted/50 text-xs font-medium border-b uppercase text-muted-foreground">
                         <div className="col-span-1 text-center"></div>
                         <div className="col-span-7">Título</div>
                         <div className="col-span-3">Valor</div>
                         <div className="col-span-1"></div>
                      </div>
                      {taxasFields.map((field, index) => (
                        <div key={field.id} className="grid grid-cols-12 gap-2 p-2 items-center border-b last:border-0 hover:bg-muted/20">
                           <div className="col-span-1 flex flex-col items-center gap-1">
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                className="h-5 w-5 p-0"
                                disabled={index === 0}
                                onClick={() => moveTaxa(index, index - 1)}
                              >
                                 <ArrowUp className="h-3 w-3" />
                              </Button>
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="sm" 
                                className="h-5 w-5 p-0"
                                disabled={index === taxasFields.length - 1}
                                onClick={() => moveTaxa(index, index + 1)}
                              >
                                 <ArrowDown className="h-3 w-3" />
                              </Button>
                           </div>
                           <div className="col-span-7">
                              <Input {...form.register(`config.taxas.${index}.titulo`)} placeholder="Ex: Taxa de Examinador Credenciado ANAC" />
                           </div>
                           <div className="col-span-3">
                              <Input 
                                placeholder="0,00"
                                value={form.watch(`config.taxas.${index}.valor`) || ''}
                                onChange={(e) => {
                                  const v = currencyApplyMask(e.target.value, 'pt-BR', 'BRL');
                                  form.setValue(`config.taxas.${index}.valor`, v);
                                }} 
                              />
                           </div>
                           <div className="col-span-1 text-center">
                              <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeTaxa(index)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                           </div>
                        </div>
                      ))}
                      <div className="p-2 bg-muted/10">
                         <Button type="button" variant="outline" size="sm" onClick={() => appendTaxa({ titulo: '', valor: '' })}>
                            <Plus className="h-4 w-4 mr-2" /> Adicionar
                         </Button>
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2"><Label>Tipo de Desconto</Label>
                    <Select value={form.watch('config.tipo_desconto_taxa')} onValueChange={(v) => form.setValue('config.tipo_desconto_taxa', v as any)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent><SelectItem value="v">Valor</SelectItem><SelectItem value="p">Percentual</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Desconto das taxas</Label>
                    <div className="flex">
                        <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-input bg-muted text-muted-foreground text-sm">
                            {form.watch('config.tipo_desconto_taxa') === 'v' ? 'R$' : '%'}
                        </span>
                        <Input 
                            className="rounded-l-none" 
                            placeholder="Desconto das taxas"
                            value={form.watch('config.desconto_taxa') || ''}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (form.watch('config.tipo_desconto_taxa') === 'v') {
                                    form.setValue('config.desconto_taxa', currencyApplyMask(val, 'pt-BR', 'BRL'));
                                } else {
                                    form.setValue('config.desconto_taxa', val);
                                }
                            }}
                        />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Marketing e Divulgação</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2"><Label>Página de divulgação</Label><Input {...form.register('config.pagina_divulgacao')} /></div>
                <div className="space-y-2 md:col-span-2"><Label>Vídeo (YouTube)</Label><Input placeholder="https://..." {...form.register('config.video')} /></div>
                <div className="space-y-2"><Label>Página de venda (link)</Label><Input {...form.register('config.pagina_venda.link')} /></div>
                <div className="space-y-2"><Label>Página de venda (label)</Label><Input {...form.register('config.pagina_venda.label')} /></div>
              </CardContent>
            </Card>

            <Card>
               <CardHeader className="pb-3">
                <CardTitle className="text-base">Integrações (ADC / EAD)</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="space-y-2"><Label>ADC: Recheck</Label>
                  <Select value={form.watch('config.adc.recheck')} onValueChange={(v) => form.setValue('config.adc.recheck', v as any)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent><SelectItem value="s">Sim</SelectItem><SelectItem value="n">Não</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>ADC: Recorrente</Label>
                  <Select value={form.watch('config.adc.recorrente')} onValueChange={(v) => form.setValue('config.adc.recorrente', v as any)}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent><SelectItem value="s">Sim</SelectItem><SelectItem value="n">Não</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>ADC: Cor (hex)</Label><Input placeholder="FFFFFF" {...form.register('config.adc.cor')} /></div>
                <div className="space-y-2 md:col-span-3"><Label>EAD: ID EADControl</Label><Input {...form.register('config.ead.id_eadcontrol')} /></div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Aeronaves */}
          <TabsContent value="aircrafts" className="space-y-4 pt-4">
            <div className="flex flex-wrap gap-2">
              {aircraftOptions.map((a) => {
                const selected = (form.watch('aeronaves') ?? []).includes(a.id);
                return (
                  <Badge key={a.id} variant={selected ? 'default' : 'secondary'} className="cursor-pointer" onClick={() => {
                    const curr = new Set(form.getValues('aeronaves') ?? []);
                    if (selected) curr.delete(a.id); else curr.add(a.id);
                    form.setValue('aeronaves', Array.from(curr));
                  }}>
                    {a.nome}
                  </Badge>
                );
              })}
            </div>
          </TabsContent>

          {/* Módulos / Períodos */}
          <TabsContent value="modules" className="space-y-4 pt-4">
            {form.watch('tipo') === '4' ? (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Períodos do Curso</CardTitle>
                    <CardDescription>
                      Este curso usa períodos (tipo 4). Gerencie os módulos diretamente pela estrutura de períodos.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCreatePeriod}
                        disabled={!courseId}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Novo período
                      </Button>
                      <Button
                        type="button"
                        onClick={() => navigate(getPeriodsFilterUrl(courseId))}
                        disabled={!courseId}
                      >
                        Abrir períodos do curso
                      </Button>
                      {!courseId && (
                        <span className="text-xs text-muted-foreground">Salve o curso para gerar o ID e habilitar o link.</span>
                      )}
                    </div>
                    {courseId ? (
                      periodsQuery.isLoading || periodsQuery.isFetching ? (
                        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                          Carregando períodos vinculados ao curso...
                        </div>
                      ) : orderedPeriodItems.length > 0 ? (
                        <div className="rounded-md border">
                          <div className="border-b px-4 py-3 text-sm font-medium">
                            <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                              <span>
                                {orderedPeriodItems.length} {orderedPeriodItems.length === 1 ? 'período encontrado' : 'períodos encontrados'}
                              </span>
                              <span className="text-xs font-normal text-muted-foreground">
                                Arraste os itens para reordenar os períodos do curso.
                              </span>
                            </div>
                          </div>
                          <DndContext
                            sensors={sensors}
                            collisionDetection={closestCenter}
                            onDragEnd={handlePeriodDragEnd}
                          >
                            <SortableContext
                              items={orderedPeriodItems.map((period) => period.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              <div className="divide-y">
                                {orderedPeriodItems.map((period, index) => (
                                  <SortablePeriodCard key={period.id} period={period} index={index} />
                                ))}
                              </div>
                            </SortableContext>
                          </DndContext>
                        </div>
                      ) : (
                        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                          Nenhum período cadastrado para este curso até o momento.
                        </div>
                      )
                    ) : (
                      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                        Salve o curso para visualizar os períodos vinculados.
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-3 p-4 border rounded-md bg-muted/20">
                {/**
                 * ModulesTabTipo4
                 * pt-BR: Para cursos do tipo 4, os módulos são geridos via página de períodos.
                 *        Use o botão abaixo para abrir a listagem de períodos já filtrada pelo curso.
                 * en-US: For type-4 courses, modules are managed via the periods page.
                 *        Use the button below to open the periods list pre-filtered by the course.
                 */}
                <p className="text-sm">
                  Este curso usa períodos (tipo 4). Gerencie os módulos diretamente na página de Períodos.
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => navigate(getPeriodsFilterUrl(courseId))}
                    disabled={!courseId}
                  >
                    Abrir períodos do curso
                  </Button>
                  {!courseId && (
                    <span className="text-xs text-muted-foreground">Salve o curso para gerar o ID e habilitar o link.</span>
                  )}
                </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Módulos do Curso</h3>
                    <p className="text-sm text-muted-foreground">Gerencie as etapas e conteúdos.</p>
                  </div>
                  <Button type="button" variant="outline" onClick={addModule}><Plus className="h-4 w-4 mr-2" />Adicionar módulo</Button>
                </div>
                
                <div className="space-y-4">
                  <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext 
                        items={fields}
                        strategy={verticalListSortingStrategy}
                    >
                      {fields.map((m, idx) => (
                        <SortableModuleItem key={m.id} id={m.id}>
                            <Card className="relative">
                            <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="absolute right-2 top-2 text-muted-foreground hover:text-red-500"
                                onClick={() => removeModule(idx)}
                                >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                            <CardContent className="pt-6">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                <div className="md:col-span-3 space-y-2">
                                    <Label>Etapa</Label>
                                    <Select 
                                        value={form.getValues(`modulos.${idx}.etapa`)} 
                                        onValueChange={(v) => form.setValue(`modulos.${idx}.etapa`, v, { shouldValidate: true })}
                                    >
                                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="etapa1">Etapa 1</SelectItem>
                                        <SelectItem value="etapa2">Etapa 2</SelectItem>
                                    </SelectContent>
                                    </Select>
                                    {((form.formState.errors.modulos as any)?.[idx]?.etapa?.message) && (
                                    <p className="text-xs text-red-600">{(form.formState.errors.modulos as any)[idx].etapa.message}</p>
                                    )}
                                </div>
                                
                                <div className="md:col-span-6 space-y-2">
                                    <Label>Título</Label>
                                    <Input {...form.register(`modulos.${idx}.titulo` as const)} placeholder="Título do módulo" />
                                    {((form.formState.errors.modulos as any)?.[idx]?.titulo?.message) && (
                                    <p className="text-xs text-red-600">{(form.formState.errors.modulos as any)[idx].titulo.message}</p>
                                    )}
                                </div>

                                <div className="md:col-span-3 space-y-2">
                                    <Label>Limite</Label>
                                    <Input {...form.register(`modulos.${idx}.limite` as const)} placeholder="1" />
                                </div>

                                <div className="md:col-span-4 space-y-2">
                                    <Label>Valor (R$)</Label>
                                    <Input 
                                        value={form.watch(`modulos.${idx}.valor`) || ''} 
                                        onChange={(e) => {
                                            const v = currencyApplyMask(e.target.value, 'pt-BR', 'BRL');
                                            form.setValue(`modulos.${idx}.valor`, v);
                                        }}
                                        placeholder="R$ 0,00"
                                    />
                                </div>

                                <div className="md:col-span-8 space-y-2">
                                    <Label>Aeronaves</Label>
                                    <ModuleAircraftSelect
                                        value={form.watch(`modulos.${idx}.aviao`) || []}
                                        onChange={(next) => {
                                            form.setValue(`modulos.${idx}.aviao`, next);
                                        }}
                                    />
                                </div>
                                </div>
                            </CardContent>
                            </Card>
                        </SortableModuleItem>
                      ))}
                    </SortableContext>
                  </DndContext>
                  {fields.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                          Nenhum módulo adicionado.
                      </div>
                  )}
                </div>
              </>
            )}
          </TabsContent>

          {/* Contratos (apenas tipo 1 e 2) */}
          {(form.watch('tipo') === '1' || form.watch('tipo') === '2') && (
            <TabsContent value="contracts" className="space-y-4 pt-4">
              <CourseContractsTab courseId={courseId} courseType={courseType} />
            </TabsContent>
          )}
        </Tabs>

        <Separator />
        
      </form>
    </FormProvider>
  );
}
