import React, { useMemo, useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useRegisterClientAttendance, useClientAttendances, useClient } from '@/hooks/clients';
import { useUpdateEnrollmentStatus } from '@/hooks/enrollments';
import { useToast } from '@/hooks/use-toast';
import { financialService } from '@/services/financialService';
import { currencyApplyMask, currencyRemoveMaskToString } from '@/lib/masks/currency';
import { cn, formatDate } from '@/lib/utils';
import { CreateClientAttendanceInput } from '@/types/attendance';
import { PaymentMethod } from '@/types/financial';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CircleDot, Clock3, Headset, MessageSquareText, XCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';

interface ProposalAttendanceCardProps {
  enrollmentId: string;
  clientId?: string;
  clientName?: string;
  status?: string;
  meta?: Record<string, unknown>;
  proposalAmountLabel?: string;
  linkAssinatura?: string;
  pdfUrl?: string;
}

interface ProposalAttendanceItem {
  id?: string | number;
  channel?: string | null;
  created_at?: string;
  observation?: string | null;
  attendant?: {
    name?: string | null;
  } | null;
  metadata?: {
    duration?: number | string | null;
  } | null;
}

interface ProposalGainPaymentItem {
  id?: string | number;
  amount?: string | number | null;
  payment_date?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  paymentDate?: string | null;
  paymentMethod?: string | null;
}

const DEFAULT_LOSS_REASONS = [
  'Fechou em outra escola',
  'Cliente não retorna ligações ou mensagens',
  'Pesquisa de preço',
  'Desistência após aprovação',
  'Follow up no Guru',
  'Tempo de espera para iniciar',
  'Fechou outra proposta atualizada',
  'Outro',
] as const;

/**
 * getStatusMeta
 * pt-BR: Traduz o código de status da proposta em rótulo, descrição e estilo visual.
 * en-US: Translates the proposal status code into label, description and visual style.
 */
function getStatusMeta(status?: string) {
  const normalized = String(status || 'a').toLowerCase();

  if (normalized === 'g') {
    return {
      code: 'g' as const,
      label: 'Ganho',
      description: 'A proposta foi convertida em venda.',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  }

  if (normalized === 'p') {
    return {
      code: 'p' as const,
      label: 'Perda',
      description: 'A proposta foi encerrada como perdida.',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    };
  }

  return {
    code: 'a' as const,
    label: 'Atendimento',
    description: 'A proposta segue em acompanhamento comercial.',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  };
}

/**
 * getChannelLabel
 * pt-BR: Converte o identificador do canal em um rótulo amigável.
 * en-US: Converts the channel identifier into a friendly label.
 */
function getChannelLabel(channel?: string | null): string {
  const normalized = String(channel || '').toLowerCase();

  switch (normalized) {
    case 'phone':
      return 'Telefone';
    case 'chat':
      return 'Chat';
    case 'whatsapp':
      return 'WhatsApp';
    case 'mensagem':
      return 'Mensagem';
    case 'in_person':
      return 'Presencial';
    case 'email':
      return 'E-mail';
    default:
      return normalized ? normalized : 'Canal não informado';
  }
}

/**
 * formatStatusDate
 * pt-BR: Formata datas ISO simples para exibicao no resumo do status.
 * en-US: Formats simple ISO dates for the status summary.
 */
function formatStatusDate(value?: string | null): string {
  if (!value) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  return String(value);
}

/**
 * formatCurrencyBRL
 * pt-BR: Formata numeros monetarios em BRL para exibicao no card.
 * en-US: Formats monetary values in BRL for display in the card.
 */
function formatCurrencyBRL(value?: string | number | null): string {
  const amount = Number(value || 0);
  if (!isFinite(amount)) return '—';

  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  } catch {
    return `R$ ${amount.toFixed(2)}`;
  }
}

/**
 * formatCurrencyInputValue
 * pt-BR: Formata um valor numerico salvo para reutilizacao em inputs monetarios ja preenchidos.
 * en-US: Formats a persisted numeric value for reuse in prefilled currency inputs.
 */
function formatCurrencyInputValue(value?: string | number | null): string {
  if (value === null || value === undefined || value === '') return '';

  const amount = Number(value);
  if (!isFinite(amount)) return '';

  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
  } catch {
    return `R$ ${amount.toFixed(2)}`;
  }
}

/**
 * getFinancialStatusLabel
 * pt-BR: Traduz o status financeiro resumido do ganho para exibicao no card.
 * en-US: Translates the summarized financial gain status for card display.
 */
function getFinancialStatusLabel(value?: string | null): string {
  switch (String(value || '').toLowerCase()) {
    case 'paid':
      return 'Quitado';
    case 'partial':
      return 'Parcial';
    case 'cancelled':
      return 'Cancelado';
    case 'overdue':
      return 'Vencido';
    default:
      return 'Pendente';
  }
}

/**
 * getPaymentMethodLabel
 * pt-BR: Converte o metodo de pagamento em um rótulo amigável.
 * en-US: Converts the payment method code into a friendly label.
 */
