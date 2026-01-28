import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, User, MapPin, Phone, Mail, Calendar, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUser } from '@/hooks/users';
import { usePermissionsList } from '@/hooks/permissions';
import { phoneApplyMask } from '@/lib/masks/phone-apply-mask';
import { UserRecord } from '@/types/users';

export default function UserView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: userResponse, isLoading, error } = useUser(id!);
  const userData = (userResponse as any)?.data || userResponse as UserRecord;

  const { data: permissionsResponse } = usePermissionsList({ per_page: 100 });
  const permissions = permissionsResponse?.data || [];

  const handleBack = () => {
    navigate('/admin/settings/users');
  };

  const handleEdit = () => {
    navigate(`/admin/settings/users/edit/${id}`);
  };

  const formatCPF = (cpf?: string) => {
    if (!cpf) return '-';
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatCNPJ = (cnpj?: string) => {
    if (!cnpj) return '-';
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  };

  const formatPhone = (phone?: string) => {
    if (!phone) return '-';
    // Remove non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    return phoneApplyMask(cleaned) || phone;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleDateString('pt-BR');
    } catch {
      return dateString;
    }
  };

  const getPermissionName = (id?: string) => {
    if (!id) return '-';
    const permission = permissions.find(p => String(p.id) === String(id));
    return permission ? permission.name : id;
  };

  if (isLoading) {
    return <div className="p-8 text-center">Carregando...</div>;
  }

  if (error || !userData) {
    return (
      <div className="container mx-auto p-6 text-center">
        <h2 className="text-xl font-semibold text-red-600">Erro ao carregar usuário</h2>
        <Button onClick={handleBack} variant="outline" className="mt-4">
          Voltar
        </Button>
      </div>
    );
  }

  const isPJ = userData.tipo_pessoa === 'pj';

  return (
    <div className="container mx-auto p-6 space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{userData.name}</h1>
            <p className="text-gray-600">{userData.email}</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <Badge variant={userData.ativo === 's' ? 'default' : 'secondary'}>
            {userData.ativo === 's' ? 'Ativo' : 'Inativo'}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <User className="mr-2 h-5 w-5" />
              Informações Básicas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Nome</label>
              <p className="text-sm font-medium">{userData.name}</p>
            </div>
            <div>
               <label className="text-sm font-medium text-gray-500">Tipo de Pessoa</label>
               <p className="text-sm font-medium">{isPJ ? 'Pessoa Jurídica' : 'Pessoa Física'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">{isPJ ? 'CNPJ' : 'CPF'}</label>
              <p className="text-sm font-medium">{isPJ ? formatCNPJ(userData.cnpj) : formatCPF(userData.cpf)}</p>
            </div>
            {isPJ && userData.razao && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Razão Social</label>
                  <p className="text-sm font-medium">{userData.razao}</p>
                </div>
            )}
            {!isPJ && userData.genero && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Gênero</label>
                  <p className="text-sm font-medium">
                      {userData.genero === 'm' ? 'Masculino' : userData.genero === 'f' ? 'Feminino' : 'Não Informado'}
                  </p>
                </div>
            )}
            {userData.config?.nascimento && (
               <div>
                  <label className="text-sm font-medium text-gray-500">Data de Nascimento</label>
                  <p className="text-sm font-medium flex items-center">
                      <Calendar className="mr-2 h-4 w-4 text-gray-400" />
                      {formatDate(userData.config.nascimento)}
                  </p>
               </div>
            )}
             <div>
              <label className="text-sm font-medium text-gray-500">Permissão</label>
              <p className="text-sm font-medium flex items-center">
                  <Shield className="mr-2 h-4 w-4 text-gray-400" />
                  {getPermissionName(userData.permission_id)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contact */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Phone className="mr-2 h-5 w-5" />
              Contato
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Email</label>
              <p className="text-sm font-medium flex items-center">
                  <Mail className="mr-2 h-4 w-4 text-gray-400" />
                  {userData.email}
              </p>
            </div>
            {userData.config?.celular && (
                <div>
                   <label className="text-sm font-medium text-gray-500">Celular</label>
                   <p className="text-sm font-medium flex items-center">
                       <Phone className="mr-2 h-4 w-4 text-gray-400" />
                       {formatPhone(userData.config.celular)}
                   </p>
                </div>
            )}
            {userData.config?.telefone_comercial && (
                <div>
                   <label className="text-sm font-medium text-gray-500">Telefone Comercial</label>
                   <p className="text-sm font-medium flex items-center">
                       <Phone className="mr-2 h-4 w-4 text-gray-400" />
                       {formatPhone(userData.config.telefone_comercial)}
                   </p>
                </div>
            )}
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MapPin className="mr-2 h-5 w-5" />
              Endereço
            </CardTitle>
          </CardHeader>
           <CardContent className="space-y-4">
               {userData.config?.cep ? (
                   <>
                       <div>
                          <label className="text-sm font-medium text-gray-500">CEP</label>
                          <p className="text-sm font-medium">{userData.config.cep}</p>
                       </div>
                       <div>
                           <label className="text-sm font-medium text-gray-500">Endereço</label>
                           <p className="text-sm font-medium">
                               {userData.config.endereco}, {userData.config.numero}
                               {userData.config.complemento && ` - ${userData.config.complemento}`}
                           </p>
                       </div>
                       <div>
                           <label className="text-sm font-medium text-gray-500">Bairro</label>
                           <p className="text-sm font-medium">{userData.config.bairro}</p>
                       </div>
                       <div>
                           <label className="text-sm font-medium text-gray-500">Cidade/UF</label>
                           <p className="text-sm font-medium">{userData.config.cidade} / {userData.config.uf}</p>
                       </div>
                   </>
               ) : (
                   <p className="text-sm text-gray-500">Endereço não informado.</p>
               )}
           </CardContent>
        </Card>
      </div>

      <div className="fixed bottom-0 left-0 md:left-[var(--sidebar-width)] right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto p-4 flex justify-between items-center">
            <Button variant="ghost" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <Button onClick={handleEdit}>
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
        </div>
      </div>
    </div>
  );
}
