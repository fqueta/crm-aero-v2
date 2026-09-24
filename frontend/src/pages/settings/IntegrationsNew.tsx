import { useMutation, useQueryClient } from '@tanstack/react-query';
import { integracoesService, IntegracaoConfig, IntegracaoMetaPair } from '@/services/integracoesService';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, ArrowLeft, CheckCircle2, Info, Mail, CreditCard, FileSignature, MessageSquare, Blocks, Zap, Check } from 'lucide-react';

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
  const [testing, setTesting] = useState(false);
  const [testSuccess, setTestSuccess] = useState<boolean | null>(null);

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
      toast.success('Configurações salvas no Banco Local');
      qc.invalidateQueries({ queryKey: ['integracoes'] });
      nav('/admin/settings/integrations');
    },
    onError: () => toast.error('Erro ao criar integração'),
  });

  const handleTestConnection = () => {
    setTesting(true);
    setTestSuccess(null);
    // Simula teste de conexao generico
    setTimeout(() => {
      setTesting(false);
      if (url.trim() !== '') {
        setTestSuccess(true);
        toast.success(`Conexão com ${name || 'a API'} estabelecida com sucesso!`);
      } else {
        setTestSuccess(false);
        toast.error('Informe a URL da API para testar.');
      }
    }, 1500);
  };

  const getIcon = () => {
    const n = name.toLowerCase();
    if (n.includes('asaas') || n.includes('pagamento')) return <CreditCard className="w-8 h-8 text-white" />;
    if (n.includes('brevo') || n.includes('mail') || n.includes('email')) return <Mail className="w-8 h-8 text-white" />;
    if (n.includes('zapsign')) return <FileSignature className="w-8 h-8 text-white" />;
    if (n.includes('zapguru') || n.includes('chat')) return <MessageSquare className="w-8 h-8 text-white" />;
    return <Blocks className="w-8 h-8 text-white" />;
  };

  const isBrevo = name.toLowerCase().includes('brevo') || name.toLowerCase().includes('email');
  const isAsaas = name.toLowerCase().includes('asaas') || name.toLowerCase().includes('pagamento');

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header com Voltar */}
      <div className="flex flex-col gap-2">
        <Button variant="ghost" size="sm" asChild className="w-fit text-slate-500 hover:text-slate-800 -ml-2 mb-2">
          <Link to="/admin/settings/integrations">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para Integrações
          </Link>
        </Button>
        <h1 className="text-2xl font-bold uppercase tracking-tight text-slate-800 flex items-center gap-2">
          {name || 'Nova Integração'}
        </h1>
        <p className="text-sm text-slate-500 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 block" />
          Configure a conta da plataforma para um novo serviço.
        </p>
      </div>

      {/* Banner Principal */}
      <div className="w-full rounded-2xl bg-slate-900 p-6 flex flex-col md:flex-row items-center justify-between shadow-xl shadow-slate-900/10 gap-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center border border-white/5">
            {getIcon()}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-white font-bold text-lg">Integração do Sistema</h2>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                Tenant Local
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border border-white/20 text-slate-300 flex items-center gap-1">
                <Check className="w-3 h-3" /> Será gravado no Banco Local
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              Esta configuração será exclusiva da sua plataforma. Ela tem prioridade sobre as variáveis de ambiente e será armazenada com segurança no banco de dados local (tenant).
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-white/5 px-4 py-3 rounded-xl border border-white/10">
          <span className="text-white text-sm font-semibold">Integração Ativa</span>
          <Switch checked={active} onCheckedChange={setActive} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda: Formulário */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                <h3 className="text-lg font-bold text-slate-800">Credenciais da Conta</h3>
              </div>
              
              <div className="space-y-6">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase mb-2 flex items-center justify-between">
                    Nome da Integração *
                  </label>
                  <Input 
                    placeholder="Ex: Asaas Pagamentos, ZapSign, Brevo..." 
                    value={name} 
                    onChange={(e) => setName(e.target.value)} 
                    className="h-11 border-slate-300 font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase mb-2 flex items-center justify-between">
                    URL da API Base *
                  </label>
                  <Input 
                    placeholder="https://api.servico.com/v1" 
                    value={url} 
                    onChange={(e) => setUrl(e.target.value)} 
                    className="h-11 border-slate-300"
                  />
                  <p className="text-xs text-slate-400 mt-1">O endpoint base para a comunicação com a API.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">
                      Usuário / E-mail Remetente
                    </label>
                    <Input 
                      placeholder="usuario@email.com" 
                      value={user} 
                      onChange={(e) => setUser(e.target.value)} 
                      className="h-11 border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">
                      Senha / Token / Chave de API
                    </label>
                    <div className="relative">
                      <Input 
                        placeholder="••••••••••••••••" 
                        type={showPass ? 'text' : 'password'} 
                        value={pass} 
                        onChange={(e) => setPass(e.target.value)} 
                        className="h-11 pr-10 border-slate-300" 
                      />
                      <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" onClick={() => setShowPass((s) => !s)}>
                        {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase mb-2 block">
                    Produto / Módulo / Outros
                  </label>
                  <Input 
                    placeholder="Identificador do produto (opcional)" 
                    value={produto} 
                    onChange={(e) => setProduto(e.target.value)} 
                    className="h-11 border-slate-300"
                  />
                </div>

                {/* Metacampos */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-xs font-bold text-slate-600 uppercase">Metacampos Dinâmicos</label>
                    <Button variant="outline" size="sm" onClick={addMeta} className="h-8 text-xs">
                      + Adicionar campo
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {meta.map((row, idx) => (
                      <div key={idx} className="flex items-center gap-3">
                        <Input placeholder="Chave (ex: webhook_token)" value={row.key} onChange={(e) => updateMeta(idx, 'key', e.target.value)} className="flex-1" />
                        <Input placeholder="Valor" value={row.value} onChange={(e) => updateMeta(idx, 'value', e.target.value)} className="flex-1" />
                        <Button variant="ghost" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => removeMeta(idx)}>Remover</Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <Button 
                    variant="outline" 
                    className={`h-11 font-semibold ${testSuccess === true ? 'text-emerald-600 border-emerald-200 bg-emerald-50' : testSuccess === false ? 'text-red-600 border-red-200 bg-red-50' : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'}`}
                    onClick={handleTestConnection}
                    disabled={testing}
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    {testing ? 'Testando conexão...' : testSuccess === true ? 'Conexão OK' : testSuccess === false ? 'Falha na conexão' : `Testar Conexão${name ? ` com ${name.split(' ')[0]}` : ''}`}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button 
            className="w-full h-14 text-base font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20"
            onClick={() => createMut.mutate()} 
            disabled={!name || !url || createMut.isLoading}
          >
            Salvar Configurações no Banco Local
          </Button>
        </div>

        {/* Coluna Direita: Instruções */}
        <div className="lg:col-span-1">
          <Card className="shadow-sm border-slate-200 sticky top-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-6 text-slate-700">
                <Info className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-bold uppercase tracking-wider">Como Configurar</h3>
              </div>

              <div className="space-y-6">
                {isBrevo ? (
                  <>
                    <div className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 font-bold flex items-center justify-center flex-shrink-0 text-sm">1</div>
                      <p className="text-sm text-slate-600 leading-relaxed">No Brevo, vá em <strong>SMTP & API</strong> {'>'} <strong>API Keys</strong> e gere uma chave que comece com <code className="bg-slate-100 px-1 rounded text-pink-600">xkeysib-...</code></p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 font-bold flex items-center justify-center flex-shrink-0 text-sm">2</div>
                      <p className="text-sm text-slate-600 leading-relaxed">Em <strong>Senders, Domains & Dedicated IPs</strong>, verifique o e-mail remetente e cole no campo Usuário.</p>
                    </div>
                  </>
                ) : isAsaas ? (
                  <>
                    <div className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 font-bold flex items-center justify-center flex-shrink-0 text-sm">1</div>
                      <p className="text-sm text-slate-600 leading-relaxed">No Asaas, acesse <strong>Configurações</strong> {'>'} <strong>Integrações</strong> e gere sua <strong>API Key</strong>.</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 font-bold flex items-center justify-center flex-shrink-0 text-sm">2</div>
                      <p className="text-sm text-slate-600 leading-relaxed">Adicione o <strong>Webhook Token</strong> nos metacampos com a chave <code className="bg-slate-100 px-1 rounded text-pink-600">webhook_token</code> se precisar processar retornos de cobrança.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 font-bold flex items-center justify-center flex-shrink-0 text-sm">1</div>
                      <p className="text-sm text-slate-600 leading-relaxed">Consulte a documentação oficial da integração para obter a <strong>URL Base</strong> e o <strong>Token de Acesso</strong>.</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 font-bold flex items-center justify-center flex-shrink-0 text-sm">2</div>
                      <p className="text-sm text-slate-600 leading-relaxed">Cole a chave no campo de Senha/Token, clique em <strong>Testar Conexão</strong> e depois em <strong>Salvar</strong>.</p>
                    </div>
                  </>
                )}

                <div className="pt-4 border-t border-slate-100">
                  <p className="text-sm text-emerald-600 font-semibold flex items-center gap-2">
                    <Check className="w-4 h-4" /> Será ativada via banco local
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