function getPaymentMethodLabel(value?: string | null): string {
  switch (String(value || '').toLowerCase()) {
    case 'cash':
      return 'Dinheiro';
    case 'credit_card':
      return 'Cartão de Crédito';
    case 'debit_card':
      return 'Cartão de Débito';
    case 'bank_transfer':
      return 'Transferência Bancária';
    case 'pix':
      return 'PIX';
    case 'check':
      return 'Cheque';
    case 'boleto':
      return 'Boleto';
    case 'other':
      return 'Outro';
    default:
      return value ? String(value) : 'Não informado';
  }
}

/**
 * getPaymentDateValue
 * pt-BR: Normaliza a leitura da data entre formatos antigos e novos do pagamento.
 * en-US: Normalizes payment date access between legacy and current payload shapes.
 */
function getPaymentDateValue(payment?: ProposalGainPaymentItem | null): string {
  return payment?.payment_date || payment?.paymentDate || '';
}

/**
 * getPaymentMethodValue
 * pt-BR: Normaliza a leitura da forma de pagamento entre formatos antigos e novos.
 * en-US: Normalizes payment method access between legacy and current payload shapes.
 */
function getPaymentMethodValue(payment?: ProposalGainPaymentItem | null): string {
  return payment?.payment_method || payment?.paymentMethod || '';
}

/**
 * extractApiErrorMessage
 * pt-BR: Extrai a primeira mensagem amigavel de um payload de erro da API, incluindo erros de validacao.
 * en-US: Extracts the first friendly message from an API error payload, including validation errors.
 */
function extractApiErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const message = 'message' in payload ? payload.message : undefined;
  const errors = 'errors' in payload ? payload.errors : undefined;

  if (errors && typeof errors === 'object') {
    for (const value of Object.values(errors as Record<string, unknown>)) {
      if (Array.isArray(value) && value.length > 0) {
        return String(value[0]);
      }

      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }
  }

  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  return null;
}

/**
 * getErrorMessage
 * pt-BR: Extrai uma mensagem amigavel de erros desconhecidos das mutacoes.
 * en-US: Extracts a friendly message from unknown mutation errors.
 */
function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null) {
    const payloadMessage = extractApiErrorMessage(
      (error as { response?: { data?: unknown }; data?: unknown }).response?.data
        ?? (error as { data?: unknown }).data
        ?? error
    );

    if (payloadMessage) {
      return payloadMessage;
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message || fallback);
  }

  return fallback;
}

/**
 * ProposalAttendanceCard
 * pt-BR: Card lateral da proposta para registrar atendimentos e marcar ganho/perda.
 * en-US: Proposal sidebar card to register attendances and mark win/loss.
 */
