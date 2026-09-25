import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Pencil, Trash2, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { asaasService } from "@/services/asaasService";
import { useAuth } from "@/contexts/AuthContext";
import { currencyApplyMask, currencyRemoveMaskToNumber } from "@/lib/masks/currency";
import type { AsaasBillingPayment } from "@/types/asaas";

const EDITABLE = ["PENDING", "OVERDUE"];

const KIND_LABEL: Record<string, string> = {
  entrada: "Entrada",
  parcela_unica: "Parcela única",
  parcelas: "Parcelas",
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
  const [editDueDate, setEditDueDate] = React.useState("");
  const [editValue, setEditValue] = React.useState("");
  const [editDescription, setEditDescription] = React.useState("");

  const billingQuery = useQuery({
    queryKey: ["asaas", "billing", matriculaId],
    queryFn: () => asaasService.getBilling(matriculaId),
    enabled: !!matriculaId,
    staleTime: 30 * 1000,
  });

  const billing = (billingQuery.data as any)?.data || billingQuery.data;
  const payments: AsaasBillingPayment[] = Array.isArray(billing?.payments) ? billing.payments : [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["asaas", "billing", matriculaId] });

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

  const openEdit = (p: AsaasBillingPayment) => {
    setEditTarget(p);
    setEditDueDate(String(p.dueDate || "").slice(0, 10));
    // pt-BR: Exibe o valor com máscara BRL (ex.: "R$ 14.850,00").
    setEditValue(currencyApplyMask(String(Math.round(Number(p.value ?? 0) * 100))));
    setEditDescription("");
  };

  const canModify = (p: AsaasBillingPayment) => {
    const st = String(p.live_status || "").toUpperCase();
    return st === "" || EDITABLE.includes(st);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Cobranças Asaas</CardTitle>
            <CardDescription>Geradas após a assinatura · edição e exclusão sincronizam com o Asaas</CardDescription>
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
            {payments.map((p) => {
              const st = String(p.live_status || p.status || "PENDING").toUpperCase();
              const editable = canModify(p);
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{KIND_LABEL[p.kind] || p.kind}</span>
                      <Badge variant={st === "PENDING" || st === "OVERDUE" ? "secondary" : "default"}>{st}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      R$ {formatBRL(p.value)} · venc. {formatBR(p.dueDate)}
                      {p.installment_id ? ` · plano ${String(p.installment_id).slice(0, 8)}…` : ""}
                    </p>
                  </div>
                  {(p.invoiceUrl || p.bankSlipUrl) && (
                    <Button variant="ghost" size="icon" asChild title="Abrir fatura/boleto">
                      <a href={String(p.invoiceUrl || p.bankSlipUrl)} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {editable && canManage && (
                    <Button variant="outline" size="icon" onClick={() => openEdit(p)} title="Editar no Asaas">
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {editable && canManage && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="text-destructive"
                      onClick={() => setDeleteTarget(p)}
                      title={p.kind === "parcelas" && p.installment_id ? "Excluir plano inteiro" : "Excluir cobrança"}
                    >
                      <Trash2 className="h-4 w-4" />
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
              <DialogDescription>Só PENDING/OVERDUE. O cliente nunca é alterado.</DialogDescription>
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

        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir cobrança</AlertDialogTitle>
              <AlertDialogDescription>
                {deleteTarget?.kind === "parcelas" && deleteTarget?.installment_id
                  ? "Exclui o plano inteiro (pendentes/vencidas; pagas não são afetadas). Confirmar?"
                  : "Exclui esta cobrança no Asaas. Confirmar?"}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteMut.mutate()}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

export default AsaasBillingSection;
