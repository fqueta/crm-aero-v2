import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { proposalService } from '@/services/proposalService';
import { Loader2, AlertCircle, FileText, ExternalLink, Pencil, Save, X, RotateCcw, Send, Copy, Check, Share2, CheckCircle2, MessageCircle, Eye, Clock, Zap, MapPin, MousePointerClick } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { enrollmentsService } from '@/services/enrollmentsService';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/qlib';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Info } from 'lucide-react';

interface ProposalContractsTabProps {
  clientId: string;
  enrollmentId: string;
  meta?: any;
  courseName?: string;
  signatureLink?: string;
  onGoToOverview?: () => void;
}

interface PdfContractItem {
  nome_arquivo: string;
  url: string;
  nome_contrato: string;
}

export default function ProposalContractsTab({ clientId, enrollmentId, meta, courseName, signatureLink, onGoToOverview }: ProposalContractsTabProps) {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  
  // Auth and Permissions
  const { user, token } = useAuth();

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [propostaPdfUrl, setPropostaPdfUrl] = useState('');
  const [editableContracts, setEditableContracts] = useState<PdfContractItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isSendingZapsign, setIsSendingZapsign] = useState(false);

  const { toast } = useToast();

  useEffect(() => {
    async function loadContracts() {
      if (!clientId || !enrollmentId) return;
      
      setLoading(true);
      setError(null);
      try {
        const data = await proposalService.getContractsHtml(clientId, enrollmentId);
        if (Array.isArray(data)) {
            setContracts(data);
        } else {
             // Se vier erro do backend
             if ((data as any).error) {
                 setError((data as any).error);
             } else {
                setContracts([]);
             }
        }
      } catch (err) {
        console.error(err);
        setError('Não foi possível carregar os contratos.');
      } finally {
        setLoading(false);
      }
    }

    loadContracts();
  }, [clientId, enrollmentId]);

  // Processamento dos metadados para Assinatura Digital
  const { pdfsToSend, sentDocs, rawParsedContracts, zapsignDoc, localSignedUrl, localExtraDocs } = useMemo(() => {
    const listToSend: { name: string; url: string; original?: any }[] = [];
    const listSent: { name: string; url: string; signer?: any }[] = [];
    let parsedContracts: PdfContractItem[] = [];

    // 1. PDFs a serem enviados (Simulações/Contratos gerados localmente)
    // pt-BR: Pega os PDFs gerados localmente na matrícula meta 'proposta_pdf' e 'contrato_pdf'.
    const rawPropostas = meta?.proposta_pdf;
    if (rawPropostas) {
        if (typeof rawPropostas === 'string' && (rawPropostas.startsWith('http') || rawPropostas.startsWith('/storage'))) {
            listToSend.push({
                name: 'Proposta Comercial (PDF)',
                url: rawPropostas,
                original: { type: 'proposal' }
            });
        } else {
            try {
                const parsed = typeof rawPropostas === 'string' ? JSON.parse(rawPropostas) : rawPropostas;
                const items = Array.isArray(parsed) ? parsed : [parsed];
                items.forEach((item: any) => {
                    if (item?.url) {
                        listToSend.push({
                            name: item.nome_contrato || item.nome_arquivo || 'Simulação/Orçamento',
                            url: item.url,
                            original: item
                        });
                    }
                });
            } catch (e) {}
        }
    }

    const rawContratos = meta?.contrato_pdf;
    if (rawContratos) {
        try {
            const parsed = typeof rawContratos === 'string' ? JSON.parse(rawContratos) : rawContratos;
            const items = Array.isArray(parsed) ? parsed : (typeof parsed === 'object' && parsed !== null ? Object.values(parsed) : [parsed]);
            parsedContracts = items;
            items.forEach((item: any) => {
                if (item && typeof item === 'object' && item.url) {
                    listToSend.push({
                        name: item.nome_contrato || item.nome_arquivo || 'Contrato',
                        url: item.url,
                        original: item
                    });
                }
            });
        } catch (e) {}
    }

    // 2. Status e Signatários (ZapSign)
    // pt-BR: O webhook do ZapSign atualiza o meta 'processo_assinatura' diretamente com o payload.
    //        Já o envio inicial salva em 'processo_assinatura.enviar.response'.
    const rawZapsign = meta?.processo_assinatura;
    const zapsignBase = typeof rawZapsign === 'string' ? (JSON.parse(rawZapsign) || {}) : (rawZapsign || {});
    const zapsignData = zapsignBase?.enviar?.response || zapsignBase;
    const signersList = zapsignData?.signers;

    if (Array.isArray(signersList)) {
        signersList.forEach((s: any) => {
            const link = s.sign_url || s.signing_link;
            if (link) {
                listSent.push({
                    name: `Link Assinatura: ${s.name}`,
                    url: link,
                    signer: s
                });
            }
        });
    }

    // 3. Arquivos Assinados Localmente (Segurança e Permanência)
    // pt-BR: Procuramos por arquivos já baixados para o servidor local em 'salvar_links_assinados'
    // en-US: Looking for files already downloaded to the local server in 'salvar_links_assinados'
    let localUrl = '';
    let extraList: { nome: string; link: string }[] = [];
    const localLinksRaw = meta?.salvar_links_assinados;
    let localLinksObj: any = null;

    if (localLinksRaw) {
        localLinksObj = typeof localLinksRaw === 'string' ? JSON.parse(localLinksRaw) : localLinksRaw;
    } else {
        // Tenta encontrar metadados de períodos específicos (ex: salvar_links_assinados_TK123)
        const periodKey = Object.keys(meta || {}).find(k => k.startsWith('salvar_links_assinados_'));
        if (periodKey) {
            const raw = meta[periodKey];
            localLinksObj = typeof raw === 'string' ? JSON.parse(raw) : raw;
        }
    }
    
    if (localLinksObj?.principal?.link) {
        localUrl = localLinksObj.principal.link;
    }

    if (localLinksObj?.extra) {
        // localLinksObj.extra pode ser um array ou objeto (chave -> {nome, link})
        extraList = Object.values(localLinksObj.extra);
    }

    return { 
        pdfsToSend: listToSend, 
        sentDocs: listSent, 
        rawParsedContracts: parsedContracts,
        zapsignSigners: Array.isArray(signersList) ? signersList : [],
        zapsignDoc: zapsignData,
        localSignedUrl: localUrl,
        localExtraDocs: extraList
    };
  }, [meta]);

  const isAdmin = user && Number(user.permission_id) === 1;
  const isStandard = user && Number(user.permission_id) > 1;
  const hasZapsign = zapsignDoc && typeof zapsignDoc === 'object' && Object.keys(zapsignDoc).length > 0 && (zapsignDoc.token || zapsignDoc.signers);
  const canEdit = isAdmin || (isStandard && hasZapsign);

  // Initialize edit state when entering edit mode
  const handleStartEditing = () => {
    setPropostaPdfUrl(meta?.proposta_pdf || '');
    // Ensure we have a deep copy of contracts to edit
    setEditableContracts(JSON.parse(JSON.stringify(rawParsedContracts || [])));
    setIsEditing(true);
  };

  const handleCancelEditing = () => {
    setIsEditing(false);
    setPropostaPdfUrl('');
    setEditableContracts([]);
  };

  const handleContractChange = (index: number, field: keyof PdfContractItem, value: string) => {
    const newContracts = [...editableContracts];
    if (newContracts[index]) {
        newContracts[index] = { ...newContracts[index], [field]: value };
        setEditableContracts(newContracts);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
        const newMeta = {
            ...(meta || {}),
            proposta_pdf: propostaPdfUrl,
            contrato_pdf: JSON.stringify(editableContracts) // Save as JSON string to be consistent
        };

        await enrollmentsService.updateEnrollment(enrollmentId, {
             // @ts-ignore - sending meta inside config or as separate field depending on backend
             // Based on types, EnrollmentRecord has [key: string]: any, so we might need to send it as part of payload
             // Checking EnrollmentsService, it uses UpdateEnrollmentInput.
             // Usually custom fields go into meta or config. Let's try sending meta directly.
             meta: newMeta
        } as any);

        toast({
            title: "Sucesso",
            description: "Links atualizados com sucesso.",
        });
        
        setIsEditing(false);
        // Force reload would be better, but for now we rely on parent update or simple state update if we had setMeta prop
        window.location.reload(); // Simple way to refresh data for now
    } catch (error) {
        console.error(error);
        toast({
            title: "Erro",
            description: "Falha ao salvar alterações.",
            variant: "destructive"
        });
    } finally {
        setIsSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!enrollmentId) return;
    if (!confirm("Deseja realmente gerar novamente a proposta e os contratos? Isso pode sobrescrever os arquivos existentes.")) return;

    setIsRegenerating(true);
    try {
      const base = getApiUrl();
      // Using the same URL logic as ProposalsView but forcing background regeneration
      const url = `${base}/pdf/matriculas/${encodeURIComponent(String(enrollmentId))}?regenerate_all=1`;
      const headers: HeadersInit = { Accept: 'application/json' };
      const tk = token || localStorage.getItem('auth_token');
      if (tk) headers['Authorization'] = `Bearer ${tk}`;
      
      const resp = await fetch(url, { method: 'GET', headers });
      
      if (!resp.ok) {
        throw new Error(`Falha ao gerar PDF (HTTP ${resp.status})`);
      }

      const data = await resp.json().catch(() => ({}));
      // The generation endpoint usually updates the backend state/files. 
      // We might get a URL back, but the important part is that the backend regenerated the files.
      
      toast({ 
          title: 'Sucesso', 
          description: 'Documentos gerados novamente. A página será recarregada.' 
      });

      // Reload to fetch new URLs from updated meta
      setTimeout(() => window.location.reload(), 1500);

    } catch (error) {
      console.error(error);
      toast({ title: 'Erro', description: 'Não foi possível gerar os documentos.', variant: 'destructive' });
      setIsRegenerating(false);
    }
  };

  const handleSendZapsign = async () => {
    if (!enrollmentId) return;

    // pt-BR: Validação de segurança - A proposta PRECISA estar aprovada antes de enviar ao ZapSign pela primeira vez.
    if (meta?.status_assinatura !== 'aprovado' && !hasZapsign) {
        setShowApprovalDialog(true);
        return;
    }

    if (!confirm("Deseja enviar os documentos para o ZapSign?")) return;

    setIsSendingZapsign(true);
    try {
      // Se for um reenvio, primeiro forçamos a regeneração dos PDFs para garantir que estão atualizados
      if (hasZapsign) {
          toast({ title: 'Atualizando arquivos', description: 'Regenerando PDFs antes de enviar...' });
          await proposalService.generateContracts(clientId, enrollmentId);
      }

      await proposalService.sendToZapsign(enrollmentId);
      
      toast({ 
          title: 'Sucesso', 
          description: hasZapsign ? 'Reenvio para ZapSign iniciado com arquivos atualizados.' : 'Envio para ZapSign iniciado.' 
      });

    } catch (error) {
      console.error(error);
      toast({ title: 'Erro', description: 'Não foi possível processar o envio para o ZapSign.', variant: 'destructive' });
    } finally {
        setIsSendingZapsign(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Erro</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
        {/* Card Assinatura Digital */}
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Assinatura digital</CardTitle>
                    <CardDescription>Gerenciamento de documentos para assinatura</CardDescription>
                </div>
                {canEdit && !isEditing && (
                    <div className="flex gap-2">
                        {isAdmin && (
                            <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={isRegenerating}>
                                {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                                Gerar Novamente
                            </Button>
                        )}
                        
                        {/* Botão de Envio (Admin) ou Reenvio (Todos se já enviado) */}
                        {(isAdmin || (isStandard && hasZapsign)) && (
                            <Button 
                                variant={hasZapsign ? "secondary" : "default"}
                                size="sm" 
                                onClick={handleSendZapsign} 
                                disabled={isSendingZapsign}
                                className={hasZapsign ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : ""}
                            >
                                {isSendingZapsign ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                {hasZapsign ? 'Reenviar para ZapSign' : 'Enviar p/ ZapSign'}
                            </Button>
                        )}

                        {isAdmin && (
                            <Button variant="outline" size="sm" onClick={handleStartEditing}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Editar Links
                            </Button>
                        )}
                    </div>
                )}
                 {canEdit && isEditing && (
                    <div className="flex gap-2">
                         <Button variant="ghost" size="sm" onClick={handleCancelEditing} disabled={isSaving}>
                            <X className="h-4 w-4 mr-2" />
                            Cancelar
                        </Button>
                        <Button variant="default" size="sm" onClick={handleSave} disabled={isSaving}>
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            Salvar
                        </Button>
                    </div>
                )}
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Subcard: Documentos que serão enviados */}
                    <Card className="bg-slate-50 dark:bg-slate-900 border-dashed">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-medium flex items-center gap-2">
                                <FileText className="h-4 w-4 text-amber-600" />
                                Documentos Selecionados para Assinatura Digital
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {!isEditing ? (
                                <>
                                    {pdfsToSend.length > 0 ? (
                                        <ul className="space-y-2">
                                            {pdfsToSend.map((doc, idx) => (
                                                <li key={idx} className="flex items-center justify-between text-sm p-2 bg-background rounded border">
                                                    <span className="truncate mr-2" title={doc.name}>{doc.name}</span>
                                                    <Button variant="ghost" size="sm" asChild className="h-6 w-6 p-0">
                                                        <a href={doc.url} target="_blank" rel="noopener noreferrer" title="Abrir PDF">
                                                            <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-xs text-muted-foreground italic">Nenhum documento PDF gerado.</p>
                                    )}
                                </>
                            ) : (
                                <div className="space-y-4">
                                    {/* Edit Mode */}
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold">Proposta Comercial (PDF)</Label>
                                        <Input 
                                            value={propostaPdfUrl} 
                                            onChange={(e) => setPropostaPdfUrl(e.target.value)} 
                                            placeholder="URL da Proposta"
                                            className="h-8 text-sm"
                                        />
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <Label className="text-xs font-semibold">Contratos (Lista)</Label>
                                        {editableContracts.map((contract, idx) => (
                                            <div key={idx} className="p-2 border rounded bg-background space-y-2">
                                                <div className="flex justify-between items-center">
                                                    <Label className="text-[10px] text-muted-foreground">Contrato {idx + 1}</Label>
                                                </div>
                                                <Input 
                                                    value={contract.nome_contrato || contract.nome_arquivo}
                                                    onChange={(e) => handleContractChange(idx, 'nome_contrato', e.target.value)}
                                                    placeholder="Nome do Contrato"
                                                    className="h-7 text-xs mb-1"
                                                />
                                                <Input 
                                                    value={contract.url}
                                                    onChange={(e) => handleContractChange(idx, 'url', e.target.value)}
                                                    placeholder="URL do PDF"
                                                    className="h-7 text-xs"
                                                />
                                            </div>
                                        ))}
                                        {editableContracts.length === 0 && (
                                            <p className="text-xs text-muted-foreground italic">Nenhum contrato na lista.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Subcard: Documentos enviados */}
                    <Card className="bg-slate-50 dark:bg-slate-900 border-dashed">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-medium flex items-center gap-2">
                                <FileText className="h-4 w-4 text-green-600" />
                                Monitoramento de Assinatura (ZapSign)
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                             {/* Document-level global info (Final PDF) */}
                             {(localSignedUrl || zapsignDoc?.signed_file) && (
                                <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                    <div className="flex items-center justify-between mb-2">
                                        <h4 className="text-xs font-bold text-green-700 dark:text-green-400 flex items-center gap-2 uppercase tracking-wider">
                                            <Zap className={`h-3 w-3 ${zapsignDoc?.status === 'pending' ? 'animate-pulse' : ''}`} />
                                            Documento Final Assinado
                                        </h4>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                            (zapsignDoc?.status === 'signed' || zapsignDoc?.status === 'completed') ? 'bg-green-600 text-white' :
                                            zapsignDoc?.status === 'pending' ? 'bg-amber-500 text-white' :
                                            zapsignDoc?.status === 'rejected' ? 'bg-red-600 text-white' :
                                            'bg-slate-400 text-white'
                                        }`}>
                                            {zapsignDoc?.status === 'signed' || zapsignDoc?.status === 'completed' ? 'Concluído' :
                                             zapsignDoc?.status === 'pending' ? 'Pendente' :
                                             zapsignDoc?.status === 'rejected' ? 'Rejeitado' :
                                             zapsignDoc?.status || 'Processando'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" className="flex-1 h-8 text-xs font-medium border-green-300 dark:border-green-700 bg-white dark:bg-zinc-800" asChild>
                                            <a href={localSignedUrl || zapsignDoc.signed_file} target="_blank" rel="noopener noreferrer">
                                                <FileText className="h-3 w-3 mr-2" />
                                                {localSignedUrl ? 'Ver Contrato Assinado (Local)' : 'Baixar PDF Final'}
                                            </a>
                                        </Button>
                                        {zapsignDoc.signature_report && (
                                            <Button variant="outline" size="sm" className="h-8 text-[10px] font-medium border-green-300 dark:border-green-700 bg-white dark:bg-zinc-800" asChild title="Relatório de Assinaturas">
                                                <a href={zapsignDoc.signature_report} target="_blank" rel="noopener noreferrer">
                                                    Manifesto
                                                </a>
                                            </Button>
                                        )}
                                    </div>

                                    {/* Documentos Extra (Individuais) */}
                                    {localExtraDocs && localExtraDocs.length > 0 && (
                                        <div className="mt-4 pt-3 border-t border-green-200 dark:border-green-800">
                                            <h5 className="text-[10px] font-bold text-green-700 dark:text-green-400 uppercase mb-2 tracking-wider">
                                                Arquivos Individuais do Envelope
                                            </h5>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {localExtraDocs.map((ex: any, i: number) => (
                                                    <Button key={i} variant="ghost" size="sm" className="h-7 text-[10px] justify-start px-2 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-800 dark:text-green-300" asChild>
                                                        <a href={ex.link} target="_blank" rel="noopener noreferrer">
                                                            <FileText className="h-3 w-3 mr-1.5 opacity-70" />
                                                            <span className="truncate">{ex.nome}</span>
                                                        </a>
                                                    </Button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                             )}

                             {sentDocs.length > 0 ? (
                                <div className="space-y-4">
                                    {sentDocs.map((doc, idx) => (
                                        <div key={idx} className="group relative bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-slate-200 dark:bg-zinc-800 group-hover:bg-primary transition-colors duration-300"></div>
                                        
                                        <div className="p-4">
                                            {/* Header do Card: Avatar + Nome + Status */}
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm border-2 ${
                                                        doc.signer?.status === 'signed' ? 'bg-green-50 border-green-200 text-green-700' :
                                                        doc.signer?.status === 'opened' ? 'bg-blue-50 border-blue-200 text-blue-700' :
                                                        'bg-slate-50 border-slate-200 text-slate-600'
                                                    }`}>
                                                        {getInitials(doc.signer?.name || doc.name)}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                                                            {doc.signer?.name || doc.name}
                                                        </h4>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            {doc.signer?.email || 'E-mail não informado'}
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className={`text-[9px] px-2 py-0.5 rounded-full uppercase font-black tracking-widest ${
                                                    (doc.signer?.status === 'signed' || doc.signer?.status === 'completed') ? 'bg-green-600 text-white shadow-sm shadow-green-200' :
                                                    doc.signer?.status === 'new' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                                    doc.signer?.status === 'opened' ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' :
                                                    doc.signer?.status === 'rejected' ? 'bg-red-600 text-white shadow-sm shadow-red-200' :
                                                    'bg-slate-100 text-slate-600 border border-slate-200'
                                                }`}>
                                                    {(doc.signer?.status === 'signed' || doc.signer?.status === 'completed') ? 'Assinado' :
                                                     doc.signer?.status === 'new' ? 'Pendente' :
                                                     doc.signer?.status === 'opened' ? 'Visualizado' :
                                                     doc.signer?.status === 'rejected' ? 'Rejeitado' :
                                                     doc.signer?.status || 'Pendente'}
                                                </span>
                                            </div>

                                            {/* Métricas de Engajamento */}
                                            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mb-4">
                                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-slate-50 dark:bg-zinc-800/50 px-2 py-1 rounded-md">
                                                    <MousePointerClick className="h-3 w-3 opacity-70" />
                                                    <span className="font-medium">{doc.signer?.times_viewed || 0}</span> acessos
                                                </div>
                                                
                                                {doc.signer?.last_view_at && (
                                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500" title="Data da última visualização">
                                                        <Eye className="h-3 w-3 opacity-70" />
                                                        Lido: <span className="font-medium">{formatDateTime(doc.signer.last_view_at)}</span>
                                                    </div>
                                                )}
                                                
                                                {doc.signer?.signed_at && (
                                                    <div className="flex items-center gap-1.5 text-[10px] text-green-600 font-bold bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md" title="Finalizado em">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        {formatDateTime(doc.signer.signed_at)}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Ações (Link + Botões) */}
                                            <div className="flex flex-col gap-2">
                                                <div className="relative group/link">
                                                    <Input 
                                                        value={doc.url} 
                                                        readOnly 
                                                        className="h-8 pr-16 bg-slate-50/50 dark:bg-zinc-800/30 border-slate-200 dark:border-zinc-800 text-[10px] focus-visible:ring-offset-0 focus-visible:ring-1"
                                                    />
                                                    <div className="absolute right-1 top-1 flex items-center gap-1">
                                                        <CopyButton text={doc.url} />
                                                    </div>
                                                </div>
                                                
                                                <div className="flex items-center gap-2">
                                                    <Button variant="outline" size="sm" className="flex-1 h-8 text-[10px] font-bold uppercase tracking-wider" asChild>
                                                        <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                                            <ExternalLink className="h-3 w-3 mr-2" />
                                                            Abrir Link
                                                        </a>
                                                    </Button>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="h-8 px-3 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-800 dark:text-green-400"
                                                        onClick={() => {
                                                            const message = `Olá ${doc.signer?.name || doc.name}, segue o link para assinatura do seu contrato no Aeroclube: ${doc.url}`;
                                                            const whatsappUrl = `https://api.whatsapp.com/send?phone=55${doc.signer?.phone_number || ''}&text=${encodeURIComponent(message)}`;
                                                            window.open(whatsappUrl, '_blank');
                                                        }}
                                                        title="Enviar lembrete pelo WhatsApp"
                                                    >
                                                        <MessageCircle className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                  ))}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground italic">Nenhum documento enviado ou links de assinatura disponíveis.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </CardContent>
        </Card>

        {/* Card Contratos HTML (Legado/Visualização) */}
        {contracts.length > 0 ? (
            <Card>
            <CardHeader>
                <CardTitle>Contratos da Proposta</CardTitle>
                <CardDescription>
                Listagem de documentos do curso: <span className="font-bold text-slate-900 dark:text-white uppercase px-1">{courseName || '—'}</span>
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible className="w-full">
                {contracts.map((contract, index) => {
                    const contractId = contract.id || `contract-${index}`;
                    const title = contract.nome || `Contrato ${index + 1}`;
                    
                    return (
                    <AccordionItem key={contractId} value={String(contractId)}>
                        <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-2 text-left">
                                <FileText className="h-4 w-4 text-blue-600" />
                                <span>{title}</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                        <div 
                            className="prose prose-sm max-w-none p-4 bg-slate-50 rounded-md border text-slate-800 dark:bg-slate-900 dark:text-slate-200 overflow-x-auto"
                            dangerouslySetInnerHTML={{ __html: contract.conteudo }}
                        />
                        </AccordionContent>
                    </AccordionItem>
                    );
                })}
                </Accordion>
            </CardContent>
            </Card>
        ) : (
             <div className="text-center py-8 text-muted-foreground">
                Nenhum contrato HTML disponível.
            </div>
        )}

        {/* Modal de Alerta: Necessário Aprovação */}
        <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-amber-600">
                        <Info className="h-5 w-5" />
                        Aprovação da Proposta Necessária
                    </DialogTitle>
                    <DialogDescription className="py-2">
                        Esta proposta ainda não foi aprovada pelo cliente. Para prosseguir com o envio dos contratos para o ZapSign, é obrigatório que a proposta comercial seja assinada/aprovada primeiro.
                    </DialogDescription>
                </DialogHeader>

                <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-md border border-slate-200 dark:border-slate-800 space-y-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Link para Aprovação do Cliente:</p>
                    {signatureLink ? (
                        <div className="flex items-start gap-2">
                             <div className="bg-white dark:bg-black p-2 rounded border flex-1 text-[11px] font-mono break-all text-slate-600 dark:text-slate-400 overflow-hidden leading-relaxed shadow-sm">
                                {signatureLink}
                            </div>
                            <div className="pt-1">
                                <CopyButton text={signatureLink} />
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-amber-600 italic">Link de assinatura não disponível. Gere a proposta novamente.</p>
                    )}
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                    <Button variant="outline" className="w-full flex-1" onClick={() => setShowApprovalDialog(false)}>
                        Fechar e Manter aqui
                    </Button>
                    <Button variant="default" className="w-full flex-1" onClick={() => {
                        setShowApprovalDialog(false);
                        onGoToOverview?.();
                    }}>
                        Ir para Visão Geral
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}

function formatDateTime(isoString?: string) {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        return date.toLocaleString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return isoString;
    }
}

function getInitials(name: string) {
    if (!name) return '?';
    const parts = name.trim().split(' ');
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function CopyButton({ text }: { text: string }) {
    const { toast } = useToast();
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast({ title: "Copiado", description: "Link copiado para a área de transferência." });
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast({ title: "Erro", description: "Falha ao copiar link.", variant: "destructive" });
        }
    };

    return (
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleCopy} title="Copiar link">
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </Button>
    );
}
