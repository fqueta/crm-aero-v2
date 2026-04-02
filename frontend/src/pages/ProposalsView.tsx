import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Pencil, Printer, FileText, Loader2 } from 'lucide-react';
import ProposalViewContent from '@/components/school/ProposalViewContent';
import { useToast } from '@/hooks/use-toast';
import { getApiUrl } from '@/lib/qlib';
import { useAuth } from '@/contexts/AuthContext';
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
  const { token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // navState
  const navState = (location?.state || {}) as { returnTo?: string; funnelId?: string; stageId?: string };
  const { id } = useParams<{ id: string }>();
  const [isPdfLoading, setIsPdfLoading] = useState(false);
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
   * handleGeneratePdf
   * pt-BR: Faz uma requisição GET ao endpoint de PDF de matrículas.
   *        Se receber HTML (com debug_html=1), usa a biblioteca html2pdf no frontend
   *        para converter o HTML em PDF e baixar diretamente.
   * en-US: Performs a GET request to the enrollment PDF endpoint.
   *        If it receives HTML (with debug_html=1), uses the html2pdf library in the 
   *        frontend to convert HTML to PDF and download directly.
   */
  async function handleGeneratePdf() {
    if (!id) return;
    setIsPdfLoading(true);
    try {
        const base = getApiUrl();
        // Mudamos para debug_html=1 para receber o HTML e processar no frontend
        const url = `${base}/pdf/matriculas/${encodeURIComponent(String(id))}?debug_html=1&engine=snap&no_store=1&force=1&cache_ttl=0`;
        const headers: HeadersInit = { Accept: 'application/json, text/html' };
        const tk = token || localStorage.getItem('auth_token');
        if (tk) headers['Authorization'] = `Bearer ${tk}`;
        
        const resp = await fetch(url, { method: 'GET', headers });
        if (!resp.ok) {
          setIsPdfLoading(false);
          toast({ title: 'Erro', description: `Falha ao buscar dados (HTTP ${resp.status})`, variant: 'destructive' });
          return;
        }

        const ct = resp.headers.get('Content-Type') || '';
        
        // Se o backend retornou HTML, geramos o PDF no frontend
        if (ct.includes('text/html')) {
          const htmlText = await resp.text();
          console.log('HTML recebido do backend, tamanho:', htmlText.length);
          
          if (htmlText.length < 100) {
              console.warn('HTML muito curto, pode estar incompleto:', htmlText);
          }

          // Criamos um iframe oculto para carregar o HTML completo com seus estilos
          const iframe = document.createElement('iframe');
          iframe.style.position = 'fixed';
          iframe.style.left = '-10000px';
          iframe.style.top = '0';
          iframe.style.width = '210mm'; // Largura A4 padrão
          iframe.style.height = '100%';
          iframe.style.border = '0';
          iframe.style.opacity = '0';
          iframe.style.pointerEvents = 'none';
          document.body.appendChild(iframe);
          
          // Injeta o HTML no iframe
          const iframeDoc = iframe.contentWindow?.document || iframe.contentDocument;
          if (!iframeDoc) {
             throw new Error('Não foi possível acessar o documento do iframe');
          }
          
          iframeDoc.open();
          iframeDoc.write(htmlText);
          iframeDoc.close();

          // Aguarda um pouco para as fontes e imagens (agora URLs públicas) serem processadas
          await new Promise(resolve => setTimeout(resolve, 2000));

          // Configurações do html2pdf
          const options = {
            margin:       0, // Margem já controlada pelo Blade do backend
            filename:     `proposta-${id}.pdf`,
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { 
              scale: 1, // Reduzido para evitar "Canvas exceeds max size" em documentos longos
              useCORS: true,
              letterRendering: true,
              logging: false,
              scrollY: 0,
              windowWidth: 794, 
            },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
          };

          try {
            // Geramos o PDF a partir do body do iframe
            // @ts-ignore
            await html2pdf().from(iframeDoc.body).set(options).save();
            toast({ title: 'PDF gerado', description: 'O download do PDF foi iniciado.' });
          } catch (err) {
            console.error('Erro no html2pdf:', err);
            throw err;
          } finally {
            document.body.removeChild(iframe);
          }
          return;
        }
        
        // Caso o backend tenha retornado PDF ou JSON (legado)
        if (ct.includes('application/pdf')) {
          const blob = await resp.blob();
          const urlBlob = URL.createObjectURL(blob);
          window.open(urlBlob, '_blank');
          toast({ title: 'PDF gerado', description: 'Abrindo o documento em nova aba.' });
          return;
        }

        const data = await resp.json().catch(() => ({}));
        const targetUrl = data?.data?.url || data?.url;
        if (typeof targetUrl === 'string' && targetUrl.length > 0) {
          const bust = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
          window.open(bust, '_blank');
          toast({ title: 'PDF gerado', description: 'Abrindo o documento em nova aba.' });
        } else {
          toast({ title: 'PDF processado', description: 'Resposta sem conteúdo PDF/HTML. Verifique o servidor.' });
        }
    } catch (err: any) {
      console.error('Erro PDF:', err);
      toast({ title: 'Erro ao gerar PDF', description: err.message, variant: 'destructive' });
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
          <Button variant="outline" onClick={handleGeneratePdf}>
            <FileText className="h-4 w-4 mr-2" /> Gerar PDF
          </Button>
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
