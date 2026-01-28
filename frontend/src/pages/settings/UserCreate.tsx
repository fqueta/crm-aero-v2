import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import * as z from "zod";
import { UserForm } from "@/components/users/UserForm";
import EditFooterBar from '@/components/ui/edit-footer-bar';
import { useCreateUser } from '@/hooks/users';
import { usePermissionsList } from '@/hooks/permissions';
import { UserFormData, CreateUserInput } from '@/types/users';

const userSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  permission_id: z.string().optional(),
  tipo_pessoa: z.enum(["pf", "pj"]).optional(),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"), // Password required for create
  genero: z.enum(["m", "f", "ni"]).optional(),
  ativo: z.enum(["s", "n"]).optional(),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  razao: z.string().optional(),
  config: z.object({
    celular: z.string().optional(),
    telefone_comercial: z.string().optional(),
    telefone_residencial: z.string().optional(),
    nascimento: z.string().optional(),
    cep: z.string().optional(),
    endereco: z.string().optional(),
    numero: z.string().optional(),
    complemento: z.string().optional(),
    bairro: z.string().optional(),
    cidade: z.string().optional(),
    uf: z.string().optional(),
  }).optional(),
});

export default function UserCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const finishAfterSaveRef = useRef<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);

  const { data: permissionsData, isLoading: isLoadingPermissions } = usePermissionsList();
  const permissions = permissionsData?.data || [];
  
  const createUserMutation = useCreateUser();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: "",
      email: "",
      permission_id: "",
      tipo_pessoa: "pf",
      genero: 'ni',
      ativo: 's',
      config: {
        celular: '',
        telefone_comercial: '',
        telefone_residencial: '',
        nascimento: '',
        cep: '',
        endereco: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        uf: '',
      },
    },
  });

  const onSubmit = (data: UserFormData) => {
    setIsLoading(true);
    
    // Convert UserFormData to CreateUserInput
    // config needs to be cast or mapped if strictly typed
    const payload: CreateUserInput = {
        ...data,
        token: '',
        password: data.password || 'mudar123', // Schema enforces it but fallback just in case
        config: data.config as any
    };

    createUserMutation.mutate(payload, {
        onSuccess: () => {
          toast({ title: "Usuário criado com sucesso" });
          setIsLoading(false);
          if (finishAfterSaveRef.current) {
            navigate('/admin/settings/users');
          } else {
             // If "Save and Continue", maybe clear form or stay? 
             // Usually "Save and Continue" stays on edit page of created item or just clears for new.
             // EditFooterBar usually implies "Save and (stay/create another)" vs "Save and Exit".
             // For Create, "Save and Continue" typically means "Save and Create Another" or "Save and Edit This".
             // Sticking to "Save and Exit" -> list. "Save and Continue" -> stay/reset.
             // Let's reset form for "Save and Continue" (Create Another)
             form.reset();
             toast({ title: "Pronto para criar outro usuário" });
          }
        },
        onError: (error: any) => {
          toast({ 
            title: "Erro ao criar", 
            description: error?.message || "Ocorreu um erro ao criar o usuário",
            variant: "destructive" 
          });
          setIsLoading(false);
        }
      }
    );
  };

  const handleCancel = () => {
    navigate('/admin/settings/users');
  };

  return (
    <div className="container mx-auto p-6 space-y-6 pb-24">
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="sm" onClick={handleCancel}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Novo Usuário</h1>
          <p className="text-gray-600">Preencha os dados para criar um novo usuário</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Usuário</CardTitle>
          <CardDescription>Campos obrigatórios marcados com *</CardDescription>
        </CardHeader>
        <CardContent>
            <UserForm 
              form={form}
              onSubmit={onSubmit}
              onCancel={handleCancel}
              permissions={permissions}
              isLoadingPermissions={isLoadingPermissions}
              showFooter={false}
            />
        </CardContent>
      </Card>

      <EditFooterBar
        onBack={handleCancel}
        onContinue={() => { finishAfterSaveRef.current = false; form.handleSubmit(onSubmit)(); }}
        onFinish={() => { finishAfterSaveRef.current = true; form.handleSubmit(onSubmit)(); }}
        disabled={isLoading || createUserMutation.isPending}
        fixed
      />
    </div>
  );
}