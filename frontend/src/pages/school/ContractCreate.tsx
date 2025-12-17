import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import EditFooterBar from '@/components/ui/edit-footer-bar';
import { contractsService } from '@/services/contractsService';
import { ContractForm } from '@/components/school/ContractForm';
import type { CreateContractInput, ContractRecord } from '@/types/contracts';
import { toast } from 'sonner';
import React from 'react';

/**
 * ContractCreate
 * pt-BR: Página de criação de contrato/termo usando EditFooterBar.
 * en-US: Contract/term creation page using EditFooterBar.
 */
export default function ContractCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const submitRef = useRef<(() => void) | null>(null);
  const finishAfterSaveRef = useRef<boolean>(false);

  /**
   * initialFromState
   * pt-BR: Dados iniciais vindos da navegação (duplication flow). Se presentes, pré-preenche o formulário.
   * en-US: Initial data from navigation (duplication flow). If present, prefill the form.
   */
  const initialFromState = ((location.state as any)?.initialContract ?? null) as ContractRecord | null;
  /**
   * duplicationHint
   * pt-BR: Exibe um toast informando que os dados foram pré-carregados.
   * en-US: Shows a toast informing that data has been preloaded.
   */
  try {
    // Wrap in effect to avoid multiple toasts on re-render
    // eslint-disable-next-line react-hooks/rules-of-hooks
    React.useEffect(() => {
      if (initialFromState) {
        toast.info('Duplicando contrato', { description: `Baseado em: ${initialFromState.nome || initialFromState.slug || initialFromState.id}` });
      }
    }, [initialFromState]);
  } catch {}

  const createMutation = useMutation({
    mutationFn: async (payload: CreateContractInput) => contractsService.createContract(payload),
  });

  /**
   * handleSubmit
   * pt-BR: Cria novo contrato e volta à listagem se finalizar.
   * en-US: Creates a new contract and navigates back to list if finishing.
   */
  const handleSubmit = async (data: CreateContractInput) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['contracts', 'list'] });
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

  /**
   * appendCopySuffix
   * pt-BR: Adiciona o sufixo " (Copia)" ao nome para indicar duplicação, evitando duplicar o rótulo.
   * en-US: Appends the " (Copia)" suffix to the name to indicate duplication, avoiding duplicate labels.
   */
  function appendCopySuffix(base: string): string {
    const text = String(base || '').trim();
    if (!text) return 'Sem nome (Copia)';
    const hasSuffix = /\(Copia\)\s*$/.test(text);
    return hasSuffix ? text : `${text} (Copia)`;
  }

  /**
   * initialForForm
   * pt-BR: Ajusta dados iniciais quando vindo de duplicação para exibir "(Copia)" no campo Nome.
   * en-US: Adjusts initial data when duplicating to show "(Copia)" in the Name field.
   */
  const initialForForm = initialFromState
    ? {
        ...initialFromState,
        nome: appendCopySuffix(
          String(initialFromState?.nome || initialFromState?.slug || initialFromState?.id || '')
        ),
      }
    : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Novo Contrato</h1>
        {/* Botão de volta no topo removido conforme solicitação */}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Cadastro de Contrato</CardTitle>
          <CardDescription>
            {initialFromState ? 'Dados pré-carregados do contrato selecionado. Edite e salve o novo registro.' : 'Preencha as informações abaixo.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ContractForm initialData={initialForForm} onSubmit={handleSubmit} isSubmitting={createMutation.isPending} onSubmitRef={submitRef} />
        </CardContent>
      </Card>
      <EditFooterBar
        onBack={handleBack}
        onContinue={handleSaveContinue}
        onFinish={handleSaveFinish}
        disabled={createMutation.isPending}
        fixed
      />
    </div>
  );
}