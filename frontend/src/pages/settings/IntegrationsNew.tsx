import { useMutation, useQueryClient } from '@tanstack/react-query';
import { integracoesService, IntegracaoConfig, IntegracaoMetaPair } from '@/services/integracoesService';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';

export default function IntegrationsNew() {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [active, setActive] = useState(true);
  const [url, setUrl] = useState('');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [produto, setProduto] = useState('');
  const [meta, setMeta] = useState<{ key: string; value: string }[]>([{ key: '', value: '' }]);
  const [showPass, setShowPass] = useState(false);

  const addMeta = () => setMeta((rows) => [...rows, { key: '', value: '' }]);
  const removeMeta = (idx: number) => setMeta((rows) => rows.filter((_, i) => i !== idx));
  const updateMeta = (idx: number, field: 'key' | 'value', val: string) =>
    setMeta((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));

  const createMut = useMutation({
    mutationFn: async () => {
      const config: IntegracaoConfig = { url: url.trim() };
      if (user) config.user = user;
      if (pass) config.pass = pass;
      if (produto) config.produto = produto;
      const metaPairs: IntegracaoMetaPair[] = meta
        .filter((m) => (m.key || '').trim() !== '')
        .map((m) => ({ key: m.key.trim(), value: m.value ?? '' }));
      return integracoesService.create({ name: name.trim(), active, config, meta: metaPairs });
    },
    onSuccess: () => {
      toast.success('Integração criada');
      qc.invalidateQueries({ queryKey: ['integracoes'] });
      nav('/admin/settings/integrations');
    },
    onError: () => toast.error('Erro ao criar integração'),
  });

  return (
    <div className="w-full">
      <Card>
        <CardHeader>
          <CardTitle>Nova integração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="flex items-center gap-2">
              <Switch checked={active} onCheckedChange={setActive} />
              <span>Ativa</span>
            </div>
            <Input placeholder="URL da API" value={url} onChange={(e) => setUrl(e.target.value)} />
            <Input placeholder="Usuário (opcional)" value={user} onChange={(e) => setUser(e.target.value)} />
            <div className="relative">
              <Input placeholder="Senha (opcional)" type={showPass ? 'text' : 'password'} value={pass} onChange={(e) => setPass(e.target.value)} className="pr-10" />
              <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setShowPass((s) => !s)}>
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <Input placeholder="Produto (opcional)" value={produto} onChange={(e) => setProduto(e.target.value)} />
          </div>
          <div className="space-y-2">
            <div className="text-sm font-medium">Metacampos</div>
            {meta.map((row, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input placeholder="Chave" value={row.key} onChange={(e) => updateMeta(idx, 'key', e.target.value)} />
                <Input placeholder="Valor" value={row.value} onChange={(e) => updateMeta(idx, 'value', e.target.value)} />
                <Button variant="secondary" onClick={() => removeMeta(idx)}>Remover</Button>
              </div>
            ))}
            <Button variant="outline" onClick={addMeta}>Adicionar campo</Button>
          </div>
          <div className="flex justify-end">
            <Button onClick={() => createMut.mutate()} disabled={!name || !url || createMut.isLoading}>Salvar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
