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
import { MoreVertical, Search, RefreshCw, CheckCircle2, Database, CreditCard, Mail, FileSignature, MessageSquare, Blocks, ChevronRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AsaasSettingsCard } from '@/components/settings/AsaasSettingsCard';
import type { AsaasSavePayload } from '@/types/asaas';

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

  /**
   * Asaas (padrão Help Desk)
   * pt-BR: Localiza a credencial `integracao-asaas` (auto-bootstrap no backend)
   * e salva os campos do card dedicado.
   */
  const asaasCredential = useMemo(
    () => items.find((it) => String(it.slug || '').toLowerCase().includes('asaas')),
    [items]
  );
  const saveAsaasMut = useMutation({
    mutationFn: async (p: AsaasSavePayload) => {
      const config: IntegracaoConfig = {
        url: p.environment === 'production' ? 'https://api.asaas.com/v3' : 'https://sandbox.asaas.com/api/v3',
        access_token: p.api_key,
        environment: p.environment,
        billing_type: p.billing_type,
        webhook_token: p.webhook_token || undefined,
        fine_value: p.fine_value || undefined,
        fine_type: (p.fine_type as 'FIXED' | 'PERCENTAGE' | undefined) || undefined,
        interest_value: p.interest_value || undefined,
      };
      if (asaasCredential) {
        return integracoesService.update(asaasCredential.id, {
          name: 'Integração Asaas',
          active: true,
          config,
        });
      }
      return integracoesService.create({ name: 'Integração Asaas', active: true, config });
    },
    onSuccess: () => {
      toast.success('Credenciais Asaas salvas');
      qc.invalidateQueries({ queryKey: ['integracoes'] });
    },
    onError: (e: any) => {
      toast.error(e?.body?.message || 'Erro ao salvar credenciais Asaas');
    },
  });

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

  const activeCount = items.filter(it => it.active).length;

  const getIconForIntegration = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('asaas') || n.includes('pagamento')) return <CreditCard className="w-6 h-6 text-indigo-600" />;
    if (n.includes('brevo') || n.includes('mail') || n.includes('email')) return <Mail className="w-6 h-6 text-emerald-600" />;
    if (n.includes('zapsign')) return <FileSignature className="w-6 h-6 text-blue-600" />;
    if (n.includes('zapguru') || n.includes('chat')) return <MessageSquare className="w-6 h-6 text-violet-600" />;
    return <Blocks className="w-6 h-6 text-slate-600" />;
  };

  const getBgForIntegration = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('asaas') || n.includes('pagamento')) return 'bg-indigo-50';
    if (n.includes('brevo') || n.includes('mail') || n.includes('email')) return 'bg-emerald-50';
    if (n.includes('zapsign')) return 'bg-blue-50';
    if (n.includes('zapguru') || n.includes('chat')) return 'bg-violet-50';
    return 'bg-slate-50';
  };

  const getDescForIntegration = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('asaas')) return 'Gateway de pagamento central da plataforma para mensalidades e cobranças.';
    if (n.includes('zapsign')) return 'Assinatura eletrônica e gestão de contratos e documentos.';
    if (n.includes('zapguru')) return 'Plataforma de atendimento e disparo de mensagens via WhatsApp.';
    return `Integração e configurações do serviço ${name}.`;
  };

  return (
    <div className="w-full space-y-6 max-w-7xl mx-auto">
      {/* Header do Console */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <Blocks className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold uppercase tracking-tight text-slate-800 dark:text-white">
                Integrações do Sistema
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Visualize e edite cada integração da plataforma (banco de dados local).
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 w-[200px]"
              placeholder="Buscar rápida..."
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
            />
          </div>
          <Button onClick={() => refetch()} variant="outline" disabled={isLoading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
          <Button asChild>
            <Link to="/admin/settings/integrations/new">Nova Integração</Link>
          </Button>
        </div>
      </div>

      {/* Summary Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500 uppercase font-semibold mb-1">Integrações</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{items.length}</span>
                <span className="text-xs font-medium uppercase text-slate-400">Cadastradas</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
              <Blocks className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500 uppercase font-semibold mb-1">Ativas</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{activeCount}</span>
                <span className="text-xs font-medium uppercase text-slate-400">Em operação</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500 uppercase font-semibold mb-1">Configuradas</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold">{items.length}</span>
                <span className="text-xs font-medium uppercase text-slate-400">Via Painel</span>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
              <Database className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center flex flex-col items-center mt-6">
          <Blocks className="w-12 h-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Nenhuma integração encontrada</h3>
          <p className="text-slate-500 max-w-sm mt-1">Nenhuma integração foi configurada ou corresponde à sua busca.</p>
        </div>
      )}

      {/* Grid de Integrações */}
      {!isLoading && items.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          {items.map((it) => (
            <Card key={it.id} className="flex flex-col border border-slate-200 shadow-sm rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              <CardContent className="p-6 flex-1 flex flex-col gap-4">
                {/* Header with icon and title */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${getBgForIntegration(it.name)}`}>
                      {getIconForIntegration(it.name)}
                    </div>
                    <div>
                      <h3 className="font-bold text-[17px] text-slate-800">{it.name}</h3>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        <Badge variant="outline" className={`font-medium border ${it.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          {it.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                        <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 font-medium">
                          Banco local
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[13px] text-slate-600 flex-1 leading-relaxed mt-1">
                  {getDescForIntegration(it.name)}
                </p>
                
                <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
                  Atualizado em {it.updated_at ? new Date(it.updated_at).toLocaleString('pt-BR') : 'Desconhecido'}
                </div>

                {/* Switch row */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-2">
                  <span className="text-[13px] font-semibold text-slate-700">Módulo ativado</span>
                  <Switch checked={it.active} onCheckedChange={() => toggleActiveMut.mutate(it)} />
                </div>
              </CardContent>
              <div className="px-6 pb-6 pt-0">
                <Button 
                  variant="outline" 
                  className="w-full text-indigo-700 border-indigo-200 hover:bg-indigo-50 hover:text-indigo-800 font-semibold"
                  onClick={() => navigate(`/admin/settings/integrations/${it.id}/edit`)}
                >
                  Visualizar / Editar <ChevronRight className="w-4 h-4 ml-1.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
