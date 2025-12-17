import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClassForm } from '@/components/school/ClassForm';
import EditFooterBar from '@/components/ui/edit-footer-bar';
import { turmasService } from '@/services/turmasService';
import type { TurmaPayload, TurmaRecord } from '@/types/turmas';

/**
 * ClassEdit
 * pt-BR: Página para editar turma existente.
 * en-US: Page to edit an existing class.
 */
export default function ClassEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const submitRef = useRef<(() => void) | null>(null);
  const finishAfterSaveRef = useRef<boolean>(false);

  /**
   * turmaQuery
   * pt-BR: Busca turma por ID, garantindo retorno null quando não encontrada.
   * en-US: Fetches class by ID, returning null when not found.
   */
  const turmaQuery = useQuery<TurmaRecord | null>({
    queryKey: ['turmas', 'detail', id],
    queryFn: async () => {
      const res = await turmasService.getById(String(id));
      return res ?? null;
    },
    enabled: !!id,
  });

  /**
   * updateMutation
   * pt-BR: Atualiza turma, invalida cache e volta à listagem.
   * en-US: Updates class, invalidates cache and navigates back.
   */
  const updateMutation = useMutation({
    mutationFn: async (payload: TurmaPayload) => turmasService.updateTurma(String(id), payload),
  });

  /**
   * handleSubmit
   * pt-BR: Submete atualização da turma.
   * en-US: Submits class update.
   */
  const handleSubmit = async (data: TurmaPayload) => {
    updateMutation.mutate(data, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['turmas', 'list'] });
        queryClient.invalidateQueries({ queryKey: ['turmas', 'detail', id] });
        if (finishAfterSaveRef.current) {
          navigate('/admin/school/classes');
        }
      },
    });
  };

  /**
   * handleBack
   * pt-BR: Volta para a listagem de turmas.
   * en-US: Navigates back to classes listing.
   */
  const handleBack = () => navigate('/admin/school/classes');

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
        <h1 className="text-2xl font-bold">Editar Turma</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/school/classes')}>Voltar</Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Atualização de Turma</CardTitle>
          <CardDescription>Edite as informações nas abas abaixo.</CardDescription>
        </CardHeader>
        <CardContent>
          {turmaQuery.isLoading ? (
            <p>Carregando...</p>
          ) : (
            <ClassForm initialData={turmaQuery.data} onSubmit={handleSubmit} isSubmitting={updateMutation.isPending} onSubmitRef={submitRef} />
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