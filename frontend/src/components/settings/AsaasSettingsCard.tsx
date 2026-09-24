import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { CreditCard, Save, RefreshCw, Eye, EyeOff, ShieldCheck, Copy, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { asaasService } from '@/services/asaasService';
import { getTenantApiUrl, getVersionApi } from '@/lib/qlib';
import type { AsaasBillingType, AsaasEnvironment, AsaasSavePayload } from '@/types/asaas';

interface AsaasSettingsCardProps {
  credential: any;
  onSave: (payload: AsaasSavePayload) => void;
  isLoading: boolean;
}

/**
 * AsaasSettingsCard (padrão Help Desk)
 * pt-BR: Card de credenciais Asaas — API Key, Webhook Token, Ambiente,
 * billing padrão e URL do webhook p/ colar no painel Asaas. Inclui status
 * da conexão (Conectado/Configurado/Não configurado) + Testar Conexão.
 */
export function AsaasSettingsCard({ credential, onSave, isLoading }: AsaasSettingsCardProps) {
  const [params, setParams] = useState({
    apiKey: '',
    webhookToken: '',
    environment: 'sandbox' as AsaasEnvironment,
    billingType: 'BOLETO' as AsaasBillingType,
    fineValue: '',
    fineType: 'PERCENTAGE',
    interestValue: '',
  });
  const [showKey, setShowKey] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Status da conexão
  const [asaasStatus, setAsaasStatus] = useState({
    connected: false,
    configured: false,
    checking: true,
  });

  const webhookUrl = `${getTenantApiUrl()}${getVersionApi()}/webhook/asaas`;

  useEffect(() => {
    if (credential) {
      try {
        const cfg = credential.config || {};
        setParams({
          apiKey: cfg.access_token || cfg.pass || cfg.api_key || credential.token || '',
          webhookToken: cfg.webhook_token || cfg.user || '',
          environment: cfg.environment || cfg.produto || 'sandbox',
          billingType: cfg.billing_type || 'BOLETO',
          fineValue: cfg.fine_value !== undefined && cfg.fine_value !== null ? String(cfg.fine_value) : '',
          fineType: cfg.fine_type || 'PERCENTAGE',
          interestValue: cfg.interest_value !== undefined && cfg.interest_value !== null ? String(cfg.interest_value) : '',
        });
      } catch (e) {
        console.error('Erro ao processar config da Asaas', e);
      }
    }
  }, [credential]);

  const checkConnectionStatus = async () => {
    setAsaasStatus((prev) => ({ ...prev, checking: true }));
    try {
      const resp = await asaasService.getStatus();
      const statusData = (resp?.data?.data || resp?.data || resp) as any;
      setAsaasStatus({
        connected: !!statusData.connected,
        configured: !!statusData.configured,
        checking: false,
      });
    } catch (e) {
      setAsaasStatus({ connected: false, configured: false, checking: false });
    }
  };

  useEffect(() => {
    checkConnectionStatus();
  }, [credential]);

  const handleFieldChange = (field: keyof typeof params, val: string) => {
    setParams((prev) => ({ ...prev, [field]: val }));
  };

  const handleSaveClick = () => {
    if (!params.apiKey) {
      toast.error('Preencha a API Key.');
      return;
    }
    onSave({
      api_key: params.apiKey,
      webhook_token: params.webhookToken,
      environment: params.environment,
      billing_type: params.billingType,
      fine_value: params.fineValue,
      fine_type: params.fineType as 'FIXED' | 'PERCENTAGE',
      interest_value: params.interestValue,
    });
  };

  const handleTestConnection = async () => {
    toast.loading('Testando conexão com Asaas...');
    try {
      await asaasService.testConnection({
        api_key: params.apiKey,
        environment: params.environment,
      });
      toast.dismiss();
      toast.success('Conexão testada com sucesso!');
      checkConnectionStatus();
    } catch (err: any) {
      toast.dismiss();
      toast.error(err?.message || 'Falha ao testar conexão com Asaas.');
    }
  };

  const handleCopyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopiedWebhook(true);
      toast.success('URL do webhook copiada');
      window.setTimeout(() => setCopiedWebhook(false), 2000);
    } catch {
      toast.error('Não foi possível copiar a URL.');
    }
  };

  return (
    <Card className="border border-blue-100 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden bg-gradient-to-br from-white to-blue-50/10">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-emerald-600 text-white p-6 relative">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <CreditCard className="w-24 h-24 text-white" />
        </div>
        <CardTitle className="flex items-center space-x-3 text-white text-xl font-bold">
          <CreditCard className="h-6 w-6 text-white" />
          <span>Asaas</span>
        </CardTitle>
        <CardDescription className="text-blue-100/90 font-medium text-xs mt-1.5">
          Cobranças via boleto, Pix e cartão. Informe a API Key gerada no painel do Asaas.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="asaas_api_key" className="text-xs font-bold text-gray-500 uppercase tracking-wider">API Key</Label>
            <div className="relative">
              <Input
                id="asaas_api_key"
                type={showKey ? 'text' : 'password'}
                value={params.apiKey}
                onChange={(e) => handleFieldChange('apiKey', e.target.value)}
                placeholder="Ex: $aact_..."
                className="h-10 border-gray-200 focus:border-blue-400 focus:ring-blue-100 rounded-lg font-medium pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-8 w-8 hover:bg-gray-100 rounded-md"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="asaas_webhook_token" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Webhook Token</Label>
            <Input
              id="asaas_webhook_token"
              type="text"
              value={params.webhookToken}
              onChange={(e) => handleFieldChange('webhookToken', e.target.value)}
              placeholder="Token para validação (32-255 caracteres)"
              className="h-10 border-gray-200 focus:border-blue-400 focus:ring-blue-100 rounded-lg font-medium"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="asaas_env" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ambiente</Label>
            <select
              id="asaas_env"
              value={params.environment}
              onChange={(e) => handleFieldChange('environment', e.target.value)}
              className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 focus:border-blue-400 focus:ring-blue-100"
            >
              <option value="sandbox">Sandbox (Testes)</option>
              <option value="production">Produção</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="asaas_billing" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Cobrança Padrão</Label>
            <select
              id="asaas_billing"
              value={params.billingType}
              onChange={(e) => handleFieldChange('billingType', e.target.value)}
              className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 focus:border-blue-400 focus:ring-blue-100"
            >
              <option value="BOLETO">Boleto</option>
              <option value="PIX">Pix</option>
              <option value="CREDIT_CARD">Cartão de Crédito</option>
              <option value="UNDEFINED">Cliente escolhe na fatura</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">URL do Webhook</Label>
            <div className="flex items-center gap-2">
              <Input value={webhookUrl} readOnly className="h-10 font-mono text-xs bg-gray-50" />
              <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" onClick={handleCopyWebhookUrl} title="Copiar URL do webhook">
                {copiedWebhook ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-[11px] text-gray-400">Cole esta URL no painel do Asaas (Integrações → Webhooks).</p>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-gray-100 bg-gray-50/50 p-4">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Multa e Juros de mora</p>
            <p className="text-[11px] text-gray-400">Pós-vencimento em todas as cobranças. Vazio = usa o padrão da conta Asaas.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="asaas_fine_value" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Multa (%)</Label>
              <Input
                id="asaas_fine_value"
                type="number"
                min="0"
                step="0.01"
                value={params.fineValue}
                onChange={(e) => handleFieldChange('fineValue', e.target.value)}
                placeholder="Ex: 2"
                className="h-10 border-gray-200 rounded-lg font-medium"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asaas_fine_type" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tipo da Multa</Label>
              <select
                id="asaas_fine_type"
                value={params.fineType}
                onChange={(e) => handleFieldChange('fineType', e.target.value)}
                className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800"
              >
                <option value="PERCENTAGE">Percentual (%)</option>
                <option value="FIXED">Valor fixo (R$)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="asaas_interest_value" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Juros (% a.m.)</Label>
              <Input
                id="asaas_interest_value"
                type="number"
                min="0"
                step="0.01"
                value={params.interestValue}
                onChange={(e) => handleFieldChange('interestValue', e.target.value)}
                placeholder="Ex: 1"
                className="h-10 border-gray-200 rounded-lg font-medium"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSaveClick}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center space-x-2 px-5 py-2 font-bold shadow-sm"
          >
            <Save className="h-4 w-4 text-white" />
            <span>{isLoading ? 'Salvando...' : 'Salvar Credenciais'}</span>
          </Button>
        </div>

        <div className="border-t border-gray-100 pt-6"></div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-gray-50/50 border border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-white border border-gray-200 rounded-xl flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-800">Status Asaas</span>
                {asaasStatus.checking ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-gray-400" />
                ) : asaasStatus.connected ? (
                  <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white border-none text-[10px] uppercase font-black tracking-wider py-0.5 px-2 rounded-full">
                    Conectado
                  </Badge>
                ) : asaasStatus.configured ? (
                  <Badge className="bg-amber-500 hover:bg-amber-500 text-white border-none text-[10px] uppercase font-black tracking-wider py-0.5 px-2 rounded-full">
                    Configurado
                  </Badge>
                ) : (
                  <Badge className="bg-gray-400 hover:bg-gray-400 text-white border-none text-[10px] uppercase font-black tracking-wider py-0.5 px-2 rounded-full">
                    Não configurado
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                {asaasStatus.connected
                  ? 'Sua conta Asaas está validada e pronta para emissões.'
                  : 'Teste a conexão com a API Key informada.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={asaasStatus.checking || !params.apiKey}
              className="border-blue-200 hover:bg-blue-50 text-blue-600 hover:text-blue-700 font-bold rounded-lg flex items-center space-x-1.5 w-full sm:w-auto justify-center"
            >
              <RefreshCw className={`h-4 w-4 ${asaasStatus.checking ? 'animate-spin' : ''}`} />
              <span>Testar Conexão</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
