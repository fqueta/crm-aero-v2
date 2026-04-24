import React, { useEffect, useState, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { currencyRemoveMaskToNumber, currencyRemoveMaskToString, currencyApplyMask } from '@/lib/masks/currency';
import { DollarSign, Plane, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface CourseModulesSelectorProps {
  course: any;
  aircrafts: any[];
  onChange: (data: { modules: any[]; total: number; etapa1Discount: number }) => void;
  getAircraftHourlyRate: (aircraft: any) => number;
  formatCurrencyBRL: (value: number) => string;
  initialSelections?: Record<number, ModuleSelection>;
  initialEtapa1Discount?: number;
  initialDollarRate?: number;
}

interface ModuleSelection {
  selected: boolean;
  credits: number;
  aircraftId: string;
  price: number;
}

type CurrencyType = 'BRL' | 'USD';

export default function CourseModulesSelector({ 
  course, 
  aircrafts, 
  onChange,
  getAircraftHourlyRate: getAircraftHourlyRateProp,
  formatCurrencyBRL,
  initialSelections: providedInitialSelections,
  initialEtapa1Discount,
  initialDollarRate
}: CourseModulesSelectorProps) {
  const { toast } = useToast();
  const [currency, setCurrency] = useState<CurrencyType>('BRL');
  const [dollarRate, setDollarRate] = useState<number>(initialDollarRate || 5.15);
  const [globalAircraftId, setGlobalAircraftId] = useState<string>('');
  // Inicializa o estado com base nos módulos do curso
  const initialSelections = useMemo(() => {
    // Se tiver seleções iniciais fornecidas (ex: edição), usa elas como base
    // mas garante que todos os índices existam
    if (providedInitialSelections) {
        const modules = Array.isArray(course?.modulos) ? course.modulos : [];
        const combined: Record<number, ModuleSelection> = {};
        
        modules.forEach((mod: any, idx: number) => {
            if (providedInitialSelections[idx]) {
                combined[idx] = providedInitialSelections[idx];
            } else {
                combined[idx] = {
                    selected: false,
                    credits: Number(mod.limite || 0),
                    aircraftId: '',
                    price: 0
                };
            }
        });
        return combined;
    }

    const modules = Array.isArray(course?.modulos) ? course.modulos : [];
    return modules.reduce((acc: any, mod: any, idx: number) => {
      // Tenta extrair valor inicial do módulo se existir (ex: Etapa 1 com valor fixo)
      let initialPrice = 0;
      if (mod.valor) {
        initialPrice = typeof mod.valor === 'number' 
            ? mod.valor 
            : currencyRemoveMaskToNumber(String(mod.valor));
      }

      acc[idx] = {
        selected: false,
        credits: Number(mod.limite || 0),
        aircraftId: '',
        price: initialPrice
      };
      return acc;
    }, {} as Record<number, ModuleSelection>);
  }, [course, providedInitialSelections]);

  const [selections, setSelections] = useState<Record<number, ModuleSelection>>(initialSelections);
  const [etapa1Discount, setEtapa1Discount] = useState<number>(initialEtapa1Discount || 0);
  const [collapsedEtapas, setCollapsedEtapas] = useState<Record<string, boolean>>({});

  const toggleEtapa = (etapa: string) => {
    setCollapsedEtapas(prev => ({ ...prev, [etapa]: !prev[etapa] }));
  };

  useEffect(() => {
    if (initialEtapa1Discount !== undefined) {
      setEtapa1Discount(initialEtapa1Discount);
    }
  }, [initialEtapa1Discount]);

  // Filtra aeronaves vinculadas ao curso de forma global
  const courseLinkedAircrafts = useMemo(() => {
    const linked = course?.aeronaves || course?.aviao || [];
    const linkedArray = Array.isArray(linked) ? linked : [];
    
    // Se não houver nada vinculado no cadastro do curso, mostra todas como fallback
    if (linkedArray.length === 0) return aircrafts;

    // Normaliza os identificadores vinculados (podem ser IDs ou Tokens)
    const linkedIdentifiers = linkedArray.map(item => String(item.id || item));
    
    return aircrafts.filter(a => {
        const idMatch = linkedIdentifiers.includes(String(a.id));
        const tokenMatch = a.token && linkedIdentifiers.includes(String(a.token));
        return idMatch || tokenMatch;
    });
  }, [course, aircrafts]);

  const hydratedRef = React.useRef<string | null>(null);

  // Atualiza seleções se o curso mudar (reset) ou se houver hidratação inicial
  useEffect(() => {
    const modules = Array.isArray(course?.modulos) ? course.modulos : [];
    if (modules.length === 0) return;

    const currentCourseId = String(course?.id || '');
    
    // pt-BR: Se já hidratamos este curso específico com dados do banco, não fazemos nada
    // en-US: If we already hydrated this specific course with DB data, do nothing
    if (hydratedRef.current === currentCourseId) {
        return;
    }

    // pt-BR: Só prosseguimos se tivermos os módulos do curso carregados
    if (modules.length === 0) return;

    setSelections(prev => {
        const next: Record<number, ModuleSelection> = {};
        modules.forEach((mod: any, idx: number) => {
            // pt-BR: Se houver providedInitialSelections para este índice, essa é a prioridade na hidratação
            // en-US: If there's providedInitialSelections for this index, it's the hydration priority
            if (providedInitialSelections && providedInitialSelections[idx]) {
                next[idx] = { ...providedInitialSelections[idx], course_id_ref: currentCourseId };
                return;
            }

            // Fallback: Se não tem seleção inicial para este módulo, inicializa com valor padrão do curso
            let defaultPrice = 0;
            if (mod.valor) {
                defaultPrice = typeof mod.valor === 'number' 
                    ? mod.valor 
                    : currencyRemoveMaskToNumber(String(mod.valor));
            }

            next[idx] = {
                selected: false,
                credits: Number(mod.limite || 0),
                aircraftId: '',
                price: defaultPrice,
                course_id_ref: currentCourseId
            } as any;
        });
        
        // pt-BR: Só marcamos como hidratado se realmente recebemos dados para hidratar
        // ou se o curso mudou (reset). Se providedInitialSelections ainda for undefined/null,
        // esperamos a próxima execução para tentar pegar os dados do banco.
        if (providedInitialSelections) {
            hydratedRef.current = currentCourseId;
        }

        return next;
    });

  }, [course?.id, providedInitialSelections]);


  // Agrupa módulos por etapa
  const groupedModules = useMemo(() => {
    const modules = Array.isArray(course?.modulos) ? course.modulos : [];
    const groups: Record<string, { module: any; index: number }[]> = {};
    
    modules.forEach((mod: any, idx: number) => {
      let etapa = mod.etapa || 'Sem Etapa';
      // Normalização básica para exibição
      if (etapa.toLowerCase().replace(/\s/g, '') === 'etapa1') etapa = 'Etapa 1';
      else if (etapa.toLowerCase().replace(/\s/g, '') === 'etapa2') etapa = 'Etapa 2';
      
      if (!groups[etapa]) groups[etapa] = [];
      groups[etapa].push({ module: mod, index: idx });
    });
    
    return groups;
  }, [course]);

  // Helper local para obter valor da hora respeitando a moeda selecionada (Padronizado BRL/USD)
  const getAircraftRate = (aircraft: any, targetCurrency: CurrencyType = currency) => {
    if (!aircraft?.pacotes) return 0;
    try {
      const pacotes = typeof aircraft.pacotes === 'string' ? JSON.parse(aircraft.pacotes) : aircraft.pacotes;
      const pacotesList = Array.isArray(pacotes) ? pacotes : Object.values(pacotes);
      
      const pkg = pacotesList[0] as any;
      if (!pkg) return 0;

      // Busca estrita pelas chaves padronizadas
      if (targetCurrency === 'USD') {
        const val = pkg['Hora Seca (USD)'] || pkg['hora-seca_dolar'] || pkg['hora-seca-dolar'] || pkg['usd'];
        return val ? currencyRemoveMaskToNumber(String(val)) : 0;
      }

      // Para BRL, tenta a chave padronizada primeiro
      const valBrl = pkg['Hora Seca (BRL)'] || pkg['hora-seca'] || pkg['brl'];
      if (valBrl) {
        return currencyRemoveMaskToNumber(String(valBrl));
      }

      // Fallback para lógica original apenas se a chave padronizada não existir (Retrocompatibilidade)
      return getAircraftHourlyRateProp(aircraft);
    } catch (err) {
      console.error("Erro ao calcular valor da aeronave:", err);
      return 0;
    }
  };

  // Helper para formatar moeda dinamicamente
  // Nota: Agora sempre mostramos o valor final em BRL conforme solicitado, 
  // mas podemos usar formatValueUSD para detalhes específicos.
  const formatValue = (val: number) => {
    return formatCurrencyBRL(val);
  };

  const formatValueUSD = (val: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  // Helper para obter o preço final aplicado (já convertido para BRL se for USD)
  const getAppliedRate = (aircraft: any) => {
    const rawRate = getAircraftRate(aircraft);
    return currency === 'USD' ? rawRate * dollarRate : rawRate;
  };

  // Atualiza o estado quando uma seleção muda
  const handleSelectionChange = (idx: number, field: keyof ModuleSelection, value: any) => {
    setSelections(prev => {
      const current = prev[idx];
      const next = { ...current, [field]: value };
      
      // Recalcula preço se mudar créditos ou aeronave (apenas se tiver aeronave selecionada)
      // pt-BR: Pula recálculo se for Etapa 1 (Teórica/Manual)
      const module = course?.modulos?.[idx];
      const etapaStr = String(module?.etapa || '').toLowerCase();
      const isTeoria = etapaStr.includes('etapa 1') || etapaStr.includes('etapa1') || etapaStr.includes('teoria');

      if (!isTeoria && (field === 'credits' || field === 'aircraftId' || (field as any) === 'currency_change')) {
        const aircraft = aircrafts.find(a => String(a.id) === String(next.aircraftId));
        if (aircraft) {
            next.price = next.credits * getAppliedRate(aircraft);
        }
      }
      
      // Se selecionou aeronave, marca como selecionado automaticamente
      if (field === 'aircraftId' && value && !current.selected) {
        next.selected = true;
      }
      // Se editou preço manual e for maior ou igual a zero (se selecionado), marca selecionado
      // Nota: Permitimos 0 como valor válido selecionado
      if (field === 'price' && !current.selected) {
        next.selected = true;
      }

      return { ...prev, [idx]: next };
    });
  };

  const handleCheckboxChange = (idx: number, checked: boolean) => {
    setSelections(prev => {
      const newState = { ...prev };
      newState[idx] = { ...newState[idx], selected: checked };

      // Se marcou e temos uma aeronave global selecionada, aplica ela
      if (checked && globalAircraftId) {
          const module = course?.modulos?.[idx];
          const allowed = getAllowedAircrafts(module);
          const canApply = allowed.some(a => String(a.id) === String(globalAircraftId));
          
          if (canApply) {
              newState[idx].aircraftId = globalAircraftId;
              const aircraft = aircrafts.find(a => String(a.id) === String(globalAircraftId));
              if (aircraft) {
                  newState[idx].price = newState[idx].credits * getAppliedRate(aircraft);
              }
          }
      }

      return newState;
    });
  };

  // Efeito para recalcular tudo se a moeda ou cotação mudar
  useEffect(() => {
    setSelections(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        const idx = Number(key);
        const sel = next[idx];
        
        // pt-BR: Não recalcula preço de módulos teóricos (Etapa 1) com base em aeronave
        const module = course?.modulos?.[idx];
        const etapaStr = String(module?.etapa || '').toLowerCase();
        const isTeoria = etapaStr.includes('etapa 1') || etapaStr.includes('etapa1') || etapaStr.includes('teoria');
        if (isTeoria) return;

        if (sel.aircraftId) {
          const aircraft = aircrafts.find(a => String(a.id) === String(sel.aircraftId));
          if (aircraft) {
            next[idx] = { ...sel, price: sel.credits * getAppliedRate(aircraft) };
          }
        }
      });
      return next;
    });
  }, [currency, dollarRate]);

  // Handler para aplicar aeronave global em massa
  const handleApplyGlobalAircraft = (id: string) => {
    setGlobalAircraftId(id === 'none' ? '' : id);
    if (!id || id === 'none') {
        // Se selecionou 'none', podemos opcionalmente limpar todas as aeronaves dos módulos
        // mas o comportamento esperado geralmente é apenas parar de aplicar automaticamente.
        // Vamos apenas atualizar o ID global e retornar.
        return;
    }

    setSelections(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(key => {
        const idx = Number(key);
        const module = course?.modulos?.[idx];
        const etapaStr = String(module?.etapa || '').toLowerCase();
        
        // pt-BR: Pula se for etapa 1 (teoria) ou se for o módulo de matrícula/avulso que não usa aeronave
        const isTeoria = etapaStr.includes('etapa 1') || etapaStr.includes('etapa1') || etapaStr.includes('teoria');

        if (isTeoria) return;

        const allowed = getAllowedAircrafts(module);
        const canApply = allowed.some(a => String(a.id) === String(id));

        if (canApply) {
           next[idx] = { ...next[idx], selected: true, aircraftId: id };
           const aircraft = aircrafts.find(a => String(a.id) === String(id));
           if (aircraft) {
             next[idx].price = next[idx].credits * getAppliedRate(aircraft);
           }
        }
      });
      return next;
    });

    toast?.({
        title: "Aeronave Aplicada",
        description: "A aeronave foi aplicada a todos os módulos compatíveis da etapa prática.",
    });
  };

  // Notifica mudanças para o componente pai
  useEffect(() => {
    const modules = Array.isArray(course?.modulos) ? course.modulos : [];
    const selectedItems: any[] = [];
    let total = 0;

    Object.entries(selections).forEach(([idxStr, sel]) => {
      const idx = Number(idxStr);
      if (sel.selected) {
        const originalMod = modules[idx];
        const aircraft = aircrafts.find(a => String(a.id) === String(sel.aircraftId));
        
        // Monta objeto do módulo com os valores selecionados
        const modWithValues = {
          ...originalMod,
          limite: String(sel.credits), // Atualiza créditos
          valor: sel.price,            // Valor calculado
          aircraft_id: aircraft?.id,
          aircraft_name: aircraft?.nome || aircraft?.matricula || aircraft?.post_title || `Aeronave ${aircraft?.id}`
        };
        
        selectedItems.push(modWithValues);
        total += sel.price;
      }
    });

    // Subtrai desconto da Etapa 1 do total geral
    total = Math.max(0, total - etapa1Discount);

    onChange({ 
        modules: selectedItems, 
        total, 
        etapa1Discount,
        currency,
        dollarRate,
        symbol: 'R$' // Sempre R$ no final pois a proposta é gerada em reais
    } as any);
  }, [selections, course, aircrafts, etapa1Discount, currency, dollarRate]);

  const handleSelectAllGroup = (groupItems: { index: number }[], checked: boolean) => {
    setSelections(prev => {
      const next = { ...prev };
      groupItems.forEach(({ index }) => {
        const item = { ...next[index], selected: checked };
        
        // Se estiver marcando e houver aeronave global, aplica logo
        if (checked && globalAircraftId) {
             const module = course?.modulos?.[index];
             const allowed = getAllowedAircrafts(module);
              if (allowed.some(a => String(a.id) === String(globalAircraftId))) {
                  item.aircraftId = globalAircraftId;
                  const aircraft = aircrafts.find(a => String(a.id) === String(globalAircraftId));
                  if (aircraft) {
                      item.price = item.credits * getAppliedRate(aircraft);
                  }
              }
        }
        
        next[index] = item;
      });
      return next;
    });
  };

  // Helper para filtrar aeronaves permitidas
  const getAllowedAircrafts = (module: any) => {
    // 1. Tenta pegar aeronaves específicas do módulo
    const moduleAllowedIds = module?.aviao || [];
    if (Array.isArray(moduleAllowedIds) && moduleAllowedIds.length > 0) {
      const allowedSet = new Set(moduleAllowedIds.map(String));
      return aircrafts.filter((a: any) => {
          const idMatch = allowedSet.has(String(a.id));
          const tokenMatch = a.token && allowedSet.has(String(a.token));
          return idMatch || tokenMatch;
      });
    }

    // 2. Se o módulo não tiver restrição, usa a lista global vinculada ao curso
    return courseLinkedAircrafts;
  };

  return (
    <div className="space-y-6">
      {/* Controles Globais */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground uppercase font-semibold">Moeda da Proposta</Label>
              <div className="flex items-center bg-background rounded-md border p-0.5 w-fit">
                <Button 
                    variant={currency === 'BRL' ? 'default' : 'ghost'} 
                    size="sm" 
                    className="h-7 px-3 text-xs gap-1.5"
                    onClick={() => setCurrency('BRL')}
                >
                    <span className="font-bold">R$</span> Real
                </Button>
                <Button 
                    variant={currency === 'USD' ? 'default' : 'ghost'} 
                    size="sm" 
                    className="h-7 px-3 text-xs gap-1.5"
                    onClick={() => setCurrency('USD')}
                >
                    <DollarSign className="w-3 h-3" /> Dólar (Ref)
                </Button>
              </div>
            </div>

            {currency === 'USD' && (
              <div className="space-y-1 w-[120px] animate-in slide-in-from-left-2 duration-300">
                <Label className="text-xs text-muted-foreground uppercase font-semibold">Cotação US$</Label>
                <div className="relative">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">R$</span>
                    <Input 
                        type="text"
                        className="h-8 pl-7 text-sm font-medium"
                        value={currencyApplyMask(String(dollarRate.toFixed(2)))}
                        onChange={(e) => setDollarRate(currencyRemoveMaskToNumber(e.target.value))}
                    />
                </div>
              </div>
            )}

            <div className="space-y-1 min-w-[280px]">
              <Label className="text-xs text-muted-foreground uppercase font-semibold">Aplicar aeronave em massa</Label>
              <Select value={globalAircraftId} onValueChange={handleApplyGlobalAircraft}>
                <SelectTrigger className="h-8 bg-background">
                    <div className="flex items-center gap-2">
                        <Plane className="w-3.5 h-3.5 text-muted-foreground" />
                        <SelectValue placeholder="Selecione para aplicar a todos" />
                    </div>
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">Nenhuma (limpar seleção global)</SelectItem>
                    {courseLinkedAircrafts.map(a => {
                        const usdRate = getAircraftRate(a, 'USD');
                        const brlRate = getAircraftRate(a, 'BRL');
                        
                        const displayRate = currency === 'USD' 
                            ? `${formatValueUSD(usdRate)}/h (~ ${formatValue(usdRate * dollarRate)}/h)`
                            : `${formatValue(brlRate)}/h`;

                        return (
                            <SelectItem key={a.id} value={String(a.id)}>
                                {a.nome || a.matricula} ({displayRate})
                            </SelectItem>
                        );
                    })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="hidden md:block">
            <Badge variant="outline" className="bg-background py-1 px-3 border-primary/20 text-primary">
                Configuração Tipo 2 — Baseado em Horas de Voo
            </Badge>
          </div>
        </CardContent>
      </Card>

      {Object.entries(groupedModules).map(([etapa, items]) => {
        const normalizedEtapa = String(etapa || '').toLowerCase().replace(/\s/g, '');
        const isEtapa1 = normalizedEtapa === 'etapa1';
        
        const allSelected = items.every(({ index }) => selections[index]?.selected);
        const someSelected = items.some(({ index }) => selections[index]?.selected);
        const isIndeterminate = someSelected && !allSelected;
        const isCollapsed = collapsedEtapas[etapa];

        return (
          <div key={etapa} className="space-y-4">
            <Card className="border-l-4 border-l-primary/20 overflow-hidden">
              <CardHeader 
                className="py-2 px-4 bg-muted/10 flex flex-row items-center justify-between cursor-pointer hover:bg-muted/20 transition-colors"
                onClick={() => toggleEtapa(etapa)}
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
                  <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                    {etapa}
                  </CardTitle>
                  {isCollapsed && someSelected && (
                    <Badge variant="secondary" className="text-[9px] h-4">
                      {items.filter(i => selections[i.index]?.selected).length} selecionados
                    </Badge>
                  )}
                </div>
                {!isCollapsed && (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Button 
                          type="button"
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] uppercase font-bold text-muted-foreground hover:text-red-600"
                          onClick={() => {
                              setSelections(prev => {
                                  const next = { ...prev };
                                  items.forEach(({ index }) => {
                                      if (next[index]) next[index] = { ...next[index], price: 0 };
                                  });
                                  return next;
                              });
                          }}
                      >
                          Zerar Valores
                      </Button>
                      <Button 
                          type="button"
                          variant="ghost" 
                          size="sm" 
                          className="h-7 text-[10px] uppercase font-bold text-muted-foreground"
                          onClick={() => {
                              setSelections(prev => {
                                  const next = { ...prev };
                                  items.forEach(({ index, module }) => {
                                      if (next[index]) {
                                          let defaultPrice = 0;
                                          if (module.valor) {
                                              defaultPrice = typeof module.valor === 'number' 
                                                  ? module.valor 
                                                  : currencyRemoveMaskToNumber(String(module.valor));
                                          }
                                          
                                          // Se não for etapa 1, tenta recalcular baseado na aeronave se houver
                                          if (!isEtapa1 && next[index].aircraftId) {
                                              const ak = aircrafts.find(a => String(a.id) === String(next[index].aircraftId));
                                              if (ak) defaultPrice = next[index].credits * getAppliedRate(ak);
                                          }

                                          next[index] = { ...next[index], price: defaultPrice };
                                      }
                                  });
                                  return next;
                              });
                          }}
                      >
                          Restaurar Padrão
                      </Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className={`p-0 transition-all duration-300 ${isCollapsed ? 'hidden' : 'block'}`}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px] text-center">
                        <Checkbox
                          checked={allSelected ? true : isIndeterminate ? 'indeterminate' : false}
                          onCheckedChange={(checked) => handleSelectAllGroup(items, checked === true)}
                        />
                      </TableHead>
                      <TableHead>Fase / Módulo</TableHead>
                      {!isEtapa1 && <TableHead className="w-[100px]">Créditos</TableHead>}
                      {!isEtapa1 && <TableHead className="w-[300px]">Aeronave</TableHead>}
                      <TableHead className="w-[140px] text-right">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(({ module, index }) => {
                      const sel = selections[index] || { selected: false, credits: 0, aircraftId: '', price: 0 };
                      const allowedAircrafts = getAllowedAircrafts(module);
                      const hasAircraftOption = allowedAircrafts.length > 0;

                      return (
                        <TableRow key={index} className={sel.selected ? "bg-primary/5" : ""}>
                          <TableCell className="text-center">
                            <Checkbox 
                              checked={sel.selected}
                              onCheckedChange={(checked) => handleCheckboxChange(index, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[300px]">
                            {module.titulo || module.nome}
                          </TableCell>
                          
                          {!isEtapa1 && (
                            <TableCell>
                              <Input 
                                type="number" 
                                className="h-8 w-20" 
                                value={sel.credits}
                                onChange={(e) => handleSelectionChange(index, 'credits', Number(e.target.value))}
                                disabled={!sel.selected}
                              />
                            </TableCell>
                          )}
                          
                          {!isEtapa1 && (
                            <TableCell>
                              {hasAircraftOption ? (
                                <Select 
                                  value={sel.aircraftId} 
                                  onValueChange={(val) => handleSelectionChange(index, 'aircraftId', val)}
                                  disabled={!sel.selected}
                                >
                                  <SelectTrigger className="h-8 w-full">
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                  <SelectContent className="min-w-[300px] bg-white dark:bg-slate-950 text-black dark:text-white border border-gray-200 shadow-md z-[9999]">
                                    {allowedAircrafts.map((a: any) => {
                                      const usdRate = getAircraftRate(a, 'USD');
                                      const brlRate = getAircraftRate(a, 'BRL');
                                      const label = a.nome || a.matricula || a.post_title || `Aeronave ${a.id}`;
                                      
                                      const displayRate = currency === 'USD'
                                        ? `${formatValueUSD(usdRate)}/h (~ ${formatValue(usdRate * dollarRate)}/h)`
                                        : `${formatValue(brlRate)}/h`;

                                      return (
                                        <SelectItem 
                                          key={String(a.id)} 
                                          value={String(a.id)}
                                          className="text-black dark:text-white focus:bg-slate-100 dark:focus:bg-slate-800"
                                        >
                                          {label} — {displayRate}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-muted-foreground text-xs italic">N/A</span>
                              )}
                            </TableCell>
                          )}

                          <TableCell>
                            <div className="flex flex-col items-end gap-1">
                              <div className="relative w-32">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-bold">R$</span>
                                <Input 
                                  type="text"
                                  className="h-8 pl-7 text-right text-xs font-semibold"
                                  value={currencyApplyMask(String(sel.price.toFixed(2)))}
                                  onChange={(e) => handleSelectionChange(index, 'price', currencyRemoveMaskToNumber(e.target.value))}
                                  disabled={!sel.selected}
                                />
                              </div>
                              
                              {sel.selected && sel.aircraftId && !isEtapa1 && (
                                <div className="text-[10px] text-muted-foreground text-right leading-tight opacity-70">
                                    {(() => {
                                        const ak = aircrafts.find(a => String(a.id) === String(sel.aircraftId));
                                        const r = ak ? getAircraftRate(ak) : 0;
                                        return (
                                            currency === 'USD' ? (
                                                <>({sel.credits}h x {formatValueUSD(r)}/h x R$ {dollarRate.toFixed(2)})</>
                                            ) : (
                                                <>({sel.credits}h x {formatValue(r)}/h)</>
                                            )
                                        );
                                    })()}
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Campo de Desconto para Etapa 1 */}
            {/* {isEtapa1 && (
              <div className="flex justify-end pr-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Desconto Etapa 1:</span>
                  <Input
                    className="h-9 w-32 text-right text-red-600 font-medium"
                    value={formatCurrencyBRL(etapa1Discount)}
                    onChange={(e) => {
                       const val = currencyRemoveMaskToNumber(e.target.value);
                       setEtapa1Discount(val);
                    }}
                    placeholder="R$ 0,00"
                  />
                </div>
              </div>
            )} */}
          </div>
        );
      })}
      
      <div className="flex justify-end p-4 bg-muted/20 rounded-lg">
        <div className="text-right">
          <span className="text-sm text-muted-foreground mr-2">Total Estimado:</span>
          <span className="text-xl font-bold">
            {formatValue(Object.values(selections).filter(s => s.selected).reduce((acc, curr) => acc + curr.price, 0))}
          </span>
        </div>
      </div>
    </div>
  );
}
