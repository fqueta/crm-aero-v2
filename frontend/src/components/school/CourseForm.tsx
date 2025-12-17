import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { aircraftSettingsService } from '@/services/aircraftSettingsService';
import { periodsService } from '@/services/periodsService';
import { CoursePayload, CourseRecord, CourseModule } from '@/types/courses';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { currencyApplyMask, currencyRemoveMaskToNumber } from '@/lib/masks/currency';

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
   * navigation
   * pt-BR: Navegação SPA para abrir a página de períodos com filtro.
   * en-US: SPA navigation to open periods page with filter.
   */
  const navigate = useNavigate();
  /**
   * courseSchema
   * pt-BR: Valida campos principais e valores monetários (aba "Valores").
   * en-US: Validates core fields and monetary values ("Valores" tab).
   */
  const moduleSchema = z.object({
    etapa: z.string().optional(),
    titulo: z.string().optional(),
    limite: z.coerce.string().optional(),
    valor: z.string().optional(),
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
    tipo: z.string().optional(),
    categoria: z.string().optional(),

    // pt-BR: Valores opcionais; validam somente quando presentes.
    // en-US: Optional values; validate only when provided.
    inscricao: z
      .string()
      .optional()
      .refine((v) => (v === undefined || currencyRemoveMaskToNumber(v) >= 0), 'Inscrição inválida'),
    valor: z
      .string()
      .optional()
      .refine((v) => (v === undefined || currencyRemoveMaskToNumber(v) >= 0), 'Valor inválido'),
    parcelas: z
      .coerce.string()
      .optional()
      .refine((v) => (v === undefined || v === '' || (/^\d+$/.test(String(v).trim()) && parseInt(String(v).trim(), 10) >= 1)), 'Parcelas deve ser inteiro >= 1'),
    valor_parcela: z
      .string()
      .optional()
      .refine((v) => (v === undefined || v === '' || currencyRemoveMaskToNumber(v) >= 0), 'Valor da parcela inválido'),

    aeronaves: z.array(z.string()).optional(),
    modulos: z.array(moduleSchema),
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
        tipo_desconto_taxa: 'v',
        desconto_taxa: '',
        pagina_divulgacao: '',
        video: '',
        pagina_venda: { link: '', label: '' },
        adc: { recheck: 'n', recorrente: 'n', cor: 'FFFFFF' },
        ead: { id_eadcontrol: '' },
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
        return onSubmit(normalized);
      });
    }
  }, [onSubmitRef, form, onSubmit]);

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
        tipo_desconto_taxa: c.config?.tipo_desconto_taxa ?? 'v',
        desconto_taxa: c.config?.desconto_taxa ?? '',
        pagina_divulgacao: c.config?.pagina_divulgacao ?? '',
        video: c.config?.video ?? '',
        pagina_venda: c.config?.pagina_venda ?? { link: '', label: '' },
        adc: c.config?.adc ?? { recheck: 'n', recorrente: 'n', cor: 'FFFFFF' },
        ead: c.config?.ead ?? { id_eadcontrol: '' },
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
    }));
  }, [periodsQuery.data]);

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
    const current = form.getValues('modulos') ?? [];
    const next: CourseModule = { etapa: 'etapa1', titulo: '', limite: '1', valor: '' };
    form.setValue('modulos', [...current, next]);
  };

  /**
   * removeModule
   * pt-BR: Remove um módulo pelo índice.
   * en-US: Removes a module by index.
   */
  const removeModule = (index: number) => {
    const current = [...(form.getValues('modulos') ?? [])];
    current.splice(index, 1);
    form.setValue('modulos', current);
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
   * onInvalid
   * pt-BR: Exibe mensagem amigável quando validação falha (ex.: módulo sem título).
   * en-US: Shows a friendly message when validation fails (e.g., module without title).
   */
  const onInvalid = () => {
    const errors = form.formState.errors as any;
    const hasModuleTitleError = Array.isArray(errors?.modulos) && errors.modulos.some((e: any) => e?.titulo);
    toast({
      title: 'Erro de validação',
      description: hasModuleTitleError ? 'Preencha o título em todos os módulos.' : 'Verifique os campos obrigatórios.',
      variant: 'destructive',
    });
  };

  /**
   * RequiredMark
   * pt-BR: Indicador visual para marcar campos obrigatórios.
   * en-US: Visual indicator to mark required fields.
   */
  const RequiredMark = () => (<span className="text-red-600 ml-1">*</span>);

  return (
    <FormProvider {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit, onInvalid)} className="space-y-6">
        <Tabs defaultValue="info" className="w-full">
          <TabsList>
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="pricing">Valores</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
            <TabsTrigger value="aircrafts">Aeronaves</TabsTrigger>
            <TabsTrigger value="modules">Módulos</TabsTrigger>
          </TabsList>
          <p className="text-xs text-muted-foreground mt-2">Campos marcados com <span className="text-red-600">*</span> são obrigatórios.</p>

          {/* Informações */}
          <TabsContent value="info" className="space-y-4 pt-4">
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

              <div className="space-y-2">
                <Label>Duração</Label>
                <Input placeholder="0" {...form.register('duracao')} className={form.formState.errors?.duracao ? 'border-red-500' : ''} />
                {form.formState.errors?.duracao && (
                  <p className="text-xs text-red-600">{String(form.formState.errors.duracao.message)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Unidade de duração</Label>
                <Select value={form.watch('unidade_duracao')} onValueChange={(v) => form.setValue('unidade_duracao', v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hrs">Hora(s)</SelectItem>
                    <SelectItem value="Min">Minuto(s)</SelectItem>
                  </SelectContent>
                </Select>
                {form.formState.errors?.unidade_duracao && (
                  <p className="text-xs text-red-600">{String((form.formState.errors as any).unidade_duracao?.message)}</p>
                )}
              </div>

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
            </div>
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
                     * Aceita apenas dígitos e valida mínimo de 1 parcela.
                     */
                    const onlyDigits = e.target.value.replace(/\D/g, '');
                    form.setValue('parcelas', onlyDigits, { shouldValidate: true });
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
          <TabsContent value="config" className="space-y-4 pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Próximo curso</Label><Input {...form.register('config.proximo_curso')} /></div>
              <div className="space-y-2">
                <Label>Grátis</Label>
                <Select value={form.watch('config.gratis')} onValueChange={(v) => form.setValue('config.gratis', v as any)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent><SelectItem value="s">Sim</SelectItem><SelectItem value="n">Não</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Comissão</Label><Input placeholder="3,00" {...form.register('config.comissao')} /></div>
              <div className="space-y-2"><Label>Tipo desconto taxa</Label>
                <Select value={form.watch('config.tipo_desconto_taxa')} onValueChange={(v) => form.setValue('config.tipo_desconto_taxa', v as any)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent><SelectItem value="v">Valor</SelectItem><SelectItem value="p">Percentual</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Desconto taxa</Label><Input {...form.register('config.desconto_taxa')} /></div>
              <div className="space-y-2 md:col-span-3"><Label>Página de divulgação</Label><Input {...form.register('config.pagina_divulgacao')} /></div>
              <div className="space-y-2 md:col-span-3"><Label>Vídeo (YouTube)</Label><Input placeholder="https://..." {...form.register('config.video')} /></div>
              <div className="space-y-2"><Label>Página de venda (link)</Label><Input {...form.register('config.pagina_venda.link')} /></div>
              <div className="space-y-2"><Label>Página de venda (label)</Label><Input {...form.register('config.pagina_venda.label')} /></div>
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
              <div className="space-y-2"><Label>EAD: ID EADControl</Label><Input {...form.register('config.ead.id_eadcontrol')} /></div>
            </div>
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

          {/* Módulos */}
          <TabsContent value="modules" className="space-y-4 pt-4">
            {form.watch('tipo') === '4' ? (
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
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">Módulos</h3>
                  <Button type="button" variant="outline" onClick={addModule}><Plus className="h-4 w-4 mr-2" />Adicionar módulo</Button>
                </div>
                {(form.watch('modulos') ?? []).map((m, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end border rounded-md p-3">
                    <div className="space-y-2">
                      <Label>Etapa</Label>
                      <Select value={m.etapa} onValueChange={(v) => {
                        const curr = [...(form.getValues('modulos') ?? [])];
                        curr[idx] = { ...curr[idx], etapa: v };
                        form.setValue('modulos', curr);
                      }}>
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
                    <div className="space-y-2 md:col-span-2">
                      <Label>Título</Label>
                      <Input value={m.titulo} onChange={(e) => {
                        const curr = [...(form.getValues('modulos') ?? [])];
                        curr[idx] = { ...curr[idx], titulo: e.target.value };
                        form.setValue('modulos', curr);
                      }} />
                      {((form.formState.errors.modulos as any)?.[idx]?.titulo?.message) && (
                        <p className="text-xs text-red-600">{(form.formState.errors.modulos as any)[idx].titulo.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Limite</Label>
                      <Input value={m.limite} onChange={(e) => {
                        const curr = [...(form.getValues('modulos') ?? [])];
                        curr[idx] = { ...curr[idx], limite: e.target.value };
                        form.setValue('modulos', curr);
                      }} />
                      {((form.formState.errors.modulos as any)?.[idx]?.limite?.message) && (
                        <p className="text-xs text-red-600">{(form.formState.errors.modulos as any)[idx].limite.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                        <Label>Valor</Label>
                        <Input value={m.valor || ''} onChange={(e) => {
                          const curr = [...(form.getValues('modulos') ?? [])];
                          curr[idx] = { ...curr[idx], valor: e.target.value };
                          form.setValue('modulos', curr);
                        }} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label>Aeronaves</Label>
                      <ModuleAircraftSelect
                        value={m.aviao || []}
                        onChange={(next) => {
                          const curr = [...(form.getValues('modulos') ?? [])];
                          curr[idx] = { ...curr[idx], aviao: next };
                          form.setValue('modulos', curr);
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-end">
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeModule(idx)}><X className="h-4 w-4" /></Button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </TabsContent>
        </Tabs>

        <Separator />
        <div className="flex items-center justify-end gap-2">
          <Button type="submit" disabled={isSubmitting}>Salvar</Button>
        </div>
      </form>
    </FormProvider>
  );
}