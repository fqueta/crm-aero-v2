import React, { useEffect, useMemo, useState } from 'react';
import { EnrollmentRecord } from '@/types/enrollments';
import { scheduledCommunicationsService } from '@/services/scheduledCommunicationsService';
import { ScheduledCommunicationChannel } from '@/types/scheduledCommunications';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface ScheduledCommunicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollments: EnrollmentRecord[];
  onSuccess?: () => void;
}

/**
 * getDefaultScheduledAt
 * pt-BR: Retorna uma data/hora local inicial para o campo de agendamento.
 * en-US: Returns an initial local datetime for the scheduling field.
 */
function getDefaultScheduledAt(): string {
  const nextHour = new Date();
  nextHour.setMinutes(0, 0, 0);
  nextHour.setHours(nextHour.getHours() + 1);
  const year = nextHour.getFullYear();
  const month = String(nextHour.getMonth() + 1).padStart(2, '0');
  const day = String(nextHour.getDate()).padStart(2, '0');
  const hours = String(nextHour.getHours()).padStart(2, '0');
  const minutes = String(nextHour.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * getDefaultMessageByChannel
 * pt-BR: Retorna a mensagem padrão conforme o canal escolhido.
 * en-US: Returns the default message according to the selected channel.
 */
function getDefaultMessageByChannel(channel: ScheduledCommunicationChannel): string {
  if (channel === 'manual') {
    return 'Realizar contato com {nome} sobre a proposta {id_proposta} do curso {curso}.';
  }

  return [
    'Olá, {nome}!',
    '',
    'Segue o link para visualizar e assinar a sua proposta comercial:',
    '{link_assinatura}',
    '',
    'Curso: {curso} — {turma}',
    'Valor: {valor_proposta} | Parcelas: {parcelas}x de {valor_parcela}',
    '',
    'Período: {data_inicio} a {data_fim}',
  ].join('\n');
}

/**
 * ScheduledCommunicationDialog
 * pt-BR: Modal para agendar envios por e-mail ou tarefas manuais de atendimento.
 * en-US: Modal to schedule email sends or manual attendance tasks.
 */
export function ScheduledCommunicationDialog({
  open,
  onOpenChange,
  enrollments,
  onSuccess,
}: ScheduledCommunicationDialogProps) {
  const { toast } = useToast();
  const [channel, setChannel] = useState<ScheduledCommunicationChannel>('email');
  const [subject, setSubject] = useState('Sua proposta — {curso} — esta pronta para assinatura');
  const [message, setMessage] = useState(getDefaultMessageByChannel('email'));
  const [scheduledAt, setScheduledAt] = useState(getDefaultScheduledAt());
  const [tags, setTags] = useState('assinatura, proposta');
  const [createAttendanceLog, setCreateAttendanceLog] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const enrollmentIds = useMemo(
    () => enrollments.map((enrollment) => Number(enrollment.id)).filter((id) => Number.isFinite(id)),
    [enrollments]
  );

  /**
   * resetForm
   * pt-BR: Restaura os valores iniciais do modal para um novo agendamento.
   * en-US: Restores the modal initial values for a new schedule.
   */
  function resetForm() {
    setChannel('email');
    setSubject('Sua proposta — {curso} — esta pronta para assinatura');
    setMessage(getDefaultMessageByChannel('email'));
    setScheduledAt(getDefaultScheduledAt());
    setTags('assinatura, proposta');
    setCreateAttendanceLog(true);
    setIsSubmitting(false);
  }

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  /**
   * handleChannelChange
   * pt-BR: Atualiza o canal e sugere uma mensagem padrao apropriada.
   * en-US: Updates the channel and suggests an appropriate default message.
   */
  function handleChannelChange(value: string) {
    const nextChannel = value as ScheduledCommunicationChannel;
    setChannel(nextChannel);
    setMessage(getDefaultMessageByChannel(nextChannel));
    if (nextChannel === 'manual') {
      setSubject('');
      return;
    }

    setSubject('Sua proposta — {curso} — esta pronta para assinatura');
  }

  /**
   * handleSubmit
   * pt-BR: Envia o lote selecionado para criacao dos agendamentos.
   * en-US: Sends the selected batch to create the scheduled communications.
   */
  async function handleSubmit() {
    if (enrollmentIds.length === 0) {
      toast({
        title: 'Nenhuma proposta selecionada',
        description: 'Selecione pelo menos uma proposta para agendar.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await scheduledCommunicationsService.createBatch({
        channel,
        subject: channel === 'email' ? subject : undefined,
        message,
        scheduled_at: scheduledAt,
        matricula_ids: enrollmentIds,
        tags: tags.split(',').map((tag) => tag.trim()).filter(Boolean),
        create_attendance_log: createAttendanceLog,
        app_url: window.location.origin,
      });

      toast({
        title: 'Agendamento criado',
        description: response.summary.skipped_count > 0
          ? `${response.summary.created_count} item(ns) criados e ${response.summary.skipped_count} ignorado(s).`
          : `${response.summary.created_count} item(ns) criados com sucesso.`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast({
        title: 'Erro ao agendar',
        description: String(error?.message || 'Nao foi possivel concluir o agendamento.'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Agendar atendimento ou envio</DialogTitle>
          <DialogDescription>
            Programe disparos por e-mail via Brevo ou tarefas manuais para as propostas selecionadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Propostas selecionadas
              </span>
              <Badge variant="secondary">{enrollments.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-2">
              {enrollments.slice(0, 8).map((enrollment) => {
                const title = (enrollment as any)?.cliente_nome || enrollment.student_name || enrollment.name || `Proposta ${enrollment.id}`;
                return (
                  <Badge key={String(enrollment.id)} variant="outline" className="max-w-full">
                    #{String(enrollment.id)} - {title}
                  </Badge>
                );
              })}
              {enrollments.length > 8 && (
                <Badge variant="outline">+{enrollments.length - 8} restante(s)</Badge>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Canal
              </label>
              <Select value={channel} onValueChange={handleChannelChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">E-mail (Brevo)</SelectItem>
                  <SelectItem value="manual">Atendimento manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Data e hora
              </label>
              <Input type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} />
            </div>
          </div>

          {channel === 'email' && (
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Assunto do e-mail
              </label>
              <Input
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Sua proposta comercial esta pronta para assinatura"
              />
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Mensagem padrao
            </label>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="min-h-[180px]"
              placeholder="Use placeholders: {nome}, {curso}, {turma}, {link_assinatura}, {id_proposta}, {valor_proposta}, {desconto}, {subtotal}, {parcelas}, {valor_parcela}, {data_inicio}, {data_fim}, {carga_horaria}, {telefone}, {documento}"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Tags opcionais
            </label>
            <Input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="assinatura, proposta, retorno"
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-3 py-3">
            <div className="space-y-1">
              <Label htmlFor="create-attendance-log">Registrar no historico de atendimento</Label>
              <p className="text-xs text-muted-foreground">
                Quando executado, o sistema tambem cria um evento no historico do cliente.
              </p>
            </div>
            <Switch
              id="create-attendance-log"
              checked={createAttendanceLog}
              onCheckedChange={setCreateAttendanceLog}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || enrollmentIds.length === 0}>
            {isSubmitting ? 'Agendando...' : 'Confirmar agendamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
