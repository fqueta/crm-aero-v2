/**
 * Tabela para exibição e gerenciamento de contas a receber
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { toast } from 'react-hot-toast';
import {
  MoreHorizontal,
  Search,
  Filter,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  Download,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  AccountReceivable,
  AccountStatus,
  PaymentMethod,
  FinancialCategory,
  AccountsFilter
} from '../../types/financial';
import { financialService } from '../../services/financialService';
import AccountReceivableForm from './AccountReceivableForm';
import { currencyApplyMask, currencyRemoveMaskToString } from '../../lib/masks/currency';

interface AccountsReceivableTableProps {
  categories: FinancialCategory[];
}

/**
 * Componente de tabela para contas a receber
 */
export const AccountsReceivableTable: React.FC<AccountsReceivableTableProps> = ({ categories }) => {
  const [accounts, setAccounts] = useState<AccountReceivable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<AccountReceivable | undefined>();
  const [filters, setFilters] = useState<AccountsFilter>({
    page: 1,
    limit: 10,
    sortBy: 'dueDate',
    sortOrder: 'asc'
  });
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [isReceiveDialogOpen, setIsReceiveDialogOpen] = useState(false);
  const [selectedReceiveAccount, setSelectedReceiveAccount] = useState<AccountReceivable | undefined>();
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveDate, setReceiveDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [receiveMethod, setReceiveMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [expandedAccounts, setExpandedAccounts] = useState<string[]>([]);

  /**
   * Carrega as contas a receber
   */
  const loadAccounts = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await financialService.accountsReceivable.getAll(filters);
      setAccounts(response.data);
      setTotalPages(response.totalPages);
      setTotal(response.total);
    } catch (error: unknown) {
      console.error('Erro ao carregar contas a receber:', error);
      toast.error('Erro ao carregar contas a receber');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  /**
   * Carrega dados quando filtros mudam
   */
  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  /**
   * Formata valor monetário
   */
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  /**
   * Formata data
   */
  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  /**
   * Retorna badge de status
   */
  const getStatusBadge = (status: AccountStatus) => {
    const statusConfig = {
      [AccountStatus.PENDING]: { label: 'Pendente', variant: 'secondary' as const },
      [AccountStatus.PARTIAL]: { label: 'Parcial', variant: 'secondary' as const },
      [AccountStatus.PAID]: { label: 'Recebido', variant: 'default' as const },
      [AccountStatus.OVERDUE]: { label: 'Vencido', variant: 'destructive' as const },
      [AccountStatus.CANCELLED]: { label: 'Cancelado', variant: 'outline' as const }
    };

    const config = statusConfig[status] || statusConfig[AccountStatus.PENDING];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  /**
   * Retorna nome da categoria
   */
  const getCategoryName = (categoryId: string): string => {
    const category = categories.find(cat => cat.id === categoryId);
    return category?.name || 'Categoria não encontrada';
  };

  /**
   * Retorna label da forma de pagamento
   */
  const getPaymentMethodLabel = (method?: PaymentMethod | string): string => {
    if (!method) return '-';

    const labels = {
      [PaymentMethod.CASH]: 'Dinheiro',
      [PaymentMethod.CREDIT_CARD]: 'Cartão de Crédito',
      [PaymentMethod.DEBIT_CARD]: 'Cartão de Débito',
      [PaymentMethod.BANK_TRANSFER]: 'Transferência',
      [PaymentMethod.PIX]: 'PIX',
      [PaymentMethod.CHECK]: 'Cheque',
      [PaymentMethod.BOLETO]: 'Boleto',
      [PaymentMethod.OTHER]: 'Outro',
    };
    return labels[method as keyof typeof labels] || String(method);
  };

  /**
   * Abre formulário para nova conta
   */
  const handleNewAccount = () => {
    setSelectedAccount(undefined);
    setIsFormOpen(true);
  };

  /**
   * Abre formulário para editar conta
   */
  const handleEditAccount = (account: AccountReceivable) => {
    setSelectedAccount(account);
    setIsFormOpen(true);
  };

  /**
   * Abre o modal para registrar uma nova parcela/recebimento.
   */
  const openReceiveDialog = (account: AccountReceivable) => {
    const availableMethods = Object.values(PaymentMethod);
    const initialMethod = availableMethods.includes((account.paymentMethod || '') as PaymentMethod)
      ? (account.paymentMethod as PaymentMethod)
      : PaymentMethod.OTHER;

    setSelectedReceiveAccount(account);
    setReceiveDate(new Date().toISOString().split('T')[0]);
    setReceiveMethod(initialMethod);
    setReceiveAmount(formatCurrency(account.remainingAmount || account.amount));
    setReceiveNotes('');
    setIsReceiveDialogOpen(true);
  };

  /**
   * Fecha e limpa o modal de recebimento.
   */
  const resetReceiveDialog = () => {
    setIsReceiveDialogOpen(false);
    setSelectedReceiveAccount(undefined);
    setReceiveAmount('');
    setReceiveDate(new Date().toISOString().split('T')[0]);
    setReceiveMethod(PaymentMethod.CASH);
    setReceiveNotes('');
  };

  /**
   * Registra uma parcela na conta selecionada.
   */
  const handleSubmitReceive = async () => {
    if (!selectedReceiveAccount) return;

    const normalizedAmount = Number(currencyRemoveMaskToString(receiveAmount || ''));
    const remainingAmount = Number(selectedReceiveAccount.remainingAmount || selectedReceiveAccount.amount || 0);

    if (!receiveDate || normalizedAmount <= 0) {
      toast.error('Informe a data e um valor de recebimento maior que zero.');
      return;
    }

    if (normalizedAmount > remainingAmount) {
      toast.error('O valor informado nao pode ser maior que o saldo pendente da conta.');
      return;
    }

    try {
      await financialService.accountsReceivable.markAsReceived(
        selectedReceiveAccount.id,
        receiveDate,
        receiveMethod,
        normalizedAmount,
        receiveNotes.trim() || undefined
      );
      toast.success('Parcela registrada com sucesso!');
      resetReceiveDialog();
      loadAccounts();
    } catch (error: unknown) {
      console.error('Erro ao registrar parcela:', error);
      toast.error('Erro ao registrar parcela');
    }
  };

  /**
   * Expande ou recolhe o histórico de parcelas da conta.
   */
  const toggleAccountPayments = (accountId: string) => {
    setExpandedAccounts((prev) => (
      prev.includes(accountId) ? prev.filter((id) => id !== accountId) : [...prev, accountId]
    ));
  };

  /**
   * Cancela conta
   */
  const handleCancelAccount = async (account: AccountReceivable) => {
    if (confirm('Tem certeza que deseja cancelar esta conta?')) {
      try {
        await financialService.accountsReceivable.cancel(account.id);
        toast.success('Conta cancelada!');
        loadAccounts();
      } catch (error: unknown) {
        console.error('Erro ao cancelar conta:', error);
        toast.error('Erro ao cancelar conta');
      }
    }
  };

  /**
   * Remove conta
   */
  const handleDeleteAccount = async (account: AccountReceivable) => {
    if (confirm('Tem certeza que deseja excluir esta conta? Esta ação não pode ser desfeita.')) {
      try {
        await financialService.accountsReceivable.delete(account.id);
        toast.success('Conta excluída!');
        loadAccounts();
      } catch (error: unknown) {
        console.error('Erro ao excluir conta:', error);
        toast.error('Erro ao excluir conta');
      }
    }
  };

  /**
   * Atualiza filtro de busca
   */
  const handleSearchChange = (search: string) => {
    setFilters(prev => ({ ...prev, search, page: 1 }));
  };

  /**
   * Atualiza filtro de status
   */
  const handleStatusFilter = (status: string) => {
    setFilters(prev => ({
      ...prev,
      status: status === 'all' ? undefined : status as AccountStatus,
      page: 1
    }));
  };

  /**
   * Muda página
   */
  const handlePageChange = (page: number) => {
    setFilters(prev => ({ ...prev, page }));
  };

  /**
   * Callback de sucesso do formulário
   */
  const handleFormSuccess = () => {
    loadAccounts();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Contas a Receber</CardTitle>
          <Button onClick={handleNewAccount}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex gap-4 items-center">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
            <Input
              placeholder="Buscar por descrição, cliente..."
              className="pl-10"
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>
          
          <Select onValueChange={handleStatusFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value={AccountStatus.PENDING}>Pendente</SelectItem>
              <SelectItem value={AccountStatus.PARTIAL}>Parcial</SelectItem>
              <SelectItem value={AccountStatus.PAID}>Recebido</SelectItem>
              <SelectItem value={AccountStatus.OVERDUE}>Vencido</SelectItem>
              <SelectItem value={AccountStatus.CANCELLED}>Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="text-gray-500">Carregando...</div>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Recebido</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Forma de Pagamento</TableHead>
                  <TableHead className="w-12">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => {
                  const paymentsCount = account.paymentsCount || account.payments?.length || 0;
                  const isExpanded = expandedAccounts.includes(account.id);
                  const canReceive = [AccountStatus.PENDING, AccountStatus.PARTIAL, AccountStatus.OVERDUE].includes(account.status);

                  return (
                    <React.Fragment key={account.id}>
                      <TableRow>
                        <TableCell className="font-medium">
                          <div>{account.description}</div>
                          {account.invoiceNumber && (
                            <div className="text-sm text-gray-500">
                              NF: {account.invoiceNumber}
                            </div>
                          )}
                          {account.serviceOrderId && (
                            <div className="text-sm text-gray-500">
                              OS: {account.serviceOrderId}
                            </div>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs text-gray-500">
                              {paymentsCount} pagamento(s)
                            </span>
                            {paymentsCount > 0 && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={() => toggleAccountPayments(account.id)}
                              >
                                {isExpanded ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                                {isExpanded ? 'Ocultar parcelas' : 'Ver parcelas'}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{account.customerName || '-'}</TableCell>
                        <TableCell>{formatCurrency(account.amount)}</TableCell>
                        <TableCell>{formatCurrency(account.paidAmount || account.paymentsTotal || 0)}</TableCell>
                        <TableCell>{formatCurrency(account.remainingAmount || 0)}</TableCell>
                        <TableCell>{formatDate(account.dueDate)}</TableCell>
                        <TableCell>{getStatusBadge(account.status)}</TableCell>
                        <TableCell>{getCategoryName(account.category)}</TableCell>
                        <TableCell>{getPaymentMethodLabel(account.paymentMethod)}</TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEditAccount(account)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              
                              {canReceive && (
                                <DropdownMenuItem onClick={() => openReceiveDialog(account)}>
                                  <Check className="h-4 w-4 mr-2" />
                                  Registrar parcela
                                </DropdownMenuItem>
                              )}

                              {paymentsCount > 0 && (
                                <DropdownMenuItem onClick={() => toggleAccountPayments(account.id)}>
                                  {isExpanded ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                                  {isExpanded ? 'Ocultar parcelas' : 'Ver parcelas'}
                                </DropdownMenuItem>
                              )}
                              
                              {account.status === AccountStatus.PENDING && (
                                <DropdownMenuItem onClick={() => handleCancelAccount(account)}>
                                  <X className="h-4 w-4 mr-2" />
                                  Cancelar
                                </DropdownMenuItem>
                              )}
                              
                              <DropdownMenuItem 
                                onClick={() => handleDeleteAccount(account)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>

                      {isExpanded && (
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={10}>
                            <div className="space-y-3 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold">Histórico de parcelas</div>
                                  <div className="text-xs text-muted-foreground">
                                    Total recebido {formatCurrency(account.paidAmount || account.paymentsTotal || 0)} de {formatCurrency(account.amount)}
                                  </div>
                                </div>
                                {canReceive && (
                                  <Button type="button" size="sm" onClick={() => openReceiveDialog(account)}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Nova parcela
                                  </Button>
                                )}
                              </div>

                              <div className="grid gap-3 md:grid-cols-2">
                                {(account.payments || []).map((payment) => (
                                  <div key={payment.id} className="rounded-lg border bg-background p-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="text-sm font-semibold">
                                        {formatCurrency(payment.amount)}
                                      </span>
                                      <Badge variant="outline">
                                        {formatDate(payment.paymentDate)}
                                      </Badge>
                                    </div>
                                    <div className="mt-2 text-xs text-muted-foreground">
                                      Forma: {getPaymentMethodLabel(payment.paymentMethod)}
                                    </div>
                                    {payment.notes && (
                                      <div className="mt-2 text-xs text-muted-foreground">
                                        Obs.: {payment.notes}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <div className="text-sm text-gray-500">
                  Mostrando {accounts.length} de {total} registros
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(filters.page! - 1)}
                    disabled={filters.page === 1}
                  >
                    Anterior
                  </Button>
                  <span className="px-3 py-1 text-sm">
                    Página {filters.page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(filters.page! + 1)}
                    disabled={filters.page === totalPages}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>

      {/* Formulário */}
      <AccountReceivableForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={handleFormSuccess}
        account={selectedAccount}
        categories={categories}
      />

      <Dialog open={isReceiveDialogOpen} onOpenChange={(open) => !open && resetReceiveDialog()}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Registrar parcela</DialogTitle>
            <DialogDescription>
              Lance um novo recebimento parcial para a conta selecionada.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {selectedReceiveAccount && (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm">
                <div className="font-semibold">{selectedReceiveAccount.description}</div>
                <div className="mt-1 text-muted-foreground">
                  Cliente: {selectedReceiveAccount.customerName || '-'}
                </div>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 text-xs">
                  <div>
                    <span className="font-semibold text-foreground">Total:</span> {formatCurrency(selectedReceiveAccount.amount)}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Recebido:</span> {formatCurrency(selectedReceiveAccount.paidAmount || selectedReceiveAccount.paymentsTotal || 0)}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">Saldo:</span> {formatCurrency(selectedReceiveAccount.remainingAmount || 0)}
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Valor da parcela
              </label>
              <Input
                inputMode="numeric"
                placeholder="R$ 0,00"
                value={receiveAmount}
                onChange={(event) => setReceiveAmount(currencyApplyMask(event.target.value))}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Data do recebimento
                </label>
                <Input type="date" value={receiveDate} onChange={(event) => setReceiveDate(event.target.value)} />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Forma de pagamento
                </label>
                <Select value={receiveMethod} onValueChange={(value) => setReceiveMethod(value as PaymentMethod)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={PaymentMethod.CASH}>Dinheiro</SelectItem>
                    <SelectItem value={PaymentMethod.CREDIT_CARD}>Cartão de Crédito</SelectItem>
                    <SelectItem value={PaymentMethod.DEBIT_CARD}>Cartão de Débito</SelectItem>
                    <SelectItem value={PaymentMethod.BANK_TRANSFER}>Transferência Bancária</SelectItem>
                    <SelectItem value={PaymentMethod.PIX}>PIX</SelectItem>
                    <SelectItem value={PaymentMethod.CHECK}>Cheque</SelectItem>
                    <SelectItem value={PaymentMethod.BOLETO}>Boleto</SelectItem>
                    <SelectItem value={PaymentMethod.OTHER}>Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Observações
              </label>
              <Textarea
                value={receiveNotes}
                onChange={(event) => setReceiveNotes(event.target.value)}
                placeholder="Ex.: entrada, reforço, negociação complementar."
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetReceiveDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitReceive}>
              Salvar parcela
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default AccountsReceivableTable;
