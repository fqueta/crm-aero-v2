import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import * as z from "zod";
import { Form } from "@/components/ui/form";
import { UserForm } from "@/components/users/UserForm";
import EditFooterBar from '@/components/ui/edit-footer-bar';
import { useUser, useUpdateUser } from '@/hooks/users';
import { usePermissionsList } from '@/hooks/permissions';
import { UserFormData, UpdateUserInput } from '@/types/users';

const userSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  permission_id: z.string().optional(),
  tipo_pessoa: z.enum(["pf", "pj"]).optional(),
  password: z.string().optional(),
  genero: z.enum(["m", "f", "ni"]).optional(),
  ativo: z.enum(["s", "n"]).optional(),
  cpf: z.string().nullable().optional(),
  cnpj: z.string().nullable().optional(),
    razao: z.string().nullable().optional(),
  config: z.object({
      celular: z.string().nullable().optional(),
      telefone_comercial: z.string().nullable().optional(),
      telefone_residencial: z.string().nullable().optional(),
      nascimento: z.string().nullable().optional(),
      cep: z.string().nullable().optional(),
      endereco: z.string().nullable().optional(),
      numero: z.string().nullable().optional(),
      complemento: z.string().nullable().optional(),
      bairro: z.string().nullable().optional(),
      cidade: z.string().nullable().optional(),
      uf: z.string().nullable().optional(),
      equipe: z.array(z.string()).optional(),
  }).optional(),
});

