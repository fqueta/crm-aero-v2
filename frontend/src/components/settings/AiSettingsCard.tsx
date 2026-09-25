import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Bot, Save, RefreshCw, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { aiAssistantService } from '@/services/aiAssistantService';

export interface AiSavePayload {
  openai_key: string;
  gemini_key: string;
  preferred: string;
}

interface AiSettingsCardProps {
  openaiCredential: any;
  geminiCredential: any;
  onSave: (payload: AiSavePayload) => void;
  isLoading: boolean;
}

/**
 * AiSettingsCard (molde AsaasSettingsCard)
 * pt-BR: Card de chaves de IA — OpenAI Key, Gemini Key e provedor preferido.
 * O assistente usa o preferido e cai para o outro como fallback. Status só
 * verifica presença da chave (sem custo de tokens).
 */
export function AiSettingsCard({ openaiCredential, geminiCredential, onSave, isLoading }: AiSettingsCardProps) {
  const [params, setParams] = useState({
    openaiKey: '',
    geminiKey: '',
    preferred: 'auto' as string,
  });
  const [showOpenai, setShowOpenai] = useState(false);
  const [showGemini, setShowGemini] = useState(false);

  // Status da configuração (presença das chaves)
  const [aiStatus, setAiStatus] = useState({
    openai: false,
    gemini: false,
    preferred: null as string | null,
    checking: true,
  });

  useEffect(() => {
    try {
      const openCfg = openaiCredential?.config || {};
      const gemCfg = geminiCredential?.config || {};
      setParams((prev) => ({
        ...prev,
        openaiKey: openCfg.access_token || openCfg.pass || openCfg.api_key || openaiCredential?.token || '',
        geminiKey: gemCfg.access_token || gemCfg.pass || gemCfg.api_key || geminiCredential?.token || '',
      }));
    } catch (e) {
      console.error('Erro ao processar config de IA', e);
    }
  }, [openaiCredential, geminiCredential]);

  const checkStatus = async () => {
    setAiStatus((prev) => ({ ...prev, checking: true }));
    try {
      const resp = await aiAssistantService.getStatus();
      const data = (resp?.data || resp) as any;
      const providers = data?.providers || {};
      setAiStatus({
        openai: !!providers.openai,
        gemini: !!providers.gemini,
        preferred: data?.preferred ?? null,
        checking: false,
      });
      if (data?.preferred) {
        setParams((prev) => ({ ...prev, preferred: data.preferred }));
      }
    } catch (e) {
      setAiStatus((prev) => ({ ...prev, checking: false }));
    }
  };

  useEffect(() => {
    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openaiCredential, geminiCredential]);

  const handleFieldChange = (field: keyof typeof params, val: string) => {
    setParams((prev) => ({ ...prev, [field]: val }));
  };

  const handleSaveClick = () => {
    if (!params.openaiKey && !params.geminiKey) {
      toast.error('Preencha ao menos uma chave (OpenAI ou Gemini).');
      return;
    }
    onSave({
      openai_key: params.openaiKey,
      gemini_key: params.geminiKey,
      preferred: params.preferred,
    });
  };

  const renderProviderBadge = (configured: boolean) => (
    <Badge className={configured
      ? 'bg-emerald-500 hover:bg-emerald-500 text-white border-none text-[10px] uppercase font-black tracking-wider py-0.5 px-2 rounded-full'
      : 'bg-gray-400 hover:bg-gray-400 text-white border-none text-[10px] uppercase font-black tracking-wider py-0.5 px-2 rounded-full'}>
      {configured ? 'Configurado' : 'Não configurado'}
    </Badge>
  );

  return (
    <Card className="border border-emerald-100 shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden bg-gradient-to-br from-white to-emerald-50/10">
      <CardHeader className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 relative">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Bot className="w-24 h-24 text-white" />
        </div>
        <CardTitle className="flex items-center space-x-3 text-white text-xl font-bold">
          <Bot className="h-6 w-6 text-white" />
          <span>Assistente de IA</span>
        </CardTitle>
        <CardDescription className="text-emerald-100/90 font-medium text-xs mt-1.5">
          Guia do sistema via chat. O assistente usa o provedor preferido e cai para o outro como fallback.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ai_openai_key" className="text-xs font-bold text-gray-500 uppercase tracking-wider">OpenAI API Key</Label>
              {renderProviderBadge(aiStatus.openai)}
            </div>
            <div className="relative">
              <Input
                id="ai_openai_key"
                type={showOpenai ? 'text' : 'password'}
                value={params.openaiKey}
                onChange={(e) => handleFieldChange('openaiKey', e.target.value)}
                placeholder="Ex: sk-..."
                className="h-10 border-gray-200 focus:border-emerald-400 focus:ring-emerald-100 rounded-lg font-medium pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-8 w-8 hover:bg-gray-100 rounded-md"
                onClick={() => setShowOpenai(!showOpenai)}
              >
                {showOpenai ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ai_gemini_key" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Gemini API Key</Label>
              {renderProviderBadge(aiStatus.gemini)}
            </div>
            <div className="relative">
              <Input
                id="ai_gemini_key"
                type={showGemini ? 'text' : 'password'}
                value={params.geminiKey}
                onChange={(e) => handleFieldChange('geminiKey', e.target.value)}
                placeholder="Ex: AIza..."
                className="h-10 border-gray-200 focus:border-emerald-400 focus:ring-emerald-100 rounded-lg font-medium pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1 h-8 w-8 hover:bg-gray-100 rounded-md"
                onClick={() => setShowGemini(!showGemini)}
              >
                {showGemini ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ai_preferred" className="text-xs font-bold text-gray-500 uppercase tracking-wider">Provedor Preferido</Label>
            <select
              id="ai_preferred"
              value={params.preferred}
              onChange={(e) => handleFieldChange('preferred', e.target.value)}
              className="flex h-10 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 focus:border-emerald-400 focus:ring-emerald-100"
            >
              <option value="auto">Automático (primeiro configurado)</option>
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Status</Label>
            <div className="flex h-10 items-center gap-2 text-xs text-gray-500">
              {aiStatus.checking ? (
                <span className="flex items-center gap-1.5"><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Verificando...</span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  {(aiStatus.openai || aiStatus.gemini)
                    ? `Assistente pronto (${aiStatus.preferred ? `preferido: ${aiStatus.preferred}` : 'fallback automático'}).`
                    : 'Nenhuma chave cadastrada.'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            onClick={handleSaveClick}
            disabled={isLoading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center space-x-2 px-5 py-2 font-bold shadow-sm"
          >
            <Save className="h-4 w-4 text-white" />
            <span>{isLoading ? 'Salvando...' : 'Salvar Chaves'}</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
