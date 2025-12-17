import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RichTextEditor } from '@/components/ui/RichTextEditor';
import { Form } from '@/components/ui/form';
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useComponentById, useCreateComponent, useUpdateComponent } from '@/hooks/components';
import { useContentTypesList } from '@/hooks/contentTypes';
import { CreateComponentInput } from '@/types/components';
import { Loader2, ArrowLeft, Trash2, GripVertical, Images, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { coursesService } from '@/services/coursesService';
import { PaginatedResponse } from '@/types';
import { uploadsService } from '@/services/uploadsService';
import EditFooterBar from '@/components/ui/edit-footer-bar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { UploadRecord } from '@/types/uploads';
/**
 * GalleryItem
 * pt-BR: Tipo para item da galeria com metadados personalizados por componente.
 * en-US: Type for gallery item with per-component custom metadata.
 */
type GalleryItem = UploadRecord & { nome_personalizado?: string; descricao_personalizada?: string };

/**
 * schema
 * pt-BR: Validação Zod para criação/edição de componentes CMS.
 * en-US: Zod validation for CMS component create/edit.
 */
const schema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  tipo_conteudo: z.string().min(1, 'Tipo de conteúdo é obrigatório'),
  // ordenar
  // pt-BR: Coerção para string, aceitando números digitados e normalizando para string.
  // en-US: Coerce to string, accepting numeric input and normalizing to string.
  ordenar: z.coerce.string().optional(),
  short_code: z.string().min(1, 'Short code é obrigatório'),
  id_curso: z.string().optional(),
  ativo: z.enum(['s', 'n']).default('s'),
  obs: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

/**
 * SiteComponentsForm
 * pt-BR: Página dedicada para cadastro e edição de componentes CMS.
 * en-US: Dedicated page for create and edit CMS components.
 */
export default function SiteComponentsForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: '',
      tipo_conteudo: '',
      ordenar: '',
      short_code: '',
      id_curso: '',
      ativo: 's',
      obs: '',
    },
  });

  const { data: record, isLoading: loadingRecord } = useComponentById(String(id || ''), { enabled: !!id });
  const createMutation = useCreateComponent();
  const updateMutation = useUpdateComponent();
  const { data: contentTypesResp, isLoading: loadingContentTypes } = useContentTypesList({ per_page: 100 });

  /**
   * fetchCourses
   * pt-BR: Busca cursos para popular o Select de cursos.
   * en-US: Fetch courses to populate the courses Select.
   */
  const coursesQuery = useQuery({
    queryKey: ['courses', 'list', { page: 1, per_page: 200 }],
    queryFn: async () => coursesService.listCourses({ page: 1, per_page: 200 }),
    staleTime: 5 * 60 * 1000,
  });
  const courseItems = ((coursesQuery.data as PaginatedResponse<any> | undefined)?.data) || [];
  /**
   * selectedCourseValue/Label & courseHasSelected
   * pt-BR: Estado derivado para fallback do Select de cursos quando o valor atual
   *        não consta entre as opções carregadas.
   * en-US: Derived state for courses Select fallback when current value is not
   *        present among loaded options.
   */
  const selectedCourseValue = String(form.watch('id_curso') ?? '');
  const selectedCourseLabel = useMemo(() => {
    const item = courseItems.find((c: any) => String(c.id) === String(selectedCourseValue || ''));
    const label = item ? (item.nome ?? item.name ?? '') : '';
    return String(label || '').trim();
  }, [courseItems, selectedCourseValue]);
  const courseHasSelected = useMemo(() => {
    return courseItems.some((c: any) => String(c.id) === String(selectedCourseValue || ''));
  }, [courseItems, selectedCourseValue]);

  /**
   * selectedTypeValue
   * pt-BR: Valor reativo do campo `tipo_conteudo`. Usa `watch` diretamente
   *        para garantir atualização imediata ao selecionar o tipo.
   * en-US: Reactive value of `tipo_conteudo`. Uses `watch` directly to ensure
   *        immediate updates when selecting the type.
   */
  const selectedTypeValue = String(form.watch('tipo_conteudo') ?? '');
  const selectedTypeLabel = useMemo(() => {
    const list = (contentTypesResp?.data || []) as any[];
    const item = list.find((opt: any) => String(opt.id ?? opt.value ?? opt.codigo) === String(selectedTypeValue || ''));
    const label = item ? (item.nome ?? item.name ?? item.descricao ?? item.titulo ?? '') : '';
    return String(label || '').trim();
  }, [contentTypesResp?.data, selectedTypeValue]);
  /**
   * typeHasSelected
   * pt-BR: Indica se o valor atual de `tipo_conteudo` existe na lista.
   * en-US: Indicates if current `tipo_conteudo` value exists in the list.
   */
  const typeHasSelected = useMemo(() => {
    const list = (contentTypesResp?.data || []) as any[];
    return list.some((opt: any) => String(opt.id ?? opt.value ?? opt.codigo) === String(selectedTypeValue || ''));
  }, [contentTypesResp?.data, selectedTypeValue]);
  /**
   * isGallery
   * pt-BR: Exibe o card quando o valor selecionado for exatamente "19".
   * en-US: Show the card when selected value equals "19" exactly.
   */
  const isGallery = String(selectedTypeValue) === '19' || Number(selectedTypeValue) === 19;

  /**
   * gallerySelection
   * pt-BR: Lista de imagens selecionadas para compor a galeria (ordem preservada).
   * en-US: Selected images list to compose the gallery (order preserved).
   */
  const [gallerySelection, setGallerySelection] = useState<GalleryItem[]>([]);
  /**
   * libraryOpen
   * pt-BR: Controla a abertura do diálogo de biblioteca.
   * en-US: Controls opening of the image library dialog.
   */
  const [libraryOpen, setLibraryOpen] = useState(false);
  /**
   * library pagination/search state
   * pt-BR: Estados para paginação incremental e busca local/servidor.
   * en-US: States for incremental pagination and local/server search.
   */
  const [libraryPage, setLibraryPage] = useState(1);
  const [libraryItems, setLibraryItems] = useState<UploadRecord[]>([]);
  const [libraryHasMore, setLibraryHasMore] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryLoadingMore, setLibraryLoadingMore] = useState(false);
  /**
   * dragIndex
   * pt-BR: Índice do item arrastado para ordenação.
   * en-US: Index of the dragged item for ordering.
   */
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  /**
   * uploadsQuery
   * pt-BR: Lista imagens enviadas (filtradas por componente quando houver ID) quando tipo = Galeria Completa.
   * en-US: Lists uploaded images (filtered by component when ID exists) when type = Galeria Completa.
   */
  const uploadsQuery = useQuery({
    queryKey: ['uploads', { id_componente: id }],
    queryFn: async () => uploadsService.listUploads(id ? { id_componente: id } : undefined),
    enabled: isGallery,
    staleTime: 60 * 1000,
  });

  /**
   * uploadsLibraryQuery
   * pt-BR: Lista geral de uploads (biblioteca) para seleção.
   * en-US: Global uploads list (library) for selection.
   */
  const uploadsLibraryQuery = useQuery({
    queryKey: ['uploads', 'library', { page: 1, per_page: 200 }],
    queryFn: async () => uploadsService.listUploads({ page: 1, per_page: 200 }),
    // pt-BR: Carrega a biblioteca APENAS quando o diálogo estiver aberto.
    // en-US: Load the library ONLY when the dialog is open.
    enabled: isGallery && libraryOpen,
    staleTime: 60 * 1000,
  });

  /**
   * initLibraryItems
   * pt-BR: Inicializa itens da biblioteca quando o diálogo abre ou quando a query muda.
   * en-US: Initialize library items when dialog opens or query changes.
   */
  useEffect(() => {
    if (!libraryOpen) return;
    const resp = uploadsLibraryQuery.data;
    const data = ((resp?.data as UploadRecord[]) || []);
    setLibraryItems(data);
    const current = Number(resp?.current_page || 1);
    const last = Number(resp?.last_page || 1);
    setLibraryPage(current);
    setLibraryHasMore(current < last);
  }, [libraryOpen, uploadsLibraryQuery.data]);

  /**
   * handleLibrarySearch
   * pt-BR: Atualiza busca e reinicia paginação (busca simples, servidor opcional).
   * en-US: Updates search and resets pagination (simple search, optional server).
   */
  const handleLibrarySearch = useCallback(async (value: string) => {
    setLibrarySearch(value);
    if (!libraryOpen) return;
    try {
      setLibraryLoadingMore(true);
      const resp = await uploadsService.listUploads({ page: 1, per_page: 60, q: value, nome: value });
      const data = ((resp?.data as UploadRecord[]) || []);
      setLibraryItems(data);
      const current = Number(resp?.current_page || 1);
      const last = Number(resp?.last_page || 1);
      setLibraryPage(current);
      setLibraryHasMore(current < last);
    } finally {
      setLibraryLoadingMore(false);
    }
  }, [libraryOpen]);

  /**
   * loadMoreLibrary
   * pt-BR: Carrega próxima página da biblioteca e concatena.
   * en-US: Loads next library page and concatenates.
   */
  const loadMoreLibrary = useCallback(async () => {
    if (!libraryOpen || libraryLoadingMore || !libraryHasMore) return;
    try {
      setLibraryLoadingMore(true);
      const nextPage = libraryPage + 1;
      const resp = await uploadsService.listUploads({ page: nextPage, per_page: 60, q: librarySearch, nome: librarySearch });
      const data = ((resp?.data as UploadRecord[]) || []);
      setLibraryItems((prev) => [...prev, ...data]);
      const current = Number(resp?.current_page || nextPage);
      const last = Number(resp?.last_page || current);
      setLibraryPage(current);
      setLibraryHasMore(current < last);
    } finally {
      setLibraryLoadingMore(false);
    }
  }, [libraryOpen, libraryLoadingMore, libraryHasMore, libraryPage, librarySearch]);

  /**
   * localPreviews
   * pt-BR: Previews locais antes/ao enviar (URLs revogadas após conclusão).
   * en-US: Local previews before/while uploading (URLs revoked after completion).
   */
  const [localPreviews, setLocalPreviews] = useState<{ url: string; name: string }[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  /**
   * handleFilesDrop
   * pt-BR: Trata arquivos soltos/selecionados, envia para `/uploads` e adiciona à seleção da galeria sem refetch.
   * en-US: Handles dropped/selected files, posts to `/uploads`, and adds to gallery selection without refetch.
   */
  const handleFilesDrop = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setIsUploading(true);
    try {
      // Gera previews locais
      const previews = arr.map((f) => ({ url: URL.createObjectURL(f), name: f.name }));
      setLocalPreviews((prev) => [...prev, ...previews]);

      // Envia cada arquivo
      for (const file of arr) {
        const resp = await uploadsService.uploadFile(file, id ? { id_componente: id } : undefined);
        // Adiciona diretamente à seleção da galeria para feedback imediato
        addToGallery(resp.data);
      }
    } catch (err: any) {
      // Tratamento de erro de API: exibe mensagem retornada
      const apiMsg = err?.body?.message || err?.message || 'Falha ao enviar arquivo.';
      toast({
        title: 'Falha no upload',
        description: String(apiMsg),
        variant: 'destructive',
      });
    } finally {
      // Revoga object URLs e limpa previews
      setLocalPreviews((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.url));
        return [];
      });
      setIsUploading(false);
    }
  }, [id, uploadsQuery]);

  /**
   * addToGallery
   * pt-BR: Adiciona uma imagem à seleção da galeria se ainda não estiver presente.
   * en-US: Adds an image to gallery selection if not already present.
   */
  const addToGallery = useCallback((img: UploadRecord) => {
    // pt-BR: Inicializa metadados do item ao adicionar.
    // en-US: Initialize item metadata upon adding.
    setGallerySelection((prev) => {
      const exists = prev.some((p) => p.id === img.id);
      const item: GalleryItem = { ...img, nome_personalizado: img.nome || '', descricao_personalizada: '' };
      return exists ? prev : [...prev, item];
    });
  }, []);

  /**
   * toggleInGallery
   * pt-BR: Alterna a presença de uma imagem na seleção da galeria. Se já estiver
   *        selecionada, remove; caso contrário, adiciona. Mostra feedback simples.
   * en-US: Toggles an image in the gallery selection. If already selected, removes;
   *        otherwise, adds. Shows simple feedback.
   */
  const toggleInGallery = useCallback((img: UploadRecord) => {
    setGallerySelection((prev) => {
      const exists = prev.some((p) => p.id === img.id);
      if (exists) return prev.filter((p) => p.id !== img.id);
      const item: GalleryItem = { ...img, nome_personalizado: img.nome || '', descricao_personalizada: '' };
      return [...prev, item];
    });
  }, []);

  /**
   * isSelectedInGallery
   * pt-BR: Verifica se um ID está presente na seleção atual da galeria.
   * en-US: Checks whether an ID is present in current gallery selection.
   */
  const isSelectedInGallery = useCallback((id: number) => {
    return gallerySelection.some((p) => p.id === id);
  }, [gallerySelection]);

  /**
   * removeFromGallery
   * pt-BR: Remove uma imagem da seleção da galeria pelo índice.
   * en-US: Removes an image from gallery selection by index.
   */
  const removeFromGallery = useCallback((index: number) => {
    setGallerySelection((prev) => prev.filter((_, i) => i !== index));
  }, []);

  /**
   * reorderGallery
   * pt-BR: Reordena a seleção da galeria (drag-and-drop simples com HTML5).
   * en-US: Reorders gallery selection (simple HTML5 drag-and-drop).
   */
  const reorderGallery = useCallback((from: number, to: number) => {
    setGallerySelection((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  /**
   * updateGalleryMeta
   * pt-BR: Atualiza nome e descrição personalizados para um item da galeria.
   * en-US: Updates custom name and description for a gallery item.
   */
  const updateGalleryMeta = useCallback((index: number, meta: Partial<Pick<GalleryItem, 'nome_personalizado' | 'descricao_personalizada'>>) => {
    setGallerySelection((prev) => prev.map((it, i) => (i === index ? { ...it, ...meta } : it)));
  }, []);

  /**
   * hydrateForm
   * pt-BR: Preenche formulário ao carregar registro no modo edição.
   * en-US: Hydrates form when record loads in edit mode.
   */
  useEffect(() => {
    if (record) {
      form.reset({
        nome: record.nome || '',
        // pt-BR: Garante que `tipo_conteudo` seja sempre string para o Select.
        // en-US: Ensure `tipo_conteudo` is always a string for the Select.
        tipo_conteudo: record.tipo_conteudo !== undefined && record.tipo_conteudo !== null ? String(record.tipo_conteudo) : '',
        // pt-BR: Normaliza ordenar para string, evitando erro "Expected string, received number".
        // en-US: Normalize ordenar to string to avoid "Expected string, received number".
        ordenar: record.ordenar !== undefined && record.ordenar !== null ? String(record.ordenar) : '',
        short_code: record.short_code || '',
        // pt-BR: Garante que `id_curso` seja string; usa fallback de `record.config.id_curso`.
        // en-US: Ensure `id_curso` is a string; falls back to `record.config.id_curso`.
        id_curso: (() => {
          const raw = (record as any)?.id_curso ?? (record as any)?.config?.id_curso;
          return raw !== undefined && raw !== null ? String(raw) : '';
        })(),
        ativo: record.ativo || 's',
        obs: record.obs || '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id]);

  /**
   * hydrateGallerySelection
   * pt-BR: Hidrata a seleção da galeria ao carregar o registro no modo edição. Se o backend
   *        fornecer `galeria` como lista de IDs, usa esses IDs para montar a seleção e ordem.
   *        Caso contrário, usa as imagens enviadas para o componente como fallback.
   * en-US: Hydrates gallery selection when editing. If backend provides `galeria` as an array
   *        of IDs, uses it to build selection and ordering. Otherwise, falls back to the
   *        uploaded images for the component.
   */
  useEffect(() => {
    if (!record || !isGallery) return;
    // pt-BR: IDs podem vir em record.galeria ou em record.config.galeria
    // en-US: IDs may come in record.galeria or record.config.galeria
    const rawConfig = (record as any)?.config?.galeria as any[] | undefined;
    const rawTop = (record as any)?.galeria as any[] | undefined;
    const raw = (rawConfig && Array.isArray(rawConfig) && rawConfig.length > 0) ? rawConfig : rawTop;
    const ids: number[] = Array.isArray(raw)
      ? raw.map((v: any) => (typeof v === 'object' && v !== null ? Number(v.id) : Number(v))).filter((n) => !Number.isNaN(n))
      : [];
    const metaById = new Map<number, { nome?: string; descricao?: string }>();
    if (Array.isArray(raw)) {
      raw.forEach((v: any) => {
        if (typeof v === 'object' && v !== null && v.id !== undefined) {
          metaById.set(Number(v.id), { nome: v.nome, descricao: v.descricao });
        }
      });
    }

    // Usa uploads do componente e busca apenas IDs faltantes (sem carregar biblioteca inteira)
    const componentUploads = ((uploadsQuery.data?.data as UploadRecord[]) || []);
    if (ids && Array.isArray(ids) && ids.length > 0) {
      const byId = new Map<number, UploadRecord>();
      componentUploads.forEach((u) => byId.set(u.id, u));
      const missingIds = ids.filter((gid) => !byId.has(gid));

      if (missingIds.length > 0) {
        (async () => {
          try {
            const fetched = await Promise.all(missingIds.map((mid) => uploadsService.getUpload(mid)));
            fetched.forEach((u) => byId.set(u.id, u));
            const ordered = ids.map((gid) => {
              const base = byId.get(gid);
              if (!base) return undefined;
              const meta = metaById.get(gid) || {};
              const item: GalleryItem = {
                ...base,
                nome_personalizado: meta.nome ?? base.nome ?? '',
                descricao_personalizada: meta.descricao ?? '',
              };
              return item;
            }).filter(Boolean) as GalleryItem[];
            setGallerySelection(ordered);
          } catch {
            const fallback = ids.map((gid) => {
              const base = byId.get(gid);
              if (!base) return undefined;
              const meta = metaById.get(gid) || {};
              const item: GalleryItem = {
                ...base,
                nome_personalizado: meta.nome ?? base.nome ?? '',
                descricao_personalizada: meta.descricao ?? '',
              };
              return item;
            }).filter(Boolean) as GalleryItem[];
            setGallerySelection(fallback);
          }
        })();
      } else {
        const ordered = ids.map((gid) => {
          const base = byId.get(gid);
          if (!base) return undefined;
          const meta = metaById.get(gid) || {};
          const item: GalleryItem = {
            ...base,
            nome_personalizado: meta.nome ?? base.nome ?? '',
            descricao_personalizada: meta.descricao ?? '',
          };
          return item;
        }).filter(Boolean) as GalleryItem[];
        setGallerySelection(ordered);
      }
    } else if (componentUploads.length > 0) {
      const initial = componentUploads.map((u) => ({
        ...u,
        nome_personalizado: u.nome ?? '',
        descricao_personalizada: '',
      })) as GalleryItem[];
      setGallerySelection(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.id, isGallery, uploadsQuery.data]);

  /**
   * finishAfterSaveRef
   * pt-BR: Controla navegação pós-salvar. Quando true, volta à listagem; quando false, permanece.
   * en-US: Controls post-save navigation. When true, goes back to listing; when false, stays.
   */
  const finishAfterSaveRef = useRef<boolean>(false);

  /**
   * handleSubmit
   * pt-BR: Cria ou atualiza o componente. Se "continuar" após criar, redireciona para a edição do novo ID.
   *        Se "finalizar", volta para a listagem.
   * en-US: Creates or updates component. If "continue" after create, redirects to edit of new ID.
   *        If "finish", navigates back to listing.
   */
  const handleSubmit = (data: FormData) => {
    const payload: CreateComponentInput = { ...data };
    // Quando for galeria (ID 19), incluir os IDs selecionados
    if (isGallery && gallerySelection.length > 0) {
      payload.galeria = gallerySelection.map((g) => ({ id: g.id, nome: g.nome_personalizado ?? g.nome ?? '', descricao: g.descricao_personalizada ?? '' }));
    }
    if (id) {
      // Atualização: decide navegação conforme finishAfterSaveRef
      updateMutation.mutate({ id: String(id), data: payload }, {
        onSuccess: () => {
          if (finishAfterSaveRef.current) {
            navigate('/admin/site/conteudo-site');
          }
        },
      });
    } else {
      // Criação: se for continuar, redireciona para edição do novo registro
      createMutation.mutate(payload, {
        onSuccess: (created: any) => {
          if (finishAfterSaveRef.current) {
            navigate('/admin/site/conteudo-site');
          } else if (created?.id) {
            navigate(`/admin/site/conteudo-site/${created.id}/edit`);
          } else {
            // Fallback: caso não haja ID, permanece na página e alerta o usuário
            // pt-BR: Mostra um aviso para o caso de a API não retornar o ID do novo registro.
            // en-US: Shows a warning in case the API does not return the new record ID.
            toast({
              title: 'Atenção',
              description: 'Criação concluída, mas o backend não retornou o ID. Permanecendo na página.',
            });
          }
        },
      });
    }
  };

  const goBack = () => navigate('/admin/site/conteudo-site');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{id ? 'Editar componente' : 'Cadastrar componente'}</h1>
          <p className="text-muted-foreground">Endpoint: <code>/componentes</code> — Rota: <code>/admin/site/conteudo-site{id ? `/${id}/edit` : '/create'}</code></p>
        </div>
        <Button variant="outline" onClick={goBack}><ArrowLeft className="h-4 w-4 mr-2" /> Voltar para listagem</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do componente</CardTitle>
          <CardDescription>Preencha os campos abaixo</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingRecord && id ? (
            <div className="flex items-center gap-2 text-gray-600"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField name="nome" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} placeholder="Nome do componente" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField name="tipo_conteudo" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de conteúdo</FormLabel>
                    {/* pt-BR: Usa sempre string para evitar mismatch com itens do Select. */}
                    {/* en-US: Always use string to avoid mismatch with Select item values. */}
                    <Select value={(field.value ? String(field.value) : undefined)} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={loadingContentTypes ? 'Carregando...' : 'Selecione o tipo'} />
                      </SelectTrigger>
                      <SelectContent>
                        {/* pt-BR: Fallback quando o valor atual não está nas opções carregadas. */}
                        {/* en-US: Fallback when current value is not among loaded options. */}
                        {!typeHasSelected && selectedTypeValue && (
                          <SelectItem value={String(selectedTypeValue)}>{selectedTypeLabel || '(valor atual)'}</SelectItem>
                        )}
                        {(contentTypesResp?.data || []).
                          filter((opt: any) => opt && (opt.id ?? opt.value ?? opt.codigo) !== undefined).
                          map((opt: any) => {
                            const value = String(opt.id ?? opt.value ?? opt.codigo);
                            const label = opt.nome ?? opt.name ?? opt.descricao ?? opt.titulo ?? value;
                            return (
                              <SelectItem key={value} value={value}>{String(label)}</SelectItem>
                            );
                          })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField name="ordenar" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ordenar</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value || ''} placeholder="Ex.: 67" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField name="short_code" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Short Code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        placeholder="Ex.: declaracao_pi_ppa"
                        onChange={(e) => {
                          // pt-BR: Normaliza substituindo espaços por '_'.
                          // en-US: Normalize by replacing spaces with '_'.
                          const normalized = e.target.value.replace(/\s+/g, '_');
                          field.onChange(normalized);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField name="id_curso" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Curso</FormLabel>
                    {/* pt-BR: Garante que o valor seja string para casar com `SelectItem` */}
                    {/* en-US: Ensure value is string to match `SelectItem` */}
                    <Select value={String(field.value || '')} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={coursesQuery.isLoading ? 'Carregando...' : 'Selecione o curso'} />
                      </SelectTrigger>
                      <SelectContent>
                        {/* pt-BR: Fallback para exibir o valor atual quando não consta nas opções. */}
                        {/* en-US: Fallback to show current value when not present in options. */}
                        {!courseHasSelected && selectedCourseValue && (
                          <SelectItem value={String(selectedCourseValue)}>{selectedCourseLabel || '(valor atual)'}</SelectItem>
                        )}
                        {courseItems.map((c: any) => {
                          const value = String(c.id);
                          const label = String(c.nome ?? c.name ?? value);
                          return (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField name="ativo" control={form.control} render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ativo</FormLabel>
                    <div className="flex items-center gap-3">
                      <Switch
                        checked={field.value === 's'}
                        onCheckedChange={(val) => field.onChange(val ? 's' : 'n')}
                      />
                      <span className="text-sm text-muted-foreground">{field.value === 's' ? 'Sim' : 'Não'}</span>
                    </div>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField name="obs" control={form.control} render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Observações (HTML)</FormLabel>
                    <FormControl>
                      <RichTextEditor
                        value={field.value || ''}
                        onChange={field.onChange}
                        placeholder="Digite conteúdo HTML formatado..."
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <div className="md:col-span-2">
                  <Card>
                      <CardHeader>
                        <CardTitle>Galeria de imagens</CardTitle>
                        <CardDescription>
                          Envie e gerencie imagens para este componente.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        {/* Barra de ações da galeria */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="text-sm text-muted-foreground">
                            {gallerySelection.length > 0 ? `${gallerySelection.length} selecionada(s)` : 'Nenhuma imagem selecionada na galeria'}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button type="button" variant="secondary" onClick={() => setLibraryOpen(true)}>
                              <Images className="h-4 w-4 mr-2" /> Selecionar da biblioteca
                            </Button>
                            <Badge variant="secondary" className="text-xs">{gallerySelection.length}</Badge>
                          </div>
                        </div>

                        {/* Lista atual da galeria selecionada, com remover e arrastar */}
                        {gallerySelection.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                            {gallerySelection.map((g, idx) => (
                              <div
                                key={`sel-${g.id}`}
                                className="relative rounded-md overflow-hidden border"
                                draggable
                                onDragStart={() => setDragIndex(idx)}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={() => {
                                  if (dragIndex !== null && dragIndex !== idx) reorderGallery(dragIndex, idx);
                                  setDragIndex(null);
                                }}
                              >
                                <img src={g.url} alt={g.nome} loading="lazy" className="w-full h-32 object-cover" />
                                <div className="px-2 py-1 text-xs truncate flex items-center justify-between">
                                  <span className="flex items-center gap-1"><GripVertical className="h-3 w-3" />{g.nome}</span>
                                  <Button type="button" variant="ghost" size="icon" onClick={() => removeFromGallery(idx)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                                {/* pt-BR: Campos para nome e descrição personalizados por imagem. */}
                                {/* en-US: Fields for per-image custom name and description. */}
                                <div className="p-2 space-y-2 border-t bg-muted/20">
                                  <Input
                                    value={g.nome_personalizado ?? ''}
                                    placeholder="Nome personalizado da imagem"
                                    onChange={(e) => updateGalleryMeta(idx, { nome_personalizado: e.target.value })}
                                  />
                                  <Textarea
                                    value={g.descricao_personalizada ?? ''}
                                    placeholder="Descrição personalizada"
                                    onChange={(e) => updateGalleryMeta(idx, { descricao_personalizada: e.target.value })}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Dropzone simples com preview local e suporte a múltiplos arquivos */}
                        <div
                          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${isUploading ? 'opacity-60 cursor-wait' : 'hover:border-gray-400'}`}
                          onDragOver={(e) => { e.preventDefault(); }}
                          onDrop={(e) => { e.preventDefault(); handleFilesDrop(e.dataTransfer.files); }}
                          onClick={() => {
                            const input = document.getElementById('gallery-file-input') as HTMLInputElement | null;
                            input?.click();
                          }}
                        >
                          <p className="text-sm text-muted-foreground">Clique ou arraste arquivos aqui</p>
                          <p className="text-xs text-muted-foreground">Apenas imagens. Suporta múltiplos envios.</p>
                          <input
                            id="gallery-file-input"
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => e.target.files && handleFilesDrop(e.target.files)}
                          />
                        </div>

                        {/* Previews locais em envio */}
                        {localPreviews.length > 0 && (
                          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                            {localPreviews.map((p) => (
                              <div key={p.url} className="rounded-md overflow-hidden border">
                                <img src={p.url} alt={p.name} loading="lazy" className="w-full h-32 object-cover" />
                                <div className="px-2 py-1 text-xs truncate">{p.name}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Lista de imagens existentes removida: exibir apenas dentro do diálogo de biblioteca. */}

                        {/* Dialog: Biblioteca de imagens */}
                        <Dialog open={libraryOpen} onOpenChange={setLibraryOpen}>
                          <DialogContent className="max-w-4xl">
                            <DialogHeader>
                              <DialogTitle>Biblioteca de imagens</DialogTitle>
                              <DialogDescription>
                                Clique em uma imagem para adicionar/remover da galeria. Use a busca para filtrar.
                              </DialogDescription>
                            </DialogHeader>
                            {/* Toolbar: busca e ações */}
                            <div className="flex items-center gap-3 mb-3">
                              <Input
                                value={librarySearch}
                                placeholder="Buscar por nome..."
                                onChange={(e) => handleLibrarySearch(e.target.value)}
                                className="w-full"
                              />
                              <Button type="button" variant="secondary" onClick={loadMoreLibrary} disabled={!libraryHasMore || libraryLoadingMore}>
                                {libraryLoadingMore ? (<Loader2 className="h-4 w-4 animate-spin" />) : 'Carregar mais'}
                              </Button>
                            </div>

                            {/* Grid com rolagem e carregamento incremental */}
                            <div
                              className="min-h-[240px] max-h-[60vh] overflow-auto"
                              onScroll={(e) => {
                                const el = e.currentTarget;
                                const nearBottom = (el.scrollHeight - el.scrollTop - el.clientHeight) < 120;
                                if (nearBottom) loadMoreLibrary();
                              }}
                            >
                              {(uploadsLibraryQuery.isLoading && libraryItems.length === 0) ? (
                                <div className="text-sm text-muted-foreground">Carregando biblioteca...</div>
                              ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                  {libraryItems.map((img) => (
                                    <button
                                      type="button"
                                      key={`lib-${img.id}`}
                                      className={`relative rounded-md overflow-hidden border text-left ${isSelectedInGallery(img.id) ? 'ring-2 ring-blue-500' : ''}`}
                                      onClick={() => toggleInGallery(img)}
                                    >
                                      <img src={img.url} alt={img.nome} loading="lazy" className="w-full h-32 object-cover" />
                                      {isSelectedInGallery(img.id) && (
                                        <div className="absolute top-1 right-1 bg-white/80 rounded-full p-1 shadow">
                                          <Check className="h-4 w-4 text-blue-600" />
                                        </div>
                                      )}
                                      <div className="px-2 py-1 text-xs truncate">{img.nome}</div>
                                    </button>
                                  ))}
                                  {libraryItems.length === 0 && (
                                    <div className="text-sm text-muted-foreground col-span-full">Nenhuma imagem na biblioteca.</div>
                                  )}
                                </div>
                              )}
                              {libraryHasMore && (
                                <div className="flex items-center justify-center py-3">
                                  <Button type="button" variant="ghost" onClick={loadMoreLibrary} disabled={libraryLoadingMore}>
                                    {libraryLoadingMore ? (<Loader2 className="h-4 w-4 animate-spin" />) : 'Carregar mais'}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </DialogContent>
                        </Dialog>
                      </CardContent>
                  </Card>
                </div>

                <div className="md:col-span-2 flex gap-3">
                  <Button type="submit" disabled={createMutation.isLoading || updateMutation.isLoading}>
                    {(createMutation.isLoading || updateMutation.isLoading) && (<Loader2 className="mr-2 h-4 w-4 animate-spin" />)}
                    {id ? 'Atualizar' : 'Cadastrar'}
                  </Button>
                  <Button type="button" variant="outline" onClick={goBack}>Cancelar</Button>
                </div>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
      {/* Rodapé fixo apenas no modo edição */}
      {Boolean(id) && (
        <EditFooterBar
          onBack={goBack}
          onContinue={() => { finishAfterSaveRef.current = false; form.handleSubmit(handleSubmit)(); }}
          onFinish={() => { finishAfterSaveRef.current = true; form.handleSubmit(handleSubmit)(); }}
          disabled={createMutation.isLoading || updateMutation.isLoading}
        />
      )}
    </div>
  );
}