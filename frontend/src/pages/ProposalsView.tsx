import { useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil, Printer, FileText, Loader2 } from 'lucide-react';
import ProposalViewContent from '@/components/school/ProposalViewContent';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/qlib';
import { useAuth } from '@/contexts/AuthContext';
import { useEnrollment } from '@/hooks/enrollments';
// @ts-ignore
import html2pdf from 'html2pdf.js';

/**
 * ProposalsView
 * pt-BR: Página de visualização somente leitura de uma proposta.
 * en-US: Read-only page to view a proposal.
 */
export default function ProposalsView() {
  /**
   * useToast
   * pt-BR: Hook para mensagens de feedback (sucesso/erro).
   * en-US: Hook for user feedback messages (success/error).
   */
  const { toast } = useToast();
  /**
   * useAuth
   * pt-BR: Fornece token atual para autenticação das chamadas de API.
   * en-US: Provides current token for authenticating API calls.
   */
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // navState
  const navState = (location?.state || {}) as { returnTo?: string; funnelId?: string; stageId?: string };
  const { id } = useParams<{ id: string }>();
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const { data: enrollment } = useEnrollment(String(id || ''));
  const isAdmin = Number(user?.permission_id) === 1;
  const clientId = useMemo(() => {
    const value = (enrollment as any)?.id_cliente ?? (enrollment as any)?.client_id;
    return value ? String(value) : '';
  }, [enrollment]);
  /**
   * handleBack
   * pt-BR: Volta para a página de origem (histórico) ou para `returnTo`.
   * en-US: Goes back to the origin page (history) or uses `returnTo`.
   */
  function handleBack() {
    if (navState?.returnTo && typeof navState.returnTo === 'string') {
      navigate(navState.returnTo);
      return;
    }
    // Preferir histórico para retornar exatamente à origem.
    navigate(-1);
  }
  /**
   * handleEdit
   * pt-BR: Navega para edição preservando o estado de origem.
   * en-US: Navigates to edit preserving origin state.
   */
  function handleEdit() {
    const stateToPass = navState && typeof navState === 'object' ? navState : {};
    navigate(`/admin/sales/proposals/edit/${id}` , { state: stateToPass });
  }

  /**
   * handlePrint
   * pt-BR: Abre o diálogo de impressão do navegador.
   * en-US: Opens the browser's print dialog.
   */
  function handlePrint() {
    window.print();
  }

  /**
   * handleOpenProposalPdf
   * pt-BR: Abre a rota pública responsável por gerar e exibir o PDF final da proposta.
   * en-US: Opens the public route responsible for generating and displaying the final proposal PDF.
   */
  function handleOpenProposalPdf() {
    if (!id || !clientId) {
      toast({
        title: 'Dados incompletos',
        description: 'Não foi possível localizar o cliente da proposta para abrir o PDF.',
        variant: 'destructive',
      });
      return;
    }

    const base = getApiUrl();
    const url = `${base}/pdf/propostas/public/${encodeURIComponent(clientId)}/${encodeURIComponent(String(id))}?force=1&t=${Date.now()}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  /**
   * handleGeneratePdfAsync
   * pt-BR: Dispara a geração assíncrona atual do PDF para administradores.
   * en-US: Triggers the current asynchronous PDF generation for administrators.
   */
  async function handleGeneratePdfAsync() {
    if (!id) return;
    setIsPdfLoading(true);
    try {
        const base = getApiUrl();
        /**
         * pt-BR: Adicionamos o flag `generate_proposal=1` para ativar o Job GeraPdfPropostasPnlJob no backend.
         *        Removemos debug_html=1 para processamento totalmente assíncrono.
         * en-US: We add the `generate_proposal=1` flag to activate the backend Job GeraPdfPropostasPnlJob.
         *        Removed debug_html=1 for fully asynchronous processing.
         */
        const url = `${base}/pdf/matriculas/${encodeURIComponent(String(id))}?generate_proposal=1&force=1`;
        const headers: HeadersInit = { Accept: 'application/json' };
        const tk = token || localStorage.getItem('auth_token');
        if (tk) headers['Authorization'] = `Bearer ${tk}`;
        
        const resp = await fetch(url, { method: 'GET', headers });
        if (!resp.ok) {
          setIsPdfLoading(false);
          toast({ title: 'Erro', description: `Falha ao solicitar geração do PDF (HTTP ${resp.status})`, variant: 'destructive' });
          return;
        }

        toast({
            title: 'Solicitação Enviada',
            description: 'A geração assíncrona do PDF da proposta foi iniciada. Assim que concluir, atualize esta página para visualizar o card "Link da proposta em PDF".'
        });
    } catch (err: any) {
      console.error('Erro PDF:', err);
      toast({ title: 'Erro ao processar PDF', description: err.message, variant: 'destructive' });
    } finally {
      setIsPdfLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Conteúdo principal */}
      {id ? <ProposalViewContent id={String(id)} /> : null}

      {/* Overlay de carregamento do PDF */}
      {isPdfLoading && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-lg shadow-xl flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Gerando PDF...</p>
          </div>
        </div>
      )}

      {/* Rodapé fixo com ações */}
      <div className="fixed bottom-0 left-0 md:left-[var(--sidebar-width)] right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 print:hidden">
        <div className="container mx-auto py-3 flex flex-wrap items-center gap-2 justify-start">
          <Button variant="ghost" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
          <Button variant="outline" onClick={handleOpenProposalPdf}>
            <FileText className="h-4 w-4 mr-2" /> Gerar PDF
          </Button>
          {isAdmin && (
            <Button variant="outline" onClick={handleGeneratePdfAsync} disabled={isPdfLoading}>
              <FileText className="h-4 w-4 mr-2" /> Gerar PDF Async
            </Button>
          )}
          <Button variant="secondary" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir
          </Button>
          <Button variant="default" onClick={handleEdit}>
            <Pencil className="h-4 w-4 mr-2" /> Editar
          </Button>
        </div>
      </div>
    </div>
  );
}
