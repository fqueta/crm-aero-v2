import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Search, Loader2, Save, FileText, Trash2, Pencil, Calendar, DollarSign, Calculator, UserCheck, Plane, Home, Copy, ExternalLink } from 'lucide-react';
import { currencyApplyMask, currencyRemoveMaskToNumber } from '@/lib/masks/currency';
import { enrollmentsService } from '@/services/enrollmentsService';
import { aircraftService } from '@/services/aircraftService';
import { rescisoesService } from '@/services/rescisoesService';
import { useToast } from '@/hooks/use-toast';
import { RescisaoRecord } from '@/types/rescisoes';
import { Combobox } from '@/components/ui/combobox';

interface AircraftFlown {
  aeronave_id: number | string;
  nome: string;
  hora_rescisao: number;
  quantidade: number;
  total: number;
}

export default function Termination() {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Page Tab state
  const [activeTab, setActiveTab] = useState<'list' | 'new'>('list');
  
  // Terminations list state
  const [rescisoes, setRescisoes] = useState<RescisaoRecord[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form/Calculator state
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [isLoadingEnrollments, setIsLoadingEnrollments] = useState(false);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState<string>('');
  const [selectedEnrollment, setSelectedEnrollment] = useState<any | null>(null);
  
  // Calculator inputs
  const [dataRescisao, setDataRescisao] = useState<string>(new Date().toISOString().substring(0, 10));
  const [valorPago, setValorPago] = useState<number>(0);
  const [valorMatricula, setValorMatricula] = useState<number>(0);
  const [valorInicial, setValorInicial] = useState<number>(0);
  const [horasCompradas, setHorasCompradas] = useState<number>(0);
  const [diasAlojamento, setDiasAlojamento] = useState<number>(0);
  const [precoDiaria, setPrecoDiaria] = useState<number>(100);
  const [obs, setObs] = useState<string>('');
  
  // Aircraft hours voadas breakdown
  const [aircrafts, setAircrafts] = useState<any[]>([]);
  const [isLoadingAircrafts, setIsLoadingAircrafts] = useState(false);
  const [aircraftHours, setAircraftHours] = useState<Record<string, number>>({});
  
  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [currentToken, setCurrentToken] = useState<string>('');
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string>('');

  // Load lists
  const loadRescisoes = async () => {
    setIsLoadingList(true);
    try {
      const resp = await rescisoesService.listRescisoes({ search: searchQuery });
      setRescisoes(resp.data || []);
    } catch (e: any) {
      toast({
        title: 'Erro ao carregar rescisões',
        description: e?.message || 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingList(false);
    }
  };

  const loadEnrollments = useCallback(async (searchTerm?: string) => {
    setIsLoadingEnrollments(true);
    try {
      // Fetch enrollments with situacao: 'mat' (Matriculado) and status: 'g' (Ganho)
      // The service already defaults situacao='mat' which filters post_name != 'int'
      const params: any = { 
        per_page: 100, 
        status: 'g' 
      };
      
      if (searchTerm) {
        params.student = searchTerm;
      }
      
      const resp = await enrollmentsService.listEnrollments(params);
      setEnrollments(resp.data || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoadingEnrollments(false);
    }
  }, []);

  const enrollmentOptions = useMemo(() => {
    const list = [...enrollments];
    
    if (selectedEnrollment && !list.some(e => String(e.id) === String(selectedEnrollment.id))) {
      list.push(selectedEnrollment);
    }
    
    return list.map((e) => ({
      value: String(e.id),
      label: `${e.cliente_nome || e.cliente?.name || e.student_name || `Matrícula #${e.id}`} - ${e.curso_nome || e.curso?.nome || e.course_name || 'Curso'}`,
      description: `Matrícula #${e.id} | Código: ${e.curso?.codigo || e.curso_codigo || '-'}`,
    }));
  }, [enrollments, selectedEnrollment]);

  const loadAircrafts = async () => {
    setIsLoadingAircrafts(true);
    try {
      const resp = await aircraftService.listAircraft({ per_page: 100 });
      setAircrafts(resp.data || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsLoadingAircrafts(false);
    }
  };

  useEffect(() => {
    loadRescisoes();
    loadEnrollments();
    loadAircrafts();
  }, []);

  // Sync edit parameter from URL
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && String(editId) !== String(editingId)) {
      handleEdit(editId);
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === 'list') {
      loadRescisoes();
    }
  }, [activeTab, searchQuery]);

  // Handle enrollment selection
  const handleEnrollmentChange = (enrollmentId: string) => {
    setSelectedEnrollmentId(enrollmentId);
    if (!enrollmentId) {
      setSelectedEnrollment(null);
      setValorPago(0);
      setValorMatricula(0);
      setValorInicial(0);
      setHorasCompradas(0);
      setAircraftHours({});
      return;
    }

    const found = enrollments.find(e => String(e.id) === String(enrollmentId));
    setSelectedEnrollment(found || null);
    
    if (found) {
      // Auto-populate contract values from enrollment data
      const initialVal = Number(found.total ?? 0) || Number(found.subtotal ?? 0) || Number(found.meta?.valor_negociado_ganho ?? 0) || 0;
      setValorInicial(initialVal);
      
      // Resolve bought hours from orc.modulos or config/curso fields
      const orc = typeof found.orc === 'object' ? found.orc : {};
      const modules = orc.modulos || [];
      let totalCredits = 0;
      if (Array.isArray(modules)) {
        for (const mod of modules) {
          const stage = String(mod.etapa || '').toLowerCase().replace(/[\s_]/g, '');
          if (stage === 'etapa1') continue;
          const limite = Number(mod.limite);
          if (!isNaN(limite)) {
            totalCredits += limite;
          }
        }
      }
      const boughtHours = Number(found.config?.horas_compradas
        ?? found.config?.horas
        ?? found.horas_compradas
        ?? (totalCredits > 0 ? totalCredits : (Number(found.curso?.duracao) || Number(found.curso?.carga_horaria) || 45)));
      setHorasCompradas(boughtHours);
      
      // Set paid amount from meta or config
      const paid = Number(found.meta?.valor_recebido_ganho
        ?? found.meta?.valor_pago
        ?? found.config?.valor_pago
        ?? found.config?.pago
        ?? found.valor_pago
        ?? 0);
      setValorPago(paid);
      
      // Default enrollment fee
      const matFee = Number(found.meta?.taxa_matricula
        ?? found.meta?.matricula
        ?? found.config?.taxa_matricula
        ?? found.config?.matricula
        ?? found.taxa_matricula
        ?? 600);
      setValorMatricula(matFee);
    }
  };

  // Safe decimal parsing
  const formatCurrency = (val: number) => {
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const toCurrencyInput = (val: number) => {
    if (!val) return '';
    return currencyApplyMask(String(Math.round(val * 100)));
  };

  const statusLabel = (status?: string) => {
    const map: Record<string, { label: string; className: string }> = {
      pending: {
        label: 'Pendente',
        className: 'bg-slate-50 text-slate-600 border-slate-200/60 dark:bg-slate-900/40 dark:text-slate-400 dark:border-slate-800/60',
      },
      sent: {
        label: 'Enviado',
        className: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30',
      },
      signed: {
        label: 'Assinado',
        className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30',
      },
      cancelled: {
        label: 'Cancelado',
        className: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/30',
      },
    };
    const s = map[status || ''] || { label: status || '-', className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300' };
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.className}`}>
        {s.label}
      </span>
    );
  };

  // Calculator computations
  const flownHoursBreakdown = useMemo<AircraftFlown[]>(() => {
    return aircrafts.map(ac => {
      const hours = aircraftHours[ac.id] || 0;
      const rate = Number(ac.hora_rescisao || ac.config?.hora_rescisao || 0);
      return {
        aeronave_id: ac.id,
        nome: ac.nome,
        hora_rescisao: rate,
        quantidade: hours,
        total: hours * rate,
      };
    });
  }, [aircrafts, aircraftHours]);

  const totalHorasVoadasQuantidade = useMemo(() => {
    return flownHoursBreakdown.reduce((sum, item) => sum + item.quantidade, 0);
  }, [flownHoursBreakdown]);

  const totalHorasVoadasValor = useMemo(() => {
    return flownHoursBreakdown.reduce((sum, item) => sum + item.total, 0);
  }, [flownHoursBreakdown]);

  const horasRestantes = useMemo(() => {
    return Math.max(0, horasCompradas - totalHorasVoadasQuantidade);
  }, [horasCompradas, totalHorasVoadasQuantidade]);

  const multaRescisoria = useMemo(() => {
    return valorInicial * 0.30;
  }, [valorInicial]);

  const totalAlojamento = useMemo(() => {
    return diasAlojamento * precoDiaria;
  }, [diasAlojamento, precoDiaria]);

  const saldoFinal = useMemo(() => {
    return valorPago - (valorMatricula + totalHorasVoadasValor + multaRescisoria + totalAlojamento);
  }, [valorPago, valorMatricula, totalHorasVoadasValor, multaRescisoria, totalAlojamento]);

  // Handle single aircraft hours input change
  const handleAircraftHoursChange = (id: string | number, val: string) => {
    const hours = parseFloat(val) || 0;
    setAircraftHours(prev => ({
      ...prev,
      [id]: hours,
    }));
  };

  // Submit Termination
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEnrollmentId) {
      toast({
        title: 'Selecione uma matrícula',
        description: 'É necessário selecionar um aluno/matrícula para rescisão.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const activeFlown = flownHoursBreakdown.filter(item => item.quantidade > 0);
      
      const payload = {
        matricula_id: selectedEnrollmentId,
        data_rescisao: dataRescisao,
        valor_pago: valorPago,
        valor_matricula: valorMatricula,
        valor_inicial: valorInicial,
        horas_compradas: horasCompradas,
        horas_voadas: totalHorasVoadasValor,
        multa_rescisoria: multaRescisoria,
        dias_alojamento: diasAlojamento,
        preco_diaria: precoDiaria,
        valor_alojamento: totalAlojamento,
        saldo_final: saldoFinal,
        config: {
          aeronaves: activeFlown,
          total_horas_voadas: totalHorasVoadasQuantidade,
          horas_restantes: horasRestantes,
        },
        obs,
      };

      if (editingId) {
        await rescisoesService.updateRescisao(editingId, payload);
        toast({
          title: 'Rescisão Atualizada',
          description: 'O registro de rescisão foi atualizado com sucesso.',
        });
      } else {
        await rescisoesService.createRescisao(payload);
        toast({
          title: 'Rescisão Salva',
          description: 'O cálculo da rescisão do contrato foi registrado com sucesso.',
        });
      }

      clearForm();
      
      // Go back to list and refresh
      setActiveTab('list');
      loadRescisoes();
    } catch (err: any) {
      toast({
        title: editingId ? 'Erro ao atualizar rescisão' : 'Erro ao salvar rescisão',
        description: err?.message || 'Verifique os dados e tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Rescisao
  const handleDelete = async (id: string | number) => {
    if (!window.confirm('Tem certeza que deseja excluir este registro de rescisão?')) return;
    try {
      await rescisoesService.deleteRescisao(id);
      toast({
        title: 'Rescisão excluída',
        description: 'O registro foi removido com sucesso.',
      });
      loadRescisoes();
    } catch (e: any) {
      toast({
        title: 'Erro ao excluir',
        description: e?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  // Handle Edit Rescisao
  const handleEdit = async (id: string | number) => {
    try {
      const data = await rescisoesService.getRescisao(id);
      
      setEditingId(id);
      setCurrentToken(data.config?.token || '');
      setCurrentPdfUrl(data.config?.pdf_url || '');
      setDataRescisao(data.data_rescisao);
      setValorPago(data.valor_pago);
      setValorMatricula(data.valor_matricula);
      setValorInicial(data.valor_inicial);
      setHorasCompradas(data.horas_compradas);
      setDiasAlojamento(data.dias_alojamento);
      setPrecoDiaria(data.preco_diaria);
      setObs(data.obs || '');

      // Set enrollment for display
      if (data.matricula_id) {
        setSelectedEnrollmentId(String(data.matricula_id));
        const fakeEnrollment: any = {
          id: data.matricula_id,
          cliente_nome: data.matricula?.cliente?.name || data.matricula?.student_name || '',
          curso_nome: data.matricula?.curso?.nome || data.matricula?.course_name || '',
          situacao: 'Rescindido',
        };
        setSelectedEnrollment(fakeEnrollment);
      }

      // Set aircraft hours from config
      if (data.config?.aeronaves && Array.isArray(data.config.aeronaves)) {
        const hours: Record<string, number> = {};
        for (const ac of data.config.aeronaves) {
          hours[String(ac.aeronave_id)] = ac.quantidade;
        }
        setAircraftHours(hours);
      }

      setActiveTab('new');
      
      // Update URL search params
      if (searchParams.get('edit') !== String(id)) {
        setSearchParams({ edit: String(id) });
      }
    } catch (e: any) {
      toast({
        title: 'Erro ao carregar rescisão',
        description: e?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const clearForm = () => {
    setEditingId(null);
    setCurrentToken('');
    setCurrentPdfUrl('');
    setSelectedEnrollmentId('');
    setSelectedEnrollment(null);
    setValorPago(0);
    setValorMatricula(0);
    setValorInicial(0);
    setHorasCompradas(0);
    setDiasAlojamento(0);
    setPrecoDiaria(100);
    setAircraftHours({});
    setObs('');
    setDataRescisao(new Date().toISOString().substring(0, 10));
    
    // Clear edit parameter from URL
    if (searchParams.get('edit')) {
      setSearchParams({});
    }
  };

  const getEditUrl = (id: string | number) => {
    return `${window.location.origin}/admin/school/termination?edit=${id}`;
  };

  const copyEditLink = async (id: string | number) => {
    const url = getEditUrl(id);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      toast({ title: 'Link de edição copiado!', description: 'O link para esta tela de edição foi copiado para a área de transferência.' });
    } catch {
      toast({ title: 'Erro ao copiar', description: 'Copie manualmente: ' + url, variant: 'destructive' });
    }
  };

  const getPublicUrl = (token?: string) => {
    if (!token) return '';
    return `${window.location.origin}/solicitar-rescisao/${token}`;
  };

  const copyPublicLink = async (token?: string) => {
    const url = getPublicUrl(token);
    if (!url) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      toast({ title: 'Link copiado!', description: 'Link público da rescisão copiado para a área de transferência.' });
    } catch {
      toast({ title: 'Erro ao copiar', description: 'Copie manualmente: ' + url, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <style>{`
        main {
          overflow: visible !important;
        }
      `}</style>
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Rescisão de Contratos
          </h1>
          <p className="text-muted-foreground">Calcule e registre rescisões de alunos com base em horas voadas, diárias e multas.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v: any) => {
        setActiveTab(v);
        if (v === 'list') {
          clearForm();
        }
      }} className="space-y-6">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 p-1 bg-slate-100/80 dark:bg-slate-900/80 backdrop-blur border border-slate-200/50 dark:border-slate-800/50 rounded-xl shadow-sm">
          <TabsTrigger 
            value="list" 
            className="flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-primary data-[state=active]:shadow-sm py-2"
          >
            <FileText className="h-4 w-4" />
            Histórico
          </TabsTrigger>
          <TabsTrigger 
            value="new" 
            className="flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950 data-[state=active]:text-primary data-[state=active]:shadow-sm py-2"
          >
            <Calculator className="h-4 w-4" />
            {editingId ? 'Editando' : 'Nova Rescisão'}
          </TabsTrigger>
        </TabsList>

        {/* LIST TAB */}
        <TabsContent value="list" className="space-y-5 animate-in fade-in duration-300">
          <div className="flex justify-between items-center gap-4 p-4 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome do aluno..."
                className="pl-9 h-10 border-slate-200 dark:border-slate-800 focus-visible:ring-primary/20 rounded-xl"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <Card className="overflow-hidden border-slate-200/80 dark:border-slate-800/80 shadow-md rounded-2xl">
            <CardContent className="p-0">
              {isLoadingList ? (
                <div className="flex flex-col items-center justify-center p-12 space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground font-medium">Carregando histórico...</span>
                </div>
              ) : rescisoes.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground space-y-2">
                  <FileText className="h-10 w-10 text-muted-foreground/50" />
                  <p className="font-medium text-slate-500">Nenhuma rescisão de contrato registrada.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50/70 dark:bg-slate-900/55 hover:bg-slate-50/70 dark:hover:bg-slate-900/55">
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4 pl-6">Aluno</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4">Curso</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4">Data Rescisão</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4">Status</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4">Valor Pago</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4">Multa (30%)</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4">Saldo Final</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 py-4 pr-6 text-right w-[240px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rescisoes.map((item) => (
                        <TableRow key={item.id} className="hover:bg-slate-500/5 transition-colors border-b border-slate-100 dark:border-slate-900/80">
                          <TableCell className="font-semibold text-slate-800 dark:text-slate-100 py-3.5 pl-6">
                            {item.matricula?.cliente?.name || item.matricula?.student_name || `Matrícula #${item.matricula_id}`}
                          </TableCell>
                          <TableCell className="text-slate-600 dark:text-slate-300 py-3.5">
                            {item.matricula?.curso?.nome || item.matricula?.course_name || '-'}
                          </TableCell>
                          <TableCell className="py-3.5">
                            <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                              <Calendar className="h-3.5 w-3.5 text-slate-400" />
                              {item.data_rescisao ? new Date(item.data_rescisao).toLocaleDateString('pt-BR') : '-'}
                            </span>
                          </TableCell>
                          <TableCell className="py-3.5">{statusLabel(item.status)}</TableCell>
                          <TableCell className="font-mono text-sm py-3.5 font-medium">{formatCurrency(item.valor_pago)}</TableCell>
                          <TableCell className="font-mono text-sm py-3.5 text-rose-500 dark:text-rose-400 font-semibold">-{formatCurrency(item.multa_rescisoria)}</TableCell>
                          <TableCell className="py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-bold border ${
                              item.saldo_final >= 0 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/20' 
                                : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/20'
                            }`}>
                              {formatCurrency(item.saldo_final)}
                            </span>
                          </TableCell>
                          <TableCell className="py-3.5 pr-6 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {item.config?.token && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => copyPublicLink(item.config?.token)}
                                    title="Copiar link público"
                                    className="text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-all rounded-full p-2 border border-slate-200/50 dark:border-slate-700/50 shadow-sm"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => window.open(getPublicUrl(item.config?.token), '_blank')}
                                    title="Abrir página pública"
                                    className="text-emerald-600 hover:text-white hover:bg-emerald-500 dark:text-emerald-400 dark:hover:text-white dark:hover:bg-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 transition-all rounded-full p-2 border border-emerald-200/30 dark:border-emerald-900/30 shadow-sm"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </button>
                                  {item.config?.pdf_url && (
                                    <button
                                      type="button"
                                      onClick={() => window.open(item.config?.pdf_url, '_blank')}
                                      title="Abrir PDF da rescisão"
                                      className="text-rose-600 hover:text-white hover:bg-rose-500 dark:text-rose-400 dark:hover:text-white dark:hover:bg-rose-600 bg-rose-50 dark:bg-rose-950/20 transition-all rounded-full p-2 border border-rose-200/30 dark:border-rose-900/30 shadow-sm"
                                    >
                                      <FileText className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => handleEdit(item.id!)}
                                title="Editar rescisão"
                                className="text-blue-600 hover:text-white hover:bg-blue-500 dark:text-blue-400 dark:hover:text-white dark:hover:bg-blue-600 bg-blue-50 dark:bg-blue-950/20 transition-all rounded-full p-2 border border-blue-200/30 dark:border-blue-900/30 shadow-sm"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id!)}
                                title="Excluir rescisão"
                                className="text-red-600 hover:text-white hover:bg-red-500 dark:text-red-400 dark:hover:text-white dark:hover:bg-red-600 bg-red-50 dark:bg-red-950/20 transition-all rounded-full p-2 border border-red-200/30 dark:border-red-900/30 shadow-sm"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* NEW TERMINATION TAB */}
        <TabsContent value="new">
          {editingId && (
            <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent backdrop-blur-md border border-amber-500/20 shadow-md text-sm text-amber-800 dark:text-amber-200 transition-all duration-300">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span className="font-semibold text-base">Editando rescisão #{editingId}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 ml-0 sm:ml-4">
                <a
                  href="/admin/school/contracts"
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-amber-900 bg-amber-100 hover:bg-amber-200 dark:text-amber-100 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 rounded-lg transition-colors shadow-sm"
                  title="Gerenciar contratos com shortcodes"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Modelos de Contratos
                </a>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => copyEditLink(editingId)}
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 dark:border-indigo-900/30 rounded-lg transition-colors shadow-sm"
                  title="Copiar link para esta página de edição"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copiar Link de Edição
                </Button>
                {currentToken ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => copyPublicLink(currentToken)}
                      className="h-8 text-xs text-slate-700 bg-background border-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:border-slate-800 dark:hover:bg-slate-900 px-3 rounded-lg shadow-sm"
                      title="Copiar link público"
                    >
                      <Copy className="h-3.5 w-3.5 mr-1.5 text-slate-500" />
                      Copiar Link
                    </Button>
                    <a
                      href={getPublicUrl(currentToken)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 dark:border-emerald-900/30 rounded-lg transition-colors shadow-sm"
                      title="Abrir página pública em nova aba"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir Página Pública
                    </a>
                    {currentPdfUrl && (
                      <a
                        href={currentPdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 dark:text-rose-300 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 dark:border-rose-900/30 rounded-lg transition-colors shadow-sm"
                        title="Abrir PDF da rescisão"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        Visualizar PDF
                      </a>
                    )}
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground italic bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded">(Registro sem link público)</span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { clearForm(); }}
                className="ml-auto h-8 text-xs text-amber-800 hover:text-amber-900 hover:bg-amber-100/50 dark:text-amber-300 dark:hover:text-amber-200 dark:hover:bg-amber-900/20 rounded-lg"
              >
                Cancelar edição
              </Button>
            </div>
          )}
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* CALCULATOR PANEL */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="shadow-lg border-primary/10">
                <CardHeader className="bg-primary/5 pb-4">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-5 w-5 text-primary" />
                    <CardTitle className="text-xl">{editingId ? 'Editando Rescisão' : 'Dados da Matrícula e Contrato'}</CardTitle>
                    <a
                      href="/admin/school/contracts"
                      className="ml-auto inline-flex items-center gap-1.5 h-7 px-2 text-xs font-medium text-blue-600 hover:text-blue-800 rounded hover:bg-blue-50 transition-colors"
                      title="Gerenciar contratos com shortcodes"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Contratos
                    </a>
                  </div>
                  <CardDescription>{editingId ? 'Revise e atualize os dados da rescisão do contrato.' : 'Selecione a matrícula e preencha os valores contratuais do aluno.'}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2 flex flex-col justify-end">
                      <label className="text-sm font-medium">Selecione o Aluno / Matrícula</label>
                      <Combobox
                        options={enrollmentOptions}
                        value={selectedEnrollmentId}
                        onValueChange={(val) => handleEnrollmentChange(val)}
                        placeholder="Selecione o Aluno / Matrícula..."
                        searchPlaceholder="Pesquisar por aluno..."
                        emptyText="Nenhum aluno/matrícula encontrado."
                        loading={isLoadingEnrollments}
                        onSearch={loadEnrollments}
                        className="h-10"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Data de Rescisão</label>
                      <div className="relative">
                        <Input
                          type="date"
                          value={dataRescisao}
                          onChange={(e) => setDataRescisao(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>

                  {selectedEnrollment && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 p-5 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-950/20 border border-slate-200/60 dark:border-slate-800/80 shadow-inner transition-all duration-500 animate-in fade-in slide-in-from-top-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 mt-0.5">
                          <UserCheck className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block font-medium">Aluno</span>
                          <strong className="font-semibold text-slate-800 dark:text-slate-100 block break-words">
                            {selectedEnrollment.cliente_nome || selectedEnrollment.cliente?.name || selectedEnrollment.student_name}
                          </strong>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 mt-0.5">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block font-medium">Curso</span>
                          <strong className="font-semibold text-slate-800 dark:text-slate-100 block break-words">
                            {selectedEnrollment.curso_nome || selectedEnrollment.curso?.nome || selectedEnrollment.course_name}
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 mt-0.5">
                          <Calendar className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block font-medium">Situação</span>
                          <Badge variant="outline" className="mt-1 border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/20 shadow-none px-2.5 py-0.5 rounded-full font-medium">
                            {selectedEnrollment.situacao || selectedEnrollment.situacao?.nome || 'Ativo'}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-xl bg-slate-500/10 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400 mt-0.5">
                          <span className="text-xs font-bold font-mono">#</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block font-medium">Identificador</span>
                          <strong className="font-mono text-slate-700 dark:text-slate-200 block text-base mt-0.5">
                            #{selectedEnrollment.id}
                          </strong>
                        </div>
                      </div>

                      {editingId && (
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 mt-0.5">
                            <Plane className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="text-xs text-muted-foreground block font-medium">Status Rescisão</span>
                            <div className="mt-1">
                              {statusLabel((rescisoes.find(r => String(r.id) === String(editingId))?.status))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                        Pago até Rescisão
                      </label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={toCurrencyInput(valorPago)}
                        onChange={(e) => setValorPago(currencyRemoveMaskToNumber(e.target.value))}
                        placeholder="R$ 0,00"
                        className="font-mono font-medium focus-visible:ring-primary/20 rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-blue-500" />
                        Taxa Matrícula
                      </label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={toCurrencyInput(valorMatricula)}
                        onChange={(e) => setValorMatricula(currencyRemoveMaskToNumber(e.target.value))}
                        placeholder="R$ 0,00"
                        className="font-mono font-medium focus-visible:ring-primary/20 rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5 text-indigo-500" />
                        Valor Contrato
                      </label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={toCurrencyInput(valorInicial)}
                        onChange={(e) => setValorInicial(currencyRemoveMaskToNumber(e.target.value))}
                        placeholder="R$ 0,00"
                        className="font-mono font-medium focus-visible:ring-primary/20 rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Calculator className="h-3.5 w-3.5 text-purple-500" />
                        Horas Compradas
                      </label>
                      <Input
                        type="number"
                        value={horasCompradas || ''}
                        onChange={(e) => setHorasCompradas(parseInt(e.target.value) || 0)}
                        placeholder="Ex: 45"
                        className="font-mono font-medium focus-visible:ring-primary/20 rounded-xl"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* FLOWN HOURS PER AIRCRAFT BREAKDOWN */}
              <Card className="shadow-md border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200/60 dark:border-slate-800/60 pb-4">
                  <div className="flex items-center gap-2">
                    <Plane className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Horas Voadas por Aeronave</CardTitle>
                  </div>
                  <CardDescription>Preencha a quantidade de horas voadas para cada aeronave.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {isLoadingAircrafts ? (
                    <div className="flex items-center justify-center p-8 space-y-2">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/70 dark:bg-slate-900/55 hover:bg-slate-50/70 dark:hover:bg-slate-900/55">
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 py-3">Aeronave</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 py-3">Valor Hora Rescisão</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 py-3 w-[180px]">Horas Voadas</TableHead>
                            <TableHead className="font-bold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 py-3 text-right">Custo Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {aircrafts.map((ac) => {
                            const rate = Number(ac.hora_rescisao || ac.config?.hora_rescisao || 0);
                            const currentVal = aircraftHours[ac.id] !== undefined ? aircraftHours[ac.id] : '';
                            const hasHours = Number(currentVal) > 0;
                            return (
                              <TableRow 
                                key={ac.id} 
                                className={`transition-all duration-300 ${
                                  hasHours 
                                    ? 'bg-blue-500/5 dark:bg-blue-500/10 border-l-2 border-l-primary hover:bg-blue-500/10 dark:hover:bg-blue-500/15' 
                                    : 'hover:bg-muted/30'
                                }`}
                              >
                                <TableCell className="font-medium py-3">
                                  <div className="flex items-center gap-2">
                                    <Plane className={`h-4 w-4 transition-all duration-500 ${hasHours ? 'text-primary scale-110 rotate-45' : 'text-slate-400'}`} />
                                    <span className={hasHours ? 'text-primary font-bold' : ''}>{ac.nome}</span>
                                    {ac.codigo && <span className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-muted-foreground">({ac.codigo})</span>}
                                  </div>
                                </TableCell>
                                <TableCell className="font-mono text-xs py-3">{formatCurrency(rate)}</TableCell>
                                <TableCell className="py-3">
                                  <Input
                                    type="number"
                                    step="1"
                                    min="0"
                                    placeholder="0"
                                    value={currentVal}
                                    onChange={(e) => handleAircraftHoursChange(ac.id, e.target.value)}
                                    className={`h-8 font-mono text-center font-bold focus-visible:ring-primary/20 rounded-lg ${hasHours ? 'border-primary/50 text-primary bg-primary/5' : ''}`}
                                  />
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold py-3">
                                  <span className={hasHours ? 'text-primary' : 'text-muted-foreground'}>
                                    {formatCurrency((aircraftHours[ac.id] || 0) * rate)}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow className="bg-slate-50 dark:bg-slate-900 border-t-2 border-t-slate-200 dark:border-t-slate-800 font-bold">
                            <TableCell className="py-4">Total de Horas</TableCell>
                            <TableCell className="text-muted-foreground font-normal py-4">-</TableCell>
                            <TableCell className="font-mono text-primary text-base font-black py-4">{totalHorasVoadasQuantidade} hrs</TableCell>
                            <TableCell className="text-right font-mono text-primary text-base font-black py-4">{formatCurrency(totalHorasVoadasValor)}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* LODGING DETAILS */}
              <Card className="shadow-md border-slate-200/80 dark:border-slate-800/80 rounded-2xl overflow-hidden">
                <CardHeader className="bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-200/60 dark:border-slate-800/60 pb-4">
                  <div className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">Alojamento / Diárias</CardTitle>
                  </div>
                  <CardDescription>Calcule os custos de alojamento do aluno durante a matrícula.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5 text-slate-400" />
                        Dias de Alojamento
                      </label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={diasAlojamento || ''}
                        onChange={(e) => setDiasAlojamento(parseInt(e.target.value) || 0)}
                        className="font-mono font-medium focus-visible:ring-primary/20 rounded-xl"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                        Preço da Diária
                      </label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={toCurrencyInput(precoDiaria)}
                        onChange={(e) => setPrecoDiaria(currencyRemoveMaskToNumber(e.target.value))}
                        placeholder="R$ 0,00"
                        className="font-mono font-medium focus-visible:ring-primary/20 rounded-xl"
                      />
                    </div>

                    <div className="space-y-2 flex flex-col justify-end">
                      <div className={`p-3 border rounded-xl font-bold flex justify-between items-center text-sm h-10 transition-all duration-300 ${
                        diasAlojamento > 0 
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400 shadow-sm' 
                          : 'bg-muted/40 text-muted-foreground border-slate-200/50 dark:border-slate-800/50'
                      }`}>
                        <span>Total Alojamento</span>
                        <span className="font-mono">{formatCurrency(totalAlojamento)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-4">
                    <label className="text-sm font-medium">Observações Internas</label>
                    <Textarea
                      placeholder="Adicione motivos, detalhes do distrato ou observações financeiras..."
                      value={obs}
                      onChange={(e) => setObs(e.target.value)}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* LIVE RECEIPT & ACTIONS SIDEBAR */}
            <div className="space-y-6 lg:sticky lg:top-20 lg:self-start">
              <Card className="shadow-2xl border-2 border-primary/20 bg-gradient-to-br from-background via-background to-slate-50/50 dark:to-slate-950/20 backdrop-blur rounded-2xl overflow-hidden transition-all duration-300 hover:border-primary/30">
                <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent pb-4 border-b border-primary/10">
                  <CardTitle className="text-lg flex items-center gap-2 text-primary font-bold">
                    <Calculator className="h-5 w-5 text-primary" />
                    Resumo do Distrato
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                  {/* Realtime breakdown grid */}
                  <div className="space-y-4 text-sm">
                    {/* Section: Créditos */}
                    <div className="space-y-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                        Créditos do Aluno
                      </span>
                      <div className="flex justify-between items-center px-2.5 py-2 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/10 dark:border-emerald-500/20">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          Total Pago no Contrato:
                        </span>
                        <span className="font-extrabold text-emerald-600 dark:text-emerald-400 font-mono text-base">{formatCurrency(valorPago)}</span>
                      </div>
                    </div>

                    {/* Section: Deduções */}
                    <div className="space-y-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/10 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400">
                        Deduções & Encargos
                      </span>
                      <div className="space-y-1.5 bg-rose-500/5 dark:bg-rose-500/10 border border-rose-500/10 dark:border-rose-500/20 rounded-2xl p-2.5">
                        {/* Item: Matricula */}
                        <div className="flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            Taxa de Matrícula:
                          </span>
                          <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono">-{formatCurrency(valorMatricula)}</span>
                        </div>

                        {/* Item: Horas Voadas */}
                        <div className="flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            Horas Voadas ({totalHorasVoadasQuantidade} hrs):
                          </span>
                          <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono">-{formatCurrency(totalHorasVoadasValor)}</span>
                        </div>

                        {/* Item: Multa */}
                        <div className="flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors" title="30% sobre o Valor Inicial do Contrato">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            Multa Rescisória (30%):
                          </span>
                          <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono">-{formatCurrency(multaRescisoria)}</span>
                        </div>

                        {/* Item: Alojamento */}
                        <div className="flex justify-between items-center px-2 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
                          <span className="text-muted-foreground flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            Alojamento ({diasAlojamento} dias):
                          </span>
                          <span className="font-semibold text-rose-600 dark:text-rose-400 font-mono">-{formatCurrency(totalAlojamento)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Premium Total Section */}
                    <div className="pt-2">
                      <div className={`p-4 rounded-2xl flex flex-col items-center justify-center gap-1.5 border transition-all duration-500 shadow-md ${
                        saldoFinal >= 0 
                          ? 'bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 hover:border-emerald-500/40 shadow-emerald-500/5' 
                          : 'bg-gradient-to-br from-rose-500/10 to-rose-500/5 text-rose-700 dark:text-rose-300 border-rose-500/20 hover:border-rose-500/40 shadow-rose-500/5'
                      }`}>
                        <span className="text-[10px] uppercase tracking-widest font-extrabold opacity-80">Saldo Final de Acerto</span>
                        <span className="text-3xl font-black font-mono tracking-tight">{formatCurrency(saldoFinal)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Calculated dynamic details badge */}
                  <div className={`p-4 rounded-xl border text-sm text-center transition-all duration-300 ${
                    saldoFinal >= 0 
                      ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-800 dark:text-emerald-200' 
                      : 'bg-rose-500/5 border-rose-500/10 text-rose-800 dark:text-rose-200'
                  }`}>
                    {saldoFinal >= 0 ? (
                      <div className="font-semibold flex items-center justify-center gap-1.5">
                        <span className="text-lg">🎉</span>
                        <span>Aluno possui crédito a ser reembolsado.</span>
                      </div>
                    ) : (
                      <div className="font-semibold flex items-center justify-center gap-1.5">
                        <span className="text-lg">⚠️</span>
                        <span>Aluno possui débito a ser pago à escola.</span>
                      </div>
                    )}

                    {/* Progress Bar for Course Hours */}
                    {selectedEnrollment && (
                      <div className="mt-3.5 space-y-1.5 border-t border-slate-200/50 dark:border-slate-800/50 pt-3">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span className="font-medium">Horas Voadas do Contrato</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{totalHorasVoadasQuantidade} / {horasCompradas} hrs</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-700" 
                            style={{ width: `${Math.min(100, (totalHorasVoadasQuantidade / (horasCompradas || 1)) * 100)}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-muted-foreground flex justify-between pt-0.5">
                          <span>{horasRestantes} horas restantes</span>
                          <span>Falta {Math.round(Math.max(0, 100 - (totalHorasVoadasQuantidade / (horasCompradas || 1)) * 100))}%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="pt-1">
                    <Button
                      type="submit"
                      disabled={isSubmitting || !selectedEnrollmentId}
                      className="w-full h-12 text-sm font-bold flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-indigo-600 text-white shadow-lg hover:shadow-xl hover:opacity-95 active:scale-98 transition-all duration-200"
                    >
                      {isSubmitting ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          {editingId ? 'Atualizar Rescisão' : 'Registrar Rescisão'}
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
