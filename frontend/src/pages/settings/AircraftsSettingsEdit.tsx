import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, FormProvider } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { aircraftSettingsService } from '@/services/aircraftSettingsService';
import { AircraftSettingsPayload, AircraftPackage } from '@/types/aircraftSettings';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { currencyApplyMask, currencyRemoveMaskToString } from '@/lib/masks/currency';
import { Trash2 } from 'lucide-react';

type PackageForm = AircraftPackage & { label?: string };
const CURRENCY_OPTIONS = ['BRL', 'USD'] as const;

export default function AircraftsSettingsEdit() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [prefixInput, setPrefixInput] = useState('');
  const [packages, setPackages] = useState<PackageForm[]>([]);
  const [prefixes, setPrefixes] = useState<string[]>([]);

  const form = useForm<AircraftSettingsPayload>({
    defaultValues: {
      nome: '',
      codigo: '',
      ativo: 's',
      tipo: '',
      descricao: '',
      hora_rescisao: '',
      pacotes: {},
      config: { combustivel: { consumo_hora: '', preco_litro: '', ativar: 's' }, prefixos: [] },
    },
    mode: 'onBlur',
  });

  const { data: aircraftData, isLoading } = useQuery({
    queryKey: ['aircrafts', id],
    queryFn: () => aircraftSettingsService.getById(id as string),
    enabled: !!id,
  });

  useEffect(() => {
    if (aircraftData) {
      const row = aircraftData as any;
      form.reset({
        nome: row.nome ?? '',
        codigo: row.codigo ?? '',
        ativo: (row.ativo === 'n' || row.ativo === false) ? 'n' : 's',
        tipo: row.tipo ?? '',
        descricao: row.descricao ?? '',
        hora_rescisao: row.hora_rescisao ? currencyApplyMask(String(row.hora_rescisao), 'pt-BR', 'BRL') : '',
        token: row.token ?? '',
        autor: row.autor ?? '',
        pacotes: row.pacotes ?? {},
        config: row.config ?? { combustivel: { consumo_hora: '', preco_litro: '', ativar: 's' }, prefixos: [] },
        id: row.id,
      });

      const pacs: PackageForm[] = [];
      const map = row.pacotes || {};
      Object.keys(map).forEach((k) => {
        const p = map[k];
        pacs.push({ label: `Pacote ${k}`, ...p });
      });
      setPackages(pacs);
      setPrefixes(row?.config?.prefixos || []);
    }
  }, [aircraftData, form]);

  const updateMutation = useMutation({
    mutationFn: async (payload: AircraftSettingsPayload) => {
      return aircraftSettingsService.updateSettings(id as string, payload);
    },
    onSuccess: (res) => {
      toast({ title: 'Aeronave atualizada', description: res?.message || 'Configurações atualizadas com sucesso.' });
      qc.invalidateQueries({ queryKey: ['aircrafts'] });
      qc.invalidateQueries({ queryKey: ['aeronaves'] });
      navigate('/admin/settings/aircrafts');
    },
    onError: (err: any) => {
      toast({ title: 'Falha ao atualizar', description: err?.message || 'Verifique os dados e tente novamente.', variant: 'destructive' });
    },
  });

  const handleAddPackage = () => {
    setPackages((prev) => ([...prev, { label: `Pacote ${prev.length + 1}`, moeda: 'BRL', limite: '1', "hora-seca": '', "hora-seca_dolar": '' }]));
  };

  const handleRemovePackage = (index: number) => {
    setPackages((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePackageCurrencyChange = (index: number, value: string) => {
    setPackages((prev) => prev.map((p, i) => (i === index ? { ...p, moeda: value } : p)));
  };

  const handleAddPrefix = () => {
    const v = prefixInput.trim();
    if (!v) return;
    setPrefixes((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setPrefixInput('');
  };

  const handleRemovePrefix = (value: string) => {
    setPrefixes((prev) => prev.filter((p) => p !== value));
  };

  useEffect(() => {
    form.setValue('config.prefixos', prefixes);
  }, [prefixes, form]);

  const buildPayload = (base: AircraftSettingsPayload): AircraftSettingsPayload => {
    const pacotesObj: Record<string, AircraftPackage> = {};
    packages.forEach((pkg, idx) => {
      const key = String(idx + 1);
      const { label, ...values } = pkg;
      pacotesObj[key] = {
        ...values,
        'hora-seca': values['hora-seca'] ? currencyRemoveMaskToString(String(values['hora-seca'])) : values['hora-seca'],
        'hora-seca_dolar': values['hora-seca_dolar'] ? currencyRemoveMaskToString(String(values['hora-seca_dolar'])) : values['hora-seca_dolar'],
      };
    });
    const consumo = String(base?.config?.combustivel?.consumo_hora ?? '')
      .replace(/[^\d,\.]/g, '')
      .replace(',', '.');
    const precoLitro = currencyRemoveMaskToString(String(base?.config?.combustivel?.preco_litro ?? ''));
    const horaRescisao = currencyRemoveMaskToString(String(base?.hora_rescisao ?? ''));

    return {
      ...base,
      hora_rescisao: horaRescisao,
      pacotes: pacotesObj,
      config: {
        ...(base.config || {}),
        combustivel: {
          ...(base.config?.combustivel || {}),
          consumo_hora: consumo,
          preco_litro: precoLitro,
        },
      },
    };
  };

  const onSubmit = (data: AircraftSettingsPayload) => {
    const payload = buildPayload(data);
    updateMutation.mutate(payload);
  };

  if (isLoading) {
    return <div className="container mx-auto py-10 text-center">Carregando dados da aeronave...</div>;
  }

  return (
    <div className="space-y-6 w-full py-6">
      <div>
        <h1 className="text-2xl font-semibold">Editar Aeronave</h1>
        <p className="text-sm text-muted-foreground">Atualize as informações e configurações da aeronave</p>
      </div>

      <FormProvider {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="info" className="w-full">
            <TabsList>
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="packages">Pacotes de horas</TabsTrigger>
              <TabsTrigger value="config">Configurações</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-4 pt-4">
              <Card className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="nome">Nome</Label>
                    <Input id="nome" placeholder="Uirapuru - T-23" {...form.register('nome', { required: true })} />
                  </div>
                  <div>
                    <Label htmlFor="codigo">Código</Label>
                    <Input id="codigo" placeholder="T-23" {...form.register('codigo', { required: true })} />
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={form.watch('ativo') === 's'} onCheckedChange={(val) => form.setValue('ativo', val ? 's' : 'n')} />
                    <Label>Ativar</Label>
                  </div>
                  <div>
                    <Label htmlFor="tipo">Tipo</Label>
                    <Input id="tipo" placeholder="" {...form.register('tipo')} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="descricao">Descrição</Label>
                  <Textarea id="descricao" rows={3} placeholder="Detalhes da aeronave" {...form.register('descricao')} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="hora_rescisao">Valor hora para rescisão</Label>
                    <Input
                      id="hora_rescisao"
                      placeholder="R$ 900,00"
                      value={form.watch('hora_rescisao') || ''}
                      onChange={(e) => {
                        const masked = currencyApplyMask(e.target.value, 'pt-BR', 'BRL');
                        form.setValue('hora_rescisao', masked, { shouldValidate: true });
                      }}
                    />
                  </div>
                  <div className="opacity-80">
                    <Label htmlFor="token">Token (opcional)</Label>
                    <Input id="token" placeholder="64d17cb86ff7b" {...form.register('token')} />
                  </div>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="packages" className="space-y-4 pt-4">
              <Card className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium">Gerenciar pacotes de horas</h3>
                    <p className="text-xs text-muted-foreground">Adicione valores BRL/USD por pacote</p>
                  </div>
                  <Button type="button" variant="secondary" onClick={handleAddPackage}>Adicionar pacote</Button>
                </div>
                <Separator />
                <div className="space-y-3">
                  {packages.length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum pacote adicionado</p>
                  )}
                  {packages.map((pkg, idx) => (
                    <div key={idx} className="p-4 rounded-md border bg-slate-50/40 space-y-4 relative group">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm text-slate-700">Pacote {idx + 1}</h4>
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 px-2"
                          onClick={() => handleRemovePackage(idx)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remover
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div className="md:col-span-2">
                          <Label>Nome do pacote</Label>
                          <Input value={pkg.label || ''} onChange={(e) => {
                            const v = e.target.value; setPackages((prev) => prev.map((p, i) => i === idx ? { ...p, label: v } : p));
                          }} placeholder={`Pacote ${idx + 1}`} />
                        </div>
                        <div>
                          <Label>Hora Seca (BRL)</Label>
                          <Input value={pkg["hora-seca"] || ''} onChange={(e) => {
                            const v = currencyApplyMask(e.target.value, 'pt-BR', 'BRL');
                            setPackages((prev) => prev.map((p, i) => i === idx ? { ...p, ["hora-seca"]: v } : p));
                          }} placeholder="R$ 600,00" />
                        </div>
                        <div>
                          <Label>Hora Seca (USD)</Label>
                          <Input value={pkg["hora-seca_dolar"] || ''} onChange={(e) => {
                            const v = currencyApplyMask(e.target.value, 'en-US', 'USD');
                            setPackages((prev) => prev.map((p, i) => i === idx ? { ...p, ["hora-seca_dolar"]: v } : p));
                          }} placeholder="$ 106.26" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label>Moeda</Label>
                            <Select value={pkg.moeda || ''} onValueChange={(v) => handlePackageCurrencyChange(idx, v)}>
                              <SelectTrigger className="w-full h-10">
                                <SelectValue placeholder="Selecione" />
                              </SelectTrigger>
                              <SelectContent>
                                {CURRENCY_OPTIONS.map((opt) => (
                                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label>A partir de</Label>
                            <Input value={pkg.limite || ''} onChange={(e) => {
                              const v = e.target.value; setPackages((prev) => prev.map((p, i) => i === idx ? { ...p, limite: v } : p));
                            }} placeholder="1" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="config" className="space-y-4 pt-4">
              <Card className="p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="consumo_hora">Consumo por hora</Label>
                    <Input
                      id="consumo_hora"
                      inputMode="decimal"
                      placeholder="25,00"
                      value={form.watch('config.combustivel.consumo_hora') || ''}
                      onChange={(e) => {
                        const raw = String(e.target.value || '').replace(/[^\d,\.]/g, '');
                        const normalized = raw
                          .replace(/\./g, ',')
                          .replace(/(,)(?=.*,)/g, '')
                          .replace(/(,\d{0,2}).*$/, '$1');
                        form.setValue('config.combustivel.consumo_hora', normalized, { shouldValidate: true });
                      }}
                      {...form.register('config.combustivel.consumo_hora', {
                        validate: (val) => {
                          if (!val) return true;
                          return /^(\d+)(?:[,\.]\d{1,2})?$/.test(String(val)) || 'Informe apenas números e até 2 decimais';
                        },
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="preco_litro">Preço por litro</Label>
                    <Input
                      id="preco_litro"
                      placeholder="R$ 0,00"
                      inputMode="numeric"
                      value={form.watch('config.combustivel.preco_litro') || ''}
                      onChange={(e) => {
                        const masked = currencyApplyMask(e.target.value, 'pt-BR', 'BRL');
                        form.setValue('config.combustivel.preco_litro', masked, { shouldValidate: true });
                      }}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={form.watch('config.combustivel.ativar') === 's'} onCheckedChange={(val) => form.setValue('config.combustivel.ativar', val ? 's' : 'n')} />
                    <Label>Ativar combustível</Label>
                  </div>
                </div>
                <Separator />
                <div className="space-y-3">
                  <Label>Prefixos</Label>
                  <div className="flex gap-2">
                    <Input value={prefixInput} onChange={(e) => setPrefixInput(e.target.value)} placeholder="PT-LMW" />
                    <Button type="button" variant="secondary" onClick={handleAddPrefix}>Adicionar</Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {prefixes.map((p) => (
                      <Badge key={p} variant="outline" className="cursor-pointer" onClick={() => handleRemovePrefix(p)}>
                        {p} ✕
                      </Badge>
                    ))}
                    {prefixes.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhum prefixo adicionado</p>
                    )}
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => navigate('/admin/settings/aircrafts')}>Cancelar</Button>
            <Button type="submit" disabled={updateMutation.isPending}>Atualizar</Button>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}
