import React, { useMemo, useState } from 'react';
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
import { useRegisterClientAttendance, useClientAttendances } from '@/hooks/clients';
import { useUpdateEnrollmentStatus } from '@/hooks/enrollments';
import { useToast } from '@/hooks/use-toast';
import { cn, formatDate } from '@/lib/utils';
import { CreateClientAttendanceInput } from '@/types/attendance';
import { CheckCircle2, CircleDot, Clock3, Headset, MessageSquareText, XCircle } from 'lucide-react';

interface ProposalAttendanceCardProps {
  enrollmentId: string;
  clientId?: string;
  clientName?: string;
  status?: string;
  meta?: Record<string, any>;
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
    case 'in_person':
      return 'Presencial';
    case 'email':
      return 'E-mail';
    default:
      return normalized ? normalized : 'Canal não informado';
  }
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
}: ProposalAttendanceCardProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lossDialogOpen, setLossDialogOpen] = useState(false);
  const [channel, setChannel] = useState('whatsapp');
  const [observation, setObservation] = useState('');
  const [duration, setDuration] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [lossDate, setLossDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [lossReason, setLossReason] = useState('');
  const [lossObservation, setLossObservation] = useState('');

  const statusMeta = useMemo(() => getStatusMeta(status), [status]);
  const currentLossDate = typeof meta?.data_perda === 'string' ? meta.data_perda : '';
  const currentLossReason = typeof meta?.motivo_perda === 'string' ? meta.motivo_perda : '';
  const currentLossObservation = typeof meta?.observacao_perda === 'string' ? meta.observacao_perda : '';
  const { data: attendancesResponse, isLoading: isLoadingAttendances } = useClientAttendances(
    String(clientId || ''),
    { per_page: 5 },
    { enabled: !!clientId, staleTime: 60_000 }
  );
  const updateEnrollmentStatusMutation = useUpdateEnrollmentStatus();
  const registerAttendanceMutation = useRegisterClientAttendance();

  const attendances = useMemo(() => {
    return Array.isArray(attendancesResponse?.data) ? attendancesResponse.data : [];
  }, [attendancesResponse?.data]);

  /**
   * handleChangeStatus
   * pt-BR: Atualiza o status da proposta para atendimento, ganho ou perda.
   * en-US: Updates proposal status to service, won or lost.
   */
  const handleChangeStatus = (nextStatus: 'a' | 'g' | 'p') => {
    if (!enrollmentId || updateEnrollmentStatusMutation.isPending) return;

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
        onError: (error: any) => {
          toast({
            title: 'Erro ao atualizar status',
            description: String(error?.message || 'Não foi possível atualizar a proposta.'),
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
        onError: (error: any) => {
          toast({
            title: 'Erro ao registrar perda',
            description: String(error?.message || 'Não foi possível registrar a perda da proposta.'),
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
  };

  /**
   * handleSubmitAttendance
   * pt-BR: Registra um novo atendimento vinculado ao cliente da proposta.
   * en-US: Registers a new attendance linked to the proposal's client.
   */
  const handleSubmitAttendance = () => {
    if (!clientId || registerAttendanceMutation.isPending) return;

    const payload: CreateClientAttendanceInput = {
      channel: channel || 'whatsapp',
      observation: observation.trim() || undefined,
      metadata: {
        duration: duration ? Number(duration) : undefined,
        tags: tagsText
          ? tagsText.split(',').map((item) => item.trim()).filter(Boolean)
          : undefined,
      },
    };

    registerAttendanceMutation.mutate(
      { clientId: String(clientId), data: payload },
      {
        onSuccess: () => {
          setDialogOpen(false);
          resetAttendanceForm();
          toast({
            title: 'Atendimento registrado',
            description: 'O evento de atendimento foi salvo com sucesso.',
          });
        },
        onError: (error: any) => {
          toast({
            title: 'Erro ao registrar atendimento',
            description: String(error?.message || 'Não foi possível registrar o atendimento.'),
            variant: 'destructive',
          });
        },
      }
    );
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
            {statusMeta.code === 'p' && (currentLossDate || currentLossReason) && (
              <div className="pt-2 space-y-1 text-xs text-muted-foreground">
                <div>
                  <span className="font-semibold text-foreground">Data da perda:</span>{' '}
                  {currentLossDate ? currentLossDate.split('-').reverse().join('/') : '—'}
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
              disabled={updateEnrollmentStatusMutation.isPending}
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

            {!isLoadingAttendances && attendances.map((attendance: any) => (
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
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Observação
              </label>
              <Textarea
                placeholder="Descreva o contato, retorno combinado, objeções ou próximos passos."
                value={observation}
                onChange={(event) => setObservation(event.target.value)}
                className="min-h-[140px]"
              />
            </div>
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
