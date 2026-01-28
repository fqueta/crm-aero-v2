import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { proposalService } from '@/services/proposalService';
import { Loader2, AlertCircle, FileText } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface ProposalContractsTabProps {
  clientId: string;
  enrollmentId: string;
}

export default function ProposalContractsTab({ clientId, enrollmentId }: ProposalContractsTabProps) {
  const [contracts, setContracts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (contracts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Nenhum contrato disponível para esta proposta.
      </div>
    );
  }

  return (
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
  );
}
