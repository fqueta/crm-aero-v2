import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { CourseRecord, CourseModule } from '@/types/courses';

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
}) {
  // Helpers
  const moduleTitle = module?.titulo || (course?.titulo || course?.nome || '');
  const etapa = module?.etapa || '';

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

  const isType2 = Array.isArray(modules) && modules.length > 0;

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
                  {/* <TableHead className="text-right text-white font-bold">Valor</TableHead> */}
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
                    {/* <TableCell className="text-right">{modValor}</TableCell> */}
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
               <TableCell colSpan={isEtapa1 ? 3 : 5} className="p-0 border-0">
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

            {/* Resumo Financeiro Global / Total Final */}
             <div className="mt-0">
               <div className="bg-[#003366] text-white p-3 flex justify-between items-center rounded-b-lg shadow-md">
                    <span className="font-bold text-lg pl-2">Valor Total com estimado de combustível:</span>
                    <span className="font-bold text-xl pr-2">{totalMasked}</span>
               </div>
               
               <div className="mt-4 p-4 border rounded-lg bg-blue-50 text-sm text-blue-900">
                    <p className="font-bold mb-2">Observações Importantes</p>
                    <p>Este orçamento possui validade de 7 (sete) dias a contar da data de envio. O valor apresentado poderá ser pago:</p>
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