import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { currencyApplyMask, currencyRemoveMaskToString } from '@/lib/masks/currency';
import { useToast } from '@/hooks/use-toast';
import { useUpdateEnrollmentStatus } from '@/hooks/enrollments';

function getErrorMessage(error: any, fallback: string): string {
  if (error?.response?.data?.message) return error.response.data.message;
  if (error?.data?.message) return error.data.message;
  if (error?.body?.message) return error.body.message;
  if (error?.message) return error.message;
  return fallback;
}

export interface ProposalWinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollmentId: string | number | null;
  proposalAmountLabel?: string;
  initialGainDate?: string;
  initialNegotiatedAmount?: string;
  initialPaidAmount?: string;
  initialGainObservation?: string;
  onSuccess?: () => void;
}

export function ProposalWinDialog({
  open,
  onOpenChange,
  enrollmentId,
  proposalAmountLabel,
  initialGainDate,
  initialNegotiatedAmount,
  initialPaidAmount,
  initialGainObservation,
  onSuccess,
}: ProposalWinDialogProps) {
  const { toast } = useToast();
  const updateEnrollmentStatusMutation = useUpdateEnrollmentStatus();

  const [gainDate, setGainDate] = useState(() => initialGainDate || new Date().toISOString().slice(0, 10));
  const [negotiatedAmount, setNegotiatedAmount] = useState(() => initialNegotiatedAmount || proposalAmountLabel || '');
  const [paidAmount, setPaidAmount] = useState(() => initialPaidAmount || '');
  const [gainObservation, setGainObservation] = useState(() => initialGainObservation || '');

  useEffect(() => {
    if (open) {
      setGainDate(initialGainDate || new Date().toISOString().slice(0, 10));
      setNegotiatedAmount(initialNegotiatedAmount || proposalAmountLabel || '');
      setPaidAmount(initialPaidAmount || '');
      setGainObservation(initialGainObservation || '');
    }
  }, [open, initialGainDate, initialNegotiatedAmount, initialPaidAmount, initialGainObservation, proposalAmountLabel]);

  const handleConfirmWin = () => {
    if (!enrollmentId || updateEnrollmentStatusMutation.isPending) return;

    const normalizedNegotiatedAmount = currencyRemoveMaskToString(negotiatedAmount || '');
    const normalizedPaidAmount = currencyRemoveMaskToString(paidAmount || '');
    if (!gainDate || Number(normalizedNegotiatedAmount) <= 0) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe a data do ganho e um valor negociado maior que zero.',
        variant: 'destructive',
      });
      return;
    }

    if (Number(normalizedPaidAmount || '0') > Number(normalizedNegotiatedAmount || '0')) {
      toast({
        title: 'Valores inconsistentes',
        description: 'A entrada inicial não pode ser maior que o valor negociado.',
        variant: 'destructive',
      });
      return;
    }

    updateEnrollmentStatusMutation.mutate(
      {
        id: String(enrollmentId),
        status: 'g',
        gain_date: gainDate,
        negotiated_amount: normalizedNegotiatedAmount,
        paid_amount: normalizedPaidAmount || '0',
        gain_observation: gainObservation.trim() || undefined,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast({
            title: 'Ganho registrado',
            description: 'A proposta foi marcada como ganho e o financeiro foi preparado para recebimentos parciais.',
          });
          onSuccess?.();
        },
        onError: (error: unknown) => {
          toast({
            title: 'Erro ao registrar ganho',
            description: getErrorMessage(error, 'Não foi possível registrar o ganho da proposta.'),
            variant: 'destructive',
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Registrar ganho da proposta</DialogTitle>
          <DialogDescription>
            Informe a data do ganho, o valor negociado e a entrada inicial para criar o crediário da proposta.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {proposalAmountLabel && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700/80">
                Valor da proposta
              </div>
              <div className="text-sm font-semibold text-emerald-900">
                {proposalAmountLabel}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Data do ganho
            </label>
            <Input type="date" value={gainDate} onChange={(event) => setGainDate(event.target.value)} />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Valor negociado
            </label>
            <Input
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={negotiatedAmount}
              onChange={(event) => setNegotiatedAmount(currencyApplyMask(event.target.value))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Entrada recebida agora
            </label>
            <Input
              inputMode="numeric"
              placeholder="R$ 0,00"
              value={paidAmount}
              onChange={(event) => setPaidAmount(currencyApplyMask(event.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Deixe zerado se a proposta foi ganha, mas ainda não houve recebimento.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Observações ou comentários
            </label>
            <Textarea
              placeholder="Descreva detalhes relevantes sobre o fechamento da proposta."
              value={gainObservation}
              onChange={(event) => setGainObservation(event.target.value)}
              className="min-h-[120px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            className="bg-emerald-600 hover:bg-emerald-700"
            onClick={handleConfirmWin}
            disabled={updateEnrollmentStatusMutation.isPending}
          >
            Confirmar ganho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

