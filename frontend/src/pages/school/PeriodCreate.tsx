import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EditFooterBar from '@/components/ui/edit-footer-bar';
import { periodsService } from '@/services/periodsService';
import { PeriodForm } from '@/components/school/PeriodForm';
import type { CreatePeriodInput } from '@/types/periods';
import { useToast } from '@/hooks/use-toast';

/**
 * PeriodCreate
 * pt-BR: Página de criação de período usando EditFooterBar.
 * en-US: Period creation page using EditFooterBar.
 */
export default function PeriodCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const submitRef = useRef<(() => void) | null>(null);
  const finishAfterSaveRef = useRef<boolean>(false);
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (payload: CreatePeriodInput) => periodsService.createPeriod(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periods'] });
      toast({
        title: 'Período criado com sucesso',
        description: 'As alterações foram salvas.',
      });
      if (finishAfterSaveRef.current) navigate(buildListUrlWithSearch());
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
  const handleBack = () => navigate(buildListUrlWithSearch());

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
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Novo Período</CardTitle>
          <CardDescription>Crie um período vinculado a um curso.</CardDescription>
        </CardHeader>
        <CardContent>
          <PeriodForm
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