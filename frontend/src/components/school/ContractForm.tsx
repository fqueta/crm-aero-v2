import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { coursesService } from '@/services/coursesService';
import { Combobox, useComboboxOptions } from '@/components/ui/combobox';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { periodsService } from '@/services/periodsService';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckSquare, Copy, Layers3, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Controller } from 'react-hook-form';
import type { CreateContractInput, UpdateContractInput, ContractRecord } from '@/types/contracts';

/**
 * ContractForm
 * pt-BR: Formulário simples para criar/editar contratos/termos vinculados a cursos.
 * en-US: Simple form to create/edit course-related contracts/terms.
 */
export function ContractForm({
  initialData,
  onSubmit,
  isSubmitting,
  onSubmitRef,
}: {
  initialData?: ContractRecord | (CreateContractInput | UpdateContractInput) | null;
  onSubmit: (data: CreateContractInput | UpdateContractInput) => Promise<void> | void;
  isSubmitting?: boolean;
  /**
   * onSubmitRef
   * pt-BR: Referência externa para disparar submissão programaticamente.
   * en-US: External ref to trigger submit programmatically.
   */
  onSubmitRef?: React.MutableRefObject<(() => void) | null>;
}) {
  const { toast } = useToast();
  const form = useForm<CreateContractInput | UpdateContractInput>({
    defaultValues: {
      nome: '',
      slug: '',
      conteudo: '',
      id_curso: undefined,
      periodo: [],
      tipo: 'geral',
      ativo: 'draft',
    },
  });

  /**
   * slugify
   * pt-BR: Converte texto em slug (espaços -> '-', sem acentos, minúsculas).
   * en-US: Converts text to slug (spaces -> '-', no diacritics, lowercase).
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
    const d = initialData as any;
    const normalizedPeriods = Array.isArray(d?.periodo)
      ? d.periodo.map((item: any) => String(item)).filter(Boolean)
      : (d?.periodo ? [String(d.periodo)] : []);
    form.reset({
      nome: d?.nome ?? '',
      slug: d?.slug ?? '',
      conteudo: d?.conteudo ?? d?.content ?? '',
      id_curso: d?.id_curso ?? undefined,
      periodo: normalizedPeriods,
      tipo: d?.tipo ?? d?.config?.tipo ?? 'geral',
      ativo: (d?.ativo as any) ?? 'draft',
    });
  }, [initialData]);

  /**
   * autoSlugFromName
   * pt-BR: Atualiza o campo slug automaticamente baseado em nome.
   * en-US: Automatically updates slug field from name.
   */
  const nomeValue = (form.watch('nome') as string) || '';
  useEffect(() => {
    // Atualiza slug automaticamente sempre que o nome muda
    form.setValue('slug', slugify(nomeValue), { shouldValidate: true, shouldDirty: true });
  }, [nomeValue]);

  /**
   * coursesQuery
   * pt-BR: Carrega cursos para popular o select de vínculo.
   * en-US: Loads courses to populate the relation select.
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
   * handleCopyContract
   * pt-BR: Copia o conteúdo HTML do contrato para a área de transferência.
   * en-US: Copies the contract HTML content to the clipboard.
   */
  async function handleCopyContract() {
    const html = String(form.getValues('conteudo') || '');
    try {
      await navigator.clipboard.writeText(html);
    } catch (err) {
      // Fallback: cria elemento temporário para copiar
      const textarea = document.createElement('textarea');
      textarea.value = html;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  /**
   * insertTag
   * pt-BR: Insere um shortcode na posição atual do cursor no editor.
   * en-US: Inserts a shortcode at the current cursor position in the editor.
   */
  function insertTag(tag: string) {
    const editor = document.querySelector('[contenteditable="true"]');
    if (editor) {
      // Tenta inserir diretamente. Se o editor estiver focado, document.execCommand 
      // usará a posição correta do cursor.
      document.execCommand('insertText', false, tag);
    }
  }

  // Query de períodos do curso selecionado
  const selectedCourseId = form.watch('id_curso') ? Number(form.watch('id_curso')) : undefined;

  // Busca detalhes do curso para verificar o tipo (se não estiver na lista)
  const selectedCourseFromList = courseItems.find((c: any) => String(c.id) === String(selectedCourseId));
  const { data: fetchedCourse } = useQuery({
    queryKey: ['course', 'detail', selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return null;
      return coursesService.getById(selectedCourseId);
    },
    enabled: !!selectedCourseId && !selectedCourseFromList,
    staleTime: 5 * 60 * 1000,
  });

  const selectedCourse = selectedCourseFromList || fetchedCourse;
  // Exibe períodos apenas se curso selecionado for do tipo 4
  const showPeriods = selectedCourse && String(selectedCourse.tipo) === '4';

  const periodsQuery = useQuery({
    queryKey: ['periodos', 'list', selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return { data: [] } as any;
      return periodsService.listPeriods({ page: 1, per_page: 200, id_curso: selectedCourseId });
    },
    enabled: !!selectedCourseId && showPeriods,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const periodItems = ((periodsQuery.data as any)?.data || (periodsQuery.data as any)?.items || []) as any[];
  const selectedPeriods = (((form.watch('periodo') as any[]) || []) as (number | string)[]).map(String);

  /**
   * normalizeSelectedPeriods
   * pt-BR: Limpa ou filtra os períodos quando o curso atual não suporta períodos
   *        ou quando parte da seleção não pertence ao curso escolhido.
   * en-US: Clears or filters selected periods when the current course does not support
   *        periods or when part of the selection does not belong to the chosen course.
   */
  useEffect(() => {
    const currentValue = form.getValues('periodo');
    const currentPeriods = Array.isArray(currentValue)
      ? currentValue.map(String).filter(Boolean)
      : (currentValue ? [String(currentValue)] : []);
    if (!currentPeriods.length) return;
    if (!showPeriods) {
      form.setValue('periodo', [], { shouldDirty: true });
      return;
    }
    const validIds = new Set(periodItems.map((p: any) => String(p?.id)));
    const nextPeriods = currentPeriods.filter((id) => validIds.has(id));
    if (!periodsQuery.isLoading && nextPeriods.length !== currentPeriods.length) {
      form.setValue('periodo', nextPeriods, { shouldDirty: true });
    }
  }, [showPeriods, periodItems, periodsQuery.isLoading, form, selectedCourseId]);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      {/* Ordem solicitada: Nome, Curso vinculado, Status (status por último) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Nome</Label>
          <Input placeholder="Ex.: Termo padrão" {...form.register('nome', { required: true })} />
          {form.formState.errors?.nome && (
            <p className="text-xs text-red-600">Nome é obrigatório</p>
          )}
        </div>
        {/* Campo slug oculto e sincronizado com nome */}
        <input type="hidden" {...form.register('slug')} />
        <div className="space-y-1">
          <Label>Curso vinculado</Label>
          <Combobox
            options={courseOptions}
            value={String(form.watch('id_curso') ?? '')}
            onValueChange={(val) => form.setValue('id_curso', val ? Number(val) : undefined)}
            placeholder="Selecione o curso"
            searchPlaceholder="Pesquisar curso pelo nome..."
            emptyText={courseItems.length === 0 ? 'Nenhum curso encontrado' : 'Digite para filtrar'}
            disabled={coursesQuery.isLoading}
            loading={coursesQuery.isLoading || coursesQuery.isFetching}
            onSearch={setCourseSearch}
            searchTerm={courseSearch}
            debounceMs={250}
          />
        </div>
      </div>

      {/* Seleção de período do curso (apenas tipo 4) */}
      {showPeriods && (
        <div className="space-y-1">
          <Label>Períodos do curso</Label>
          <div className="space-y-2">
            {!selectedCourseId && (
              <p className="text-sm text-muted-foreground">Selecione um curso para ver os períodos.</p>
            )}
            {selectedCourseId && periodsQuery.isLoading && (
              <p className="text-sm">Carregando períodos...</p>
            )}
            {selectedCourseId && !periodsQuery.isLoading && periodItems.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum período encontrado para este curso.</p>
            )}
            {selectedCourseId && !periodsQuery.isLoading && periodItems.length > 0 && (
              <>
                <Controller
                  control={form.control}
                  name="periodo"
                  render={({ field }) => (
                    <PeriodsMultiSelect
                      value={Array.isArray(field.value) ? field.value : (field.value ? [field.value] : [])}
                      onChange={field.onChange}
                      items={periodItems}
                      loading={periodsQuery.isLoading || periodsQuery.isFetching}
                    />
                  )}
                />
                <div className="rounded-md border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-blue-700">
                  Ao salvar, este contrato sera vinculado automaticamente aos periodos selecionados nos modulos do curso.
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Status por último */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>Status</Label>
          <div className="flex items-center gap-3 h-10">
            <Switch
              checked={(form.watch('ativo') as any) === 'publish'}
              onCheckedChange={(checked) => form.setValue('ativo', checked ? ('publish' as any) : ('draft' as any))}
            />
            <span className="text-sm text-muted-foreground">
              {(form.watch('ativo') as any) === 'publish' ? 'Publicado' : 'Rascunho'}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <Label>Tipo de Contrato</Label>
          <Controller
            control={form.control}
            name="tipo"
            render={({ field }) => (
              <Select
                value={String(field.value || 'geral')}
                onValueChange={field.onChange}
              >
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="geral">Geral (Aluno)</SelectItem>
                  <SelectItem value="responsavel">Responsável Financeiro</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {/* Seção de Variáveis (Helper) */}
      <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3 dark:border-blue-900/30 dark:bg-blue-950/20">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200">Dica</Badge>
            <span className="text-xs font-bold text-blue-800 dark:text-blue-400 uppercase tracking-wider">Variáveis Dinâmicas</span>
          </div>
          <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            className="h-6 text-[10px] text-blue-600 hover:text-blue-700 hover:bg-blue-100"
            onClick={() => {
              const vars = [
                '{aluno}', '{cpf_aluno}', '{identidade}', '{data_nascimento}', 
                '{logradouro}', '{numero}', '{bairro}', '{cidade}', '{estado}',
                '{curso}', '{valor_total}', '{dia}', '{mes}', '{ano}'
              ];
              navigator.clipboard.writeText(vars.join(', '));
              toast.success('Variáveis sugeridas copiadas');
            }}
          >
            Copiar Lista Base
          </Button>
        </div>
        <p className="text-[10px] text-blue-700/80 dark:text-blue-300/60 leading-relaxed mb-2">
          Use as tags abaixo no conteúdo para preenchimento automático. <strong>Clique em uma tag para inseri-la no editor</strong> na posição do cursor.
        </p>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {[
            { label: '{aluno}', desc: 'Nome do Aluno' },
            { label: '{cpf_aluno}', desc: 'CPF do Aluno' },
            { label: '{responsavel_nome}', desc: 'Nome do Fiador' },
            { label: '{responsavel_cpf}', desc: 'CPF do Fiador' },
            { label: '{responsavel_identidade}', desc: 'RG do Fiador' },
            { label: '{responsavel_email}', desc: 'E-mail do Fiador' },
            { label: '{responsavel_celular}', desc: 'Celular do Fiador' },
            { label: '{responsavel_endereco}', desc: 'Endereço do Fiador' },
            { label: '{responsavel_cidade}', desc: 'Cidade do Fiador' },
            { label: '{responsavel_uf}', desc: 'UF do Fiador' },
            { label: '{curso}', desc: 'Nome do Curso' },
            { label: '{data_nascimento}', desc: 'Nasc. Aluno' },
            { label: '{identidade}', desc: 'RG Aluno' },
          ].map((v) => (
            <div 
              key={v.label} 
              className="group relative cursor-pointer"
              onMouseDown={(e) => {
                e.preventDefault(); // Evita que o editor perca o foco
                insertTag(v.label);
              }}
            >
              <code className="text-[10px] bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded text-blue-700 dark:text-blue-400 font-mono">
                {v.label}
              </code>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block bg-zinc-800 text-white text-[9px] px-2 py-1 rounded whitespace-nowrap z-10 shadow-lg">
                {v.desc}
              </span>
            </div>
          ))}
          <span className="text-[10px] text-blue-400 font-medium ml-1 flex items-center">e mais...</span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            Conteúdo do termo/contrato
            <span className="text-[9px] font-normal text-muted-foreground uppercase">(Suporta HTML editor)</span>
          </Label>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={handleCopyContract}>
              <Copy className="h-3 w-3 mr-1" /> Copiar HTML
            </Button>
          </div>
        </div>
        
        <RichTextEditor
          value={String(form.watch('conteudo') || '')}
          onChange={(html) => form.setValue('conteudo', html, { shouldDirty: true })}
          placeholder="Comece a digitar o contrato aqui... Use as variáveis dinâmicas para personalização."
        />
      </div>

    </form>
  );
}

/**
 * PeriodsMultiSelect
 * pt-BR: Seleção múltipla de períodos com busca e badges removíveis.
 * en-US: Multi-select for periods with search and removable badges.
 */
function PeriodsMultiSelect({
  value,
  onChange,
  items,
  loading,
}: {
  value: (number | string)[];
  onChange: (next: (number | string)[]) => void;
  items: any[];
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = query.trim()
    ? items.filter((item) => String(item?.nome || item?.title || '').toLowerCase().includes(query.trim().toLowerCase()))
    : items;

  const selectedItems = items.filter((item) => value.map(String).includes(String(item?.id)));
  const triggerLabel = value.length === 0
    ? 'Selecione os periodos...'
    : `${value.length} ${value.length === 1 ? 'periodo selecionado' : 'periodos selecionados'}`;

  return (
    <div className="space-y-2.5">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-between text-left font-normal">
            <span className="flex items-center gap-2 truncate text-sm">
              <Layers3 className="h-4 w-4 text-zinc-400" />
              {loading ? 'Carregando...' : triggerLabel}
            </span>
            <CheckSquare className="h-4 w-4 text-zinc-400" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-3" align="start">
          <div className="space-y-3">
            <Input
              placeholder="Buscar periodos..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <ScrollArea className="h-56">
              <div className="space-y-1 pr-2">
                {filtered.map((item) => {
                  const id = String(item?.id);
                  const checked = value.map(String).includes(id);
                  const nome = String(item?.nome || item?.title || id);
                  return (
                    <label key={id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(nextChecked) => {
                          const next = new Set(value.map(String));
                          if (nextChecked) next.add(id);
                          else next.delete(id);
                          onChange(Array.from(next));
                        }}
                      />
                      <span className="text-sm">{nome}</span>
                    </label>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="px-2 py-3 text-center text-xs text-muted-foreground">Nenhum periodo encontrado</div>
                )}
              </div>
            </ScrollArea>
            <div className="flex items-center justify-between border-t pt-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
                Limpar
              </Button>
              <Button type="button" size="sm" onClick={() => setOpen(false)}>
                Concluir
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-md border border-dashed border-zinc-200 bg-zinc-50/30 p-2">
          {selectedItems.map((item) => {
            const id = String(item?.id);
            const nome = String(item?.nome || item?.title || id);
            return (
              <Badge key={id} className="flex items-center gap-1 rounded-md px-2 py-1">
                <span>{nome}</span>
                <button
                  type="button"
                  title="Remover periodo"
                  onClick={() => onChange(value.filter((selectedId) => String(selectedId) !== id))}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ContractForm;
