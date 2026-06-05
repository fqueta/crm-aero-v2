import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { coursesService } from '@/services/coursesService';
import { Combobox, useComboboxOptions } from '@/components/ui/combobox';
import type { CreatePeriodInput, UpdatePeriodInput, PeriodRecord, PeriodStatus } from '@/types/periods';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { contractsService } from '@/services/contractsService';
import { aircraftService } from '@/services/aircraftService';
import { Badge } from '@/components/ui/badge';
import { 
  BookOpen, 
  DollarSign, 
  Clock, 
  Plane, 
  FileText, 
  Plus,
  GraduationCap, 
  Award, 
  Check, 
  X, 
  ShieldCheck 
} from 'lucide-react';

/**
 * PeriodForm
 * pt-BR: Formulário premium reestilizado para criar/editar períodos com seções, cards dinâmicos e tags.
 * en-US: Premium overhauled form to create/edit periods with sections, dynamic cards, and tags.
 */
export function PeriodForm({
  initialData,
  onSubmit,
  isSubmitting,
  onSubmitRef,
}: {
  initialData?: PeriodRecord | (CreatePeriodInput | UpdatePeriodInput) | null;
  onSubmit: (data: CreatePeriodInput | UpdatePeriodInput) => Promise<void> | void;
  isSubmitting?: boolean;
  /**
   * onSubmitRef
   * pt-BR: Referência externa para disparar submissão programaticamente.
   * en-US: External ref to trigger submit programmatically.
   */
  onSubmitRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const form = useForm<CreatePeriodInput | UpdatePeriodInput>({
    defaultValues: {
      nome: '',
      slug: '',
      id_curso: undefined,
      tipo_modulo: undefined,
      valor: undefined,
      h_praticas: undefined,
      h_teoricas: undefined,
      aeronaves: [],
      status: 'draft',
      id_contratos: [],
      cursos_incluidos: [],
    },
  });

  /**
   * slugify
   * pt-BR: Converte uma string em slug substituindo espaços por '-', removendo acentos e colocando em minúsculas.
   * en-US: Converts a string to a slug by replacing spaces with '-', removing diacritics, and lowercasing.
   */
  function slugify(value: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}+/gu, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * exposeSubmitRef
   * pt-BR: Expõe o handleSubmit via referência opcional para integração com EditFooterBar.
   * en-US: Exposes handleSubmit via optional ref for integration with EditFooterBar.
   */
  useEffect(() => {
    if (onSubmitRef) {
      onSubmitRef.current = form.handleSubmit(onSubmit);
    }
  }, [onSubmitRef, form, onSubmit]);

  /**
   * applyInitialData
   * pt-BR: Aplica dados iniciais quando em modo edição.
   * en-US: Applies initial data when in edit mode.
   */
  useEffect(() => {
    if (!initialData) return;
    const data = initialData as PeriodRecord;
    const normalizeStatus = (value: any): PeriodStatus => {
      const v = String(value ?? '').toLowerCase();
      if (v === 'publish' || v === 'publicado' || v === '1' || v === 'true') return 'publish';
      if (v === 'draft' || v === 'rascunho' || v === '0' || v === 'false') return 'draft';
      return 'draft';
    };
    form.reset({
      nome: (data as any).nome || '',
      slug: (data as any).slug || '',
      id_curso: (data as any).id_curso ?? undefined,
      tipo_modulo: (data as any).tipo_modulo ?? undefined,
      valor: (data as any).valor ?? undefined,
      id_contratos: Array.isArray((data as any).id_contratos) ? (data as any).id_contratos : [],
      cursos_incluidos: Array.isArray((data as any).cursos_incluidos) ? (data as any).cursos_incluidos : [],
      h_praticas: (data as any).h_praticas ?? undefined,
      h_teoricas: (data as any).h_teoricas ?? undefined,
      aeronaves: Array.isArray((data as any).aeronaves) ? (data as any).aeronaves : [],
      status: normalizeStatus((data as any).status),
    });
    setSlugEdited(Boolean((data as any).slug));
    setValorMask(formatCurrencyBRL((data as any).valor));
  }, [initialData, form]);

  const [slugEdited, setSlugEdited] = useState(false);
  const nomeValue = (form.watch('nome') as string) || '';
  const slugValue = (form.watch('slug') as string) || '';
  useEffect(() => {
    if (slugEdited) return;
    if (!slugValue) {
      form.setValue('slug', slugify(nomeValue), { shouldValidate: true, shouldDirty: true });
    }
  }, [nomeValue, slugEdited]);

  const [courseSearch, setCourseSearch] = useState('');
  const coursesQuery = useQuery({
    queryKey: ['cursos', 'list', 200, courseSearch],
    queryFn: async () => coursesService.listCourses({ page: 1, per_page: 200, search: courseSearch }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const courseItems = (coursesQuery.data?.data || coursesQuery.data?.items || []) as any[];
  const courseOptions = useComboboxOptions(courseItems, 'id', 'nome', undefined, (c: any) => String(c?.titulo || ''));

  const tipoModulo = form.watch('tipo_modulo') as ('1'|'2'|'3'|number|undefined);
  const [includedCoursesSearch, setIncludedCoursesSearch] = useState('');
  const cursosIncluidosQuery = useQuery({
    queryKey: ['cursos', 'by_tipo', tipoModulo ?? 'none', includedCoursesSearch],
    queryFn: async () => coursesService.listCourses({ page: 1, per_page: 200, search: includedCoursesSearch || undefined, tipo: tipoModulo ?? undefined }),
    enabled: !!tipoModulo,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const cursosIncluidosItems = (cursosIncluidosQuery.data?.data || cursosIncluidosQuery.data?.items || []) as any[];

  useEffect(() => {
    // Apenas resetar se for alteração explícita do usuário
    if (form.formState.isDirty) {
      form.setValue('cursos_incluidos', [], { shouldDirty: true });
    }
  }, [tipoModulo]);

  const selectedCourseId = form.watch('id_curso');

  const [contractsSearch, setContractsSearch] = useState('');
  const contractsQuery = useQuery({
    queryKey: ['contracts', 'by_course', selectedCourseId, contractsSearch],
    queryFn: async () => contractsService.listContracts({ page: 1, per_page: 200, id_curso: selectedCourseId as any, name: contractsSearch || undefined }),
    enabled: !!selectedCourseId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const contractItems = (contractsQuery.data?.data || contractsQuery.data?.items || []) as any[];

  const [aircraftSearch, setAircraftSearch] = useState('');
  const aircraftQuery = useQuery({
    queryKey: ['aeronaves', 'list', 200, aircraftSearch],
    queryFn: async () => aircraftService.listAircraft({ page: 1, per_page: 200, search: aircraftSearch }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const aircraftItems = (aircraftQuery.data?.data || aircraftQuery.data?.items || []) as any[];

  function formatCurrencyBRL(value: any): string {
    const n = Number(value);
    if (!isFinite(n)) return '';
    try {
      return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } catch {
      return String(value ?? '');
    }
  }

  function currencyMaskFromInput(input: string): { display: string; numeric: number } {
    const digits = (input || '').replace(/\D+/g, '');
    const int = digits ? parseInt(digits, 10) : 0;
    const value = int / 100;
    return { display: formatCurrencyBRL(value), numeric: value };
  }

  const [valorMask, setValorMask] = useState<string>('');

  /**
   * handleCreateContract
   * pt-BR: Abre a tela de novo contrato com o curso atual pré-selecionado e retorno para esta edição.
   * en-US: Opens the new contract screen with the current course preselected and a return path to this edit screen.
   */
  function handleCreateContract() {
    if (!selectedCourseId) return;
    navigate('/admin/school/contracts/create', {
      state: {
        prefillData: { id_curso: Number(selectedCourseId) },
        returnPath: location.pathname + location.search,
      },
    });
  }

  function handleValorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { display, numeric } = currencyMaskFromInput(e.target.value);
    setValorMask(display);
    form.setValue('valor', numeric as any, { shouldDirty: true, shouldValidate: true });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
      {/* Seção 1: Identificação & Vínculo */}
      <div className="space-y-4">
        <div className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-900 pb-2">
          <BookOpen className="w-4 h-4" />
          <span>1. Identificação & Vínculo</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-2">
            <Label htmlFor="nome" className="text-xs font-semibold text-zinc-700 dark:text-zinc-350">Nome do período</Label>
            <Input
              id="nome"
              placeholder="Ex.: Primeiro Período"
              {...form.register('nome', { required: true })}
              className="h-10 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 focus:bg-white dark:focus:bg-zinc-950 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
            />
            <input type="hidden" {...form.register('slug')} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-350">Curso principal</Label>
            <Combobox
              options={courseOptions}
              value={String(form.watch('id_curso') ?? '')}
              onValueChange={(val) => form.setValue('id_curso', val ? Number(val) : undefined, { shouldDirty: true })}
              placeholder="Selecione o curso vinculado"
              searchPlaceholder="Pesquisar curso pelo nome..."
              emptyText={courseItems.length === 0 ? 'Nenhum curso encontrado' : 'Digite para filtrar'}
              disabled={coursesQuery.isLoading}
              loading={coursesQuery.isLoading || coursesQuery.isFetching}
              onSearch={setCourseSearch}
              searchTerm={courseSearch}
              debounceMs={250}
              className="h-10 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 text-left w-full focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-350">Tipo de Módulo</Label>
            <Select
              value={String(form.watch('tipo_modulo') ?? '')}
              onValueChange={(val) => form.setValue('tipo_modulo', val as any, { shouldDirty: true, shouldValidate: true })}
            >
              <SelectTrigger className="h-10 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 focus:bg-white dark:focus:bg-zinc-950 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="1">Teórico</SelectItem>
                <SelectItem value="2">Prático</SelectItem>
                <SelectItem value="3">Teórico/Prático</SelectItem>
              </SelectContent>
            </Select>
          </div>  
        </div>
      </div>

      {/* Seção 2: Carga Horária & Preço */}
      <div className="space-y-4">
        <div className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-900 pb-2">
          <DollarSign className="w-4 h-4" />
          <span>2. Carga Horária & Aspectos Financeiros</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="space-y-2">
            <Label htmlFor="valor" className="text-xs font-semibold text-zinc-700 dark:text-zinc-350">Valor total (R$)</Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-zinc-400 text-sm font-semibold">R$</span>
              <Input
                id="valor"
                type="text"
                inputMode="numeric"
                placeholder="0,00"
                value={valorMask.replace('R$', '').trim()}
                onChange={handleValorChange}
                className="h-10 pl-9 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 focus:bg-white dark:focus:bg-zinc-950 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 font-semibold"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="h_praticas" className="text-xs font-semibold text-zinc-700 dark:text-zinc-350">Carga horária prática (horas)</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
              <Input
                id="h_praticas"
                type="number"
                inputMode="numeric"
                step="0.1"
                placeholder="Ex.: 20"
                {...form.register('h_praticas', { valueAsNumber: true })}
                className="h-10 pl-9 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 focus:bg-white dark:focus:bg-zinc-950 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 font-medium"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="h_teoricas" className="text-xs font-semibold text-zinc-700 dark:text-zinc-350">Carga horária teórica (horas)</Label>
            <div className="relative">
              <Clock className="absolute left-3 top-3 w-4 h-4 text-zinc-400" />
              <Input
                id="h_teoricas"
                type="number"
                inputMode="numeric"
                step="0.1"
                placeholder="Ex.: 10"
                {...form.register('h_teoricas', { valueAsNumber: true })}
                className="h-10 pl-9 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/30 border-zinc-200 dark:border-zinc-800 focus:bg-white dark:focus:bg-zinc-950 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 font-medium"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Seção 3: Recursos Vinculados */}
      <div className="space-y-4">
        <div className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-900 pb-2">
          <Plane className="w-4 h-4" />
          <span>3. Recursos Vinculados</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Multi-select de aeronaves */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-350 flex items-center gap-1">Aeronaves homologadas</Label>
            <AeronavesMultiSelect
              value={(form.watch('aeronaves') as (number | string)[]) || []}
              onChange={(next) => form.setValue('aeronaves', next, { shouldDirty: true })}
              items={aircraftItems}
              loading={aircraftQuery.isLoading || aircraftQuery.isFetching}
              onSearch={setAircraftSearch}
            />
            {aircraftQuery.isError && (
              <p className="text-xs text-rose-500 font-medium">Falha ao carregar aeronaves.</p>
            )}
          </div>

          {/* Multi-select de contratos, aparece quando há curso selecionado */}
          {selectedCourseId ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-350">Contratos associados ao curso</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCreateContract}
                  className="h-8 rounded-lg px-2.5 text-xs font-semibold"
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Novo contrato
                </Button>
              </div>
              <ContractsMultiSelect
                value={(form.watch('id_contratos') as (number | string)[]) || []}
                onChange={(next) => form.setValue('id_contratos', next, { shouldDirty: true })}
                items={contractItems}
                loading={contractsQuery.isLoading || contractsQuery.isFetching}
                onSearch={setContractsSearch}
              />
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Cadastre um novo contrato para este curso e volte para vinculá-lo ao período.
              </p>
              {contractsQuery.isError && (
                <p className="text-xs text-rose-500 font-medium">Falha ao carregar contratos para o curso selecionado.</p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-center text-zinc-400 text-xs font-medium bg-zinc-50/20">
              Selecione um curso principal para liberar os contratos.
            </div>
          )}

          {/* Cursos Incluídos: aparece quando há tipo de módulo selecionado */}
          {tipoModulo ? (
            <div className="space-y-2 md:col-span-2">
              <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-350">Cursos incluídos no período</Label>
              <CursosIncluidosMultiSelect
                value={(form.watch('cursos_incluidos') as (number | string)[]) || []}
                onChange={(next) => form.setValue('cursos_incluidos', next, { shouldDirty: true })}
                items={cursosIncluidosItems}
                loading={cursosIncluidosQuery.isLoading || cursosIncluidosQuery.isFetching}
                onSearch={setIncludedCoursesSearch}
              />
              {cursosIncluidosQuery.isError && (
                <p className="text-xs text-rose-500 font-medium">Falha ao carregar cursos pelo tipo selecionado.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Seção 4: Publicação & Status */}
      <div className="space-y-4 pt-2">
        <div className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-900 pb-2">
          <ShieldCheck className="w-4 h-4" />
          <span>4. Visibilidade & Publicação</span>
        </div>

        <div className={`p-5 rounded-2xl border transition-all duration-300 ${
          form.watch('status') === 'publish'
            ? 'border-emerald-500/30 bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01] shadow-sm shadow-emerald-500/5'
            : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10'
        }`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Status do Período</span>
                {form.watch('status') === 'publish' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Publicado / Ativo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-650 border border-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:border-zinc-800 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500"></span>
                    Rascunho
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-450 leading-relaxed max-w-[580px]">
                {form.watch('status') === 'publish'
                  ? 'Este período está ativo. Alunos e administradores poderão selecioná-lo e vinculá-lo a novas matrículas, propostas comerciais e contratos financeiros.'
                  : 'Este período está em modo de rascunho temporário. Ele ficará oculto em todo o sistema e não poderá ser associado a novas vendas ou propostas.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 mr-1">
                {form.watch('status') === 'publish' ? 'Publicado' : 'Rascunho'}
              </span>
              <Switch
                checked={form.watch('status') === 'publish'}
                onCheckedChange={(checked) => form.setValue('status', (checked ? 'publish' : 'draft') as PeriodStatus, { shouldDirty: true })}
                className="data-[state=checked]:bg-emerald-500 dark:data-[state=checked]:bg-emerald-600"
              />
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

/**
 * ContractsMultiSelect
 * pt-BR: Componente reestilizado de seleção múltipla de contratos exibindo badges interativos.
 * en-US: Restyled component for multi-selecting contracts displaying interactive badges.
 */
function ContractsMultiSelect({
  value,
  onChange,
  items,
  loading,
  onSearch,
}: {
  value: (number | string)[];
  onChange: (next: (number | string)[]) => void;
  items: any[];
  loading?: boolean;
  onSearch?: (term: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = (query.trim()
    ? items.filter((c) => String(c?.nome || c?.title || '').toLowerCase().includes(query.trim().toLowerCase()))
    : items);

  const selectedItems = items.filter((c) => value.map(String).includes(String(c.id)));
  const triggerLabel = value.length === 0
    ? 'Selecione os contratos...'
    : `${value.length} ${value.length === 1 ? 'contrato selecionado' : 'contratos selecionados'}`;

  return (
    <div className="space-y-2.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            type="button" 
            variant="outline" 
            className="justify-between w-full h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all duration-200 text-left font-normal"
          >
            <span className="flex items-center gap-2 text-zinc-650 dark:text-zinc-400 text-sm truncate">
              <FileText className="w-4 h-4 text-zinc-400" />
              {loading ? 'Carregando...' : triggerLabel}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-md bg-white dark:bg-zinc-950" align="start">
          <div className="space-y-3">
            <Input 
              placeholder="Buscar contratos..." 
              value={query} 
              onChange={(e) => {
                const term = e.target.value; setQuery(term); onSearch?.(term);
              }} 
              className="h-9 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 focus:bg-white dark:focus:bg-zinc-950 focus:ring-2 focus:ring-blue-500/20"
            />
            <ScrollArea className="h-52">
              <div className="space-y-1 pr-2">
                {filtered.map((c) => {
                  const id = c.id;
                  const nome = String(c?.nome || c?.title || id);
                  const checked = value.map(String).includes(String(id));
                  return (
                    <label key={String(id)} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer transition-colors duration-150">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(chk) => {
                          const next = new Set(value.map(String));
                          if (chk) next.add(String(id)); else next.delete(String(id));
                          onChange(Array.from(next));
                        }}
                        className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-350">{nome}</span>
                    </label>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="text-xs text-zinc-400 px-3 py-4 text-center">Nenhum contrato encontrado</div>
                )}
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-900">
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])} className="h-8 text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg px-2">Limpar todos</Button>
              <Button type="button" size="sm" onClick={() => setOpen(false)} className="h-8 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg px-3 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950">Concluir</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected items badges wrapped below the trigger */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-900/5 transition-all duration-200">
          {selectedItems.map((c) => {
            const id = c.id;
            const nome = String(c?.nome || c?.title || id);
            return (
              <Badge 
                key={String(id)} 
                className="rounded-lg border border-violet-100 bg-violet-50/70 dark:bg-violet-950/20 dark:border-violet-900/30 px-2 py-1 text-xs font-medium text-violet-750 dark:text-violet-400 shadow-sm flex items-center gap-1.5 transition-all duration-150 hover:bg-violet-100/55"
              >
                <span className="truncate max-w-[280px]">{nome}</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = value.filter((vid) => String(vid) !== String(id));
                    onChange(next);
                  }}
                  className="w-3.5 h-3.5 rounded-full hover:bg-violet-200/50 dark:hover:bg-violet-900/50 flex items-center justify-center text-violet-750 dark:text-violet-400 transition-colors"
                  title="Remover contrato"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * AeronavesMultiSelect
 * pt-BR: Seleção múltipla de aeronaves com busca e badges dinâmicos.
 * en-US: Multi-select for aircraft with search and dynamic badges.
 */
function AeronavesMultiSelect({
  value,
  onChange,
  items,
  loading,
  onSearch,
}: {
  value: (number | string)[];
  onChange: (next: (number | string)[]) => void;
  items: any[];
  loading?: boolean;
  onSearch?: (term: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = (query.trim()
    ? items.filter((a) => String(a?.nome || a?.description || '').toLowerCase().includes(query.trim().toLowerCase()))
    : items);

  const selectedItems = items.filter((a) => value.map(String).includes(String(a.id)));
  const triggerLabel = value.length === 0
    ? 'Selecione as aeronaves...'
    : `${value.length} ${value.length === 1 ? 'aeronave selecionada' : 'aeronaves selecionadas'}`;

  return (
    <div className="space-y-2.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            type="button" 
            variant="outline" 
            className="justify-between w-full h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all duration-200 text-left font-normal"
          >
            <span className="flex items-center gap-2 text-zinc-650 dark:text-zinc-400 text-sm truncate">
              <Plane className="w-4 h-4 text-zinc-400" />
              {loading ? 'Carregando...' : triggerLabel}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-md bg-white dark:bg-zinc-950" align="start">
          <div className="space-y-3">
            <Input 
              placeholder="Buscar aeronaves..." 
              value={query} 
              onChange={(e) => {
                const term = e.target.value; setQuery(term); onSearch?.(term);
              }} 
              className="h-9 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 focus:bg-white dark:focus:bg-zinc-950 focus:ring-2 focus:ring-blue-500/20"
            />
            <ScrollArea className="h-52">
              <div className="space-y-1 pr-2">
                {filtered.map((a) => {
                  const id = a.id;
                  const nome = String(a?.nome || a?.description || id);
                  const checked = value.map(String).includes(String(id));
                  return (
                    <label key={String(id)} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer transition-colors duration-150">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(chk) => {
                          const next = new Set(value.map(String));
                          if (chk) next.add(String(id)); else next.delete(String(id));
                          onChange(Array.from(next));
                        }}
                        className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-350">{nome}</span>
                    </label>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="text-xs text-zinc-400 px-3 py-4 text-center">Nenhuma aeronave encontrada</div>
                )}
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-900">
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])} className="h-8 text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg px-2">Limpar todos</Button>
              <Button type="button" size="sm" onClick={() => setOpen(false)} className="h-8 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg px-3 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950">Concluir</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected items badges wrapped below the trigger */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-900/5 transition-all duration-200">
          {selectedItems.map((a) => {
            const id = a.id;
            const nome = String(a?.nome || a?.description || id);
            return (
              <Badge 
                key={String(id)} 
                className="rounded-lg border border-amber-100 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/30 px-2 py-1 text-xs font-semibold text-amber-800 dark:text-amber-400 shadow-sm flex items-center gap-1.5 transition-all duration-150 hover:bg-amber-100/50"
              >
                <span className="truncate max-w-[280px]">{nome}</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = value.filter((vid) => String(vid) !== String(id));
                    onChange(next);
                  }}
                  className="w-3.5 h-3.5 rounded-full hover:bg-amber-200/50 dark:hover:bg-amber-900/50 flex items-center justify-center text-amber-800 dark:text-amber-450 transition-colors"
                  title="Remover aeronave"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * CursosIncluidosMultiSelect
 * pt-BR: Seleção múltipla de cursos com busca, carregados por tipo.
 * en-US: Multi-select for courses with search, loaded by type.
 */
function CursosIncluidosMultiSelect({
  value,
  onChange,
  items,
  loading,
  onSearch,
}: {
  value: (number | string)[];
  onChange: (next: (number | string)[]) => void;
  items: any[];
  loading?: boolean;
  onSearch?: (term: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = (query.trim()
    ? items.filter((c) => String(c?.nome || c?.titulo || '').toLowerCase().includes(query.trim().toLowerCase()))
    : items);

  const selectedItems = items.filter((c) => value.map(String).includes(String(c.id)));
  const triggerLabel = value.length === 0
    ? 'Selecione os cursos incluídos...'
    : `${value.length} ${value.length === 1 ? 'curso incluído' : 'cursos incluídos'}`;

  return (
    <div className="space-y-2.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button 
            type="button" 
            variant="outline" 
            className="justify-between w-full h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all duration-200 text-left font-normal"
          >
            <span className="flex items-center gap-2 text-zinc-650 dark:text-zinc-400 text-sm truncate">
              <GraduationCap className="w-4 h-4 text-zinc-400" />
              {loading ? 'Carregando...' : triggerLabel}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-3 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 shadow-md bg-white dark:bg-zinc-950" align="start">
          <div className="space-y-3">
            <Input 
              placeholder="Buscar cursos..." 
              value={query} 
              onChange={(e) => {
                const term = e.target.value; setQuery(term); onSearch?.(term);
              }} 
              className="h-9 rounded-lg bg-zinc-50/50 dark:bg-zinc-900/50 border-zinc-200 dark:border-zinc-800 focus:bg-white dark:focus:bg-zinc-950 focus:ring-2 focus:ring-blue-500/20"
            />
            <ScrollArea className="h-52">
              <div className="space-y-1 pr-2">
                {filtered.map((c) => {
                  const id = c.id;
                  const nome = String(c?.nome || c?.titulo || id);
                  const checked = value.map(String).includes(String(id));
                  return (
                    <label key={String(id)} className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-900 cursor-pointer transition-colors duration-150">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(chk) => {
                          const next = new Set(value.map(String));
                          if (chk) next.add(String(id)); else next.delete(String(id));
                          onChange(Array.from(next));
                        }}
                        className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-350">{nome}</span>
                    </label>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="text-xs text-zinc-400 px-3 py-4 text-center">Nenhum curso encontrado</div>
                )}
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-900">
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])} className="h-8 text-xs font-semibold text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg px-2">Limpar todos</Button>
              <Button type="button" size="sm" onClick={() => setOpen(false)} className="h-8 text-xs font-semibold bg-zinc-900 hover:bg-zinc-800 text-white rounded-lg px-3 dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950">Concluir</Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected items badges wrapped below the trigger */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/20 dark:bg-zinc-900/5 transition-all duration-200">
          {selectedItems.map((c) => {
            const id = c.id;
            const nome = String(c?.nome || c?.titulo || id);
            return (
              <Badge 
                key={String(id)} 
                className="rounded-lg border border-sky-100 bg-sky-50/70 dark:bg-sky-950/20 dark:border-sky-900/30 px-2 py-1 text-xs font-medium text-sky-700 dark:text-sky-400 shadow-sm flex items-center gap-1.5 transition-all duration-150 hover:bg-sky-100/50"
              >
                <span className="truncate max-w-[280px]">{nome}</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = value.filter((vid) => String(vid) !== String(id));
                    onChange(next);
                  }}
                  className="w-3.5 h-3.5 rounded-full hover:bg-sky-200/50 dark:hover:bg-sky-900/50 flex items-center justify-center text-sky-700 dark:text-sky-400 transition-colors"
                  title="Remover curso"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