export default function UserEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const finishAfterSaveRef = useRef<boolean>(false);
  const [isLoading, setIsLoading] = useState(false);

  const { data: userResponse, isLoading: isLoadingUser } = useUser(id!);
  // Handle response format if wrapped in data or direct
  const userData = (userResponse as any)?.data || userResponse;

  const { data: permissionsData, isLoading: isLoadingPermissions } = usePermissionsList();
  const permissions = permissionsData?.data || [];
  
  const updateUserMutation = useUpdateUser();

  const form = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    shouldFocusError: true,
    defaultValues: {
      name: "",
      email: "",
      permission_id: "",
      tipo_pessoa: "pf",
      config: {},
    },
  });

  useEffect(() => {
    if (userData) {
      const rawCfg = (userData as any)?.config;
      let cfg: any = {};
      try {
        cfg = typeof rawCfg === 'string' ? (JSON.parse(rawCfg || '{}') || {}) : (rawCfg || {});
      } catch {
        cfg = {};
      }
      const equipe = Array.isArray(cfg?.equipe) ? (cfg.equipe as any[]).map((v: any) => String(v)) : [];
      form.reset({
        name: userData.name,
        email: userData.email,
        permission_id: userData.permission_id != null ? String(userData.permission_id) : '',
        tipo_pessoa: userData.tipo_pessoa || "pf",
        genero: userData.genero,
        ativo: userData.ativo,
        cpf: userData.cpf ?? '',
        cnpj: userData.cnpj ?? '',
        config: { ...(cfg || {}), equipe },
      });
    }
  }, [userData, form]);

  /**
   * ensurePermissionSelected
   * pt-BR: Após carregar permissões, garante que o Select reflita o permission_id do usuário.
   * en-US: After permissions load, ensure the Select reflects the user's permission_id.
   */
  useEffect(() => {
    const current = form.getValues('permission_id');
    const hasOptions = Array.isArray(permissions) && permissions.length > 0;
    if (hasOptions) {
      const target = userData?.permission_id != null ? String(userData.permission_id) : '';
      if (!current && target) {
        form.setValue('permission_id', target, { shouldDirty: false, shouldValidate: true });
      }
    }
  }, [permissions, userData, form]);



  const onSubmit = (data: UserFormData) => {
    setIsLoading(true);
    // Cast to any to avoid strict type mismatch with UserConfig which expects all fields
    const { razao: _razao, cnpj: _cnpj, ...rest } = data;
    const payload: UpdateUserInput = {
        ...rest,
        // Converte strings vazias para null quando necessário
        cpf: data.cpf && data.cpf.trim() !== '' ? data.cpf : undefined,
        // Removemos CNPJ do cadastro de usuário (PJ não se aplica aqui)
        cnpj: undefined,
        config: {
          ...(data.config as any || {}),
          equipe: Array.isArray((data.config as any)?.equipe) ? ((data.config as any).equipe as any[]).map((v: any) => String(v)) : undefined,
        } as any
    };

    updateUserMutation.mutate(
      { id: id!, data: payload },
      {
        onSuccess: () => {
          toast({ title: "Usuário atualizado com sucesso" });
          setIsLoading(false);
          if (finishAfterSaveRef.current) {
            navigate('/admin/settings/users');
          }
        },
        onError: (error: any) => {
          toast({ 
            title: "Erro ao atualizar", 
            description: error?.message || "Ocorreu um erro ao salvar o usuário",
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

  /**
   * onInvalid
   * pt-BR: Exibe mensagem amigável quando houver erros de validação e mantém foco no primeiro campo inválido.
   * en-US: Shows a friendly message when validation errors occur and keeps focus on the first invalid field.
   */
  const onInvalid = (errors: any) => {
    function findFirstPath(obj: any, base = ''): { path: string; err: any } | null {
      if (!obj || typeof obj !== 'object') return null;
      for (const k of Object.keys(obj)) {
        const v: any = obj[k];
        const curr = base ? `${base}.${k}` : k;
        if (v && typeof v === 'object') {
          if (v.message) return { path: curr, err: v };
          const deeper = findFirstPath(v, curr);
          if (deeper) return deeper;
        }
      }
      return null;
    }
    const found = findFirstPath(errors) || { path: '', err: undefined };
    const path = found.path;
    const firstError: any = found.err;
    const labels: Record<string, string> = {
      name: 'Nome',
      email: 'Email',
      permission_id: 'Permissão de Acesso',
      tipo_pessoa: 'Tipo de Pessoa',
      genero: 'Gênero',
      ativo: 'Status',
      cpf: 'CPF',
      cnpj: 'CNPJ',
      'config.celular': 'Celular',
      'config.telefone_residencial': 'Telefone',
      'config.telefone_comercial': 'Telefone Comercial',
      'config.nascimento': 'Data de Nascimento',
      'config.cep': 'CEP',
      'config.equipe': 'Equipe',
    };
    const label = labels[path] || path || 'campo';
    const rawMsg = firstError?.message || '';
    const friendly = rawMsg && rawMsg.toLowerCase().includes('expected string')
      ? `Campo ${label} está vazio ou inválido`
      : (rawMsg || `Corrija o campo ${label} antes de salvar`);
    if (path) {
      try { form.setFocus(path as any); } catch {}
    }
    toast({
      title: "Validação necessária",
      description: friendly,
      variant: "destructive",
    });
  };

  if (isLoadingUser) {
     return <div className="p-8 text-center">Carregando...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6 pb-24">
      <div className="flex items-center space-x-4">
        <Button variant="outline" size="sm" onClick={handleCancel}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editar Usuário</h1>
          <p className="text-gray-600">Atualize as informações do cadastro</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados do Usuário</CardTitle>
        </CardHeader>
        <CardContent>
            <UserForm 
              form={form}
              onSubmit={onSubmit}
              onCancel={handleCancel}
              editingUser={userData}
              permissions={permissions}
              isLoadingPermissions={isLoadingPermissions}
              showFooter={false}
            />
        </CardContent>
      </Card>

      <EditFooterBar
        onBack={handleCancel}
        onContinue={() => { finishAfterSaveRef.current = false; form.handleSubmit(onSubmit, onInvalid)(); }}
        onFinish={() => { finishAfterSaveRef.current = true; form.handleSubmit(onSubmit, onInvalid)(); }}
        disabled={isLoading || updateUserMutation.isPending}
        fixed
      />
    </div>
  );
}
