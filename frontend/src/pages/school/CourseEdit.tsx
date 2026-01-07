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
import { useToast } from '@/hooks/use-toast';

export default function CourseEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const submitRef = useRef<(() => void) | null>(null);
  const finishAfterSaveRef = useRef<boolean>(false);
  const { toast } = useToast();

  const { data: course, isLoading } = useQuery<CourseRecord | null>({
    queryKey: ['courses', 'detail', id],
    queryFn: async () => {
      const res = await coursesService.getById(String(id));
      return res ?? null;
    },
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: async (payload: CoursePayload) => coursesService.updateCourse(String(id), payload),
    onSuccess: () => {
        toast({
            title: "Sucesso",
            description: "Curso atualizado com sucesso.",
            variant: "default", // or just omit variant for default success style if configured
            className: "bg-green-500 text-white border-none"
        });
        queryClient.invalidateQueries({ queryKey: ['courses', 'list'] });
        queryClient.invalidateQueries({ queryKey: ['courses', 'detail', id] });
        if (finishAfterSaveRef.current) {
          navigate('/admin/school/courses');
        }
    },
    onError: (err) => {
        console.error("Erro na mutação updateCourse:", err);
        toast({
            title: "Erro",
            description: "Erro ao atualizar curso. Verifique os dados.",
            variant: "destructive",
        });
    }
  });

  const handleSubmit = async (data: CoursePayload) => {
    updateMutation.mutate(data);
  };

  const handleBack = () => navigate('/admin/school/courses');

  const handleSaveContinue = () => {
    finishAfterSaveRef.current = false;
    submitRef.current?.();
  };

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