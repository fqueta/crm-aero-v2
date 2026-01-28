import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DialogFooter } from '@/components/ui/dialog';
import { AddressAccordion } from "@/components/lib/AddressAccordion";
import { SmartDocumentInput } from '@/components/lib/SmartDocumentInput';
import { MaskedInputField } from '@/components/lib/MaskedInputField';
import { UseFormReturn } from 'react-hook-form';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { phoneApplyMask } from '@/lib/masks/phone-apply-mask';
import { UserFormData } from '@/types/users';
import { PermissionRecord } from '@/types/permissions';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';

/**
 * Propriedades do componente UserForm
 * UserForm component props for create/edit flows
 */
interface UserFormProps {
  form: UseFormReturn<UserFormData>;
  onSubmit: (data: UserFormData) => void;
  onCancel: () => void;
  editingUser?: UserFormData | null;
  permissions: PermissionRecord[];
  isLoadingPermissions: boolean;
  handleOnclick?: () => void;
  /** Custom render for actions (buttons) */
  renderActions?: React.ReactNode;
  /** Controla exibição do footer padrão (DialogFooter) */
  showFooter?: boolean;
}

/**
 * UserForm — Formulário compartilhado de usuário
 * Layout atualizado para corresponder ao ClientForm (seções, grid).
 */
export function UserForm({
  form,
  onSubmit,
  onCancel,
  editingUser,
  permissions,
  isLoadingPermissions,
  handleOnclick,
  renderActions,
  showFooter = true,
}: UserFormProps): React.ReactElement {
  const [showPassword, setShowPassword] = React.useState(false);
  const tipoPessoa = 'pf';

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Seção: Informações Básicas */}
        <div className="bg-gray-50 p-6 rounded-lg border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
            Informações Básicas
          </h3>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
             <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome</FormLabel>
                  <FormControl>
                    <Input placeholder="Nome completo" {...field} className="h-11" />
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="email@exemplo.com" {...field} className="h-11" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tipo de Pessoa removido do cadastro de usuário (apenas PF) */}

            <FormField
              control={form.control}
              name="genero"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gênero</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Selecione o gênero" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="m">Masculino</SelectItem>
                      <SelectItem value="f">Feminino</SelectItem>
                      <SelectItem value="ni">Não Informado</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SmartDocumentInput
              name="cpf"
              control={form.control}
              label="CPF"
              tipoPessoa="pf"
              placeholder="000.000.000-00"
            />

            <FormField
              control={form.control}
              name="permission_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Permissão de Acesso</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingPermissions}>
                    <FormControl>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder={isLoadingPermissions ? "Carregando..." : "Selecione a permissão"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="z-[60]">
                      {permissions.map((permission) => (
                        <SelectItem key={permission.id} value={String(permission.id)}>
                          {permission.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="config.equipe"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Equipe</FormLabel>
                  <EquipeMultiSelect
                    value={Array.isArray(field.value) ? (field.value as any[]).map(String) : []}
                    onChange={(next) => field.onChange(next)}
                    items={permissions}
                    loading={isLoadingPermissions}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />




            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 col-span-1 lg:col-span-2">
                 <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Senha (min. 6 caracteres)"
                            {...field}
                            value={field.value ?? ''}
                            className="h-11 pr-10"
                          />
                          <button
                            type="button"
                            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            onClick={() => setShowPassword((v) => !v)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ativo"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm h-11 mt-8">
                      <div className="space-y-0.5">
                        <FormLabel>Status: {field.value === 's' ? <span className="text-green-600 font-bold bg-green-100 px-2 py-0.5 rounded text-xs">ATIVO</span> : <span className="text-red-600 font-bold bg-red-100 px-2 py-0.5 rounded text-xs">INATIVO</span>}</FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value === 's'}
                          onCheckedChange={(checked) => field.onChange(checked ? 's' : 'n')}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
            </div>
            
             <FormField
                control={form.control}
                name="config.celular"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Celular</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(phoneApplyMask(e.target.value))}
                        placeholder="+55 (11) 99999-9999"
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

               <FormField
                control={form.control}
                name="config.telefone_residencial" // Usando residencial como "Telefone" genérico conforme imagem
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                       <Input
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => field.onChange(phoneApplyMask(e.target.value))}
                        placeholder="+55 (11) 3333-4444"
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="config.nascimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Nascimento</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
                        value={field.value || ""}
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
            />

          </div>
        </div>

        {/* Seção: Endereço */}
        <AddressAccordion form={form} />
        
        {/* Renderiza ações personalizadas (Salvar e Continuar, etc) se fornecidas */}
        {renderActions}

        {/* Footer padrão se não houver actions personalizadas */}
        {showFooter && !renderActions && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              type="submit"
              onClick={handleOnclick}
              disabled={isLoadingPermissions}
            >
              {editingUser ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        )}
      </form>
    </Form>
  );
}

function EquipeMultiSelect({
  value,
  onChange,
  items,
  loading,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  items: PermissionRecord[];
  loading?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');

  const filtered = (query.trim()
    ? items.filter((p) => String(p?.name || '').toLowerCase().includes(query.trim().toLowerCase()))
    : items);

  const label = (value && value.length)
    ? items.filter((p) => (value || []).map(String).includes(String(p.id))).map((p) => String(p?.name || p.id)).join(', ')
    : (loading ? 'Carregando...' : 'Selecione membros da equipe');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="justify-between w-full h-11">
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-2" align="start">
        <div className="space-y-2">
          <Input placeholder="Buscar permissões..." value={query} onChange={(e) => setQuery(e.target.value)} />
          <ScrollArea className="h-52">
            <div className="space-y-1">
              {filtered.map((p) => {
                const id = String(p.id);
                const nome = String(p?.name || id);
                const checked = (value || []).map(String).includes(id);
                return (
                  <label key={id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(chk) => {
                        const next = new Set((value || []).map(String));
                        if (chk) next.add(String(id)); else next.delete(String(id));
                        onChange(Array.from(next));
                      }}
                    />
                    <span className="text-sm">{nome}</span>
                  </label>
                );
              })}
              {filtered.length === 0 && (
                <div className="text-xs text-muted-foreground px-2 py-1">Nenhuma permissão encontrada</div>
              )}
            </div>
          </ScrollArea>
          <div className="flex items-center justify-between pt-1">
            <Button type="button" variant="ghost" onClick={() => onChange([])}>Limpar</Button>
            <Button type="button" onClick={() => setOpen(false)}>Concluir</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