export default function ProposalAttendanceCard({
  enrollmentId,
  clientId,
  clientName,
  status,
  meta,
  proposalAmountLabel,
  linkAssinatura,
  pdfUrl,
}: ProposalAttendanceCardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [winDialogOpen, setWinDialogOpen] = useState(false);
  const [lossDialogOpen, setLossDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [channel, setChannel] = useState('whatsapp');
  const [observation, setObservation] = useState('');
  const [duration, setDuration] = useState('');
  const [tagsText, setTagsText] = useState('');

  const [gainDate, setGainDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [negotiatedAmount, setNegotiatedAmount] = useState('');

  useEffect(() => {
    const openAttendance = searchParams.get('openAttendance');
    if (!openAttendance) return;

    // Check if the data is already loaded
    const isLoaded = !!clientName || (meta && Object.keys(meta).length > 0);
    if (!isLoaded) return;

    // Clear param to prevent reopening on refresh
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('openAttendance');
    setSearchParams(newParams, { replace: true });
    
    setDialogOpen(true);
    setChannel('mensagem');
    
    const nome = clientName || 'Cliente';
    if (openAttendance === 'pdf') {
      const url = pdfUrl || (meta?.proposta_pdf ? String(meta.proposta_pdf) : '');
      setObservation(`Olá, *${nome}*! Segue o link do PDF com os detalhes da sua proposta comercial: ${url}`);
    } else if (openAttendance === 'assinatura') {
      const url = linkAssinatura || '';
      setObservation(`Olá, *${nome}*! Segue o link para visualizar e assinar a sua proposta comercial: ${url}`);
    }
  }, [searchParams, pdfUrl, linkAssinatura, clientName, meta, setSearchParams]);
  const [paidAmount, setPaidAmount] = useState('');
  const [gainObservation, setGainObservation] = useState('');
  const [lossDate, setLossDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lossReason, setLossReason] = useState('');
  const [lossObservation, setLossObservation] = useState('');
  const [receiveDate, setReceiveDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveMethod, setReceiveMethod] = useState<PaymentMethod>(PaymentMethod.OTHER);
  const [receiveNotes, setReceiveNotes] = useState('');

  const statusMeta = useMemo(() => getStatusMeta(status), [status]);
  const currentGainDate = typeof meta?.data_ganho === 'string' ? meta.data_ganho : '';
  const currentNegotiatedAmount = typeof meta?.valor_negociado_ganho === 'string' ? meta.valor_negociado_ganho : '';
  const currentEntryAmount = typeof meta?.valor_entrada_ganho === 'string' ? meta.valor_entrada_ganho : '';
  const currentPaidAmount = typeof meta?.valor_recebido_ganho === 'string'
    ? meta.valor_recebido_ganho
    : (typeof meta?.valor_pago === 'string' ? meta.valor_pago : '');
  const currentRemainingAmount = typeof meta?.saldo_ganho === 'string' ? meta.saldo_ganho : '';
  const currentFinancialStatus = typeof meta?.financeiro_status_ganho === 'string' ? meta.financeiro_status_ganho : '';
  const currentGainObservation = typeof meta?.observacao_ganho === 'string' ? meta.observacao_ganho : '';
  const currentFinancialAccountId = meta?.financial_gain_account_id ? String(meta.financial_gain_account_id) : '';
  const currentGainPayments = useMemo<ProposalGainPaymentItem[]>(() => {
    return Array.isArray(meta?.pagamentos_ganho) ? (meta.pagamentos_ganho as ProposalGainPaymentItem[]) : [];
  }, [meta?.pagamentos_ganho]);
  const currentLossDate = typeof meta?.data_perda === 'string' ? meta.data_perda : '';
  const currentLossReason = typeof meta?.motivo_perda === 'string' ? meta.motivo_perda : '';
  const currentLossObservation = typeof meta?.observacao_perda === 'string' ? meta.observacao_perda : '';
  const remainingGainAmount = Number(currentRemainingAmount || 0);
  const editingPayment = useMemo(() => {
    return currentGainPayments.find((payment) => String(payment.id || '') === String(editingPaymentId || '')) || null;
  }, [currentGainPayments, editingPaymentId]);
  const { data: attendancesResponse, isLoading: isLoadingAttendances } = useClientAttendances(
    String(clientId || ''),
    { per_page: 5 },
    { enabled: !!clientId, staleTime: 60_000 }
  );
  const { data: clientResponse } = useClient(
    String(clientId || ''),
    { enabled: !!clientId, staleTime: 60_000 }
  );

  const clientCelular = clientResponse?.celular || (clientResponse?.config as any)?.celular || '';
  const [celularEnvio, setCelularEnvio] = useState('');

  useEffect(() => {
    if (dialogOpen) {
      setCelularEnvio(clientCelular || '');
    }
  }, [dialogOpen, clientCelular]);

  const updateEnrollmentStatusMutation = useUpdateEnrollmentStatus();
  const registerAttendanceMutation = useRegisterClientAttendance();

  const attendances = useMemo<ProposalAttendanceItem[]>(() => {
    return Array.isArray(attendancesResponse?.data) ? (attendancesResponse.data as ProposalAttendanceItem[]) : [];
  }, [attendancesResponse?.data]);

  /**
   * resetReceiveForm
   * pt-BR: Prepara o modal de parcela com o saldo atual da proposta.
   * en-US: Prepares the installment modal with the proposal's current outstanding balance.
   */
  const resetReceiveForm = () => {
    setReceiveDate(new Date().toISOString().slice(0, 10));
    setReceiveAmount(remainingGainAmount > 0 ? formatCurrencyInputValue(remainingGainAmount) : '');
    setReceiveMethod(PaymentMethod.OTHER);
    setReceiveNotes('');
    setEditingPaymentId(null);
  };

  /**
   * handleChangeStatus
   * pt-BR: Atualiza o status da proposta para atendimento, ganho ou perda.
   * en-US: Updates proposal status to service, won or lost.
   */
  const handleChangeStatus = (nextStatus: 'a' | 'g' | 'p') => {
    if (!enrollmentId || updateEnrollmentStatusMutation.isPending) return;

    if (nextStatus === 'g') {
      setGainDate(currentGainDate || new Date().toISOString().slice(0, 10));
      setNegotiatedAmount(
        currentNegotiatedAmount
          ? formatCurrencyInputValue(currentNegotiatedAmount)
          : (proposalAmountLabel || '')
      );
      setPaidAmount(currentEntryAmount ? formatCurrencyInputValue(currentEntryAmount) : '');
      setGainObservation(currentGainObservation || '');
      setWinDialogOpen(true);
      return;
    }

    if (nextStatus === 'p') {
      setLossDate(currentLossDate || new Date().toISOString().slice(0, 10));
      setLossReason(currentLossReason || '');
      setLossObservation(currentLossObservation || '');
      setLossDialogOpen(true);
      return;
    }

    updateEnrollmentStatusMutation.mutate(
      { id: String(enrollmentId), status: nextStatus },
      {
        onSuccess: () => {
          toast({
            title: 'Status atualizado',
            description: `A proposta foi marcada como ${getStatusMeta(nextStatus).label.toLowerCase()}.`,
          });
        },
        onError: (error: unknown) => {
          toast({
            title: 'Erro ao atualizar status',
            description: getErrorMessage(error, 'Nao foi possivel atualizar a proposta.'),
            variant: 'destructive',
          });
        },
      }
    );
  };

  /**
   * handleConfirmWin
   * pt-BR: Confirma o ganho da proposta e envia valor negociado, entrada inicial e observacao.
   * en-US: Confirms the proposal win and sends negotiated value, initial payment and observation.
   */
  const handleConfirmWin = () => {
    if (!enrollmentId || updateEnrollmentStatusMutation.isPending) return;

    const normalizedNegotiatedAmount = currencyRemoveMaskToString(negotiatedAmount || '');
    const normalizedPaidAmount = currencyRemoveMaskToString(paidAmount || '');
    if (!gainDate || Number(normalizedNegotiatedAmount) <= 0) {
      toast({
        title: 'Campos obrigatorios',
        description: 'Informe a data do ganho e um valor negociado maior que zero.',
        variant: 'destructive',
      });
      return;
    }

    if (Number(normalizedPaidAmount || '0') > Number(normalizedNegotiatedAmount || '0')) {
      toast({
        title: 'Valores inconsistentes',
        description: 'A entrada inicial nao pode ser maior que o valor negociado.',
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
          setWinDialogOpen(false);
          toast({
            title: 'Ganho registrado',
            description: 'A proposta foi marcada como ganho e o financeiro foi preparado para recebimentos parciais.',
          });
        },
        onError: (error: unknown) => {
          toast({
            title: 'Erro ao registrar ganho',
            description: getErrorMessage(error, 'Nao foi possivel registrar o ganho da proposta.'),
            variant: 'destructive',
          });
        },
      }
    );
  };

  /**
   * handleConfirmLoss
   * pt-BR: Confirma a perda da proposta e envia data/motivo ao backend.
   * en-US: Confirms the proposal loss and sends loss date/reason to the backend.
   */
  const handleConfirmLoss = () => {
    if (!enrollmentId || updateEnrollmentStatusMutation.isPending) return;
    if (!lossDate || !lossReason) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Informe a data da perda e o motivo da perda.',
        variant: 'destructive',
      });
      return;
    }

    updateEnrollmentStatusMutation.mutate(
      {
        id: String(enrollmentId),
        status: 'p',
        loss_date: lossDate,
        loss_reason: lossReason,
        loss_observation: lossObservation.trim() || undefined,
      },
      {
        onSuccess: () => {
          setLossDialogOpen(false);
          toast({
            title: 'Perda registrada',
            description: 'A proposta foi marcada como perda com os dados informados.',
          });
        },
        onError: (error: unknown) => {
          toast({
            title: 'Erro ao registrar perda',
            description: getErrorMessage(error, 'Nao foi possivel registrar a perda da proposta.'),
            variant: 'destructive',
          });
        },
      }
    );
  };

  /**
   * resetAttendanceForm
   * pt-BR: Limpa o formulário do modal de atendimento para o próximo uso.
   * en-US: Clears the attendance modal form for the next use.
   */
  const resetAttendanceForm = () => {
    setChannel('whatsapp');
    setObservation('');
    setDuration('');
    setTagsText('');
    setCelularEnvio('');
  };

  /**
   * handleSubmitAttendance
   * pt-BR: Registra um novo atendimento vinculado ao cliente da proposta.
   * en-US: Registers a new attendance linked to the proposal's client.
   */
  const handleSubmitAttendance = () => {
    if (!clientId || registerAttendanceMutation.isPending) return;

    if ((channel === 'whatsapp' || channel === 'mensagem') && !celularEnvio.trim()) {
      toast({
        title: 'Número do WhatsApp obrigatório',
        description: 'Por favor, informe o número de celular para envio da mensagem.',
        variant: 'destructive',
      });
      return;
    }

    const payload: CreateClientAttendanceInput = {
      channel: channel || 'whatsapp',
      observation: observation.trim() || undefined,
      metadata: {
        duration: duration ? Number(duration) : undefined,
        tags: tagsText
          ? tagsText.split(',').map((item) => item.trim()).filter(Boolean)
          : undefined,
      },
      enviar_whatsapp: (channel === 'whatsapp' || channel === 'mensagem'),
      celular_envio: (channel === 'whatsapp' || channel === 'mensagem') ? celularEnvio.trim() : undefined,
    };

    registerAttendanceMutation.mutate(
      { clientId: String(clientId), data: payload },
      {
        onSuccess: (response: any) => {
          setDialogOpen(false);
          resetAttendanceForm();
          
          if (response?.whatsapp_sent) {
            toast({
              title: 'Atendimento registrado',
              description: 'O atendimento foi salvo e a mensagem WhatsApp enviada com sucesso.',
            });
          } else if (response?.whatsapp_error) {
            toast({
              title: 'Atendimento salvo com alerta',
              description: `Atendimento salvo, mas ocorreu um erro no WhatsApp: ${response.whatsapp_error}`,
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Atendimento registrado',
              description: 'O evento de atendimento foi salvo com sucesso.',
            });
          }
        },
        onError: (error: unknown) => {
          toast({
            title: 'Erro ao registrar atendimento',
            description: getErrorMessage(error, 'Nao foi possivel registrar o atendimento.'),
            variant: 'destructive',
          });
        },
      }
    );
  };

  /**
   * handleOpenReceiveDialog
   * pt-BR: Abre o modal para registrar uma nova parcela da proposta ganha.
   * en-US: Opens the modal to register a new installment for the won proposal.
   */
  const handleOpenReceiveDialog = () => {
    if (!currentFinancialAccountId) {
      toast({
        title: 'Financeiro indisponivel',
        description: 'Esta proposta ainda nao possui uma conta financeira vinculada.',
        variant: 'destructive',
      });
      return;
    }

    resetReceiveForm();
    setReceiveDialogOpen(true);
  };

  /**
   * handleEditReceivePayment
   * pt-BR: Carrega uma parcela existente no modal para manutencao.
   * en-US: Loads an existing installment into the modal for maintenance.
   */
  const handleEditReceivePayment = (payment: ProposalGainPaymentItem) => {
    if (!currentFinancialAccountId || !payment?.id) return;

    setEditingPaymentId(String(payment.id));
    setReceiveDate(getPaymentDateValue(payment) || new Date().toISOString().slice(0, 10));
    setReceiveAmount(formatCurrencyInputValue(payment.amount));
    setReceiveMethod((getPaymentMethodValue(payment) || PaymentMethod.OTHER) as PaymentMethod);
    setReceiveNotes(payment.notes || '');
    setReceiveDialogOpen(true);
  };

  /**
   * refreshProposalFinancialData
   * pt-BR: Revalida caches relacionados a proposta, logs e financeiro apos alteracoes.
   * en-US: Revalidates proposal, logs and financial caches after changes.
   */
  const refreshProposalFinancialData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['enrollments'] }),
      queryClient.invalidateQueries({ queryKey: ['enrollments', 'detail', String(enrollmentId)] }),
      queryClient.invalidateQueries({ queryKey: ['event-logs'] }),
      queryClient.invalidateQueries({ queryKey: ['accounts-receivable'] }),
    ]);
  };

  /**
   * handleSubmitReceivePayment
   * pt-BR: Registra uma nova parcela no financeiro e atualiza proposta e histórico.
   * en-US: Registers a new financial installment and refreshes the proposal and history.
   */
  const handleSubmitReceivePayment = async () => {
    if (!currentFinancialAccountId || isSubmittingPayment) return;

    const normalizedReceiveAmount = Number(currencyRemoveMaskToString(receiveAmount || '0'));
    const currentEditingAmount = Number(editingPayment?.amount || 0);
    const maxAllowedAmount = editingPaymentId ? remainingGainAmount + currentEditingAmount : remainingGainAmount;
    if (!receiveDate || normalizedReceiveAmount <= 0) {
      toast({
        title: 'Campos obrigatorios',
        description: 'Informe a data do recebimento e um valor maior que zero.',
        variant: 'destructive',
      });
      return;
    }

    if (maxAllowedAmount > 0 && normalizedReceiveAmount > maxAllowedAmount) {
      toast({
        title: 'Valor acima do saldo',
        description: editingPaymentId
          ? 'A parcela editada nao pode ultrapassar o total disponivel da proposta.'
          : 'A parcela nao pode ser maior que o saldo pendente da proposta.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmittingPayment(true);
      if (editingPaymentId) {
        await financialService.accountsReceivable.updatePayment(
          currentFinancialAccountId,
          editingPaymentId,
          receiveDate,
          receiveMethod,
          normalizedReceiveAmount,
          receiveNotes.trim() || undefined
        );
      } else {
        await financialService.accountsReceivable.markAsReceived(
          currentFinancialAccountId,
          receiveDate,
          receiveMethod,
          normalizedReceiveAmount,
          receiveNotes.trim() || undefined
        );
      }

      await refreshProposalFinancialData();

      setReceiveDialogOpen(false);
      toast({
        title: editingPaymentId ? 'Parcela atualizada' : 'Parcela registrada',
        description: editingPaymentId
          ? 'A parcela foi atualizada e a proposta ja reflete o novo saldo.'
          : 'O novo recebimento foi salvo e a proposta foi atualizada.',
      });
    } catch (error) {
      toast({
        title: editingPaymentId ? 'Erro ao atualizar parcela' : 'Erro ao registrar parcela',
        description: getErrorMessage(
          error,
          editingPaymentId
            ? 'Nao foi possivel atualizar a parcela da proposta.'
            : 'Nao foi possivel registrar a nova parcela da proposta.'
        ),
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  /**
   * handleDeleteReceivePayment
   * pt-BR: Remove uma parcela da proposta apos confirmacao do usuario.
   * en-US: Deletes a proposal installment after user confirmation.
   */
  const handleDeleteReceivePayment = async (payment: ProposalGainPaymentItem) => {
    if (!currentFinancialAccountId || !payment?.id || isSubmittingPayment) return;
    const confirmed = window.confirm('Deseja realmente excluir esta parcela do financeiro?');
    if (!confirmed) return;

    try {
      setIsSubmittingPayment(true);
      await financialService.accountsReceivable.deletePayment(currentFinancialAccountId, String(payment.id));
      await refreshProposalFinancialData();

      toast({
        title: 'Parcela removida',
        description: 'A parcela foi excluida e o saldo da proposta foi recalculado.',
      });
    } catch (error) {
      toast({
        title: 'Erro ao remover parcela',
        description: getErrorMessage(error, 'Nao foi possivel remover a parcela da proposta.'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  return (
    <>
      <Card className="border-none shadow-sm rounded-2xl overflow-hidden bg-zinc-50/30">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Headset className="h-4 w-4" />
            </div>
            <CardTitle className="text-xs font-bold uppercase tracking-widest">Atendimento</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-5 space-y-5">
          <div className="space-y-2 rounded-xl border border-border/50 bg-white dark:bg-zinc-900 p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                Status da proposta
              </span>
              <Badge variant="outline" className={cn('font-semibold', statusMeta.badgeClass)}>
                {statusMeta.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{statusMeta.description}</p>
            {statusMeta.code === 'g' && (
              <div className="pt-2 space-y-1 text-xs text-muted-foreground">
                <div>
                  <span className="font-semibold text-foreground">Data do ganho:</span>{' '}
                  {formatStatusDate(currentGainDate)}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Valor negociado:</span>{' '}
                  {currentNegotiatedAmount ? formatCurrencyBRL(currentNegotiatedAmount) : proposalAmountLabel || '—'}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Total recebido:</span>{' '}
                  {currentPaidAmount ? formatCurrencyBRL(currentPaidAmount) : '—'}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Saldo pendente:</span>{' '}
                  {currentRemainingAmount ? formatCurrencyBRL(currentRemainingAmount) : '—'}
                </div>
                {currentEntryAmount && (
                  <div>
                    <span className="font-semibold text-foreground">Entrada inicial:</span>{' '}
                    {formatCurrencyBRL(currentEntryAmount)}
                  </div>
                )}
                <div>
                  <span className="font-semibold text-foreground">Status financeiro:</span>{' '}
                  {getFinancialStatusLabel(currentFinancialStatus)}
                  {currentGainPayments.length > 0 ? ` • ${currentGainPayments.length} pagamento(s)` : ''}
                </div>
                {currentGainObservation && (
                  <div>
                    <span className="font-semibold text-foreground">Observacoes:</span>{' '}
                    {currentGainObservation}
                  </div>
                )}
                <div className="pt-2">
                  <div className="font-semibold text-foreground mb-2">Parcelas recebidas</div>
                  {currentGainPayments.length > 0 ? (
                    <div className="space-y-2">
                      {currentGainPayments.map((payment, index) => (
                        <div key={String(payment.id || index)} className="rounded-lg border border-border/60 bg-background/80 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-foreground">
                              {formatCurrencyBRL(payment.amount)}
                            </span>
                            <span>{formatStatusDate(getPaymentDateValue(payment))}</span>
                          </div>
                          <div className="mt-1 text-[11px]">
                            Forma: {getPaymentMethodLabel(getPaymentMethodValue(payment))}
                          </div>
                          {payment.notes && (
                            <div className="mt-1 text-[11px]">
                              Obs.: {payment.notes}
                            </div>
                          )}
                          {payment.id && (
                            <div className="mt-3 flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px]"
                                onClick={() => handleEditReceivePayment(payment)}
                                disabled={isSubmittingPayment}
                              >
                                Editar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-[11px] text-red-600"
                                onClick={() => handleDeleteReceivePayment(payment)}
                                disabled={isSubmittingPayment}
                              >
                                Excluir
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border/70 bg-background/60 p-3 text-[11px] text-muted-foreground">
                      Nenhuma parcela registrada ate o momento.
                    </div>
                  )}
                </div>
                <div className="pt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleOpenReceiveDialog}
                    disabled={!currentFinancialAccountId || remainingGainAmount <= 0 || isSubmittingPayment}
                    className="w-full"
                  >
                    Registrar parcela futura
                  </Button>
                  {!currentFinancialAccountId && (
                    <p className="mt-2 text-[11px] text-amber-700">
                      O financeiro desta proposta ainda nao foi vinculado.
                    </p>
                  )}
                  {currentFinancialAccountId && remainingGainAmount <= 0 && (
                    <p className="mt-2 text-[11px] text-emerald-700">
                      Esta proposta ja esta quitada no financeiro.
                    </p>
                  )}
                </div>
              </div>
            )}
            {statusMeta.code === 'p' && (currentLossDate || currentLossReason) && (
              <div className="pt-2 space-y-1 text-xs text-muted-foreground">
                <div>
                  <span className="font-semibold text-foreground">Data da perda:</span>{' '}
                  {formatStatusDate(currentLossDate)}
                </div>
                <div>
                  <span className="font-semibold text-foreground">Motivo:</span>{' '}
                  {currentLossReason || '—'}
                </div>
                {currentLossObservation && (
                  <div>
                    <span className="font-semibold text-foreground">Observações:</span>{' '}
                    {currentLossObservation}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2">
            <Button
              variant={statusMeta.code === 'a' ? 'default' : 'outline'}
              onClick={() => handleChangeStatus('a')}
              disabled={updateEnrollmentStatusMutation.isPending}
            >
              <CircleDot className="h-4 w-4" />
              Marcar atendimento
            </Button>
            <Button
              variant={statusMeta.code === 'g' ? 'default' : 'outline'}
              onClick={() => handleChangeStatus('g')}
              disabled={
                updateEnrollmentStatusMutation.isPending || 
                !['aprovado', 'assinado'].includes(String(meta?.status_assinatura || '').toLowerCase())
              }
              className={cn(statusMeta.code === 'g' && 'bg-emerald-600 hover:bg-emerald-700')}
            >
              <CheckCircle2 className="h-4 w-4" />
              Marcar ganho
            </Button>
            <Button
              variant={statusMeta.code === 'p' ? 'destructive' : 'outline'}
              onClick={() => handleChangeStatus('p')}
              disabled={updateEnrollmentStatusMutation.isPending}
            >
              <XCircle className="h-4 w-4" />
              Marcar perda
            </Button>
          </div>

          <div className="rounded-xl border border-dashed border-border/60 bg-background/70 p-4 space-y-3">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                Eventos de atendimento
              </span>
              <p className="text-sm text-muted-foreground">
                Registre contatos e acompanhamentos feitos com o cliente desta proposta.
              </p>
            </div>

            <Button
              className="w-full"
              variant="secondary"
              onClick={() => setDialogOpen(true)}
              disabled={!clientId}
            >
              <MessageSquareText className="h-4 w-4" />
              Registrar atendimento
            </Button>

            {!clientId && (
              <p className="text-xs text-destructive">
                Esta proposta não possui um cliente vinculado para receber atendimentos.
              </p>
            )}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                Últimos registros
              </span>
              <Badge variant="secondary">{attendances.length}</Badge>
            </div>

            {isLoadingAttendances && (
              <div className="rounded-xl border border-border/50 bg-white dark:bg-zinc-900 p-4 text-sm text-muted-foreground">
                Carregando atendimentos...
              </div>
            )}

            {!isLoadingAttendances && attendances.length === 0 && (
              <div className="rounded-xl border border-border/50 bg-white dark:bg-zinc-900 p-4 text-sm text-muted-foreground">
                Nenhum atendimento registrado para esta proposta ainda.
              </div>
            )}

            {!isLoadingAttendances && attendances.map((attendance) => (
              <div
                key={String(attendance.id)}
                className="rounded-xl border border-border/50 bg-white dark:bg-zinc-900 p-4 shadow-sm space-y-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="outline">{getChannelLabel(attendance.channel)}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {attendance.created_at ? formatDate(attendance.created_at) : '-'}
                  </span>
                </div>
                <p className="text-sm text-foreground">
                  {attendance.observation || 'Atendimento registrado sem observação.'}
                </p>
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                  <span>Atendente: {attendance?.attendant?.name || 'Sistema'}</span>
                  {attendance?.metadata?.duration ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="h-3.5 w-3.5" />
                      {attendance.metadata.duration} min
                    </span>
                  ) : (
                    <span />
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetAttendanceForm();
        }}
      >
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Registrar atendimento</DialogTitle>
            <DialogDescription>
              {clientName
                ? `Adicione um novo atendimento para ${clientName}.`
                : 'Adicione um novo atendimento para o cliente desta proposta.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Canal</label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o canal" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="mensagem">Mensagem (WhatsApp API)</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="chat">Chat</SelectItem>
                    <SelectItem value="in_person">Presencial</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Duração opcional
                </label>
                <Input
                  type="number"
                  min={0}
                  placeholder="15"
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Tags opcionais
              </label>
              <Input
                placeholder="retorno, prioridade, negociação"
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Observação
                </label>
                <div className="flex gap-2">
                  {linkAssinatura && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg font-semibold"
                      onClick={() => {
                        const nome = clientName || 'Cliente';
                        setObservation(`Olá, *${nome}*! Segue o link para visualizar e assinar a sua proposta comercial: ${linkAssinatura}`);
                        if (channel !== 'whatsapp' && channel !== 'mensagem') {
                          setChannel('mensagem');
                        }
                      }}
                    >
                      Modelo Assinatura
                    </Button>
                  )}
                  {pdfUrl && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 rounded-lg font-semibold"
                      onClick={() => {
                        const nome = clientName || 'Cliente';
                        setObservation(`Olá, *${nome}*! Segue o link do PDF com os detalhes da sua proposta comercial: ${pdfUrl}`);
                        if (channel !== 'whatsapp' && channel !== 'mensagem') {
                          setChannel('mensagem');
                        }
                      }}
                    >
                      Modelo PDF
                    </Button>
                  )}
                </div>
              </div>
              <Textarea
                placeholder="Descreva o contato, retorno combinado, objeções ou próximos passos."
                value={observation}
                onChange={(event) => setObservation(event.target.value)}
                className="min-h-[140px]"
              />
            </div>

            {(channel === 'whatsapp' || channel === 'mensagem') && (
              <div className="p-3 rounded-xl border bg-emerald-50/30 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-900/30 space-y-2">
                <label className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-400">
                  Celular para Envio (WhatsApp)
                </label>
                <Input
                  placeholder="Ex.: 5511999999999"
                  value={celularEnvio}
                  onChange={(e) => setCelularEnvio(e.target.value)}
                  className="bg-white dark:bg-zinc-950 border-emerald-200 dark:border-emerald-900/60 focus-visible:ring-emerald-500"
                />
                <p className="text-[10px] text-muted-foreground leading-snug">
                  A mensagem de atendimento será enviada automaticamente via WhatsApp API (ChatGuru).
                  Você pode editar o número se necessário (DDI + DDD + número).
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitAttendance} disabled={!clientId || registerAttendanceMutation.isPending}>
              Salvar atendimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={receiveDialogOpen}
        onOpenChange={(open) => {
          setReceiveDialogOpen(open);
          if (!open) resetReceiveForm();
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>{editingPaymentId ? 'Editar parcela da proposta' : 'Registrar parcela da proposta'}</DialogTitle>
            <DialogDescription>
              {editingPaymentId
                ? 'Ajuste os dados da parcela e mantenha o saldo da proposta sincronizado.'
                : 'Lance um novo recebimento sem sair da visualizacao da proposta.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  Negociado
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {currentNegotiatedAmount ? formatCurrencyBRL(currentNegotiatedAmount) : proposalAmountLabel || '—'}
                </div>
              </div>
              <div className="rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                  Recebido
                </div>
                <div className="text-sm font-semibold text-foreground">
                  {currentPaidAmount ? formatCurrencyBRL(currentPaidAmount) : '—'}
                </div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-700/80">
                  Saldo atual
                </div>
                <div className="text-sm font-semibold text-amber-900">
                  {currentRemainingAmount ? formatCurrencyBRL(currentRemainingAmount) : '—'}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Data do recebimento
              </label>
              <Input type="date" value={receiveDate} onChange={(event) => setReceiveDate(event.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Valor da parcela
              </label>
              <Input
                inputMode="numeric"
                placeholder="R$ 0,00"
                value={receiveAmount}
                onChange={(event) => setReceiveAmount(currencyApplyMask(event.target.value))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Forma de pagamento
              </label>
              <Select value={receiveMethod} onValueChange={(value) => setReceiveMethod(value as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={PaymentMethod.CASH}>Dinheiro</SelectItem>
                  <SelectItem value={PaymentMethod.PIX}>PIX</SelectItem>
                  <SelectItem value={PaymentMethod.BANK_TRANSFER}>Transferência Bancária</SelectItem>
                  <SelectItem value={PaymentMethod.DEBIT_CARD}>Cartão de Débito</SelectItem>
                  <SelectItem value={PaymentMethod.CREDIT_CARD}>Cartão de Crédito</SelectItem>
                  <SelectItem value={PaymentMethod.BOLETO}>Boleto</SelectItem>
                  <SelectItem value={PaymentMethod.CHECK}>Cheque</SelectItem>
                  <SelectItem value={PaymentMethod.OTHER}>Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Observacoes
              </label>
              <Textarea
                placeholder="Ex.: segunda parcela, pagamento parcial, acordo comercial."
                value={receiveNotes}
                onChange={(event) => setReceiveNotes(event.target.value)}
                className="min-h-[110px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitReceivePayment} disabled={isSubmittingPayment || !currentFinancialAccountId}>
              {editingPaymentId ? 'Salvar alteracoes' : 'Salvar parcela'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={winDialogOpen}
        onOpenChange={(open) => {
          setWinDialogOpen(open);
          if (open) {
            setGainDate(currentGainDate || new Date().toISOString().slice(0, 10));
            setNegotiatedAmount(
              currentNegotiatedAmount
                ? formatCurrencyInputValue(currentNegotiatedAmount)
                : (proposalAmountLabel || '')
            );
            setPaidAmount(currentEntryAmount ? formatCurrencyInputValue(currentEntryAmount) : '');
            setGainObservation(currentGainObservation || '');
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Registrar ganho da proposta</DialogTitle>
            <DialogDescription>
              Informe a data do ganho, o valor negociado e a entrada inicial para criar o crediario da proposta.
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
                Deixe zerado se a proposta foi ganha, mas ainda nao houve recebimento.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Observacoes ou comentarios
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
            <Button variant="outline" onClick={() => setWinDialogOpen(false)}>
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

      <Dialog
        open={lossDialogOpen}
        onOpenChange={(open) => {
          setLossDialogOpen(open);
          if (open) {
            setLossDate(currentLossDate || new Date().toISOString().slice(0, 10));
            setLossReason(currentLossReason || '');
            setLossObservation(currentLossObservation || '');
          }
        }}
      >
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Registrar perda da proposta</DialogTitle>
            <DialogDescription>
              Informe a data e o motivo da perda antes de encerrar a proposta como perdida.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Data da perda
              </label>
              <Input type="date" value={lossDate} onChange={(event) => setLossDate(event.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Motivo da perda
              </label>
              <Select value={lossReason} onValueChange={setLossReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo da perda" />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_LOSS_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {reason}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Observações
              </label>
              <Textarea
                placeholder="Descreva mais detalhes sobre a perda da proposta."
                value={lossObservation}
                onChange={(event) => setLossObservation(event.target.value)}
                className="min-h-[120px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setLossDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmLoss} disabled={updateEnrollmentStatusMutation.isPending}>
              Confirmar perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
