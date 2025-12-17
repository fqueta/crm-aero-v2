import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CourseForm } from '@/components/school/CourseForm';
import EditFooterBar from '@/components/ui/edit-footer-bar';
import { coursesService } from '@/services/coursesService';
import { CoursePayload, CourseRecord } from '@/types/courses';

/**
 * CourseEdit
 * pt-BR: Página para editar curso existente com formulário em abas.
 * en-US: Page to edit an existing course with tabbed form.
 */
export default function CourseEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const submitRef = useRef<(() => void) | null>(null);
  const finishAfterSaveRef = useRef<boolean>(false);

  const { data: course, isLoading } = useQuery<CourseRecord | null>({
    queryKey: ['courses', 'detail', id],
    /**
     * queryFn
     * pt-BR: Garante retorno não-`undefined`. Caso API não encontre o registro,
     *        retorna `null` para evitar erro do React Query.
     * en-US: Ensures non-`undefined` return. If API doesn't find the record,
     *        returns `null` to avoid React Query error.
     */
    queryFn: async () => {
      const res = await coursesService.getById(String(id));
      return res ?? null;
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: CoursePayload) => coursesService.updateCourse(String(id), payload),
  });

  /**
   * handleSubmit
   * pt-BR: Submete atualização do curso e volta à listagem.
   * en-US: Submits course update and navigates back to listing.
   */
  const handleSubmit = async (data: CoursePayload) => {
    updateMutation.mutate(data, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['courses', 'list'] });
        queryClient.invalidateQueries({ queryKey: ['courses', 'detail', id] });
        if (finishAfterSaveRef.current) {
          navigate('/admin/school/courses');
        }
      },
    });
  };

  /**
   * handleBack
   * pt-BR: Volta para a listagem de cursos.
   * en-US: Navigates back to courses listing.
   */
  const handleBack = () => navigate('/admin/school/courses');

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
        <h1 className="text-2xl font-bold">Editar Curso</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate('/admin/school/courses')}>Voltar</Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Atualização de Curso</CardTitle>
          <CardDescription>Edite as informações nas abas abaixo.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>Carregando...</p>
          ) : (
            <CourseForm initialData={course} onSubmit={handleSubmit} isSubmitting={updateMutation.isPending} onSubmitRef={submitRef} />
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