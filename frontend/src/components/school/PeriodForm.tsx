import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
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

/**
 * PeriodForm
 * pt-BR: Formulário simples para criar/editar períodos vinculados a cursos.
 * en-US: Simple form to create/edit course-related periods.
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
  const form = useForm<CreatePeriodInput | UpdatePeriodInput>({
    defaultValues: {
      nome: '',
      slug: '',
      id_curso: undefined,
      // tipo_modulo: 1=Teórico, 2=Prático, 3=Teórico/Prático
      tipo_modulo: undefined,
      // valor: number|string opcional, sem valor padrão.
      // value será tratado como string pelo input e enviado como está.
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
    /**
     * normalizeStatus
     * pt-BR: Converte valores variados do backend para 'publish' | 'draft'.
     * en-US: Converts varied backend values to 'publish' | 'draft'.
     */
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
    // Marcar como editado quando já existir slug vindo do backend para evitar qualquer auto-atualização
    setSlugEdited(Boolean((data as any).slug));
    // Sincroniza máscara do valor a partir do valor inicial (se houver)
    setValorMask(formatCurrencyBRL((data as any).valor));
  }, [initialData, form]);

  /**
   * autoSlugFromName
   * pt-BR: Mantém o campo slug sincronizado com o nome, até o usuário editar manualmente.
   * en-US: Keeps slug synchronized with name until the user edits it manually.
   */
  const [slugEdited, setSlugEdited] = useState(false);
  const nomeValue = (form.watch('nome') as string) || '';
  const slugValue = (form.watch('slug') as string) || '';
  useEffect(() => {
    if (slugEdited) return;
    if (!slugValue) {
      form.setValue('slug', slugify(nomeValue), { shouldValidate: true, shouldDirty: true });
    }
  }, [nomeValue, slugEdited]);

  /**
   * coursesQuery
   * pt-BR: Carrega cursos com suporte a busca para o Combobox.
   * en-US: Loads courses with search support for the Combobox.
   */
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

  /**
   * tipoModulo & cursosIncluidosQuery
   * pt-BR: Observa tipo de módulo e carrega cursos por tipo para o multi-select.
   * en-US: Watch module type and load courses by type for the multi-select.
   */
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

  // Reset cursos_incluidos quando o tipo_modulo muda
  useEffect(() => {
    form.setValue('cursos_incluidos', [], { shouldDirty: true });
  }, [tipoModulo]);

  /**
   * selectedCourseId
   * pt-BR: Observa o curso selecionado para carregar contratos relacionados.
   * en-US: Watches selected course to load related contracts.
   */
  const selectedCourseId = form.watch('id_curso');

  /**
   * contractsQuery
   * pt-BR: Lista contratos vinculados ao curso selecionado.
   * en-US: Lists contracts linked to the selected course.
   */
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

  /**
   * aircraftQuery
   * pt-BR: Lista aeronaves para seleção múltipla.
   * en-US: Lists aircraft for multi-selection.
   */
  const [aircraftSearch, setAircraftSearch] = useState('');
  const aircraftQuery = useQuery({
    queryKey: ['aeronaves', 'list', 200, aircraftSearch],
    queryFn: async () => aircraftService.listAircraft({ page: 1, per_page: 200, search: aircraftSearch }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const aircraftItems = (aircraftQuery.data?.data || aircraftQuery.data?.items || []) as any[];

  /**
   * formatCurrencyBRL
   * pt-BR: Formata um número/valor como moeda BRL.
   * en-US: Formats a number/value as BRL currency.
   */
  function formatCurrencyBRL(value: any): string {
    const n = Number(value);
    if (!isFinite(n)) return '';
    try {
      return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    } catch {
      return String(value ?? '');
    }
  }

  /**
   * currencyMaskFromInput
   * pt-BR: Converte entrada livre em centavos e retorna máscara BRL e número.
   * en-US: Converts free-form input into cents and returns BRL mask and number.
   */
  function currencyMaskFromInput(input: string): { display: string; numeric: number } {
    const digits = (input || '').replace(/\D+/g, '');
    const int = digits ? parseInt(digits, 10) : 0; // centavos
    const value = int / 100;
    return { display: formatCurrencyBRL(value), numeric: value };
  }

  // Estado local para a máscara do campo valor
  const [valorMask, setValorMask] = useState<string>('');

  /**
   * handleValorChange
   * pt-BR: Atualiza máscara e valor numérico no formulário ao digitar.
   * en-US: Updates mask and numeric value in the form while typing.
   */
  function handleValorChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { display, numeric } = currencyMaskFromInput(e.target.value);
    setValorMask(display);
    form.setValue('valor', numeric as any, { shouldDirty: true, shouldValidate: true });
  }

  return (
    /**
     * Layout spacing adjustments
     * pt-BR: Reduzimos espaçamentos para compactar os campos do formulário.
     * - space-y-4 -> space-y-3 (vertical)
     * - gap-4 -> gap-3 (grid)
     * en-US: We reduced spacing to make form fields more compact.
     * - space-y-4 -> space-y-3 (vertical)
     * - gap-4 -> gap-3 (grid)
     */
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      {/* Ordem solicitada: Nome, Curso vinculado, Status. Slug oculto. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="nome">Nome</Label>
          <Input
            id="nome"
            placeholder="Ex.: Primeiro Período"
            {...form.register('nome', { required: true })}
          />
          {/* Slug oculto e sincronizado via efeito */}
          <input type="hidden" {...form.register('slug')} />
        </div>
        {/* Campo Valor com máscara de moeda (R$) */}
        <div className="space-y-2">
          <Label htmlFor="valor">Valor (R$)</Label>
          {/**
           * Valor
           * pt-BR: Campo opcional com máscara BRL, armazena número no form.
           * en-US: Optional BRL-masked field, stores numeric in form.
           */}
          <Input
            id="valor"
            type="text"
            inputMode="numeric"
            placeholder="Ex.: 399,90"
            value={valorMask}
            onChange={handleValorChange}
          />
        </div>
        {/* Horas práticas */}
        <div className="space-y-2">
          <Label htmlFor="h_praticas">Horas práticas</Label>
          <Input
            id="h_praticas"
            type="number"
            inputMode="numeric"
            step="0.1"
            placeholder="Ex.: 20"
            {...form.register('h_praticas', { valueAsNumber: true })}
          />
        </div>
        {/* Horas teóricas */}
        <div className="space-y-2">
          <Label htmlFor="h_teoricas">Horas teóricas</Label>
          <Input
            id="h_teoricas"
            type="number"
            inputMode="numeric"
            step="0.1"
            placeholder="Ex.: 10"
            {...form.register('h_teoricas', { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-2">
          <Label>Curso vinculado</Label>
          <Combobox
            options={courseOptions}
            value={String(form.watch('id_curso') ?? '')}
            onValueChange={(val) => form.setValue('id_curso', val ? Number(val) : undefined)}
            placeholder="Selecione um curso"
            searchPlaceholder="Pesquisar curso pelo nome..."
            emptyText={courseItems.length === 0 ? 'Nenhum curso encontrado' : 'Digite para filtrar'}
            disabled={coursesQuery.isLoading}
            loading={coursesQuery.isLoading || coursesQuery.isFetching}
            onSearch={setCourseSearch}
            searchTerm={courseSearch}
            debounceMs={250}
          />
        </div>
        {/* Tipo de Módulo */}
        <div className="space-y-2">
          <Label>Tipo de Módulo</Label>
          {/**
           * Tipo de Módulo
           * pt-BR: Define o tipo do módulo (1 Teórico, 2 Prático, 3 Teórico/Prático).
           * en-US: Sets module type (1 Theoretical, 2 Practical, 3 Both).
           */}
          <Select
            value={String(form.watch('tipo_modulo') ?? '')}
            onValueChange={(val) => form.setValue('tipo_modulo', val as any, { shouldDirty: true, shouldValidate: true })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Teórico</SelectItem>
              <SelectItem value="2">Prático</SelectItem>
              <SelectItem value="3">Teórico/Prático</SelectItem>
            </SelectContent>
          </Select>
        </div>  
      </div>


      {/* Cursos Incluídos: aparece quando há tipo de módulo selecionado */}
      {tipoModulo ? (
        <div className="space-y-2">
          <Label>Cursos Incluídos</Label>
          <CursosIncluidosMultiSelect
            value={(form.watch('cursos_incluidos') as (number | string)[]) || []}
            onChange={(next) => form.setValue('cursos_incluidos', next, { shouldDirty: true })}
            items={cursosIncluidosItems}
            loading={cursosIncluidosQuery.isLoading || cursosIncluidosQuery.isFetching}
            onSearch={setIncludedCoursesSearch}
          />
          {cursosIncluidosQuery.isError && (
            <p className="text-xs text-red-600">Falha ao carregar cursos pelo tipo selecionado.</p>
          )}
        </div>
      ) : null}

      {/* Status por último */}
      <div className="space-y-2">
        <Label>Status</Label>
        {/**
         * Status Switch
         * pt-BR: Alterna entre 'Publicado' e 'Rascunho' mapeando para PeriodStatus.
         * en-US: Toggles between 'publish' and 'draft' mapping to PeriodStatus.
         */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <span className="text-sm text-muted-foreground">Publicado</span>
          <Switch
            checked={form.watch('status') === 'publish'}
            onCheckedChange={(checked) => form.setValue('status', (checked ? 'publish' : 'draft') as PeriodStatus)}
          />
        </div>
      </div>

      {/* Multi-select de contratos, aparece quando há curso selecionado */}
      {selectedCourseId ? (
        <div className="space-y-2">
          <Label>Contratos do curso</Label>
          <ContractsMultiSelect
            value={(form.watch('id_contratos') as (number | string)[]) || []}
            onChange={(next) => form.setValue('id_contratos', next, { shouldDirty: true })}
            items={contractItems}
            loading={contractsQuery.isLoading || contractsQuery.isFetching}
            onSearch={setContractsSearch}
          />
          {contractsQuery.isError && (
            <p className="text-xs text-red-600">Falha ao carregar contratos para o curso selecionado.</p>
          )}
        </div>
      ) : null}

      {/* Multi-select de aeronaves */}
      <div className="space-y-2">
        <Label>Aeronaves</Label>
        <AeronavesMultiSelect
          value={(form.watch('aeronaves') as (number | string)[]) || []}
          onChange={(next) => form.setValue('aeronaves', next, { shouldDirty: true })}
          items={aircraftItems}
          loading={aircraftQuery.isLoading || aircraftQuery.isFetching}
          onSearch={setAircraftSearch}
        />
        {aircraftQuery.isError && (
          <p className="text-xs text-red-600">Falha ao carregar aeronaves.</p>
        )}
      </div>

      {/* Botão de salvar removido: usamos EditFooterBar para ações de salvar no rodapé */}
    </form>
  );
}

/**
 * ContractsMultiSelect
 * pt-BR: Componente interno para seleção múltipla de contratos via Popover com busca.
 * en-US: Internal component for multi-selecting contracts via Popover with search.
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

  /**
   * filterContracts
   * pt-BR: Filtra lista localmente por nome enquanto a busca remota atualiza os itens.
   * en-US: Filters list locally by name while remote search updates items.
   */
  const filtered = (query.trim()
    ? items.filter((c) => String(c?.nome || c?.title || '').toLowerCase().includes(query.trim().toLowerCase()))
    : items);

  const label = value.length
    ? items.filter((c) => value.map(String).includes(String(c.id))).map((c) => String(c?.nome || c?.title || c.id)).join(', ')
    : (loading ? 'Carregando...' : 'Selecione contratos');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="justify-between w-full">
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-2" align="start">
        <div className="space-y-2">
          <Input placeholder="Buscar contratos..." value={query} onChange={(e) => {
            const term = e.target.value; setQuery(term); onSearch?.(term);
          }} />
          <ScrollArea className="h-52">
            <div className="space-y-1">
              {filtered.map((c) => {
                const id = c.id;
                const nome = String(c?.nome || c?.title || id);
                const checked = value.map(String).includes(String(id));
                return (
                  <label key={String(id)} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(chk) => {
                        const next = new Set(value.map(String));
                        if (chk) next.add(String(id)); else next.delete(String(id));
                        onChange(Array.from(next));
                      }}
                    />
                    <span className="text-sm">{nome}</span>
                  </label>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-xs text-muted-foreground px-2 py-1">Nenhum contrato encontrado</div>
              )}
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
}

/**
 * AeronavesMultiSelect
 * pt-BR: Seleção múltipla de aeronaves com busca.
 * en-US: Multi-select for aircraft with search.
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

  const label = value.length
    ? items.filter((a) => value.map(String).includes(String(a.id))).map((a) => String(a?.nome || a?.description || a.id)).join(', ')
    : (loading ? 'Carregando...' : 'Selecione aeronaves');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="justify-between w-full">
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-2" align="start">
        <div className="space-y-2">
          <Input placeholder="Buscar aeronaves..." value={query} onChange={(e) => {
            const term = e.target.value; setQuery(term); onSearch?.(term);
          }} />
          <ScrollArea className="h-52">
            <div className="space-y-1">
              {filtered.map((a) => {
                const id = a.id;
                const nome = String(a?.nome || a?.description || id);
                const checked = value.map(String).includes(String(id));
                return (
                  <label key={String(id)} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(chk) => {
                        const next = new Set(value.map(String));
                        if (chk) next.add(String(id)); else next.delete(String(id));
                        onChange(Array.from(next));
                      }}
                    />
                    <span className="text-sm">{nome}</span>
                  </label>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-xs text-muted-foreground px-2 py-1">Nenhuma aeronave encontrada</div>
              )}
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

  const label = value.length
    ? items.filter((c) => value.map(String).includes(String(c.id))).map((c) => String(c?.nome || c?.titulo || c.id)).join(', ')
    : (loading ? 'Carregando...' : 'Selecione cursos');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="justify-between w-full">
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-2" align="start">
        <div className="space-y-2">
          <Input placeholder="Buscar cursos..." value={query} onChange={(e) => {
            const term = e.target.value; setQuery(term); onSearch?.(term);
          }} />
          <ScrollArea className="h-52">
            <div className="space-y-1">
              {filtered.map((c) => {
                const id = c.id;
                const nome = String(c?.nome || c?.titulo || id);
                const checked = value.map(String).includes(String(id));
                return (
                  <label key={String(id)} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(chk) => {
                        const next = new Set(value.map(String));
                        if (chk) next.add(String(id)); else next.delete(String(id));
                        onChange(Array.from(next));
                      }}
                    />
                    <span className="text-sm">{nome}</span>
                  </label>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-xs text-muted-foreground px-2 py-1">Nenhum curso encontrado</div>
              )}
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
}