import React, { useEffect, useState, useMemo } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { currencyRemoveMaskToNumber, currencyRemoveMaskToString, currencyApplyMask } from '@/lib/masks/currency';

interface CourseModulesSelectorProps {
  course: any;
  aircrafts: any[];
  onChange: (data: { modules: any[]; total: number; etapa1Discount: number }) => void;
  getAircraftHourlyRate: (aircraft: any) => number;
  formatCurrencyBRL: (value: number) => string;
  initialSelections?: Record<number, ModuleSelection>;
  initialEtapa1Discount?: number;
}

interface ModuleSelection {
  selected: boolean;
  credits: number;
  aircraftId: string;
  price: number;
}

export default function CourseModulesSelector({ 
  course, 
  aircrafts, 
  onChange,
  getAircraftHourlyRate,
  formatCurrencyBRL,
  initialSelections: providedInitialSelections,
  initialEtapa1Discount
}: CourseModulesSelectorProps) {
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

  // Sincroniza initialEtapa1Discount se mudar (para edição)
  useEffect(() => {
    if (initialEtapa1Discount !== undefined) {
      setEtapa1Discount(initialEtapa1Discount);
    }
  }, [initialEtapa1Discount]);

  // Atualiza seleções se initialSelections mudar (hidratação tardia)
  useEffect(() => {
    // Se o curso mudar, precisamos re-inicializar o estado base, MAS preservando edições do usuário se possível.
    // A lógica anterior estava um pouco confusa. Vamos simplificar.
    
    setSelections(prev => {
        const modules = Array.isArray(course?.modulos) ? course.modulos : [];
        const next: Record<number, ModuleSelection> = {};

        modules.forEach((mod: any, idx: number) => {
            // Se houver providedInitialSelections para este índice, use-o (prioridade máxima - vindo do BD)
            if (providedInitialSelections && providedInitialSelections[idx]) {
                next[idx] = providedInitialSelections[idx];
                return;
            }

            // Se já tivermos um estado local para este índice, use-o (preserva edições em andamento)
            // CUIDADO: Se mudou de curso, o índice pode referir a outro módulo.
            // O ideal seria verificar se o ID ou título do módulo mudou, mas CourseModulesSelector
            // geralmente é montado para um curso específico. Se o curso muda, o componente deve remountar ou resetar.
            // Assumindo que o componente é resetado ou que o parent limpa o estado.
            
            // Mas se course muda, queremos resetar para os defaults do novo curso,
            // a menos que providedInitialSelections diga o contrário.
            // Como saber se course mudou? useEffect dependencies.
            
            // Vamos assumir que se providedInitialSelections existe, ele é a fonte da verdade.
            // Se não, usamos os defaults do curso.
            
            // Vamos calcular o default deste módulo
            let defaultPrice = 0;
            if (mod.valor) {
                defaultPrice = typeof mod.valor === 'number' 
                    ? mod.valor 
                    : currencyRemoveMaskToNumber(String(mod.valor));
            }
            
            // Se já existe no estado anterior, mantemos?
            // Só se fizer sentido. Se o usuário trocou o curso no dropdown pai, o estado anterior é lixo.
            // O componente pai (ProposalsCreate/Edit) deve estar passando um `key` ou o React gerencia.
            // Se não, precisamos resetar.
            
            // Para garantir que valores iniciais (como 100,00) apareçam quando o curso é carregado pela primeira vez:
            // Se prev[idx] não existe, usa default.
            // Se prev[idx] existe, e tem price 0 mas o módulo tem valor, talvez devêssemos atualizar?
            // Não, porque o usuário pode ter zerado manualmente.
            
            // Melhor estratégia:
            // Se providedInitialSelections mudou, ele vence.
            // Se course mudou, reinicia com defaults.
            // Como diferenciar "course mudou" de "outra renderização"?
            // O useEffect roda quando [course, providedInitialSelections] muda.
            
            // Se providedInitialSelections está presente, usamos ele.
            // Se não, usamos defaults do curso.
            
            // O problema é que se o usuário editar (setSelections), isso não dispara esse useEffect,
            // então o estado local é preservado.
            // Mas se course mudar, esse useEffect dispara. E aí sobrescrevemos tudo com defaults do NOVO curso.
            // Isso parece correto.
            
            next[idx] = {
                selected: false,
                credits: Number(mod.limite || 0),
                aircraftId: '',
                price: defaultPrice
            };
        });
        
        // Se tiver providedInitialSelections, sobrescreve o que tiver
        if (providedInitialSelections) {
             Object.entries(providedInitialSelections).forEach(([k, v]) => {
                 const i = Number(k);
                 if (next[i]) next[i] = v;
             });
        }
        
        return next;
    });

  }, [course, providedInitialSelections]);


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

  // Atualiza o estado quando uma seleção muda
  const handleSelectionChange = (idx: number, field: keyof ModuleSelection, value: any) => {
    setSelections(prev => {
      const current = prev[idx];
      const next = { ...current, [field]: value };
      
      // Recalcula preço se mudar créditos ou aeronave (apenas se tiver aeronave selecionada)
      if (field === 'credits' || field === 'aircraftId') {
        const aircraft = aircrafts.find(a => String(a.id) === String(next.aircraftId));
        // Se tiver aeronave, calcula; se não, mantém o preço atual (pode ser manual) ou zero
        if (aircraft) {
            const rate = getAircraftHourlyRate(aircraft);
            next.price = next.credits * rate;
        } else if (field === 'aircraftId' && !value) {
            // Se limpou a aeronave, zera o preço? Ou mantém manual?
            // Geralmente, se depende de aeronave e remove, vira zero.
            // Mas para Etapa 1, não tem aeronave.
            // Vamos checar se o módulo original é Etapa 1? Não temos acesso fácil aqui sem lookup.
            // Mas se aircraftId ficou vazio, assumimos que o preço não é derivado de aeronave
            // A MENOS que fosse antes.
            // Para simplificar: se o usuário limpou a aeronave, assumimos que ele quer zerar ou editar manualmente.
            // Mas se ele editou manualmente, não queremos sobrescrever.
            // Então só sobrescrevemos se tiver aeronave.
        }
      }
      
      // Se selecionou aeronave, marca como selecionado automaticamente
      if (field === 'aircraftId' && value && !current.selected) {
        next.selected = true;
      }
      // Se editou preço manual e for maior que zero, marca selecionado
      if (field === 'price' && Number(value) > 0 && !current.selected) {
        next.selected = true;
      }

      return { ...prev, [idx]: next };
    });
  };

  const handleCheckboxChange = (idx: number, checked: boolean) => {
    setSelections(prev => ({
      ...prev,
      [idx]: { ...prev[idx], selected: checked }
    }));
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

    onChange({ modules: selectedItems, total, etapa1Discount });
  }, [selections, course, aircrafts, etapa1Discount]); // Remove onChange from deps to avoid loop if parent recreates it constantly

  const handleSelectAllGroup = (groupItems: { index: number }[], checked: boolean) => {
    setSelections(prev => {
      const next = { ...prev };
      groupItems.forEach(({ index }) => {
        // Se desmarcar, apenas desmarca. Se marcar, mantém estado anterior ou inicializa.
        // Importante: Não limpar aircraftId ao desmarcar para não perder o contexto se o usuário marcar de novo.
        next[index] = { ...next[index], selected: checked };
      });
      return next;
    });
  };

  // Helper para filtrar aeronaves permitidas
  const getAllowedAircrafts = (module: any) => {
    const allowedIds = module?.aviao || [];
    if (!allowedIds || allowedIds.length === 0) return [];
    const allowedSet = new Set(allowedIds.map(String));
    return aircrafts.filter((a: any) => allowedSet.has(String(a.id)));
  };

  return (
    <div className="space-y-6">
      {Object.entries(groupedModules).map(([etapa, items]) => {
        const normalizedEtapa = String(etapa || '').toLowerCase().replace(/\s/g, '');
        const isEtapa1 = normalizedEtapa === 'etapa1';
        
        const allSelected = items.every(({ index }) => selections[index]?.selected);
        const someSelected = items.some(({ index }) => selections[index]?.selected);
        const isIndeterminate = someSelected && !allSelected;

        return (
          <div key={etapa} className="space-y-4">
            <Card className="border-l-4 border-l-primary/20">
              <CardHeader className="py-3 bg-muted/10">
                <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                  {etapa}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
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
                      <TableHead className="w-[120px]">Créditos</TableHead>
                      {!isEtapa1 && <TableHead className="w-[350px]">Aeronave</TableHead>}
                      <TableHead className="w-[120px] text-right">Valor</TableHead>
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
                          <TableCell className="font-medium">
                            {module.titulo || module.nome}
                          </TableCell>
                          <TableCell>
                            <Input 
                              type="number" 
                              className="h-8 w-20" 
                              value={sel.credits}
                              onChange={(e) => handleSelectionChange(index, 'credits', Number(e.target.value))}
                              disabled={!sel.selected}
                            />
                          </TableCell>
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
                                    {allowedAircrafts.map((a: any) => (
                                      <SelectItem 
                                        key={String(a.id)} 
                                        value={String(a.id)}
                                        className="text-black dark:text-white focus:bg-slate-100 dark:focus:bg-slate-800"
                                      >
                                        {/* Usa o nome se disponível (ex: Paulistinha), senão usa matricula ou fallback */}
                                        {a.nome || a.matricula || a.post_title || `Aeronave ${a.id}`}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-muted-foreground text-xs italic">N/A</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="text-right font-medium">
                            {isEtapa1 ? (
                                <Input
                                    className="h-8 w-28 text-right ml-auto"
                                    value={formatCurrencyBRL(sel.price)}
                                    onChange={(e) => {
                                       const val = currencyRemoveMaskToNumber(e.target.value);
                                       handleSelectionChange(index, 'price', val);
                                    }}
                                    disabled={!sel.selected}
                                />
                            ) : (
                                formatCurrencyBRL(sel.price)
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Campo de Desconto para Etapa 1 */}
            {isEtapa1 && (
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
            )}
          </div>
        );
      })}
      
      <div className="flex justify-end p-4 bg-muted/20 rounded-lg">
        <div className="text-right">
          <span className="text-sm text-muted-foreground mr-2">Total Estimado:</span>
          <span className="text-xl font-bold">
            {formatCurrencyBRL(Object.values(selections).filter(s => s.selected).reduce((acc, curr) => acc + curr.price, 0))}
          </span>
        </div>
      </div>
    </div>
  );
}
