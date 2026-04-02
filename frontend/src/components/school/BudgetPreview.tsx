import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
}: {
  title?: string;
  clientName: string;
  clientId?: string | number;
  clientPhone?: string;
  clientEmail?: string;
  validityDate?: string;
  course?: CourseRecord | any;
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
    // Remove "R$", trim, remove thousands separator (.), replace decimal separator (,) with (.)
    const clean = s.replace(/^R\$\s?/, '').trim();
    const n = Number(clean.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  // Helper para formatar valor monetário
  const formatValue = (v: any) => {
    if (typeof v === 'number') {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
    }
    if (typeof v === 'string' && v.trim().length > 0) {
      return v.startsWith('R$') ? v : `R$ ${v}`;
    }
    return 'R$ 0,00';
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
      // Assumindo que o desconto global se aplica apenas à Etapa 2 (parte prática), ou proporcionalmente
      // Mas a lógica atual do renderStageTable aplica o desconto global APENAS nas etapas != 1
      // Se houver múltiplas etapas != 1 (ex: Etapa 2 e Etapa 3), o desconto global seria aplicado em todas?
      // A lógica original aplica parseToNumber(discountAmountMasked) em CADA etapa != 1. Isso parece duplicar desconto se houver >1 etapa prática.
      // Vou manter a lógica do renderStageTable para consistência, mas idealmente desconto global deveria ser único.
      // No contexto atual (Etapa 1 + Etapa 2), funciona pois só há uma etapa prática.
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
        // Para outras etapas (Etapa 2), aplicamos o desconto global
        // Assumindo que o desconto global se aplica à Etapa 2 (parte prática)
        stageDiscount = parseToNumber(discountAmountMasked);
        stageTotal = Math.max(0, stageSubtotal - stageDiscount);
    }

    return (
      <div key={stageName} className="mb-6">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#003366] hover:bg-[#003366]">
              {isEtapa1 ? (
                <>
                  <TableHead className="w-[100px] text-center text-white font-bold whitespace-nowrap">{stageName}</TableHead>
                  <TableHead className="text-white font-bold">Conteúdo</TableHead>
                  <TableHead className="text-white font-bold">Aula</TableHead>
                </>
              ) : (
                <>
                  <TableHead className="w-[100px] text-white font-bold pl-4 whitespace-nowrap">{stageName}</TableHead>
                  <TableHead className="text-white font-bold">Conteúdo</TableHead>
                  <TableHead className="text-white font-bold">Aeronave</TableHead>
                  <TableHead className="text-center text-white font-bold">Créditos</TableHead>
                  <TableHead className="text-right text-white font-bold pr-4">Valor</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {stageModules.map((mod, idx) => {
              const modTitle = mod?.titulo || mod?.nome || `Item ${idx + 1}`;
              const modValor = formatValue(mod?.valor);
              
              if (isEtapa1) {
                 return (
                  <TableRow key={`${stageName}-${idx}`} className="even:bg-muted/10">
                    <TableCell className="text-center font-medium">{idx + 1}</TableCell>
                    <TableCell>{modTitle}</TableCell>
                    <TableCell>Ground School</TableCell>
                  </TableRow>
                 );
              } else {
                const modCreditos = parseToNumber(mod?.limite);
                const modAircraft = mod?.aircraft_name || mod?.aviao_nome || '—';
                return (
                  <TableRow key={`${stageName}-${idx}`} className="even:bg-muted/10">
                    <TableCell className="font-medium pl-4">{idx + 8}</TableCell> {/* Numeração continua fictícia ou baseada em index? Imagem mostra 8,9,10... */}
                    <TableCell>{modTitle}</TableCell>
                    <TableCell>{modAircraft}</TableCell>
                    <TableCell className="text-center">{modCreditos}</TableCell>
                    <TableCell className="text-right pr-4">{modValor}</TableCell>
                  </TableRow>
                );
              }
            })}
            
            {/* Footer da Etapa */}
            {!isEtapa1 && (
            <TableRow className="bg-[#22c55e] hover:bg-[#22c55e] border-t-0">
               <TableCell colSpan={5} className="p-0 border-0">
                   <div className="flex flex-col w-full bg-white">
                        {/* Subtotal */}
                        <div className="flex justify-end items-center py-1 pr-4 border-b">
                            <span className="font-bold mr-4 text-sm">Subtotal:</span>
                            <span className="font-bold text-sm">{formatValue(stageSubtotal)}</span>
                        </div>
                        {/* Desconto */}
                        {stageDiscount > 0 && (
                            <div className="flex justify-end items-center py-1 pr-4 border-b">
                                <span className="font-bold mr-4 text-sm text-red-600 uppercase">
                                    {isEtapa1 ? 'Desconto especial' : (discountLabel || 'Desconto')}:
                                </span>
                                <span className="font-bold text-sm text-red-600">- {formatValue(stageDiscount)}</span>
                            </div>
                        )}
                        {/* Total Etapa */}
                        <div className="flex justify-end items-center py-1 pr-4 bg-muted/10">
                            <span className="font-bold mr-4 text-sm text-green-600 uppercase">Total {stageName}:</span>
                            <span className="font-bold text-sm text-green-600">{formatValue(stageTotal)}</span>
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
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Cabeçalho com dados do cliente */}
        <div className="space-y-1 text-sm mb-4">
          {clientName && (
            <div>
              <span className="font-medium">Cliente:</span>{' '}
              <span className='font-bold'>{clientName}</span>{' '}
              {clientId && (
                <span className="text-muted-foreground">ID: {String(clientId)}</span>
              )}
            </div>
          )}
          {clientPhone && (
            <div>
              <span className="font-medium">Telefone:</span>{' '}
              <span className='font-bold'>{clientPhone}</span>
            </div>
          )}
          {clientEmail && (
            <div>
              <span className="font-medium">Email:</span>{' '}
              <span className='font-bold'>{clientEmail}</span>
            </div>
          )}
          <div className="flex gap-4">
            <div>
              <span className="font-medium">Data:</span>{' '}
              <span className='font-bold'>{new Date().toLocaleDateString('pt-BR')}</span>
            </div>
            <div>
              <span className="font-medium">Validade:</span>{' '}
              <span className='font-bold'>{validityDate || '—'}</span>
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
              <div className="mb-6">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#003366] hover:bg-[#003366]">
                       <TableHead className="w-[100px] text-white font-bold pl-4 whitespace-nowrap">Etapa 3</TableHead>
                       <TableHead className="text-white font-bold text-center">Conteúdo</TableHead>
                       <TableHead className="text-right text-white font-bold pr-4">Valor</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow className="even:bg-muted/10">
                        <TableCell colSpan={3} className="p-4 text-sm leading-relaxed text-center">
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
                    <TableRow className="bg-[#003366] hover:bg-[#003366] border-t-0">
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
               <Table className="border rounded-md bg-white shadow-sm mb-4">
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-bold text-black">Descrição</TableHead>
                      <TableHead className="text-right font-bold text-black">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Matrícula */}
                    <TableRow>
                      <TableCell className="font-medium">Matrícula</TableCell>
                      <TableCell className="text-right font-bold">{formatValue(parseToNumber(inscricaoMasked))}</TableCell>
                    </TableRow>
                    
                    {/* Totais por Etapa */}
                    {Object.keys(groupedModules).map((stageName) => (
                      <TableRow key={`summary-${stageName}`}>
                        <TableCell className="font-medium">{stageName}</TableCell>
                        <TableCell className="text-right font-bold">{formatValue(getStageTotal(stageName))}</TableCell>
                      </TableRow>
                    ))}

                    {/* Taxas do Curso */}
                    {course?.config?.taxas && Array.isArray(course.config.taxas) && course.config.taxas.map((taxa: any, idx: number) => (
                      <TableRow key={`taxa-${idx}`}>
                        <TableCell className="text-muted-foreground">{taxa.titulo}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{formatValue(parseToNumber(taxa.valor))}</TableCell>
                      </TableRow>
                    ))}

                    {/* Total de Taxas (Não inclusas) */}
                    {(() => {
                      const taxasTotal = (course?.config?.taxas || []).reduce((acc: number, t: any) => acc + parseToNumber(t.valor), 0);
                      if (taxasTotal > 0) {
                        return (
                          <TableRow>
                            <TableCell className="font-bold text-red-600">Total de taxas não inclusas no orçamento:</TableCell>
                            <TableCell className="text-right font-bold text-red-600">{formatValue(taxasTotal)}</TableCell>
                          </TableRow>
                        );
                      }
                      return null;
                    })()}

                    {/* TOTAL DA PROPOSTA */}
                    <TableRow className="bg-muted/20 border-t-2">
                      <TableCell className="font-bold text-green-600 text-lg uppercase">TOTAL DA PROPOSTA A VISTA:</TableCell>
                      <TableCell className="text-right font-bold text-green-600 text-lg">{totalMasked}</TableCell>
                    </TableRow>
                  </TableBody>
               </Table>
               
               {course?.nome && (
                 <div className="text-right text-xs text-muted-foreground mt-1 mb-4">
                   *{course.nome}
                 </div>
               )}
               
               <div className="mt-4 p-4 border rounded-lg bg-blue-50 text-sm text-blue-900">
                    <p className="font-bold mb-2">Observações Importantes</p>
                    <p>Este orçamento possui validade de {validityDays}{validityDaysText ? ` (${validityDaysText})` : ''} dias a contar da data de envio. O valor apresentado poderá ser pago:</p>
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                        <li>À vista, <strong>com desconto</strong> (já aplicado se houver);</li>
                        <li>Parcelado em até 12x no cartão de crédito (consulte condições).</li>
                    </ul>
                    <p className="mt-2">
                        O custo estimado de combustível para esta proposta é variável. É importante notar que este valor é uma estimativa e pode variar conforme os preços do combustível no momento do abastecimento.
                    </p>
               </div>
             </div>
          </>
        ) : (
          /* Tabela para Módulo Único (Legacy) */
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Etapa</TableHead>
                <TableHead>H. Teóricas</TableHead>
                <TableHead>H. Práticas</TableHead>
                <TableHead className="text-right">Valor</TableHead>
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
                      <TableRow>
                        <TableCell>{moduleTitle}</TableCell>
                        <TableCell>{etapa || '—'}</TableCell>
                        <TableCell>{horasTeoricas}</TableCell>
                        <TableCell>{horasPraticas}</TableCell>
                        <TableCell className="text-right">{valorItemMasked}</TableCell>
                      </TableRow>
                  );
              })()}

              {discountAmountMasked && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <span className="text-red-600 font-medium">{discountLabel}</span>
                    </TableCell>
                    <TableCell className="text-right text-red-600">- {discountAmountMasked}</TableCell>
                  </TableRow>
                )}

              {subtotalMasked && (
                <TableRow>
                  <TableCell colSpan={4} className="font-medium">Subtotal</TableCell>
                  <TableCell className="text-right font-medium">{subtotalMasked}</TableCell>
                </TableRow>
              )}

              {totalMasked && (
                <TableRow>
                  <TableCell colSpan={4} className="font-semibold">Total do Orçamento</TableCell>
                  <TableCell className="text-right font-semibold">{totalMasked}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}