import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CourseRecord, CourseModule } from '@/types/courses';
import { enrollmentsService } from '@/services/enrollmentsService';

/**
 * BudgetPreview
 * pt-BR: Componente de visualização de orçamento. Exibe cabeçalho com dados do cliente
 *        e uma tabela detalhando itens, descontos, subtotal e total.
 * en-US: Budget preview component. Shows client header and a table detailing items,
 *        discounts, subtotal, and total.
 */
export default function BudgetPreview({
  title = 'Proposta Comercial',
  clientName,
  clientId,
  clientPhone,
  clientEmail,
  validityDate,
  course,
  module,
  modules,
  discountLabel = 'Desconto',
  discountAmountMasked,
  subtotalMasked,
  totalMasked,
  etapa1Discount = 0,
  inscricaoMasked,
  validityDays = '7',
  fuelExternalText,
  courseName,
  turmaName,
  parcelamento,
  emissionDate,
}: {
  title?: string;
  clientName: string;
  clientId?: string | number;
  clientPhone?: string;
  clientEmail?: string;
  validityDate?: string;
  emissionDate?: string;
  course?: CourseRecord | any;
  courseName?: string;
  turmaName?: string;
  module?: CourseModule | any;
  modules?: any[]; // Suporte para múltiplos módulos (curso tipo 2)
  discountLabel?: string;
  discountAmountMasked?: string; // already masked (e.g. "R$ 6.000,00")
  subtotalMasked?: string; // already masked
  totalMasked?: string; // already masked
  etapa1Discount?: number;
  inscricaoMasked?: string;
  validityDays?: string | number;
  fuelExternalText?: string;
  parcelamento?: {
    linhas?: Array<{ parcela?: string; parcelas?: string; valor: string; desconto: string }>;
    texto_desconto?: string;
    texto_preview_html?: string;
    parcela_selecionada?: string;
  } | null;
}) {
  // Helpers
  const moduleTitle = module?.titulo || (course?.titulo || course?.nome || '');
  const etapa = module?.etapa || '';
  
  const numberToText = (n: string | number) => {
      const num = Number(n);
      switch(num) {
          case 7: return 'sete';
          case 14: return 'quatorze';
          case 30: return 'trinta';
          default: return '';
      }
  };
  const validityDaysText = numberToText(validityDays);

  const isType2 = Array.isArray(modules) && modules.length > 0;

  const [fuelData, setFuelData] = useState<{ valor: number; valor_litro: number | null } | null>(null);

  useEffect(() => {
    let mounted = true;
    console.log('BudgetPreview: Checking Type2 condition', { isType2, modules });

    if (isType2 && modules && modules.length > 0) {
      console.log('BudgetPreview: Simulating fuel for modules', modules);
      enrollmentsService.simulateFuel({ modulos: modules })
        .then(res => {
            console.log('BudgetPreview: Fuel simulation result', res);
            if (mounted && res && res.exec) {
                setFuelData(res);
            } else if (mounted) {
                setFuelData(null);
            }
        })
        .catch((err) => {
            console.error('BudgetPreview: Fuel simulation error', err);
            if (mounted) setFuelData(null);
        });
    } else {
        setFuelData(null);
    }
    return () => { mounted = false; };
  }, [modules, isType2]);

  /**
   * parseToNumber
   * pt-BR: Converte valores numéricos vindos como string/number para número seguro.
   * en-US: Converts numeric values coming as string/number into a safe number.
   */
  const parseToNumber = (v: unknown): number => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    const s = String(v ?? '').trim();
    if (!s) return 0;
    
    // Remove "R$" e espaços
    let clean = s.replace(/^R\$\s?/, '').trim();
    
    // Se contiver vírgula, assume formato BR (Ex: 1.234,56 ou 10,00)
    if (clean.includes(',')) {
      const n = Number(clean.replace(/\./g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    }
    
    // Se não contiver vírgula mas contiver ponto, pode ser US (10100.00) ou BR sem decimais (1.100)
    // Se houver apenas um ponto e ele estiver na posição de centavos (2 casas), assume US.
    // Para simplificar: se não tem vírgula, tenta converter direto. 
    // Se o resultado for válido, usa.
    const n = Number(clean);
    return Number.isFinite(n) ? n : 0;
  };

  // Helper para formatar valor monetário
  const formatValue = (v: any) => {
    const num = parseToNumber(v);
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  /**
   * parseInstallmentCount
   * pt-BR: Extrai a quantidade de parcelas a partir de valores como "3", "3x" ou similares.
   * en-US: Extracts installment count from values such as "3", "3x" or similar.
   */
  const parseInstallmentCount = (value: unknown): number => {
    const raw = String(value ?? '').trim();
    if (!raw) return 0;
    const digits = raw.match(/\d+/)?.[0] || '';
    const parsed = Number(digits);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  // Agrupa módulos por etapa
  const groupedModules = useMemo(() => {
    if (!isType2 || !modules) return {};
    
    const groups: Record<string, any[]> = {};
    
    modules.forEach(mod => {
      let key = mod.etapa || 'Outros';
      // Normalização básica
      if (key.toLowerCase().replace(/\s/g, '') === 'etapa1') key = 'Etapa 1';
      else if (key.toLowerCase().replace(/\s/g, '') === 'etapa2') key = 'Etapa 2';
      else if (key.toLowerCase().replace(/\s/g, '') === 'etapa3') key = 'Etapa 3';
      
      if (!groups[key]) groups[key] = [];
      groups[key].push(mod);
    });
    
    // Ordenar chaves para garantir Etapa 1 primeiro
    const orderedGroups: Record<string, any[]> = {};
    const keys = Object.keys(groups).sort();
    keys.forEach(k => {
      orderedGroups[k] = groups[k];
    });
    
    return orderedGroups;
  }, [modules, isType2]);

  // Função para calcular totais por etapa (usado no resumo final)
  const getStageTotal = (stageName: string) => {
    const stageModules = groupedModules[stageName] || [];
    const stageSubtotal = stageModules.reduce((acc, mod) => acc + parseToNumber(mod.valor), 0);
    
    if (stageName === 'Etapa 1') {
      return Math.max(0, stageSubtotal - etapa1Discount);
    } else {
      const discount = parseToNumber(discountAmountMasked);
      return Math.max(0, stageSubtotal - discount);
    }
  };

  // Função para renderizar tabela de uma etapa específica
  const renderStageTable = (stageName: string, stageModules: any[]) => {
    const isEtapa1 = stageName === 'Etapa 1';
    
    // Calcular subtotal da etapa
    const stageSubtotal = stageModules.reduce((acc, mod) => {
      return acc + parseToNumber(mod.valor);
    }, 0);

    let stageDiscount = 0;
    let stageTotal = 0;

    if (isEtapa1) {
        stageDiscount = etapa1Discount;
        stageTotal = Math.max(0, stageSubtotal - stageDiscount);
    } else {
        stageDiscount = parseToNumber(discountAmountMasked);
        stageTotal = Math.max(0, stageSubtotal - stageDiscount);
    }

    return (
      <div key={stageName} className="mb-6 rounded-md border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#003366] dark:bg-slate-900/90 hover:bg-[#003366] dark:hover:bg-slate-900/90 border-b border-border">
                <TableHead className="w-[100px] text-center text-white font-bold whitespace-nowrap">{stageName}</TableHead>
                <TableHead className="text-white font-bold">Conteúdo</TableHead>
                <TableHead className="text-white font-bold">{isEtapa1 ? 'Aula' : 'Aeronave'}</TableHead>
                {!isEtapa1 && <TableHead className="text-center text-white font-bold">Créditos</TableHead>}
                <TableHead className="text-right text-white font-bold pr-4">Valor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stageModules.map((mod, idx) => {
              const modTitle = mod?.titulo || mod?.nome || `Item ${idx + 1}`;
              const modValor = formatValue(mod?.valor);
              
              if (isEtapa1) {
                 return (
                  <TableRow key={`${stageName}-${idx}`} className="even:bg-muted/10 border-b border-border">
                    <TableCell className="text-center font-medium text-foreground">{idx + 1}</TableCell>
                    <TableCell className="text-foreground">{modTitle}</TableCell>
                    <TableCell className="text-foreground">Ground School</TableCell>
                    <TableCell className="text-right pr-4 text-foreground">{modValor}</TableCell>
                  </TableRow>
                 );
              } else {
                const modCreditos = parseToNumber(mod?.limite);
                const modAircraft = mod?.aircraft_name || mod?.aviao_nome || '—';
                return (
                  <TableRow key={`${stageName}-${idx}`} className="even:bg-muted/10 border-b border-border">
                    <TableCell className="font-medium pl-4 text-foreground">{idx + (stageModules.length > 8 ? 8 : 1)}</TableCell>
                    <TableCell className="text-foreground">{modTitle}</TableCell>
                    <TableCell className="text-foreground">{modAircraft}</TableCell>
                    <TableCell className="text-center text-foreground">{modCreditos}</TableCell>
                    <TableCell className="text-right pr-4 text-foreground">{modValor}</TableCell>
                  </TableRow>
                );
              }
            })}
            
            {/* Footer da Etapa */}
            {!isEtapa1 && (
            <TableRow className="border-t-0 hover:bg-transparent">
               <TableCell colSpan={5} className="p-0 border-0">
                   <div className="flex flex-col w-full bg-card dark:bg-zinc-900 border-t border-border">
                        {/* Subtotal */}
                        <div className="flex justify-end items-center py-2 pr-4 border-b border-border">
                            <span className="font-bold mr-4 text-sm text-muted-foreground">Subtotal:</span>
                            <span className="font-bold text-sm text-foreground">{formatValue(stageSubtotal)}</span>
                        </div>
                        {/* Desconto */}
                        {stageDiscount > 0 && (
                            <div className="flex justify-end items-center py-2 pr-4 border-b border-border">
                                <span className="font-bold mr-4 text-sm text-red-600 dark:text-red-400 uppercase">
                                    {isEtapa1 ? 'Desconto especial' : (discountLabel || 'Desconto')}:
                                </span>
                                <span className="font-bold text-sm text-red-600 dark:text-red-400">- {formatValue(stageDiscount)}</span>
                            </div>
                        )}
                        {/* Total Etapa */}
                        <div className="flex justify-end items-center py-2 pr-4 bg-muted/20">
                            <span className="font-bold mr-4 text-sm text-emerald-600 dark:text-emerald-400 uppercase">Total {stageName}:</span>
                            <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">{formatValue(stageTotal)}</span>
                        </div>
                   </div>
               </TableCell>
            </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <Card className="mt-6 border-border bg-card">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Cabeçalho com dados do cliente */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8 p-6 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/60 border border-zinc-200/60 dark:border-zinc-800 print:bg-white print:border-0 print:p-0 print:grid-cols-2">
          {clientName && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Cliente</span>
              <div className="flex items-center gap-2">
                 <span className='font-bold text-sm text-foreground'>{clientName}</span>
                 {clientId && (
                   <Badge variant="outline" className="text-[10px] h-4 px-1 font-normal opacity-80 border-border">#{String(clientId)}</Badge>
                 )}
              </div>
            </div>
          )}
          {clientPhone && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">WhatsApp / Contato</span>
              <span className='font-bold text-sm text-foreground'>{clientPhone}</span>
            </div>
          )}
          {clientEmail && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">E-mail</span>
              <span className='font-bold text-sm text-foreground'>{clientEmail}</span>
            </div>
          )}
          {courseName && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Plano / Curso</span>
              <span className='font-bold text-sm text-foreground'>{courseName}</span>
            </div>
          )}
          {turmaName && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Turma</span>
              <span className='font-bold text-sm text-foreground'>{turmaName}</span>
            </div>
          )}
          <div className="flex gap-8">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Emissão</span>
              <span className='font-bold text-sm text-foreground'>
                {emissionDate ? new Date(emissionDate).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Validade</span>
              <span className='font-bold text-sm text-amber-600 dark:text-amber-400'>{validityDate || '—'}</span>
            </div>
          </div>
        </div>

        {/* Renderização condicional: Tipo 2 (múltiplos módulos/etapas) vs Tipo 4/Legado (módulo único) */}
        {isType2 ? (
          <>
            {/* Tabelas por etapa */}
            {Object.entries(groupedModules).map(([stageName, stageModules]) => 
              renderStageTable(stageName, stageModules)
            )}

            {/* Etapa 3 - Combustível Estimado */}
            {fuelData && fuelData.valor > 0 && (
              <div className="mb-6 rounded-md border border-border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#003366] dark:bg-slate-900/90 hover:bg-[#003366] dark:hover:bg-slate-900/90 border-b border-border">
                       <TableHead className="w-[100px] text-white font-bold pl-4 whitespace-nowrap">Etapa 3</TableHead>
                       <TableHead className="text-white font-bold text-center">Conteúdo</TableHead>
                       <TableHead className="text-right text-white font-bold pr-4">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="even:bg-muted/10 border-b border-border">
                        <TableCell colSpan={3} className="p-4 text-sm leading-relaxed text-center text-foreground">
                            {fuelExternalText ? (
                                <div dangerouslySetInnerHTML={{ __html: fuelExternalText.replace('{valor}', formatValue(fuelData.valor)) }} />
                            ) : (
                                <>
                                    O custo estimado de combustível para esta proposta é de <span className="font-bold">{formatValue(fuelData.valor)}</span>. É importante notar que este valor é uma estimativa e pode variar conforme os preços do combustível no momento do abastecimento. O cálculo final será baseado no preço vigente na data em que o combustível for abastecido, sendo assim, esse valor pode variar.
                                </>
                            )}
                        </TableCell>
                    </TableRow>
                    {/* Footer with total */}
                    <TableRow className="bg-[#003366] dark:bg-slate-900/90 hover:bg-[#003366] dark:hover:bg-slate-900/90 border-t-0">
                       <TableCell colSpan={3} className="p-0 border-0">
                           <div className="flex justify-end items-center py-2 pr-4 text-white">
                               <span className="font-bold mr-4 text-sm uppercase">Valor Total com estimado de combustível:</span>
                               <span className="font-bold text-sm">{formatValue((parseToNumber(totalMasked) + fuelData.valor))}</span>
                           </div>
                       </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Resumo Financeiro Global / Total Final */}
             <div className="mt-0">
               {/* Tabela de Resumo Detalhado (Substitui o card de taxas e resumo anterior) */}
               <Table className="border border-border rounded-md bg-card dark:bg-zinc-900 shadow-sm mb-4 overflow-hidden">
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border">
                      <TableHead className="font-bold text-foreground">Descrição</TableHead>
                      <TableHead className="text-right font-bold text-foreground">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Matrícula */}
                    <TableRow className="border-b border-border">
                      <TableCell className="font-medium text-foreground">Matrícula</TableCell>
                      <TableCell className="text-right font-bold text-foreground">{formatValue(parseToNumber(inscricaoMasked))}</TableCell>
                    </TableRow>
                    
                    {/* Totais por Etapa */}
                    {Object.keys(groupedModules).map((stageName) => (
                      <TableRow key={`summary-${stageName}`} className="border-b border-border">
                        <TableCell className="font-medium text-foreground">{stageName}</TableCell>
                        <TableCell className="text-right font-bold text-foreground">{formatValue(getStageTotal(stageName))}</TableCell>
                      </TableRow>
                    ))}

                    {/* Taxas do Curso */}
                    {course?.config?.taxas && Array.isArray(course.config.taxas) && course.config.taxas.map((taxa: any, idx: number) => (
                      <TableRow key={`taxa-${idx}`} className="border-b border-border">
                        <TableCell className="text-muted-foreground">{taxa.titulo}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatValue(parseToNumber(taxa.valor))}</TableCell>
                      </TableRow>
                    ))}

                    {/* Total de Taxas (Não inclusas) */}
                    {(() => {
                      const taxasTotal = (course?.config?.taxas || []).reduce((acc: number, t: any) => acc + parseToNumber(t.valor), 0);
                      if (taxasTotal > 0) {
                        return (
                          <TableRow className="border-b border-border">
                            <TableCell className="font-bold text-red-600 dark:text-red-400">Total de taxas não inclusas no orçamento:</TableCell>
                            <TableCell className="text-right font-bold text-red-600 dark:text-red-400">{formatValue(taxasTotal)}</TableCell>
                          </TableRow>
                        );
                      }
                      return null;
                    })()}

                    {/* TOTAL DA PROPOSTA */}
                    <TableRow className="bg-muted/20 border-t-2 border-border">
                      <TableCell className="font-bold text-emerald-600 dark:text-emerald-400 text-lg uppercase">TOTAL DA PROPOSTA A VISTA:</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400 text-lg">{totalMasked}</TableCell>
                    </TableRow>
                  </TableBody>
               </Table>
               
               {course?.nome && (
                 <div className="text-right text-xs text-muted-foreground mt-1 mb-4">
                   *{course.nome}
                 </div>
               )}
               
               <div className="mt-4 p-4 border rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50 text-sm text-blue-950 dark:text-blue-200">
                    <p className="font-bold mb-2 text-blue-900 dark:text-blue-100">Observações Importantes</p>
                    <p>Este orçamento possui validade de {validityDays}{validityDaysText ? ` (${validityDaysText})` : ''} dias a contar da data de envio. O valor apresentado poderá ser pago:</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                        <li>À vista, <strong>com desconto</strong> (já aplicado se houver);</li>
                        <li>Parcelado em até 12x no cartão de crédito (consulte condições).</li>
                    </ul>
                    <p className="mt-2 text-blue-900/80 dark:text-blue-300/80">
                        O custo estimado de combustível para esta proposta é variável. É importante notar que este valor é uma estimativa e pode variar conforme os preços do combustível no momento do abastecimento.
                    </p>
               </div>
 
               {/* Condições de Parcelamento (Se disponível) */}
               {parcelamento && Array.isArray(parcelamento.linhas) && parcelamento.linhas.length > 0 && (
                 <div className="mt-8 space-y-4">
                   <div className="flex items-center gap-2 mb-4">
                     <div className="h-6 w-1 bg-primary dark:bg-sky-500 rounded-full" />
                     <h3 className="text-sm font-bold uppercase tracking-wider text-primary dark:text-sky-400">Opções de Parcelamento</h3>
                   </div>
                   
                   <Table className="border border-border rounded-md bg-card dark:bg-zinc-900 shadow-sm overflow-hidden">
                     <TableHeader>
                       <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border">
                         <TableHead className="font-bold text-foreground text-center pr-0 uppercase text-[10px]">Parcelamento</TableHead>
                         <TableHead className="font-bold text-foreground text-center uppercase text-[10px]">Valor da Parcela</TableHead>
                         <TableHead className="font-bold text-foreground text-center uppercase text-[10px]">Desconto Pontualidade</TableHead>
                         <TableHead className="font-bold text-foreground text-right uppercase text-[10px]">Parcela Líquida</TableHead>
                         <TableHead className="font-bold text-foreground text-right uppercase text-[10px]">Total</TableHead>
                       </TableRow>
                     </TableHeader>
                     <TableBody>
                       {parcelamento.linhas.map((row, idx) => {
                         const valRaw = row.valor;
                         const descRaw = row.desconto;
                         const parcelaNum = row.parcelas || row.parcela || '';
                         
                         const valorNum = parseToNumber(valRaw);
                         const descontoNum = parseToNumber(descRaw);
                         const liquido = Math.max(valorNum - descontoNum, 0);
                         const totalParcelas = parseInstallmentCount(parcelaNum);
                         const totalParcelado = totalParcelas * liquido;
                         const isSelected = String(parcelaNum).trim() === String(parcelamento.parcela_selecionada ?? '').trim();
                         
                         return (
                           <TableRow 
                             key={`budget-parc-${idx}`} 
                             className={`transition-colors border-b border-border ${isSelected ? 'bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100/80 dark:hover:bg-blue-950/60 border-l-4 border-l-primary dark:border-l-sky-500 font-medium' : 'hover:bg-zinc-50/50 dark:hover:bg-zinc-800/40'}`} 
                           >
                             <TableCell className="text-center font-medium text-blue-700 dark:text-blue-300 bg-blue-50/30 dark:bg-blue-950/20 whitespace-nowrap">
                               <div className="flex items-center justify-center gap-1.5">
                                 <span>{parcelaNum}{parcelaNum ? 'x' : ''}</span>
                                 {isSelected && (
                                   <span className="text-[10px] bg-primary dark:bg-sky-600 text-white px-1.5 py-0.5 rounded-full font-semibold">
                                     Opção Escolhida
                                   </span>
                                 )}
                               </div>
                             </TableCell>
                             <TableCell className="text-center font-mono text-xs text-foreground">
                               {formatValue(valorNum)}
                             </TableCell>
                             <TableCell className="text-center font-mono text-xs text-red-600 dark:text-red-400">
                               {formatValue(descontoNum)}
                             </TableCell>
                             <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400">
                               {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(liquido)}
                             </TableCell>
                             <TableCell className="text-right font-bold text-blue-700 dark:text-blue-400">
                               {formatValue(totalParcelado)}
                             </TableCell>
                           </TableRow>
                         );
                       })}
                     </TableBody>
                    </Table>
                   
                   {parcelamento.texto_desconto && (
                     <div className="p-4 rounded-xl border border-dashed border-blue-200 dark:border-blue-900/60 bg-blue-50/30 dark:bg-blue-950/20">
                       <div 
                         className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed space-y-1"
                         dangerouslySetInnerHTML={{ __html: (() => {
                            if (parcelamento.texto_preview_html) return parcelamento.texto_preview_html;

                            // Fallback para resolver se não tiver o HTML pré-renderizado
                            const selectedParcela = parcelamento.parcela_selecionada;
                            const targetRow = (parcelamento.linhas || []).find(r => String(r.parcelas || r.parcela || '') === String(selectedParcela)) || parcelamento.linhas?.[0];
                            
                            if (!targetRow) return parcelamento.texto_desconto;
                            const vNum = parseToNumber(targetRow.valor);
                            const dNum = parseToNumber(targetRow.desconto);
                            const liqNum = Math.max(vNum - dNum, 0);
                            const liqStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(liqNum);
                            return String(parcelamento.texto_desconto)
                              .replace(/\{total_parcelas\}/gi, String(targetRow.parcelas || targetRow.parcela || ''))
                              .replace(/\{valor_parcela\}/gi, formatValue(vNum))
                              .replace(/\{desconto_pontualidade\}/gi, formatValue(dNum))
                              .replace(/\{parcela_com_desconto\}/gi, liqStr);
                          })()
 }} 
                       />
                     </div>
                   )}
                 </div>
               )}
             </div>
          </>
        ) : (
          /* Tabela para Módulo Único (Legacy) */
          <Table className="border border-border rounded-md bg-card dark:bg-zinc-900 shadow-sm overflow-hidden">
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50 border-b border-border">
                <TableHead className="font-bold text-foreground">Descrição</TableHead>
                <TableHead className="font-bold text-foreground">Etapa</TableHead>
                <TableHead className="font-bold text-foreground">H. Teóricas</TableHead>
                <TableHead className="font-bold text-foreground">H. Práticas</TableHead>
                <TableHead className="text-right font-bold text-foreground">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                  const horasTeoricas = parseToNumber(module?.limite);
                  const horasPraticas = parseToNumber(module?.limite_pratico);
                  const valorItemMasked = (() => {
                      const v = module?.valor || course?.valor || '';
                      if (typeof v === 'string' && v.trim().length > 0) {
                        return v.startsWith('R$') ? v : `R$ ${v}`;
                      }
                      return subtotalMasked || 'R$ 0,00';
                  })();

                  return (
                      <TableRow className="border-b border-border">
                        <TableCell className="text-foreground">{moduleTitle}</TableCell>
                        <TableCell className="text-foreground">{etapa || '—'}</TableCell>
                        <TableCell className="text-foreground">{horasTeoricas}</TableCell>
                        <TableCell className="text-foreground">{horasPraticas}</TableCell>
                        <TableCell className="text-right text-foreground">{valorItemMasked}</TableCell>
                      </TableRow>
                  );
              })()}

              {discountAmountMasked && (
                  <TableRow className="border-b border-border">
                    <TableCell colSpan={4}>
                      <span className="text-red-600 dark:text-red-400 font-medium">{discountLabel}</span>
                    </TableCell>
                    <TableCell className="text-right text-red-600 dark:text-red-400">- {discountAmountMasked}</TableCell>
                  </TableRow>
                )}

              {subtotalMasked && (
                <TableRow className="border-b border-border">
                  <TableCell colSpan={4} className="font-medium text-foreground">Subtotal</TableCell>
                  <TableCell className="text-right font-medium text-foreground">{subtotalMasked}</TableCell>
                </TableRow>
              )}

              {totalMasked && (
                <TableRow className="border-b border-border">
                  <TableCell colSpan={4} className="font-semibold text-emerald-600 dark:text-emerald-400">Total do Orçamento</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">{totalMasked}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
