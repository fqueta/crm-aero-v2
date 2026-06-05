import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EditFooterBar from '@/components/ui/edit-footer-bar';
import { contractsService } from '@/services/contractsService';
import { periodsService } from '@/services/periodsService';
import { ContractForm } from '@/components/school/ContractForm';
import type { ContractRecord, UpdateContractInput } from '@/types/contracts';
import { toast } from 'sonner';

/**
 * ContractEdit
 * pt-BR: Página para editar contrato/termo existente usando EditFooterBar.
 * en-US: Page to edit an existing contract/term using EditFooterBar.
 */
export default function ContractEdit() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const submitRef = useRef<(() => void) | null>(null);
  const finishAfterSaveRef = useRef<boolean>(false);
  
  const returnPath = (location.state as any)?.returnPath as string | undefined;

  const { data: contract, isLoading } = useQuery<ContractRecord | null>({
    queryKey: ['contracts', 'detail', id],
    /**
     * queryFn
     * pt-BR: Tenta obter o contrato; retorna null se não encontrado.
     * en-US: Tries to fetch contract; returns null if not found.
     */
    queryFn: async () => {
      const res = await contractsService.getById(String(id));
      return res ?? null;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: UpdateContractInput) => contractsService.updateContract(String(id), payload),
  });

  /**
   * normalizePeriodIds
   * pt-BR: Normaliza o valor de período para uma lista de IDs em string.
   * en-US: Normalizes the period value into a list of string IDs.
   */
  function normalizePeriodIds(value?: UpdateContractInput['periodo'] | ContractRecord['periodo'] | null): string[] {
    if (Array.isArray(value)) {
      return value.map(String).filter(Boolean);
    }
    return value ? [String(value)] : [];
  }

  /**
   * syncContractPeriodSelection
   * pt-BR: Sincroniza o contrato entre o período antigo e o novo período selecionado.
   * en-US: Syncs the contract between the previous period and the newly selected period.
   */
  async function syncContractPeriodSelection(
    contractId: string | number,
    previousPeriodIds?: UpdateContractInput['periodo'] | ContractRecord['periodo'] | null,
    nextPeriodIds?: UpdateContractInput['periodo'] | null
  ) {
    const previousSet = new Set(normalizePeriodIds(previousPeriodIds));
    const nextSet = new Set(normalizePeriodIds(nextPeriodIds));

    for (const previousId of previousSet) {
      if (nextSet.has(previousId)) continue;
      const previousPeriod = await periodsService.getById(previousId);
      if (!previousPeriod) continue;
      const nextContractIds = (Array.isArray(previousPeriod.id_contratos) ? previousPeriod.id_contratos : [])
        .map(String)
        .filter((linkedId) => linkedId !== String(contractId));
      await periodsService.updatePeriod(previousId, { id_contratos: nextContractIds });
    }

    for (const nextId of nextSet) {
      const nextPeriod = await periodsService.getById(nextId);
      if (!nextPeriod) continue;
      const currentIds = Array.isArray(nextPeriod.id_contratos) ? nextPeriod.id_contratos.map(String) : [];
      if (currentIds.includes(String(contractId))) continue;
      await periodsService.updatePeriod(nextId, {
        id_contratos: [...currentIds, String(contractId)],
      });
    }

    queryClient.invalidateQueries({ queryKey: ['periodos'] });
    queryClient.invalidateQueries({ queryKey: ['periods'] });
  }

  /**
   * handleSubmit
   * pt-BR: Submete atualização do contrato e volta à listagem se finalizar.
   * en-US: Submits contract update and navigates back to list if finishing.
   */
  const handleSubmit = async (data: UpdateContractInput) => {
    try {
      await updateMutation.mutateAsync(data);
      await syncContractPeriodSelection(String(id), contract?.periodo, data.periodo);
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contracts', 'detail', id] });
      if (finishAfterSaveRef.current) {
        if (returnPath) {
          navigate(returnPath);
        } else {
          navigate('/admin/school/contracts');
        }
      }
    } catch (error: any) {
      toast.error('Erro ao atualizar contrato', {
        description: String(error?.response?.data?.message || error?.body?.message || error?.message || 'Não foi possível atualizar o contrato.'),
      });
    }
  };

  /**
   * handleBack
   * pt-BR: Volta para listagem de contratos.
   * en-US: Navigates back to contracts listing.
   */
  const handleBack = () => {
    if (returnPath) {
      navigate(returnPath);
    } else {
      navigate('/admin/school/contracts');
    }
  };

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
   * pt-BR: Salva e finaliza (volta para listagem).
   * en-US: Saves and finishes (navigates back to list).
   */
  const handleSaveFinish = () => {
    finishAfterSaveRef.current = true;
    submitRef.current?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Editar Contrato</h1>
        {/* Botão de volta no topo removido conforme solicitação */}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Atualização de Contrato</CardTitle>
          <CardDescription>Edite as informações abaixo.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Carregando...</p>
          ) : (
            <ContractForm initialData={contract} onSubmit={handleSubmit} isSubmitting={updateMutation.isPending} onSubmitRef={submitRef} />
          )}
        </CardContent>
      </Card>
      <EditFooterBar
        onBack={handleBack}
        onContinue={handleSaveContinue}
        onFinish={handleSaveFinish}
        disabled={updateMutation.isPending}
        fixed
      />
    </div>
  );
}
