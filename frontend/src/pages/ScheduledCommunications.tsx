import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Send, Ban, RotateCcw, CalendarClock, AlertTriangle, Trash2, ExternalLink, Eye, MousePointerClick, CheckCircle2, Clock, FileText, Bug } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { scheduledCommunicationsService } from '@/services/scheduledCommunicationsService';
import { ScheduledCommunicationRecord, ScheduledCommunicationStatus } from '@/types/scheduledCommunications';
import { useToast } from '@/hooks/use-toast';

/**
 * formatDateTime
 * pt-BR: Formata data/hora em padrao pt-BR para a grade operacional.
 * en-US: Formats datetime in pt-BR standard for the operational grid.
 */
function formatDateTime(value?: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

/**
 * getStatusVariantClass
 * pt-BR: Retorna classes visuais para os status do painel de agendamentos.
 * en-US: Returns visual classes for statuses in the scheduling panel.
 */
function getStatusVariantClass(status: ScheduledCommunicationStatus): string {
  if (status === 'sent') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'failed') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status === 'cancelled') return 'bg-zinc-100 text-zinc-700 border-zinc-200';
  if (status === 'processing') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

/**
 * getStatusLabel
 * pt-BR: Traduz o status tecnico para um rotulo amigavel no painel.
 * en-US: Translates the technical status into a friendly label in the panel.
 */
function getStatusLabel(status: ScheduledCommunicationStatus): string {
  if (status === 'sent') return 'Executado';
  if (status === 'failed') return 'Falhou';
  if (status === 'cancelled') return 'Cancelado';
  if (status === 'processing') return 'Processando';
  return 'Agendado';
}

/**
 * getTrackingSummary
 * pt-BR: Extrai resumo de tracking do metadata para exibição rápida.
 * en-US: Extracts tracking summary from metadata for quick display.
 */
function getTrackingSummary(metadata?: Record<string, any> | null): {
  opened: boolean;
  clicked: boolean;
  delivered: boolean;
  lastEvent: string;
  lastEventAt: string;
} {
  const summary = metadata?.summary || {};
  const tracking = (metadata?.tracking || []) as Array<Record<string, any>>;
  return {
    opened: tracking.some((t: any) => ['opened', 'unique_opened'].includes(t.event)),
    clicked: tracking.some((t: any) => ['click', 'unique_click'].includes(t.event)),
    delivered: tracking.some((t: any) => t.event === 'delivered'),
    lastEvent: summary.last_event || '-',
    lastEventAt: summary.last_event_at || '-',
  };
}

/**
 * ScheduledCommunicationsPage
 * pt-BR: Painel administrativo para acompanhar envios e atendimentos agendados.
 * en-US: Administrative panel to track scheduled sends and attendances.
 */
