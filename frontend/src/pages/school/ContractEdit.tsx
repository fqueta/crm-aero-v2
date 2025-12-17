import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EditFooterBar from '@/components/ui/edit-footer-bar';
import { contractsService } from '@/services/contractsService';
import { ContractForm } from '@/components/school/ContractForm';
import type { ContractRecord, UpdateContractInput } from '@/types/contracts';

/**
 * ContractEdit
 * pt-BR: Página para editar contrato/termo existente usando EditFooterBar.
 * en-US: Page to edit an existing contract/term using EditFooterBar.
 */
export default function ContractEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const submitRef = useRef<(() => void) | null>(null);
  const finishAfterSaveRef = useRef<boolean>(false);

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
   * handleSubmit
   * pt-BR: Submete atualização do contrato e volta à listagem se finalizar.
   * en-US: Submits contract update and navigates back to list if finishing.
   */
  const handleSubmit = async (data: UpdateContractInput) => {
    updateMutation.mutate(data, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['contracts', 'list'] });
        queryClient.invalidateQueries({ queryKey: ['contracts', 'detail', id] });
        if (finishAfterSaveRef.current) {
          navigate('/admin/school/contracts');
        }
      },
    });
  };

  /**
   * handleBack
   * pt-BR: Volta para listagem de contratos.
   * en-US: Navigates back to contracts listing.
   */
  const handleBack = () => navigate('/admin/school/contracts');

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