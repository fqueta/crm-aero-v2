import React, { useMemo, useState } from 'react';
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
  User as UserIcon,
  Send,
  Download,
  Code
} from 'lucide-react';
import { useEventLogsList } from '@/hooks/eventLogs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from '@/contexts/AuthContext';

interface ProposalLogsTabProps {
  enrollmentId: string;
}

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
    case 'zapsign_send_request':
      return { label: 'Envio Zapsign', icon: Send, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-200' };
    case 'zapsign_send_response':
      return { label: 'Retorno Zapsign', icon: Download, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-200' };
    default:
      return { label: action, icon: FileText, color: 'text-gray-500', bg: 'bg-gray-500/10', border: 'border-gray-200' };
  }
};

/**
 * ProposalLogsTab
 * pt-BR: Aba para listar Event Logs relacionados à matrícula/proposta com visual aprimorado (Timeline).
 * en-US: Tab to list Event Logs related to the enrollment/proposal with enhanced UI (Timeline).
 */
export default function ProposalLogsTab({ enrollmentId }: ProposalLogsTabProps) {
  const { user } = useAuth();
  const canViewJson = user && Number(user.permission_id) === 1;

  const { data, isLoading, isFetching } = useEventLogsList({
    per_page: 50, // Increased to show more history
    entity_type: 'matricula',
    entity_id: String(enrollmentId),
  });

  const logs = (data?.data || (data as any)?.items || []) as any[];

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
          <CardDescription>Nenhuma atividade registrada para esta matrícula.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="h-full border-none shadow-none">
      <CardHeader className="px-0 pt-0 pb-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">Histórico de Atividades</CardTitle>
            <CardDescription>Registro de alterações e eventos da matrícula</CardDescription>
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
                            <Badge variant="secondary" className={cn("text-xs font-medium hover:bg-secondary", config.color, config.bg)}>
                              <ActionIcon className="w-3 h-3 mr-1" />
                              {config.label}
                            </Badge>
                          </div>
                          
                          <div className="mt-1 p-3 rounded-lg border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md">
                            <p className="font-medium text-sm text-foreground">
                              {log.description || 'Sem descrição'}
                            </p>
                            
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

                             {canViewJson && log.payload && (
                                <div className="mt-3">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="outline" size="sm" className="h-6 text-xs gap-1">
                                        <Code className="h-3 w-3" />
                                        Ver JSON
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-2xl h-[80vh] flex flex-col p-0">
                                      <DialogHeader className="px-6 py-4 border-b">
                                        <DialogTitle>Detalhes do Evento (JSON)</DialogTitle>
                                      </DialogHeader>
                                      <div className="flex-1 min-h-0 overflow-auto bg-slate-950 text-slate-50 p-4">
                                            <pre className="text-xs font-mono break-all whitespace-pre-wrap">
                                              {JSON.stringify(log.payload, null, 2)}
                                            </pre>
                                      </div>
                                    </DialogContent>
                                  </Dialog>
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

