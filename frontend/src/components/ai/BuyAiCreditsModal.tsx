import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/use-toast';
import {
  Sparkles,
  Zap,
  CheckCircle2,
  Copy,
  Check,
  QrCode,
  Loader2,
  Clock,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import {
  aiCreditService,
  AiCreditPackage,
  BuyPackageResponse,
} from '@/services/aiCreditService';

interface BuyAiCreditsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function BuyAiCreditsModal({
  open,
  onOpenChange,
  onSuccess,
}: BuyAiCreditsModalProps) {
  const [packages, setPackages] = useState<AiCreditPackage[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>('pro_1500');
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [generatingPix, setGeneratingPix] = useState(false);
  const [pixData, setPixData] = useState<BuyPackageResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Carrega pacotes
  useEffect(() => {
    if (!open) {
      setPixData(null);
      setIsPaid(false);
      if (pollingRef.current) clearInterval(pollingRef.current);
      return;
    }

    setLoadingPackages(true);
    aiCreditService
      .getPackages()
      .then((pkgs) => {
        setPackages(pkgs);
        const popular = pkgs.find((p) => p.recommended);
        if (popular) setSelectedSlug(popular.slug);
        else if (pkgs.length > 0) setSelectedSlug(pkgs[0].slug);
      })
      .catch(() => {
        toast({
          title: 'Erro',
          description: 'Não foi possível carregar os pacotes de créditos.',
          variant: 'destructive',
        });
      })
      .finally(() => setLoadingPackages(false));
  }, [open]);

  // Polling para verificar se o PIX foi pago
  useEffect(() => {
    if (!pixData || isPaid) return;

    pollingRef.current = setInterval(async () => {
      try {
        const res = await aiCreditService.checkPurchaseStatus(pixData.purchase_id);
        if (res.is_paid) {
          setIsPaid(true);
          if (pollingRef.current) clearInterval(pollingRef.current);
          toast({
            title: 'Pagamento Confirmado!',
            description: `${pixData.credits.toLocaleString()} créditos de IA foram liberados na sua conta.`,
          });
          if (onSuccess) onSuccess();
        }
      } catch (e) {
        // Ignora erros transitórios no polling
      }
    }, 3500);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [pixData, isPaid, onSuccess]);

  const handleGeneratePix = async () => {
    if (!selectedSlug) return;
    setGeneratingPix(true);
    try {
      const res = await aiCreditService.buyPackage(selectedSlug);
      setPixData(res);
      setIsPaid(false);
    } catch (err: any) {
      toast({
        title: 'Erro ao gerar PIX',
        description: err.message || 'Falha na comunicação com o gateway Asaas.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingPix(false);
    }
  };

  const handleCopyPix = () => {
    if (!pixData?.pix_copy_paste) return;
    navigator.clipboard.writeText(pixData.pix_copy_paste);
    setCopied(true);
    toast({
      title: 'Código PIX copiado!',
      description: 'Cole no aplicativo do seu banco para pagar.',
    });
    setTimeout(() => setCopied(false), 3000);
  };

  const selectedPkg = packages.find((p) => p.slug === selectedSlug);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden">
        {/* Header com gradiente */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 text-white p-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="p-2 rounded-lg bg-white/10 backdrop-blur-sm">
              <Sparkles className="h-5 w-5" />
            </span>
            <Badge variant="outline" className="text-white border-white/30 text-xs font-semibold">
              Recarga Instantânea
            </Badge>
          </div>
          <DialogTitle className="text-2xl font-bold text-white">
            Adicionar Créditos de IA
          </DialogTitle>
          <DialogDescription className="text-white/80 mt-1 text-sm">
            Recarregue sua conta para utilizar o Assistente, revisões automáticas de Programas de Instrução e RAG.
          </DialogDescription>
        </div>

        <div className="p-6">
          {/* ETAPA 1: Escolha do pacote */}
          {!pixData && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Selecione o pacote desejado:
              </p>

              {loadingPackages ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Carregando pacotes de créditos...
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {packages.map((pkg) => {
                    const isSelected = selectedSlug === pkg.slug;
                    return (
                      <div
                        key={pkg.slug}
                        onClick={() => setSelectedSlug(pkg.slug)}
                        className={`relative rounded-xl border p-4 cursor-pointer transition-all flex flex-col justify-between ${
                          isSelected
                            ? 'border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20 shadow-sm ring-2 ring-emerald-500/20'
                            : 'border-border hover:border-emerald-300 hover:bg-muted/30'
                        }`}
                      >
                        {pkg.badge && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                            <span className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                              {pkg.badge}
                            </span>
                          </div>
                        )}

                        <div>
                          <h4 className="font-semibold text-sm text-foreground">{pkg.name}</h4>
                          <div className="mt-2 flex items-baseline gap-1">
                            <span className="text-2xl font-extrabold text-foreground">
                              R$ {pkg.price.toFixed(2).replace('.', ',')}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            {pkg.unit_price}
                          </div>
                          <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            <Zap className="h-3.5 w-3.5 fill-current" />
                            <span>{pkg.credits.toLocaleString()} créditos</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                            {pkg.description}
                          </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">Validade permanente</span>
                          <div
                            className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                              isSelected
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-muted-foreground/30'
                            }`}
                          >
                            {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Informações adicionais */}
              <div className="bg-muted/40 rounded-lg p-3 text-xs text-muted-foreground flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  Pagamento 100% seguro via <strong>PIX dinâmico Asaas</strong>. Créditos ativados imediatamente após a confirmação.
                </span>
              </div>
            </div>
          )}

          {/* ETAPA 2: Exibição do QR Code PIX */}
          {pixData && !isPaid && (
            <div className="space-y-5">
              <div className="text-center space-y-1">
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20">
                  Aguardando Pagamento
                </Badge>
                <h3 className="text-lg font-bold">Pague com o PIX Copia e Cola ou QR Code</h3>
                <p className="text-xs text-muted-foreground">
                  Valor a pagar: <strong className="text-foreground">R$ {pixData.price.toFixed(2).replace('.', ',')}</strong> por <strong>{pixData.credits.toLocaleString()} créditos</strong>
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                {/* QR Code Imagem */}
                <div className="flex flex-col items-center justify-center p-4 border rounded-xl bg-white dark:bg-zinc-900 shadow-sm">
                  {pixData.pix_qr_code ? (
                    <img
                      src={`data:image/png;base64,${pixData.pix_qr_code}`}
                      alt="QR Code PIX"
                      className="w-48 h-48 object-contain"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center bg-muted/40 rounded-lg">
                      <QrCode className="h-16 w-16 text-muted-foreground/40" />
                    </div>
                  )}
                  <span className="text-[11px] text-muted-foreground mt-2 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 animate-pulse" />
                    Abra o app do seu banco e aponte a câmera
                  </span>
                </div>

                {/* Copia e Cola */}
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      PIX Copia e Cola
                    </label>
                    <textarea
                      readOnly
                      rows={4}
                      value={pixData.pix_copy_paste || ''}
                      className="w-full text-xs font-mono bg-muted/50 p-2.5 rounded-lg border border-border focus:outline-none resize-none"
                    />
                  </div>

                  <Button
                    onClick={handleCopyPix}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Código Copiado!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copiar Código PIX
                      </>
                    )}
                  </Button>

                  {pixData.invoice_url && (
                    <Button
                      variant="outline"
                      asChild
                      className="w-full text-xs"
                    >
                      <a href={pixData.invoice_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                        Abrir página da fatura no Asaas
                      </a>
                    </Button>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600 shrink-0" />
                    <span>Detectando pagamento em tempo real...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ETAPA 3: Pagamento Confirmado */}
          {pixData && isPaid && (
            <div className="py-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-foreground">Pagamento Confirmado com Sucesso!</h3>
                <p className="text-sm text-muted-foreground">
                  Foram adicionados <strong>{pixData.credits.toLocaleString()} créditos</strong> à sua carteira de IA.
                </p>
              </div>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Você já pode fechar esta janela e continuar utilizando todos os recursos inteligentes do sistema normalmente.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 bg-muted/30 border-t flex items-center justify-between">
          {!pixData ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-xs">
                Cancelar
              </Button>
              <Button
                onClick={handleGeneratePix}
                disabled={generatingPix || !selectedSlug}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm"
              >
                {generatingPix ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Gerando PIX...
                  </>
                ) : (
                  <>
                    Continuar para Pagamento PIX
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </>
          ) : isPaid ? (
            <Button
              onClick={() => onOpenChange(false)}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Concluir
            </Button>
          ) : (
            <div className="w-full flex items-center justify-between">
              <Button
                variant="ghost"
                onClick={() => setPixData(null)}
                className="text-xs"
              >
                ← Escolher outro pacote
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Fechar (o pagamento continuará sendo monitorado)
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
