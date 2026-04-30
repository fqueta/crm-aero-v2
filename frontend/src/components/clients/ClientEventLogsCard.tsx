import React, { useMemo } from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from '@/components/ui/card';
import { 
  GitCommitHorizontal, 
  Edit3, 
  PlusCircle, 
  Trash2, 
  FileText, 
  Clock, 
  Activity,
  User as UserIcon
} from 'lucide-react';
import { useEventLogsList } from '@/hooks/eventLogs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface ClientEventLogsCardProps {
  clientId: string;
}

type ClientTimelineLog = {
  id: number | string;
  entity_type: string;
  entity_id: string;
  action: string;
  description?: string | null;
  payload?: Record<string, unknown> | null;
  actor_id?: string | null;
  actor?: {
    id?: string;
    name?: string;
  } | null;
  created_at: string;
};

const getActionConfig = (action: string) => {
  switch (action) {
    case 'stage_changed':
      return { label: 'Mudança de Etapa', icon: GitCommitHorizontal, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-200' };
    case 'updated':
      return { label: 'Atualização', icon: Edit3, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-200' };
    case 'created':
      return { label: 'Criação', icon: PlusCircle, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-200' };
    case 'deleted':
      return { label: 'Remoção', icon: Trash2, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-200' };
    case 'login':
      return { label: 'Acesso', icon: Activity, color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-200' };
    default:
      return { label: action, icon: FileText, color: 'text-gray-500', bg: 'bg-gray-500/10', border: 'border-gray-200' };
  }
};

const getEntityConfig = (entityType: string) => {
  switch (entityType) {
    case 'matricula':
      return { label: 'Proposta', className: 'bg-emerald-500/10 text-emerald-700' };
    case 'client_attendance':
      return { label: 'Atendimento', className: 'bg-violet-500/10 text-violet-700' };
    case 'user':
      return { label: 'Cliente', className: 'bg-sky-500/10 text-sky-700' };
    default:
      return { label: entityType, className: 'bg-muted text-muted-foreground' };
  }
};

/**
 * Traduz a ação técnica para um rótulo mais amigável na jornada do lead.
 */
const getJourneyActionLabel = (log: ClientTimelineLog) => {
  if (log.entity_type === 'matricula' && log.action === 'created') {
    return 'Proposta Criada';
  }
  if (log.entity_type === 'matricula' && log.action === 'status_changed') {
    return 'Status da Proposta';
  }
  if (log.entity_type === 'matricula' && log.action === 'financial_receivable_synced') {
    return 'Financeiro Gerado';
  }
  if (log.entity_type === 'client_attendance' && log.action === 'created') {
    return 'Atendimento Registrado';
  }
  if (log.entity_type === 'user' && log.action === 'stage_changed') {
    return 'Movimento no Pipeline';
  }
  return getActionConfig(log.action).label;
};

/**
 * Resume o evento com texto comercial para facilitar a leitura da jornada.
 */
const getJourneyDescription = (log: ClientTimelineLog) => {
  const payload = log.payload || {};
  const matriculaId = payload.matricula_id || log.entity_id;

  if (log.entity_type === 'matricula' && log.action === 'created') {
    return `Proposta #${matriculaId} criada para o cliente.`;
  }
  if (log.entity_type === 'matricula' && log.action === 'status_changed') {
    const newStatus = payload.new_status || payload.status;
    return newStatus
      ? `Status da proposta atualizado para ${String(newStatus)}.`
      : 'Status da proposta atualizado.';
  }
  if (log.entity_type === 'matricula' && log.action === 'financial_receivable_synced') {
    return 'Proposta ganhou vínculo financeiro e gerou contas a receber.';
  }
  if (log.entity_type === 'matricula' && log.action === 'proposta_generated') {
    return `Documento da proposta #${matriculaId} gerado.`;
  }
  if (log.entity_type === 'matricula' && log.action === 'zapsign_send_request') {
    return 'Proposta enviada para assinatura.';
  }
  if (log.entity_type === 'matricula' && log.action === 'zapsign_send_response') {
    return 'Retorno do envio para assinatura registrado.';
  }
  if (log.entity_type === 'matricula' && log.action === 'financial_payment_received') {
    return 'Pagamento recebido para a proposta.';
  }
  if (log.entity_type === 'client_attendance' && log.action === 'created') {
    const source = payload.source;
    if (source === 'proposal_created') {
      return 'Atendimento automático registrado na criação da proposta.';
    }
    return 'Atendimento do cliente registrado.';
  }
  if (log.entity_type === 'user' && log.action === 'stage_changed') {
    return log.description || 'Cliente movimentado no pipeline.';
  }

  return log.description || 'Evento registrado na jornada do lead.';
};

/**
 * Gera um detalhe secundário curto para complementar a leitura do evento.
 */
const getJourneyMeta = (log: ClientTimelineLog) => {
  const payload = log.payload || {};

  if (log.entity_type === 'matricula') {
    const matriculaId = payload.matricula_id || log.entity_id;
    return `Proposta #${String(matriculaId)}`;
  }

  if (log.entity_type === 'client_attendance' && payload.channel) {
    return `Canal: ${String(payload.channel)}`;
  }

  if (log.action === 'stage_changed' && (payload.from_stage_id || payload.to_stage_id)) {
    const fromStage = payload.from_stage_id ?? '-';
    const toStage = payload.to_stage_id ?? '-';
    return `Etapa ${String(fromStage)} -> ${String(toStage)}`;
  }

  return null;
};

/**
 * ClientEventLogsCard
 * pt-BR: Card para exibir Event Logs do cadastro de cliente (tabela users) com visual aprimorado (Timeline).
 * en-US: Card to show Event Logs of client record (users table) with enhanced UI (Timeline).
 */
export default function ClientEventLogsCard({ clientId }: ClientEventLogsCardProps) {
  const { data, isLoading, isFetching } = useEventLogsList({
    per_page: 50, // Increased to show more history
    client_id: String(clientId),
  });

  const logs = (data?.data || (data as any)?.items || []) as ClientTimelineLog[];

  // Group logs by Date
  const groupedLogs = useMemo(() => {
    const groups: Record<string, typeof logs> = {};
    logs.forEach((log) => {
      const date = new Date(log.created_at).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
      if (!groups[date]) groups[date] = [];
      groups[date].push(log);
    });
    return groups;
  }, [logs]);

  if (isLoading && !isFetching && logs.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">
          Carregando histórico...
        </CardContent>
      </Card>
    );
  }

  if (!isLoading && logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Histórico de Eventos</CardTitle>
          <CardDescription>Nenhuma atividade registrada para este cliente.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="h-full border-none shadow-none">
      <CardHeader className="px-0 pt-0 pb-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">Jornada do Lead</CardTitle>
            <CardDescription>Registro da proposta, atendimentos e movimentos do cliente</CardDescription>
          </div>
          <Badge variant="outline" className="h-7">
            {logs.length} eventos
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-8">
            {Object.entries(groupedLogs).map(([date, dayLogs]) => (
              <div key={date} className="relative">
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur pb-4 pt-2">
                  <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {date}
                  </h3>
                </div>
                
                <div className="ml-2 space-y-6 border-l-2 border-muted pl-6 pb-2">
                  {dayLogs.map((log) => {
                    const config = getActionConfig(log.action);
                    const entityConfig = getEntityConfig(log.entity_type);
                    const actionLabel = getJourneyActionLabel(log);
                    const description = getJourneyDescription(log);
                    const meta = getJourneyMeta(log);
                    const ActionIcon = config.icon;
                    const time = new Date(log.created_at).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    });

                    return (
                      <div key={log.id} className="relative group">
                        {/* Timeline Dot */}
                        <div className={cn(
                          "absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 bg-background flex items-center justify-center transition-colors",
                          config.border,
                          "group-hover:scale-110"
                        )}>
                          <div className={cn("h-1.5 w-1.5 rounded-full", config.color.replace('text-', 'bg-'))} />
                        </div>

                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {time}
                            </span>
                            <Badge variant="outline" className={cn("text-xs font-medium", entityConfig.className)}>
                              {entityConfig.label}
                            </Badge>
                            <Badge variant="secondary" className={cn("text-xs font-medium hover:bg-secondary", config.color, config.bg)}>
                              <ActionIcon className="w-3 h-3 mr-1" />
                              {actionLabel}
                            </Badge>
                          </div>
                          
                          <div className="mt-1 p-3 rounded-lg border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md">
                            <p className="font-medium text-sm text-foreground">
                              {description}
                            </p>
                            {meta && (
                              <p className="mt-2 text-xs text-muted-foreground">
                                {meta}
                              </p>
                            )}
                            
                            {log.actor_id && (
                              <div className="mt-3 flex items-center gap-2 pt-2 border-t text-xs text-muted-foreground">
                                <Avatar className="h-5 w-5">
                                  <AvatarFallback className="text-[9px] bg-muted">
                                    <UserIcon className="w-3 h-3" />
                                  </AvatarFallback>
                                </Avatar>
                                <span className="truncate max-w-[200px]" title={String(log.actor_id)}>
                                  Autor: <span className="font-mono">{log.actor?.name || String(log.actor_id || '').substring(0, 8) || 'Sistema'}</span>
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
