import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, UserSearch, Clock, Trash2, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { clientsService } from '@/services/clientsService';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const HISTORY_KEY = 'quick-client-search-history';

// Funções utilitárias de formatação
function formatPhone(phone?: string) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 12 || digits.length === 13) {
    const cc = digits.slice(0, 2);
    const ddd = digits.slice(2, 4);
    const p1 = digits.slice(4, digits.length - 4);
    const p2 = digits.slice(digits.length - 4);
    return `+${cc} (${ddd}) ${p1}-${p2}`;
  }
  if (digits.length === 10 || digits.length === 11) {
    const ddd = digits.slice(0, 2);
    const p1 = digits.slice(2, digits.length - 4);
    const p2 = digits.slice(digits.length - 4);
    return `(${ddd}) ${p1}-${p2}`;
  }
  return phone;
}

function formatCPF(cpf?: string) {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
  return cpf;
}

function getInitials(name?: string) {
  if (!name) return 'U';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

export function QuickClientSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  // Load history on open
  useEffect(() => {
    if (open) {
      try {
        const stored = localStorage.getItem(HISTORY_KEY);
        if (stored) setHistory(JSON.parse(stored));
      } catch (e) {
        console.warn('Erro ao ler histórico', e);
      }
    }
  }, [open]);

  // Debounce the search input
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedQuery(query), 400);
    return () => clearTimeout(handler);
  }, [query]);

  // Limpa a busca ao fechar
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setQuery('');
        setDebouncedQuery('');
        setSelectedIndex(0);
      }, 300);
    }
  }, [open]);

  // Atalho global Ctrl+Space
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['quick-client-search', debouncedQuery],
    queryFn: () => clientsService.listClients({ search: debouncedQuery, per_page: 15 }),
    enabled: open && debouncedQuery.length > 0,
  });

  const clients = data?.data || [];
  const activeList = debouncedQuery ? clients : history;

  // Reseta a seleção quando a lista muda
  useEffect(() => {
    setSelectedIndex(0);
  }, [debouncedQuery, clients, history]);

  // Navegação por teclado
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (activeList.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < activeList.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      handleSelectClient(activeList[selectedIndex]);
    }
  };

  const handleSelectClient = (client: any) => {
    if (!client) return;
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      let currentHistory: any[] = stored ? JSON.parse(stored) : [];
      // Remove if exists
      currentHistory = currentHistory.filter((c) => c.id !== client.id);
      // Add to top
      currentHistory.unshift({
        id: client.id,
        name: client.name,
        cpf: client.cpf,
        phone: client.phone,
        celular: client.celular,
        email: client.email,
        timestamp: new Date().toISOString()
      });
      // Limit to 10
      currentHistory = currentHistory.slice(0, 10);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(currentHistory));
      setHistory(currentHistory);
    } catch (e) {
      console.warn('Erro ao salvar histórico', e);
    }
    
    setOpen(false);
    navigate(`/admin/clients/${client.id}/view`);
  };

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

  const renderClientRow = (client: any, index: number, isHistory = false) => {
    const isSelected = index === selectedIndex;
    return (
      <TableRow 
        key={client.id} 
        className={`cursor-pointer transition-colors group ${isSelected ? 'bg-blue-50/70 border-l-2 border-l-blue-500' : 'bg-white hover:bg-slate-50 border-l-2 border-l-transparent'}`}
        onClick={() => handleSelectClient(client)}
        onMouseEnter={() => setSelectedIndex(index)}
      >
        <TableCell>
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border border-slate-100 shadow-sm">
              <AvatarFallback className="bg-blue-50 text-blue-700 text-xs font-semibold">
                {getInitials(client.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-semibold text-slate-800 flex items-center gap-2">
                {isHistory && <Clock className="h-3 w-3 text-slate-400" title="Do seu histórico" />}
                {client.name}
              </div>
              {client.cpf && <div className="text-xs text-slate-500 font-mono mt-0.5">Doc: {formatCPF(client.cpf)}</div>}
            </div>
          </div>
        </TableCell>
        <TableCell>
          {(client.celular || client.phone) && <div className="text-sm font-medium text-slate-700">{formatPhone(client.celular || client.phone)}</div>}
          {client.email && <div className="text-xs text-slate-500 truncate max-w-[250px]" title={client.email}>{client.email}</div>}
        </TableCell>
        <TableCell className="text-right">
          <ChevronRight className={`h-5 w-5 ml-auto transition-colors ${isSelected ? 'text-blue-500' : 'text-slate-300 group-hover:text-blue-500'}`} />
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Busca rápida de clientes (Ctrl+Space)">
          <Search className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[1000px] top-[10%] translate-y-0 max-h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl">
        <div className="p-4 border-b shrink-0 bg-white relative">
          <div className="relative pr-8">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input 
              placeholder="Digite o Nome, Celular, E-mail, Documento ou ID..." 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              className="text-lg py-6 pl-12 pr-4 bg-slate-50 border border-slate-200 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:bg-white rounded-xl shadow-sm transition-all"
              autoFocus
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto p-0 bg-slate-50/50">
          {!debouncedQuery ? (
            history.length > 0 ? (
              <div className="p-4">
                <div className="flex items-center justify-between mb-2 px-2">
                  <h3 className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Consultas Recentes
                  </h3>
                  <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500 hover:text-red-600" onClick={clearHistory}>
                    <Trash2 className="h-3 w-3 mr-1" /> Limpar
                  </Button>
                </div>
                <Table>
                  <TableHeader className="bg-transparent sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent border-b-slate-200">
                      <TableHead>Cliente</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead className="text-right w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((c, idx) => renderClientRow(c, idx, true))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-3">
                <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-2">
                  <UserSearch className="h-8 w-8 text-slate-300" />
                </div>
                <p className="font-medium text-slate-600">Busca Rápida de Clientes</p>
                <p className="text-sm max-w-sm">Digite o nome, documento, e-mail ou o final do telefone para encontrar rapidamente.</p>
                <p className="text-xs text-slate-400 mt-4">Pressione <kbd className="bg-white border shadow-sm rounded px-1.5 py-0.5 mx-1 font-mono text-[10px]">Ctrl</kbd> + <kbd className="bg-white border shadow-sm rounded px-1.5 py-0.5 mx-1 font-mono text-[10px]">Espaço</kbd> de qualquer lugar para abrir.</p>
              </div>
            )
          ) : isLoading ? (
            <div className="p-16 flex justify-center text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : clients.length > 0 ? (
            <Table>
              <TableHeader className="bg-transparent sticky top-0 z-10">
                <TableRow className="hover:bg-transparent border-b-slate-200">
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead className="text-right w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c, idx) => renderClientRow(c, idx, false))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-16 text-center text-muted-foreground">
              Nenhum cliente encontrado para "<span className="font-medium text-slate-700">{debouncedQuery}</span>".
            </div>
          )}
        </div>
        <div className="shrink-0 p-2.5 px-4 border-t bg-slate-50/80 flex items-center justify-between text-[11px] text-slate-400 font-medium">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              Navegar 
              <span className="flex gap-0.5">
                <kbd className="bg-white border shadow-sm rounded px-1.5 py-0.5 font-sans text-[10px] text-slate-500">↓</kbd>
                <kbd className="bg-white border shadow-sm rounded px-1.5 py-0.5 font-sans text-[10px] text-slate-500">↑</kbd>
              </span>
            </span>
            <span className="flex items-center gap-1.5">
              Selecionar 
              <kbd className="bg-white border shadow-sm rounded px-1.5 py-0.5 font-sans text-[10px] text-slate-500">Enter</kbd>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            Abrir busca: 
            <span className="flex gap-0.5">
              <kbd className="bg-white border shadow-sm rounded px-1.5 py-0.5 font-sans text-[10px] text-slate-500">Ctrl</kbd>
              <span className="text-[10px]">+</span>
              <kbd className="bg-white border shadow-sm rounded px-1.5 py-0.5 font-sans text-[10px] text-slate-500">Espaço</kbd>
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
