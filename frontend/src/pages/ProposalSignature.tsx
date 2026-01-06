import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import { Loader2, Check, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { proposalService, ProposalData, SignProposalData } from '@/services/proposalService';
import { useCep } from '@/hooks/useCep';
import { cpfApplyMask } from '@/lib/masks/cpf-apply-mask';
import { phoneApplyMask } from '@/lib/masks/phone-apply-mask';
import { cepApplyMask } from '@/lib/masks/cep-apply-mask';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";

const formSchema = z.object({
  name: z.string().min(2, 'Nome é obrigatório'),
  email: z.string().email('E-mail inválido'),
  cpf: z.string().min(11, 'CPF inválido'),
  celular: z.string().min(10, 'Celular inválido'),
  nascimento: z.string().min(10, 'Data de nascimento inválida'),
  pais_origem: z.string().optional(),
  canac: z.string().optional(),
  identidade: z.string().optional(),
  cep: z.string().optional(),
  endereco: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().optional(),
  nacionalidade: z.string().optional(),
  profissao: z.string().min(1, 'Profissão é obrigatória'),
  sexo: z.string().min(1, 'Sexo é obrigatório'),
  altura: z.string().min(1, 'Altura é obrigatória').refine((val) => !isNaN(Number(val)) && Number(val) > 0, 'Altura inválida'),
  peso: z.string().min(1, 'Peso é obrigatório').refine((val) => !isNaN(Number(val)) && Number(val) > 0, 'Peso inválido')
});

type FormData = z.infer<typeof formSchema>;

export default function ProposalSignature() {
  const { compositeId } = useParams<{ compositeId: string }>();
  const [clientId, matriculaId] = compositeId ? compositeId.split('_') : [null, null];

  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [proposal, setProposal] = useState<ProposalData | null>(null);
  
  const { fetchCep, loading: loadingCep } = useCep();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      cpf: '',
      celular: '',
      nascimento: '',
      pais_origem: 'Brasil', 
      canac: '',
      identidade: '',
      cep: '',
      endereco: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      nacionalidade: 'Brasileira',
      profissao: '',
      sexo: '',
      altura: '',
      peso: ''
    }
  });

  useEffect(() => {
    async function loadData() {
      if (!clientId || !matriculaId) {
        toast.error('Link inválido');
        setLoading(false);
        return;
      }

      try {
        const data = await proposalService.getProposal(clientId, matriculaId);
        setProposal(data);
        
        // Populate form with existing client data
        if (data.cliente) {
          form.reset({
            name: data.cliente.name || '',
            email: data.cliente.email || '',
            cpf: cpfApplyMask(data.cliente.cpf || ''),
            celular: phoneApplyMask(data.cliente.celular || ''),
            nascimento: (() => {
              const rawDate = data.cliente.nascimento || data.cliente.config?.nascimento || '';
              if (!rawDate) return '';
              // Format DD/MM/YYYY to YYYY-MM-DD for input type="date"
              if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
                const [day, month, year] = rawDate.split('/');
                return `${year}-${month}-${day}`;
              }
              return rawDate;
            })(),
            cep: data.cliente.config?.cep ? cepApplyMask(data.cliente.config.cep) : '',
            endereco: data.cliente.config?.endereco || '',
            numero: data.cliente.config?.numero || '',
            complemento: data.cliente.config?.complemento || '',
            bairro: data.cliente.config?.bairro || '',
            cidade: data.cliente.config?.cidade || '',
            estado: data.cliente.config?.estado || '',
            pais_origem: data.cliente.config?.pais_origem || 'Brasil',
            nacionalidade: data.cliente.config?.nacionalidade || 'Brasileira',
            profissao: data.cliente.config?.profissao || '',
            identidade: data.cliente.config?.identidade || '',
            canac: data.cliente.config?.canac || '',
            altura: data.cliente.config?.altura ? String(data.cliente.config.altura) : '',
            peso: data.cliente.config?.peso ? String(data.cliente.config.peso) : '',
            sexo: data.cliente.sexo || data.cliente.genero || '',
          });
        }
      } catch (error) {
        console.error(error);
        toast.error('Erro ao carregar dados da proposta');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [clientId, matriculaId, form]);

  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, '');
    if (cep.length === 8) {
      const address = await fetchCep(cep);
      if (address) {
        form.setValue('endereco', address.endereco);
        form.setValue('bairro', address.bairro);
        form.setValue('cidade', address.cidade);
        form.setValue('estado', address.uf);
        form.setFocus('numero');
      }
    }
  };

  async function onSubmit(data: FormData) {
    if (!clientId || !matriculaId) return;

    try {
      setLoading(true);
      const cleanData: SignProposalData = {
        ...data,
        name: data.name,
        email: data.email,
        cpf: data.cpf.replace(/\D/g, ''),
        celular: data.celular.replace(/\D/g, ''),
        nascimento: data.nascimento,
        cep: data.cep?.replace(/\D/g, '') || undefined,
        altura: data.altura ? Number(data.altura) : undefined,
        peso: data.peso ? Number(data.peso) : undefined,
      } as SignProposalData;

        const response = await proposalService.signProposal(clientId!, matriculaId!, cleanData);
        
        // Success redirect
        if ((response as any).redirect) {
          window.location.href = (response as any).redirect;
        } else {
          toast.success('Assinatura realizada com sucesso!');
        }
    } catch (error: any) {
      console.error(error);
      
      // Validação de erros do backend
      if (error.status === 422 && error.body && error.body.messages) {
        const messages = error.body.messages;
        let hasFieldErrors = false;

        if (messages.cpf) {
          form.setError('cpf', { type: 'manual', message: messages.cpf[0] });
          hasFieldErrors = true;
        }

        if (messages.email) {
          form.setError('email', { type: 'manual', message: messages.email[0] });
          hasFieldErrors = true;
        }

        if (messages.celular) {
          form.setError('celular', { type: 'manual', message: messages.celular[0] });
          hasFieldErrors = true;
        }

        if (hasFieldErrors) {
          toast.error('Verifique os campos com erro.');
          return;
        }
      }

      toast.error('Erro ao salvar os dados');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!proposal) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-lg shadow-sm text-center max-w-md">
          <X className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-xl font-semibold mb-2">Proposta não encontrada</h1>
          <p className="text-muted-foreground">O link que você acessou pode estar expirado ou incorreto.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <PublicHeader />
      
      <main className="flex-grow py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto space-y-8">
          
          {/* Proposal Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Informações da Proposta</CardTitle>
              <CardDescription>Revise os detalhes da sua matrícula</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-muted-foreground">Curso</Label>
                  <p className="text-lg font-medium">{proposal.curso_nome}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Turma</Label>
                  <p className="text-lg font-medium">{proposal.turma_nome}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Valor Total</Label>
                  <p className="text-lg font-medium">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(proposal.total)}
                  </p>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                <h4 className="text-blue-800 font-medium mb-1">Status da Matrícula</h4>
                <p className="text-blue-600 text-sm">Aguardando assinatura e confirmação de dados.</p>
              </div>
            </CardContent>
          </Card>

          {/* Student Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Seus Dados</CardTitle>
                  <CardDescription>Confirme e complete suas informações cadastrais</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  {/* Personal Info Section */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-lg">Dados Pessoais</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome Completo</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>E-mail</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="cpf"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CPF</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                onChange={(e) => field.onChange(cpfApplyMask(e.target.value))}
                                maxLength={14}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="celular"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Celular (WhatsApp)</FormLabel>
                            <FormControl>
                              <Input 
                                {...field} 
                                onChange={(e) => field.onChange(phoneApplyMask(e.target.value))}
                                maxLength={20}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="nascimento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data de Nascimento</FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="sexo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Sexo</FormLabel>
                              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione..." />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="M">Masculino</SelectItem>
                                <SelectItem value="F">Feminino</SelectItem>
                                <SelectItem value="ni">Não informar</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Additional Info Section */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-lg">Documentos e Físico</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="identidade"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>RG / Identidade</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="canac"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CANAC (se houver)</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="profissao"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Profissão</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="altura"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Altura (m)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.01" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="peso"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Peso (kg)</FormLabel>
                            <FormControl>
                              <Input type="number" step="0.1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Address Section */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-lg">Endereço</h3>
                     <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                       <FormField
                        control={form.control}
                        name="cep"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CEP</FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  {...field} 
                                  onChange={(e) => field.onChange(cepApplyMask(e.target.value))}
                                  onBlur={handleCepBlur}
                                  maxLength={9}
                                />
                                {loadingCep && (
                                  <div className="absolute right-3 top-2.5">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                  </div>
                                )}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="endereco"
                        render={({ field }) => (
                          <FormItem className="col-span-2">
                            <FormLabel>Endereço</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="numero"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Número</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="complemento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Complemento</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="bairro"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Bairro</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="cidade"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Cidade</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                       <FormField
                        control={form.control}
                        name="estado"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Estado</FormLabel>
                            <FormControl>
                              <Input {...field} maxLength={2} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                     </div>
                  </div>

                </CardContent>
                <CardFooter className="flex justify-between border-t p-6">
                  <Button variant="outline" type="button" onClick={() => navigate(-1)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading} size="lg" className="bg-primary hover:bg-primary/90">
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        Salvar e Avançar
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </form>
          </Form>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <label className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}>{children}</label>;
}
