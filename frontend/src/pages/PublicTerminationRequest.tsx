import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Loader2, FileText, Printer, CheckCircle, AlertCircle, Pencil } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { rescisoesService } from '@/services/rescisoesService';
import { useAuth } from '@/contexts/AuthContext';

export default function PublicTerminationRequest() {
  const { token } = useParams<{ token: string }>();
  const { user, isAuthenticated } = useAuth();
  const [termoHtml, setTermoHtml] = useState('');
  const [rescisao, setRescisao] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState('');

  useEffect(() => {
    if (!token) {
      setError('Token de acesso não informado.');
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const { rescisao, termoHtml } = await rescisoesService.getPublicRescisao(token);
        setTermoHtml(termoHtml);
        setRescisao(rescisao);
      } catch (e: any) {
        setError(e?.message || 'Rescisão não encontrada.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token]);

  const handleSign = async () => {
    if (!token) return;
    setSigning(true);
    setSignError('');
    try {
      const result = await rescisoesService.signTermo(token);
      if (result.exec && result.sign_url) {
        window.location.href = result.sign_url;
      } else {
        setSignError('Erro ao iniciar assinatura digital.');
      }
    } catch (e: any) {
      setSignError(e?.message || 'Erro ao iniciar assinatura digital.');
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <PublicHeader />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span>Carregando dados da rescisão...</span>
          </div>
        </main>
        <PublicFooter />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col">
        <PublicHeader />
        <main className="flex-1 flex items-center justify-center">
          <Card className="max-w-md mx-auto">
            <CardContent className="p-8 text-center space-y-3">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <h2 className="text-xl font-semibold">Rescisão não encontrada</h2>
              <p className="text-muted-foreground">{error || 'O link de rescisão é inválido ou expirou.'}</p>
            </CardContent>
          </Card>
        </main>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <PublicHeader />

      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-8 space-y-4 print:px-0 print:py-0">
        <div className="flex justify-between items-center print:hidden">
          {isAuthenticated && user && user.permission_id <= 5 && rescisao && (
            <Button
              asChild
              variant="default"
              size="sm"
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
            >
              <Link to={`/admin/school/termination?edit=${rescisao.id}`}>
                <Pencil className="h-4 w-4" />
                Editar no Painel
              </Link>
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="gap-2 ml-auto"
          >
            <Printer className="h-4 w-4" />
            Imprimir
          </Button>
        </div>

        {termoHtml && (
          <Card className="print:shadow-none print:border-0">
            <CardContent className="p-6 print:p-4">
              <div
                className="termo-rescisao"
                dangerouslySetInnerHTML={{ __html: termoHtml }}
              />
            </CardContent>
          </Card>
        )}

        {/* Sign agreement button */}
        <div className="print:hidden">
          <Card className="border-2 border-primary/20 bg-primary/5">
            <CardContent className="p-6 text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                Ao clicar em <strong>Concordar</strong>, você declara estar de acordo com os termos da rescisão acima e autoriza o início do processo de assinatura digital.
              </p>
              {signError && (
                <div className="flex items-center justify-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg p-3">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {signError}
                </div>
              )}
              <Button
                size="lg"
                onClick={handleSign}
                disabled={signing}
                className="w-full sm:w-auto gap-2 text-base font-semibold"
              >
                {signing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Enviando para assinatura...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    Concordar
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
