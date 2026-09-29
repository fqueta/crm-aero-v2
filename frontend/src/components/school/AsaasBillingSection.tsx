import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Trash2, ExternalLink, RefreshCw, Copy, MessageCircle, Check, Eye, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { asaasService } from "@/services/asaasService";
import { enrollmentsService } from "@/services/enrollmentsService";
import { useAuth } from "@/contexts/AuthContext";
import { currencyApplyMask, currencyRemoveMaskToNumber } from "@/lib/masks/currency";
import type { AsaasBillingPayment } from "@/types/asaas";
import { asaasStatusLabel } from "@/types/asaas";

const EDITABLE = ["PENDING", "OVERDUE"];
const REFUNDABLE = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"];

const KIND_LABEL: Record<string, string> = {
  entrada: "Entrada",
  parcela_unica: "Parcela única",
  parcelas: "Parcelas",
  parcela: "Parcela",
  matricula: "Taxa de matrícula",
};

function formatBR(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(ymd || "-");
}

function formatBRL(n: number): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
}

/**
 * formatViewedAt
 * pt-BR: "2026-09-28 19:26:00" (Asaas lastInvoiceViewedDate) →
 * "28/09/2026 às 19:26". Retorna null se ausente/inválida.
 */
function formatViewedAt(raw?: string | null): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(raw || ""));
  return m ? `${m[3]}/${m[2]}/${m[1]} às ${m[4]}:${m[5]}` : null;
}

/**
 * AsaasBillingSection
 * pt-BR: Cobranças Asaas da matrícula — lista (status vivo), edição
 * (vencimento/valor/descrição, só PENDING/OVERDUE) e exclusão (avulsa ou
 * plano). Cobrança paga não exibe excluir (Asaas exige estorno).
 */
