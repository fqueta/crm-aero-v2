import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EditFooterBar from '@/components/ui/edit-footer-bar';
import { periodsService } from '@/services/periodsService';
import { PeriodForm } from '@/components/school/PeriodForm';
import type { PeriodRecord, UpdatePeriodInput } from '@/types/periods';
import { useToast } from '@/hooks/use-toast';

/**
 * PeriodEdit
 * pt-BR: Página para editar período existente usando EditFooterBar.
 * en-US: Page to edit an existing period using EditFooterBar.
 */
export default function PeriodEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const submitRef = useRef<(() => void) | null>(null);
  const finishAfterSaveRef = useRef<boolean>(false);
  const { toast } = useToast();

  const { data: period, isLoading } = useQuery<PeriodRecord | null>({
    queryKey: ['periods', 'detail', id],
    /**
     * queryFn
     * pt-BR: Tenta obter o período; retorna null se não encontrado.
     * en-US: Tries to fetch period; returns null if not found.
     */
    queryFn: async () => {
      const res = await periodsService.getById(String(id));
      return res ?? null;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdatePeriodInput) => periodsService.updatePeriod(String(id), payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periods'] });
      toast({
        title: 'Período atualizado com sucesso',
        description: 'As alterações foram salvas.',
      });
      if (finishAfterSaveRef.current) navigate(buildListUrlWithSearch());
    },
    onError: (err: any) => {
      toast({
        title: 'Falha ao atualizar período',
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
          <CardTitle>Editar Período</CardTitle>
          <CardDescription>Atualize os dados do período.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div>Carregando…</div>
          ) : (
            <PeriodForm
              initialData={period}
              onSubmit={async (data) => updateMutation.mutateAsync(data as UpdatePeriodInput)}
              isSubmitting={updateMutation.isPending}
              onSubmitRef={submitRef}
            />
          )}
        </CardContent>
      </Card>

      <EditFooterBar
        onBack={handleBack}
        onContinue={handleSaveContinue}
        onFinish={handleSaveFinish}
        disabled={isLoading || updateMutation.isPending}
      />
    </div>
  );
}