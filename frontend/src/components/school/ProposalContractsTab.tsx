import React, { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { proposalService } from '@/services/proposalService';
import { Loader2, AlertCircle, FileText, ExternalLink, Pencil, Save, X, RotateCcw, Send } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { enrollmentsService } from '@/services/enrollmentsService';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/qlib';

interface ProposalContractsTabProps {
  clientId: string;
  enrollmentId: string;
  meta?: any;
}

interface PdfContractItem {
  nome_arquivo: string;
  url: string;
  nome_contrato: string;
}

export default function ProposalContractsTab({ clientId, enrollmentId, meta }: ProposalContractsTabProps) {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Auth and Permissions
  const { user, token } = useAuth();
  const canEdit = user && Number(user.permission_id) < 2;

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
  const { pdfsToSend, sentDocs, rawParsedContracts } = useMemo(() => {
    const listToSend: { name: string; url: string; original?: any }[] = [];
    const listSent: { name: string; url: string }[] = [];
    let parsedContracts: PdfContractItem[] = [];

    // 1. Proposta PDF (string)
    if (meta?.proposta_pdf && typeof meta.proposta_pdf === 'string') {
        listToSend.push({
            name: 'Proposta Comercial (PDF)',
            url: meta.proposta_pdf,
            original: { type: 'proposal' }
        });
    }

    // 2. Contratos PDF (JSON string ou Array/Object)
    const rawContratoPdf = meta?.contrato_pdf;
    
    if (Array.isArray(rawContratoPdf)) {
        parsedContracts = rawContratoPdf;
    } else if (typeof rawContratoPdf === 'string') {
        try {
            parsedContracts = JSON.parse(rawContratoPdf);
        } catch (e) {
            console.error('Erro ao fazer parse de contrato_pdf:', e);
        }
    } else if (typeof rawContratoPdf === 'object' && rawContratoPdf !== null) {
        // Se vier como objeto (ex: array associativo do PHP), tenta converter valores em array
        parsedContracts = Object.values(rawContratoPdf);
    }

    if (Array.isArray(parsedContracts)) {
        parsedContracts.forEach((item: any) => { // item pode ser PdfContractItem ou similar
            if (item && item.url) {
                listToSend.push({
                    name: item.nome_contrato || item.nome_arquivo || 'Contrato',
                    url: item.url,
                    original: item
                });
            }
        });
    }

    return { pdfsToSend: listToSend, sentDocs: listSent, rawParsedContracts: parsedContracts };
  }, [meta]);

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
    if (!confirm("Deseja enviar os documentos para o Zapsign?")) return;

    setIsSendingZapsign(true);
    try {
      const base = getApiUrl();
      const url = `${base}/pdf/matriculas/${encodeURIComponent(String(enrollmentId))}?send_zapsign=1`;
      const headers: HeadersInit = { Accept: 'application/json' };
      const tk = token || localStorage.getItem('auth_token');
      if (tk) headers['Authorization'] = `Bearer ${tk}`;
      
      const resp = await fetch(url, { method: 'GET', headers });
      
      if (!resp.ok) {
        throw new Error(`Falha ao enviar para Zapsign (HTTP ${resp.status})`);
      }

      toast({ 
          title: 'Sucesso', 
          description: 'Envio para Zapsign iniciado.' 
      });

    } catch (error) {
      console.error(error);
      toast({ title: 'Erro', description: 'Não foi possível enviar para o Zapsign.', variant: 'destructive' });
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
                        <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={isRegenerating}>
                            {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
                            Gerar Novamente
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleSendZapsign} disabled={isSendingZapsign}>
                            {isSendingZapsign ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                            Enviar p/ Zapsign
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleStartEditing}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar Links
                        </Button>
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
                                <FileText className="h-4 w-4 text-amber-500" />
                                Documentos que serão enviados
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
                                Documentos enviados
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                             {sentDocs.length > 0 ? (
                                <ul className="space-y-2">
                                    {sentDocs.map((doc, idx) => (
                                        <li key={idx} className="flex items-center justify-between text-sm p-2 bg-background rounded border">
                                            <span className="truncate mr-2">{doc.name}</span>
                                            <Button variant="ghost" size="sm" asChild className="h-6 w-6 p-0">
                                                <a href={doc.url} target="_blank" rel="noopener noreferrer">
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-xs text-muted-foreground italic">Nenhum documento enviado.</p>
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
                Listagem dos contratos gerados para este plano de formação. Clique para visualizar o conteúdo.
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
    </div>
  );
}