export function AsaasBillingSection({ matriculaId }: { matriculaId: string }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  // pt-BR: Leitura liberada p/ interno ativo; escrita (editar/excluir) só Master/Admin (1,2).
  const canManage = !!user && [1, 2].includes(Number(user?.permission_id));
  const [editTarget, setEditTarget] = React.useState<AsaasBillingPayment | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<AsaasBillingPayment | null>(null);
  const [refundTarget, setRefundTarget] = React.useState<AsaasBillingPayment | null>(null);
  const [refundValue, setRefundValue] = React.useState("");
  const [refundDescription, setRefundDescription] = React.useState("");
  const [refundRequestUrl, setRefundRequestUrl] = React.useState<string | null>(null);
  const [editDueDate, setEditDueDate] = React.useState("");
  const [editValue, setEditValue] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");
  const [waTarget, setWaTarget] = React.useState<AsaasBillingPayment | null>(null);
  const [waText, setWaText] = React.useState("");
  const [waSending, setWaSending] = React.useState(false);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const handleCopyLink = (p: AsaasBillingPayment) => {
    const url = p.invoiceUrl || p.bankSlipUrl;
    if (!url) {
      toast.error("Link da fatura não disponível.");
      return;
    }
    navigator.clipboard.writeText(url);
    setCopiedId(p.id);
    toast.success("Link da fatura copiado para a área de transferência!");
    setTimeout(() => setCopiedId(null), 2500);
  };

  const buildWhatsAppText = (p: AsaasBillingPayment) => {
    const url = p.invoiceUrl || p.bankSlipUrl || "";
    const label = p.installment_number
      ? `Parcela ${p.installment_number}/${p.total_installments || ''}`
      : (KIND_LABEL[p.kind] || 'Fatura');
    return `Olá! Segue o link da sua fatura (${label}) no valor de R$ ${formatBRL(p.value)} com vencimento em ${formatBR(p.dueDate)}:\n${url}`;
  };

  const openWhatsAppModal = (p: AsaasBillingPayment) => {
    const url = p.invoiceUrl || p.bankSlipUrl;
    if (!url) {
      toast.error("Link da fatura não disponível.");
      return;
    }
    setWaTarget(p);
    setWaText(buildWhatsAppText(p));
  };

  const sendWhatsAppApi = async () => {
    if (!waTarget) return;
    if (!waText.trim()) {
      toast.error("A mensagem não pode estar vazia.");
      return;
    }
    setWaSending(true);
    try {
      const resp = await enrollmentsService.sendWhatsApp(String(matriculaId), { mensagem: waText });
      if ((resp as any)?.success) {
        toast.success((resp as any)?.message || "Mensagem enviada via WhatsApp (ChatGuru)!");
        setWaTarget(null);
      } else {
        toast.error((resp as any)?.error || (resp as any)?.message || "Falha ao enviar a mensagem.");
      }
    } catch (err: any) {
      const detail = err?.body?.error || err?.body?.message || err?.message || "Erro de conexão.";
      toast.error(`Falha no envio: ${detail}`);
    } finally {
      setWaSending(false);
    }
  };

  const billingQuery = useQuery({
    queryKey: ["asaas", "billing", matriculaId],
    queryFn: () => asaasService.getBilling(matriculaId),
    enabled: !!matriculaId,
    staleTime: 30 * 1000,
  });

  const billing = (billingQuery.data as any)?.data || billingQuery.data;
  const payments: AsaasBillingPayment[] = Array.isArray(billing?.payments) ? billing.payments : [];

  /**
   * orderedPayments
   * pt-BR: Lista em ordem cronológica (vencimento crescente): matrícula e
   * entrada primeiro, depois as parcelas 1/N..N/N.
   */
  const orderedPayments = React.useMemo(() => {
    const numOf = (p: AsaasBillingPayment) => {
      const n = Number((p as any)?.installment_number);
      return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
    };
    return [...payments].sort((a, b) => {
      const da = String(a?.dueDate || '');
      const db = String(b?.dueDate || '');
      if (da !== db) return da < db ? -1 : 1;
      return numOf(a) - numOf(b);
    });
  }, [payments]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["asaas", "billing", matriculaId] });
    qc.invalidateQueries({ queryKey: ["enrollments", "detail", String(matriculaId)] });
    qc.invalidateQueries({ queryKey: ["enrollments"] });
    qc.invalidateQueries({ queryKey: ["event-logs"] });
  };

  const updateMut = useMutation({
    mutationFn: () =>
      asaasService.updateBillingPayment(String(editTarget!.id), {
        matricula_id: matriculaId,
        dueDate: editDueDate || undefined,
        value: editValue ? currencyRemoveMaskToNumber(editValue) : undefined,
        description: editDescription || undefined,
      }),
    onSuccess: () => {
      toast.success("Cobrança atualizada no Asaas");
      setEditTarget(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.body?.message || e?.message || "Erro ao atualizar cobrança"),
  });

  const deleteMut = useMutation({
    mutationFn: () => {
      const t = deleteTarget!;
      if (t.kind === "parcelas" && t.installment_id) {
        return asaasService.cancelBillingInstallment(String(t.installment_id), matriculaId);
      }
      return asaasService.deleteBillingPayment(String(t.id), matriculaId);
    },
    onSuccess: () => {
      toast.success("Cobrança excluída no Asaas");
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e: any) => toast.error(e?.body?.message || e?.message || "Erro ao excluir cobrança"),
  });

  const refundMut = useMutation({
    mutationFn: () => {
      const t = refundTarget!;
      const v = refundValue ? currencyRemoveMaskToNumber(refundValue) : undefined;
      return asaasService.refundBillingPayment(String(t.id), {
        matricula_id: matriculaId,
        value: v,
        description: refundDescription.trim() || undefined,
      });
    },
    onSuccess: (resp: any) => {
      const payload = (resp as any)?.data || resp;
      const requestUrl = String(payload?.request_url || payload?.data?.requestUrl || "");
      if (payload?.bank_slip || requestUrl) {
        setRefundRequestUrl(requestUrl);
        toast.success("Estorno de boleto iniciado. Envie o link ao cliente.");
      } else {
        toast.success("Cobrança estornada no Asaas. Baixa revertida no financeiro.");
        setRefundTarget(null);
        setRefundRequestUrl(null);
      }
      invalidate();
    },
    onError: (e: any) => toast.error(e?.body?.message || e?.message || "Erro ao estornar cobrança"),
  });

  const openRefund = (p: AsaasBillingPayment) => {
    setRefundTarget(p);
    setRefundValue(currencyApplyMask(String(Math.round(Number(p.value ?? 0) * 100))));
    setRefundDescription("");
    setRefundRequestUrl(null);
  };

  const openEdit = (p: AsaasBillingPayment) => {
    setEditTarget(p);
    setEditDueDate(String(p.dueDate || "").slice(0, 10));
    // pt-BR: Exibe o valor com máscara BRL (ex.: "R$ 14.850,00").
    setEditValue(currencyApplyMask(String(Math.round(Number(p.value ?? 0) * 100))));
    setEditDescription("");
  };

  const canModify = (p: AsaasBillingPayment) => {
    const st = String(p.live_status || p.status || "").toUpperCase();
    return st === "" || EDITABLE.includes(st);
  };

  const canRefund = (p: AsaasBillingPayment) => {
    const st = String(p.live_status || p.status || "").toUpperCase();
    return REFUNDABLE.includes(st);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Cobranças Asaas</CardTitle>
            <CardDescription>Geradas após a assinatura · editar/excluir (pendentes) e estornar (pagas) sincronizam com o Asaas</CardDescription>
          </div>
          <Button variant="outline" size="icon" onClick={() => billingQuery.refetch()} title="Atualizar status">
            <RefreshCw className={`h-4 w-4 ${billingQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {billingQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando cobranças...</p>
        ) : payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhuma cobrança gerada. A cobrança é criada automaticamente após a assinatura do contrato.
          </p>
        ) : (
          <div className="space-y-2">
            {orderedPayments.map((p) => {
              const st = String(p.live_status || p.status || "PENDING").toUpperCase();
              const editable = canModify(p);
              const invoiceLink = p.invoiceUrl || p.bankSlipUrl;
              const title = p.installment_number
                ? `Parcela ${p.installment_number}/${p.total_installments || ''}`
                : (KIND_LABEL[p.kind] || p.kind);
              const viewedAt = formatViewedAt(p.lastInvoiceViewedDate || p.lastBankSlipViewedDate);

              return (
                <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{title}</span>
                      <Badge variant={st === "PENDING" || st === "OVERDUE" ? "secondary" : "default"}>{asaasStatusLabel(st)}</Badge>
                      {viewedAt && (
                        <span
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                          title={`Fatura visualizada pela última vez em ${viewedAt}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Visualizada em {viewedAt}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      R$ {formatBRL(p.value)} · venc. {formatBR(p.dueDate)}
                      {p.installment_id && !p.installment_number ? ` · plano ${String(p.installment_id).slice(0, 8)}…` : ""}
                    </p>
                  </div>

                  {invoiceLink && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => handleCopyLink(p)}
                        title="Copiar link da fatura"
                      >
                        {copiedId === p.id ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                        {copiedId === p.id ? "Copiado!" : "Copiar Link"}
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                        onClick={() => openWhatsAppModal(p)}
                        title="Enviar link via WhatsApp (ChatGuru)"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </Button>

                      <Button variant="ghost" size="icon" className="h-8 w-8" asChild title="Abrir fatura/boleto em nova aba">
                        <a href={String(invoiceLink)} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </>
                  )}

                  {editable && canManage && (
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEdit(p)} title="Editar no Asaas">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {editable && canManage && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteTarget(p)}
                      title={p.kind === "parcelas" && p.installment_id ? "Excluir plano inteiro" : "Excluir cobrança"}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {canRefund(p) && canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs text-amber-700 hover:text-amber-800 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950"
                      onClick={() => openRefund(p)}
                      title="Estornar cobrança paga no Asaas"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      Estornar
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar cobrança no Asaas</DialogTitle>
              <DialogDescription>Somente pendentes ou vencidas. O cliente nunca é alterado.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Vencimento</Label>
                <Input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Valor (R$)</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={editValue}
                  onChange={(e) => setEditValue(currencyApplyMask(e.target.value))}
                  placeholder="R$ 0,00"
                />
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTarget(null)}>Cancelar</Button>
              <Button onClick={() => updateMut.mutate()} disabled={updateMut.isLoading}>
                {updateMut.isLoading ? "Salvando..." : "Salvar no Asaas"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!waTarget} onOpenChange={(o) => !o && !waSending && setWaTarget(null)}>
          <DialogContent className="sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle>Enviar fatura via WhatsApp</DialogTitle>
              <DialogDescription>
                {waTarget ? `${KIND_LABEL[waTarget.kind] || 'Fatura'} • R$ ${formatBRL(waTarget.value)} • venc. ${formatBR(waTarget.dueDate)} — envio pela API do ChatGuru.` : 'Envio pela API do ChatGuru.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea
                value={waText}
                onChange={(e) => setWaText(e.target.value)}
                rows={6}
                className="font-normal"
                placeholder="Texto da mensagem..."
              />
              <p className="text-[11px] text-muted-foreground">Revise o texto antes de enviar. O link da fatura já está incluído.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setWaTarget(null)} disabled={waSending}>Cancelar</Button>
              <Button onClick={sendWhatsAppApi} disabled={waSending || !waText.trim()} className="bg-green-600 hover:bg-green-700 text-white">
                <MessageCircle className="h-4 w-4 mr-1.5" />
                {waSending ? "Enviando..." : "Enviar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir cobrança</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>
                  {deleteTarget?.kind === "parcelas" && deleteTarget?.installment_id
                    ? "Cancela o plano inteiro no Asaas (só pendentes/vencidas; pagas não são afetadas)."
                    : "Exclui esta cobrança não paga no Asaas."}
                </p>
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm font-medium text-destructive">
                  ⚠️ Atenção: ação irreversível. A cobrança é perdida no Asaas sem possibilidade de recuperação —
                  link/boleto param de funcionar e o histórico é perdido. Só não pagas podem ser excluídas (pagas usam Estornar).
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteMut.mutate()}
              >
                Sim, excluir definitivamente
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={!!refundTarget} onOpenChange={(o) => { if (!o && !refundMut.isLoading) { setRefundTarget(null); setRefundRequestUrl(null); } }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Estornar cobrança no Asaas</DialogTitle>
              <DialogDescription className="space-y-3">
                <p>
                  {refundTarget ? `${refundTarget.installment_number ? `Parcela ${refundTarget.installment_number}/${refundTarget.total_installments || ''} • ` : ''}R$ ${formatBRL(refundTarget.value)} — a baixa local é revertida e o ganho automático pode voltar a atendimento.` : 'Estorno da cobrança paga.'}
                </p>
                <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm font-medium text-destructive">
                  ⚠️ Atenção: ação irreversível. O valor devolvido ao cliente é perdido sem possibilidade de recuperação —
                  taxas do Asaas não voltam e o financeiro é revertido. Só não pagas deveriam estar aqui; pagas exigem este estorno consciente.
                </p>
              </DialogDescription>
            </DialogHeader>
            {refundRequestUrl ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Estorno de boleto iniciado. Envie este link ao cliente para informar os dados bancários. Sem isso o estorno não conclui.
                </p>
                <div className="flex items-center gap-2 rounded-lg border p-2 text-xs break-all">
                  <span className="flex-1">{refundRequestUrl}</span>
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(refundRequestUrl); toast.success("Link de estorno copiado!"); }}>
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Valor do estorno (R$) — vazio = integral</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={refundValue}
                    onChange={(e) => setRefundValue(currencyApplyMask(e.target.value))}
                    placeholder="R$ 0,00"
                  />
                  <p className="text-[11px] text-muted-foreground">Pix permite parciais. Taxas do Asaas não são devolvidas.</p>
                </div>
                <div className="space-y-1">
                  <Label>Motivo (opcional)</Label>
                  <Input value={refundDescription} onChange={(e) => setRefundDescription(e.target.value)} placeholder="Ex.: cancelamento da matrícula" />
                </div>
                <p className="text-[11px] text-muted-foreground">Boleto: inicia solicitação e retorna link para o cliente completar os dados.</p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRefundTarget(null); setRefundRequestUrl(null); }} disabled={refundMut.isLoading}>Fechar</Button>
              {!refundRequestUrl && (
                <Button onClick={() => refundMut.mutate()} disabled={refundMut.isLoading} className="bg-amber-600 hover:bg-amber-700 text-white">
                  {refundMut.isLoading ? "Estornando..." : "Sim, estornar definitivamente"}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default AsaasBillingSection;
