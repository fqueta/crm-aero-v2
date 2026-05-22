import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { integracoesService, Integracao, IntegracaoConfig } from '@/services/integracoesService';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { MoreVertical, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

export default function Integrations() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filterName, setFilterName] = useState('');
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formUser, setFormUser] = useState('');
  const [formPass, setFormPass] = useState('');
  const [formProduto, setFormProduto] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [formMeta, setFormMeta] = useState<{ key: string; value: string }[]>([{ key: '', value: '' }]);
  const addFormMetaRow = () => setFormMeta((rows) => [...rows, { key: '', value: '' }]);
  const removeFormMetaRow = (idx: number) => setFormMeta((rows) => rows.filter((_, i) => i !== idx));
  const updateFormMetaRow = (idx: number, field: 'key' | 'value', val: string) =>
    setFormMeta((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));

  /** Carrega lista de integrações com filtro simples */
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['integracoes', { name: filterName }],
    queryFn: () => {
      console.log('[integracoes] queryFn start', { name: filterName });
      return integracoesService.list({ name: filterName || undefined, per_page: 20 });
    },
    enabled: true,
  });
  const items: Integracao[] = useMemo(() => data?.data || [], [data]);
  console.log(items);
  /** Criação */
  const createMut = useMutation({
    mutationFn: () => {
      const config: IntegracaoConfig = { url: formUrl.trim() };
      if (formUser) config.user = formUser;
      if (formPass) config.pass = formPass;
      if (formProduto) config.produto = formProduto;
      const meta = formMeta
        .filter((m) => (m.key || '').trim() !== '')
        .map((m) => ({ key: m.key.trim(), value: m.value ?? '' }));
      return integracoesService.create({
        name: formName.trim(),
        active: formActive,
        config,
        meta,
      });
    },
    onSuccess: () => {
      toast.success('Integração criada');
      setCreating(false);
      setFormName('');
      setFormUrl('');
      setFormUser('');
      setFormPass('');
      setFormProduto('');
      setFormActive(true);
      setFormMeta([{ key: '', value: '' }]);
      qc.invalidateQueries({ queryKey: ['integracoes'] });
    },
    onError: (e: any) => {
      toast.error(e?.body?.message || 'Erro ao criar integração');
    },
  });

  /** Atualização rápida: ativa/inativa */
  const toggleActiveMut = useMutation({
    mutationFn: (item: Integracao) => integracoesService.update(item.id, { active: !item.active }),
    onSuccess: () => {
      toast.success('Status atualizado');
      qc.invalidateQueries({ queryKey: ['integracoes'] });
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  /** Remover (lixeira) */
  const removeMut = useMutation({
    mutationFn: (item: Integracao) => integracoesService.remove(item.id),
    onSuccess: () => {
      toast.success('Integração movida para lixeira');
      qc.invalidateQueries({ queryKey: ['integracoes'] });
    },
    onError: () => toast.error('Erro ao remover integração'),
  });

  /** Edição de metas por item */
  const [expandedMeta, setExpandedMeta] = useState<Record<number, boolean>>({});
  const [editMetaRows, setEditMetaRows] = useState<Record<number, { key: string; value: string }[]>>({});
  const toggleMeta = (id: number, item: Integracao) => {
    setExpandedMeta((s) => ({ ...s, [id]: !s[id] }));
    if (!editMetaRows[id]) {
      const base = (item.meta || []).map((m) => ({ key: m.key, value: m.value ?? '' }));
      setEditMetaRows((m) => ({ ...m, [id]: base.length ? base : [{ key: '', value: '' }] }));
    }
  };
  const addMetaRow = (id: number) =>
    setEditMetaRows((m) => ({ ...m, [id]: [...(m[id] || []), { key: '', value: '' }] }));
  const removeMetaRow = (id: number, idx: number) =>
    setEditMetaRows((m) => ({ ...m, [id]: (m[id] || []).filter((_, i) => i !== idx) }));
  const updateMetaRow = (id: number, idx: number, field: 'key' | 'value', val: string) =>
    setEditMetaRows((m) => ({
      ...m,
      [id]: (m[id] || []).map((r, i) => (i === idx ? { ...r, [field]: val } : r)),
    }));
  const saveMetaMut = useMutation({
    mutationFn: async (item: Integracao) => {
      const rows = (editMetaRows[item.id] || []).filter((r) => (r.key || '').trim() !== '');
      return integracoesService.update(item.id, { meta: rows.map((r) => ({ key: r.key.trim(), value: r.value ?? '' })) });
    },
    onSuccess: (_, item) => {
      toast.success('Metacampos salvos');
      qc.invalidateQueries({ queryKey: ['integracoes'] });
      setEditMetaRows((m) => {
        const next = { ...m };
        delete next[item.id];
        return next;
      });
    },
    onError: () => toast.error('Erro ao salvar metacampos'),
  });

  const [expandedEdit, setExpandedEdit] = useState<Record<number, boolean>>({});
  const [editFields, setEditFields] = useState<Record<number, { name: string; url: string; user: string; pass: string; produto: string; active: boolean }>>({});
  const toggleEdit = (id: number, item: Integracao) => {
    setExpandedEdit((s) => ({ ...s, [id]: true }));
    if (!editFields[id]) {
      setEditFields((m) => ({
        ...m,
        [id]: {
          name: item.name || '',
          url: item.config?.url || '',
          user: (item.config as any)?.user || '',
          pass: (item.config as any)?.pass || '',
          produto: (item.config as any)?.produto || '',
          active: item.active,
        },
      }));
    }
  };
  const updateEditField = (id: number, field: keyof typeof editFields[number], val: any) => {
    setEditFields((m) => ({ ...m, [id]: { ...(m[id] || {}), [field]: val } }));
  };
  const saveEditMut = useMutation({
    mutationFn: async (item: Integracao) => {
      const f = editFields[item.id];
      return integracoesService.update(item.id, {
        name: f.name,
        active: f.active,
        config: { url: f.url, user: f.user || undefined, pass: f.pass || undefined, produto: f.produto || undefined },
      });
    },
    onSuccess: (_, item) => {
      toast.success('Integração atualizada');
      qc.invalidateQueries({ queryKey: ['integracoes'] });
      setExpandedEdit({});
      setEditFields((fields) => {
        const next = { ...fields };
        delete next[item.id];
        return next;
      });
    },
    onError: () => toast.error('Erro ao atualizar integração'),
  });

  useEffect(() => {
    refetch();
  }, []);

  // Debug: chamada direta para verificar execução de fetch
  useEffect(() => {
    (async () => {
      try {
        const r = await integracoesService.list({ per_page: 20, name: filterName || undefined });
        console.log('[integracoes] direct result', r);
      } catch (e) {
        console.error('[integracoes] direct error', e);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Integrações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Filtrar por nome..."
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
              />
            </div>
            <Button onClick={() => refetch()} disabled={isLoading}>Buscar</Button>
            <Button asChild variant="secondary">
              <Link to="/admin/settings/integrations/new">Nova Integração</Link>
            </Button>
          </div>
          <Separator />
          <div className="space-y-3">
            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Card><CardContent className="p-4 space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-64" /><Skeleton className="h-8 w-full" /></CardContent></Card>
                <Card><CardContent className="p-4 space-y-2"><Skeleton className="h-5 w-40" /><Skeleton className="h-4 w-64" /><Skeleton className="h-8 w-full" /></CardContent></Card>
              </div>
            )}
            {!isLoading && items.length === 0 && (
              <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
                Nenhuma integração encontrada.
              </div>
            )}
            {!isLoading && items.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {items.map((it) => (
                  <Card key={it.id}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className="font-medium">{it.name}</div>
                          <Badge variant={it.active ? 'secondary' : 'outline'}>{it.active ? 'Ativa' : 'Inativa'}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">{it.config?.url}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch checked={it.active} onCheckedChange={() => toggleActiveMut.mutate(it)} />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/admin/settings/integrations/${it.id}/edit`)}>Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleMeta(it.id, it)}>Metas</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => removeMut.mutate(it)}>Remover</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {/* Edição agora é feita na rota dedicada */}
            {items.map((it) => (
              expandedMeta[it.id] ? (
                <div key={`meta-${it.id}`} className="border rounded-md p-3">
                  <div className="text-sm font-medium mb-2">Metacampos de {it.name}</div>
                  {(editMetaRows[it.id] || []).map((row, idx) => (
                    <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                      <Input placeholder="Chave" value={row.key} onChange={(e) => updateMetaRow(it.id, idx, 'key', e.target.value)} />
                      <Input placeholder="Valor" value={row.value} onChange={(e) => updateMetaRow(it.id, idx, 'value', e.target.value)} />
                      <Button variant="secondary" onClick={() => removeMetaRow(it.id, idx)}>Remover</Button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => addMetaRow(it.id)}>Adicionar campo</Button>
                    <Button onClick={() => saveMetaMut.mutate(it)} disabled={saveMetaMut.isLoading}>Salvar</Button>
                  </div>
                </div>
              ) : null
            ))}
          </div>
        </CardContent>
        <CardFooter />
      </Card>
    </div>
  );
}
