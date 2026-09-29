import { asaasService } from '@/services/asaasService';
import type { AsaasBillingPayment } from '@/types/asaas';

/**
 * getUnpaidBillingPayments
 * pt-BR: Filtra só cobranças não pagas (PENDING/OVERDUE pelo status vivo ou salvo).
 * Pagas/confirmadas/estornadas nunca entram (Asaas retorna 409 e exige estorno).
 */
export function getUnpaidBillingPayments(payments: AsaasBillingPayment[]): AsaasBillingPayment[] {
  return (Array.isArray(payments) ? payments : []).filter((p) => {
    const st = String(p?.live_status || p?.status || '').toUpperCase();
    return st === '' || st === 'PENDING' || st === 'OVERDUE';
  });
}

/**
 * summarizeUnpaid
 * pt-BR: Conta e soma as não pagas para exibir no diálogo de exclusão.
 */
export function summarizeUnpaid(payments: AsaasBillingPayment[]): { count: number; total: number } {
  const unpaid = getUnpaidBillingPayments(payments);
  return {
    count: unpaid.length,
    total: unpaid.reduce((sum, p) => sum + (Number(p?.value) || 0), 0),
  };
}

export interface DeleteUnpaidResult {
  deletedPayments: number;
  deletedInstallments: number;
  failed: string[];
}

/**
 * deleteUnpaidBilling
 * pt-BR: Exclui no Asaas só as não pagas da matrícula:
 * - com installment_id → cancela o plano uma vez por installment_id
 *   (Asaas mantém as já pagas intactas);
 * - sem installment_id → DELETE individual por payment id.
 * Retorna contadores + lista de falhas (não lança).
 */
export async function deleteUnpaidBilling(
  matriculaId: string | number,
  payments: AsaasBillingPayment[]
): Promise<DeleteUnpaidResult> {
  const unpaid = getUnpaidBillingPayments(payments);
  const result: DeleteUnpaidResult = { deletedPayments: 0, deletedInstallments: 0, failed: [] };

  const installmentIds = Array.from(
    new Set(
      unpaid
        .map((p) => String(p?.installment_id || '').trim())
        .filter((id) => id.length > 0)
    )
  );
  const singles = unpaid.filter((p) => !String(p?.installment_id || '').trim());

  for (const installmentId of installmentIds) {
    try {
      await asaasService.cancelBillingInstallment(installmentId, matriculaId);
      result.deletedInstallments += 1;
    } catch (err: any) {
      result.failed.push(
        `Plano ${installmentId.slice(0, 8)}…: ${String(err?.body?.message || err?.message || 'falha')}`
      );
    }
  }

  for (const p of singles) {
    const pid = String((p as any)?.id || '').trim();
    if (!pid) continue;
    try {
      await asaasService.deleteBillingPayment(pid, matriculaId);
      result.deletedPayments += 1;
    } catch (err: any) {
      result.failed.push(
        `Cobrança ${pid.slice(0, 8)}…: ${String(err?.body?.message || err?.message || 'falha')}`
      );
    }
  }

  return result;
}

/**
 * formatBRL
 * pt-BR: Formata total para exibição no diálogo.
 */
export function formatUnpaidTotalBRL(n: number): string {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);
  } catch {
    return `R$ ${(Number(n) || 0).toFixed(2)}`;
  }
}