export default function ScheduledCommunicationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [status, setStatus] = useState<'all' | ScheduledCommunicationStatus>('all');
  const [channel, setChannel] = useState<'all' | 'email' | 'manual'>('all');
  const [search, setSearch] = useState('');
  const [scheduledFrom, setScheduledFrom] = useState('');
  const [scheduledTo, setScheduledTo] = useState('');
  const [detailItem, setDetailItem] = useState<ScheduledCommunicationRecord | null>(null);

  const listQuery = useQuery({
    queryKey: ['scheduled-communications', status, channel, search, scheduledFrom, scheduledTo],
    queryFn: () => scheduledCommunicationsService.list({
      per_page: 100,
      status,
      channel,
      search,
      scheduled_from: scheduledFrom || undefined,
      scheduled_to: scheduledTo || undefined,
    }),
  });

  const items = listQuery.data?.data || [];

  const metrics = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        acc.total += 1;
        if (item.status === 'scheduled') acc.scheduled += 1;
        if (item.status === 'processing') acc.processing += 1;
        if (item.status === 'sent') acc.sent += 1;
        if (item.status === 'failed') acc.failed += 1;
        return acc;
      },
      { total: 0, scheduled: 0, processing: 0, sent: 0, failed: 0 }
    );
  }, [items]);

  /**
   * refreshList
   * pt-BR: Atualiza a listagem principal apos acoes de operacao.
   * en-US: Refreshes the main list after operational actions.
   */
  function refreshList() {
    queryClient.invalidateQueries({ queryKey: ['scheduled-communications'] });
  }

  const cancelMutation = useMutation({
    mutationFn: (id: number | string) => scheduledCommunicationsService.cancel(id),
    onSuccess: () => {
      toast({ title: 'Agendamento cancelado' });
      refreshList();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao cancelar',
        description: String(error?.message || 'Nao foi possivel cancelar.'),
        variant: 'destructive',
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: number | string) => scheduledCommunicationsService.retry(id),
    onSuccess: () => {
      toast({ title: 'Agendamento reenfileirado' });
      refreshList();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao reenfileirar',
        description: String(error?.message || 'Nao foi possivel reenfileirar.'),
        variant: 'destructive',
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number | string) => scheduledCommunicationsService.remove(id),
    onSuccess: () => {
      toast({ title: 'Agendamento removido' });
      refreshList();
    },
    onError: (error: any) => {
      toast({
        title: 'Erro ao remover',
        description: String(error?.message || 'Nao foi possivel remover.'),
        variant: 'destructive',
      });
    },
  });

  /**
   * openProposal
   * pt-BR: Navega para a visualizacao da proposta ligada ao agendamento.
   * en-US: Navigates to the proposal view linked to the scheduled communication.
   */
  function openProposal(item: ScheduledCommunicationRecord) {
    if (!item.matricula_id) return;
    navigate(`/admin/sales/proposals/view/${encodeURIComponent(String(item.matricula_id))}`);
  }

  return (
    <div className="container mx-auto max-w-[1600px] space-y-6 pb-20 pt-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Painel de agendamentos</h1>
        <p className="text-muted-foreground">
          Acompanhe os envios e atendimentos agendados, com status, erros e acoes operacionais.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold">{metrics.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Agendados</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-amber-600">{metrics.scheduled}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Processando</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-blue-600">{metrics.processing}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Executados</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-emerald-600">{metrics.sent}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Falhas</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-bold text-rose-600">{metrics.failed}</CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por cliente, e-mail, assunto ou proposta"
            />
            <Select value={status} onValueChange={(value) => setStatus(value as 'all' | ScheduledCommunicationStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="scheduled">Agendado</SelectItem>
                <SelectItem value="processing">Processando</SelectItem>
                <SelectItem value="sent">Executado</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={channel} onValueChange={(value) => setChannel(value as 'all' | 'email' | 'manual')}>
              <SelectTrigger>
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os canais</SelectItem>
                <SelectItem value="email">E-mail (Brevo)</SelectItem>
                <SelectItem value="manual">Atendimento manual</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={scheduledFrom} onChange={(event) => setScheduledFrom(event.target.value)} />
            <Input type="date" value={scheduledTo} onChange={(event) => setScheduledTo(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Execucao dos agendamentos</CardTitle>
          <Button variant="outline" onClick={() => refreshList()} disabled={listQuery.isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${listQuery.isFetching ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {listQuery.isLoading ? (
            <div className="py-10 text-sm text-muted-foreground">Carregando agendamentos...</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-sm text-muted-foreground">
              Nenhum agendamento encontrado para os filtros informados.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Proposta</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Agendado para</TableHead>
                    <TableHead>Executado em</TableHead>
                    <TableHead>Erro</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const clientName = item.recipient_name || item.matricula?.cliente?.name || item.client?.name || '-';
                    const courseName = item.payload?.course_name || item.matricula?.curso?.nome || item.matricula?.curso?.titulo || '-';
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">#{item.id}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{clientName}</span>
                            <span className="text-xs text-muted-foreground">{item.recipient_email || '-'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>#{item.matricula_id || '-'}</span>
                            <span className="text-xs text-muted-foreground">{courseName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.channel === 'email' ? 'E-mail' : 'Manual'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusVariantClass(item.status)}>
                            {getStatusLabel(item.status)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.channel === 'email' && item.metadata ? (
                            <div className="flex items-center gap-2">
                              {(() => {
                                const tracking = getTrackingSummary(item.metadata);
                                return (
                                  <>
                                    {tracking.delivered ? (
                                      <span title="Entregue">
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                      </span>
                                    ) : item.status === 'sent' ? (
                                      <span title="Aguardando confirmação">
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                      </span>
                                    ) : null}
                                    {tracking.opened && (
                                      <span title="Visualizado">
                                        <Eye className="h-4 w-4 text-blue-500" />
                                      </span>
                                    )}
                                    {tracking.clicked && (
                                      <span title="Clicou">
                                        <MousePointerClick className="h-4 w-4 text-purple-500" />
                                      </span>
                                    )}
                                    {!tracking.delivered && !tracking.opened && !tracking.clicked && (
                                      <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                  </>
                                );
                              })()}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CalendarClock className="h-4 w-4 text-muted-foreground" />
                            {formatDateTime(item.scheduled_at)}
                          </div>
                        </TableCell>
                        <TableCell>{formatDateTime(item.sent_at || item.processed_at)}</TableCell>
                        <TableCell className="max-w-[320px]">
                          {item.last_error ? (
                            <div className="flex items-start gap-2 text-rose-600">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                              <span className="text-xs line-clamp-2">{item.last_error}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setDetailItem(item)} title="Ver detalhes">
                              <FileText className="h-4 w-4" />
                            </Button>
                            {!!item.matricula_id && (
                              <Button variant="ghost" size="icon" onClick={() => openProposal(item)} title="Ver proposta">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            )}
                            {item.status !== 'sent' && item.status !== 'cancelled' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => cancelMutation.mutate(item.id)}
                                disabled={cancelMutation.isPending}
                                title="Cancelar agendamento"
                              >
                                <Ban className="h-4 w-4 text-amber-600" />
                              </Button>
                            )}
                            {(item.status === 'failed' || item.status === 'cancelled') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => retryMutation.mutate(item.id)}
                                disabled={retryMutation.isPending}
                                title={item.status === 'failed' ? 'Reagendar' : 'Reenviar'}
                              >
                                {item.status === 'failed' ? (
                                  <RotateCcw className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <Send className="h-4 w-4 text-blue-600" />
                                )}
                              </Button>
                            )}
                            {item.status !== 'scheduled' && item.status !== 'processing' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  if (confirm('Remover este agendamento permanentemente?')) {
                                    deleteMutation.mutate(item.id);
                                  }
                                }}
                                disabled={deleteMutation.isPending}
                                title="Remover permanentemente"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Detalhes */}
      <Dialog open={!!detailItem} onOpenChange={(open) => { if (!open) setDetailItem(null); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Detalhes do Agendamento #{detailItem?.id}
            </DialogTitle>
            <DialogDescription>
              Informações completas de envio, erros e eventos de tracking.
            </DialogDescription>
          </DialogHeader>

          {detailItem && (
            <div className="space-y-4">
              {/* Informações básicas */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-xs text-muted-foreground">Cliente</p>
                  <p className="text-sm font-medium">{detailItem.recipient_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">E-mail</p>
                  <p className="text-sm font-medium">{detailItem.recipient_email || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant="outline" className={getStatusVariantClass(detailItem.status)}>
                    {getStatusLabel(detailItem.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Canal</p>
                  <p className="text-sm font-medium">{detailItem.channel === 'email' ? 'E-mail (Brevo)' : 'Manual'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Provider Message ID</p>
                  <p className="text-sm font-medium font-mono text-xs">{detailItem.provider_message_id || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tentativas</p>
                  <p className="text-sm font-medium">{detailItem.attempts || 0} / {detailItem.max_attempts || 3}</p>
                </div>
              </div>

              {/* Erro */}
              {detailItem.last_error && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-rose-600 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Erro
                  </h4>
                  <pre className="text-xs bg-rose-50 text-rose-800 p-3 rounded-md whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                    {detailItem.last_error}
                  </pre>
                </div>
              )}

              {/* Resposta completa da API (metadata.last_response) */}
              {detailItem.metadata?.last_response && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Bug className="h-4 w-4" />
                    Resposta da API (Brevo)
                  </h4>
                  <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                    {JSON.stringify(detailItem.metadata.last_response, null, 2)}
                  </pre>
                </div>
              )}

              {/* Tracking events */}
              {detailItem.metadata?.tracking && detailItem.metadata.tracking.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Eventos de Tracking ({detailItem.metadata.tracking.length})
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {(detailItem.metadata.tracking as Array<Record<string, any>>).map((event, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-2 bg-muted/30 rounded-md text-xs">
                        <div className="shrink-0 mt-0.5">
                          {event.event === 'delivered' ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : event.event === 'opened' || event.event === 'unique_opened' ? (
                            <Eye className="h-4 w-4 text-blue-500" />
                          ) : event.event === 'click' || event.event === 'unique_click' ? (
                            <MousePointerClick className="h-4 w-4 text-purple-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-rose-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">{event.event}</p>
                          <p className="text-muted-foreground">{event.timestamp || '-'}</p>
                          {event.link && (
                            <p className="text-muted-foreground truncate">Link: {event.link}</p>
                          )}
                          {event.device_used && (
                            <p className="text-muted-foreground">Dispositivo: {event.device_used}</p>
                          )}
                          {event.user_agent && (
                            <p className="text-muted-foreground truncate">{event.user_agent}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payload */}
              {detailItem.payload && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Payload do Agendamento</h4>
                  <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                    {JSON.stringify(detailItem.payload, null, 2)}
                  </pre>
                </div>
              )}

              {/* Metadata completa */}
              {detailItem.metadata && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Metadata</h4>
                  <pre className="text-xs bg-muted p-3 rounded-md whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                    {JSON.stringify(detailItem.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
