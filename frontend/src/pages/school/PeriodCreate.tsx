import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EditFooterBar from '@/components/ui/edit-footer-bar';
import { periodsService } from '@/services/periodsService';
import { PeriodForm } from '@/components/school/PeriodForm';
import type { CreatePeriodInput } from '@/types/periods';
import { useToast } from '@/hooks/use-toast';
import { ChevronLeft } from 'lucide-react';

/**
 * PeriodCreate
 * pt-BR: Página de criação de período usando EditFooterBar.
 * en-US: Period creation page using EditFooterBar.
 */
export default function PeriodCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const submitRef = useRef<(() => void) | null>(null);
  const finishAfterSaveRef = useRef<boolean>(false);
  const { toast } = useToast();
  const returnPath = (location.state as any)?.returnPath as string | undefined;
  const prefillData = ((location.state as any)?.prefillData ?? null) as CreatePeriodInput | null;

  const createMutation = useMutation({
    mutationFn: async (payload: CreatePeriodInput) => periodsService.createPeriod(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periods'] });
      queryClient.invalidateQueries({ queryKey: ['periodos'] });
      toast({
        title: 'Período criado com sucesso',
        description: 'As alterações foram salvas.',
      });
      if (finishAfterSaveRef.current) {
        navigate(returnPath || buildListUrlWithSearch());
      }
    },
    onError: (err: any) => {
      toast({
        title: 'Falha ao salvar período',
        description: String(err?.message ?? 'Verifique os dados e tente novamente.'),
        variant: 'destructive',
      });
    },
  });

  /**
   * buildListUrlWithSearch
   * pt-BR: Constrói a URL da listagem de períodos preservando os parâmetros de busca atuais.
   * en-US: Builds the periods listing URL preserving current search parameters.
   */
  function buildListUrlWithSearch(): string {
    const suffix = searchParams.toString();
    return `/admin/school/periods${suffix ? `?${suffix}` : ''}`;
  }

  /**
   * handleBack
   * pt-BR: Volta para listagem de períodos.
   * en-US: Navigates back to periods listing.
   */
  const handleBack = () => navigate(returnPath || buildListUrlWithSearch());

  /**
   * handleSaveContinue
   * pt-BR: Salva e permanece na página.
   * en-US: Saves and stays on the page.
   */
  const handleSaveContinue = () => {
    finishAfterSaveRef.current = false;
    submitRef.current?.();
  };

  /**
   * handleSaveFinish
   * pt-BR: Salva e volta para listagem.
   * en-US: Saves and navigates back to listing.
   */
  const handleSaveFinish = () => {
    finishAfterSaveRef.current = true;
    submitRef.current?.();
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Cabeçalho principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            onClick={handleBack}
            className="h-10 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-zinc-50 transition-all duration-200"
          >
            <ChevronLeft className="w-4 h-4 mr-1 text-zinc-500" />
            Voltar
          </Button>
          <div className="h-6 w-[1px] bg-zinc-200 dark:bg-zinc-800"></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Novo Período</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Configure as etapas, custos, aeronaves e contratos para criar um novo período.</p>
          </div>
        </div>
      </div>

      <Card className="border border-zinc-200/80 dark:border-zinc-800/80 shadow-sm rounded-2xl bg-white dark:bg-zinc-950 p-6">
        <CardContent className="p-0">
          <PeriodForm
            initialData={prefillData || {
              id_curso: searchParams.get('id_curso') ? Number(searchParams.get('id_curso')) : undefined,
            }}
            onSubmit={async (data) => createMutation.mutateAsync(data as CreatePeriodInput)}
            isSubmitting={createMutation.isPending}
            onSubmitRef={submitRef}
          />
        </CardContent>
      </Card>

      <EditFooterBar
        onBack={handleBack}
        onContinue={handleSaveContinue}
        onFinish={handleSaveFinish}
        disabled={createMutation.isPending}
      />
    </div>
  );
}
