import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useContractsList, useCreateContract, useUpdateContract, useDeleteContract } from '@/hooks/contracts';
import type { ContractRecord, CreateContractInput, UpdateContractInput } from '@/types/contracts';

/**
 * Contracts
 * pt-BR: Página de gerenciamento de contratos com listagem e formulário simples.
 * en-US: Contracts management page with listing and a simple form.
 */
export default function Contracts() {
  const [editing, setEditing] = useState<ContractRecord | null>(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('');

  // Data listing
  const { data, isLoading, refetch } = useContractsList(
    { page: 1, per_page: 20, nome: search || undefined, ativo: activeFilter || undefined },
    { keepPreviousData: true }
  );

  // Mutations
  const createMutation = useCreateContract({ onSuccess: () => { reset(); setEditing(null); } });
  const updateMutation = useUpdateContract({ onSuccess: () => { reset(); setEditing(null); } });
  const deleteMutation = useDeleteContract({ onSuccess: () => { /* keep list invalidation to hooks */ } });

  const items = useMemo(() => data?.data ?? [], [data]);

  // Form setup
  const { register, handleSubmit, reset, formState: { errors } } = useForm<CreateContractInput | UpdateContractInput>({
    defaultValues: {
      nome: '',
      slug: '',
      content: '',
      id_curso: undefined,
      ativo: 's',
    },
  });

  useEffect(() => {
    if (editing) {
      reset({
        nome: editing.title ?? editing.nome ?? '',
        slug: editing.slug ?? '',
        content: editing.content ?? '',
        id_curso: editing.id_curso ?? undefined,
        ativo: editing.ativo ?? 's',
      });
    } else {
      reset({ nome: '', slug: '', content: '', id_curso: undefined, ativo: 's' });
    }
  }, [editing, reset]);

  /**
   * onSubmit
   * pt-BR: Submete o formulário para criar ou atualizar um contrato.
   * en-US: Submits the form to create or update a contract.
   */
  const onSubmit = (values: CreateContractInput | UpdateContractInput) => {
    if (editing?.id) {
      updateMutation.mutate({ id: String(editing.id), data: values as UpdateContractInput });
    } else {
      createMutation.mutate(values as CreateContractInput);
    }
  };

  /**
   * handleEdit
   * pt-BR: Prepara o formulário para edição do contrato selecionado.
   * en-US: Prepares the form to edit the selected contract.
   */
  const handleEdit = (item: ContractRecord) => setEditing(item);

  /**
   * handleDelete
   * pt-BR: Solicita a remoção (soft-delete) do contrato.
   * en-US: Requests soft-delete of the contract.
   */
  const handleDelete = (item: ContractRecord) => {
    if (!item?.id) return;
    if (confirm(`Remover contrato "${item.nome ?? item.title}"?`)) {
      deleteMutation.mutate(String(item.id));
    }
  };

  /**
   * handleCancel
   * pt-BR: Cancela a edição e limpa o formulário.
   * en-US: Cancels editing and clears the form.
   */
  const handleCancel = () => {
    setEditing(null);
    reset({ nome: '', slug: '', content: '', id_curso: undefined, ativo: 's' });
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Contratos</h1>
        <button
          className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          onClick={() => setEditing(null)}
        >
          Novo Contrato
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <input
          className="border rounded p-2"
          placeholder="Buscar por nome"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onBlur={() => refetch()}
        />
        <select
          className="border rounded p-2"
          value={activeFilter}
          onChange={(e) => { setActiveFilter(e.target.value); refetch(); }}
        >
          <option value="">Ativo (todos)</option>
          <option value="s">Somente ativos</option>
          <option value="n">Somente inativos</option>
        </select>
      </div>

      {/* Form */}
      <div className="border rounded p-4">
        <h2 className="text-lg font-medium mb-3">{editing ? 'Editar Contrato' : 'Cadastrar Contrato'}</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Nome</label>
            <input className="border rounded p-2 w-full" {...register('nome', { required: true })} />
            {errors.nome && <p className="text-red-600 text-sm">Nome é obrigatório</p>}
          </div>
          <div>
            <label className="block text-sm mb-1">Slug</label>
            <input className="border rounded p-2 w-full" {...register('slug')} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">Conteúdo</label>
            <textarea className="border rounded p-2 w-full" rows={4} {...register('content')} />
          </div>
          <div>
            <label className="block text-sm mb-1">ID do Curso</label>
            <input type="number" className="border rounded p-2 w-full" {...register('id_curso', { valueAsNumber: true })} />
          </div>
          <div>
            {/* Campo período removido do formulário de cadastro conforme solicitação */}
          </div>
          <div>
            <label className="block text-sm mb-1">Ativo</label>
            <select className="border rounded p-2 w-full" {...register('ativo')}>
              <option value="s">Sim</option>
              <option value="n">Não</option>
            </select>
          </div>

          <div className="md:col-span-2 flex gap-2 mt-2">
            <button type="submit" className="px-3 py-2 rounded bg-green-600 text-white hover:bg-green-700">
              {editing ? 'Salvar Alterações' : 'Criar Contrato'}
            </button>
            {editing && (
              <button type="button" className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300" onClick={handleCancel}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* List */}
      <div className="border rounded">
        <div className="grid grid-cols-6 gap-2 p-2 bg-gray-100 text-sm font-medium">
          <div>Nome</div>
          <div>Slug</div>
          <div>Curso</div>
          <div>Período</div>
          <div>Ativo</div>
          <div>Ações</div>
        </div>
        {isLoading && <div className="p-3">Carregando...</div>}
        {!isLoading && items.length === 0 && <div className="p-3">Nenhum contrato encontrado.</div>}
        {!isLoading && items.map((item: ContractRecord) => (
          <div key={String(item.id)} className="grid grid-cols-6 gap-2 p-2 border-t">
            <div>{item.nome ?? item.title}</div>
            <div className="truncate">{item.slug}</div>
            <div>{item.id_curso ?? '-'}</div>
            <div>{item.periodo ?? '-'}</div>
            <div>{(item.ativo ?? 's') === 's' ? 'Sim' : 'Não'}</div>
            <div className="flex gap-2">
              <button className="px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700" onClick={() => handleEdit(item)}>Editar</button>
              <button className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700" onClick={() => handleDelete(item)}>Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}