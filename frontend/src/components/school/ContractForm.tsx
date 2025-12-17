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
  const form = useForm<CreateContractInput | UpdateContractInput>({
    defaultValues: {
      nome: '',
      slug: '',
      conteudo: '',
      id_curso: undefined,
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
    form.reset({
      nome: d?.nome ?? '',
      slug: d?.slug ?? '',
      conteudo: d?.conteudo ?? d?.content ?? '',
      id_curso: d?.id_curso ?? undefined,
      periodo: d?.periodo ?? '',
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

  // Query de períodos do curso selecionado (visualização)
  const selectedCourseId = form.watch('id_curso') ? Number(form.watch('id_curso')) : undefined;
  const periodsQuery = useQuery({
    queryKey: ['periodos', 'list', selectedCourseId],
    queryFn: async () => {
      if (!selectedCourseId) return { data: [] } as any;
      return periodsService.listPeriods({ page: 1, per_page: 200, id_curso: selectedCourseId });
    },
    enabled: !!selectedCourseId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  const periodItems = ((periodsQuery.data as any)?.data || (periodsQuery.data as any)?.items || []) as any[];

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

      {/* Visualização de períodos do curso (mantida) */}
      <div className="space-y-1">
        <Label>Períodos do curso (visualização)</Label>
        <div className="border rounded-md p-2 min-h-[42px]">
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
            <div className="flex flex-wrap gap-2">
              {periodItems.map((p: any) => {
                const relacionados: any[] = (p?.id_contratos as any[]) || [];
                const isLinked = !!relacionados?.includes?.((initialData as any)?.id);
                return (
                  <Badge key={String(p?.id)} variant={isLinked ? 'default' : 'secondary'}>
                    {String(p?.nome || p?.title || '')}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Status por último */}
      <div className="space-y-1">
        <Label>Status</Label>
        <div className="flex items-center gap-3">
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
        <Label>Conteúdo do termo/contrato</Label>
        {/**
         * RichTextEditor
         * pt-BR: Substitui o Textarea por um editor HTML simples.
         * en-US: Replaces Textarea with a simple HTML editor.
         */}
        <RichTextEditor
          value={String(form.watch('conteudo') || '')}
          onChange={(html) => form.setValue('conteudo', html, { shouldDirty: true })}
          placeholder="Edite o conteúdo do termo/contrato..."
        />
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={handleCopyContract}>
            Copiar contrato
          </Button>
        </div>
      </div>

    </form>
  );
}

export default ContractForm;