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

    const stageTotal = Math.max(0, stageSubtotal - (isEtapa1 ? etapa1Discount : 0));

    return (
      <div key={stageName} className="mb-6">
        <h3 className="font-semibold text-lg mb-2 pl-1">{stageName}</h3>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {isEtapa1 ? (
                <>
                  <TableHead className="w-[50px] text-center">{stageName}</TableHead>
                  <TableHead>Conteúdo</TableHead>
                  <TableHead>Aula</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </>
              ) : (
                <>
                  <TableHead>Conteúdo</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Créditos (Horas)</TableHead>
                  <TableHead>Aeronave</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
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
                  <TableRow key={`${stageName}-${idx}`}>
                    <TableCell className="text-center font-medium">{idx + 1}</TableCell>
                    <TableCell>{modTitle}</TableCell>
                    <TableCell>Ground School</TableCell>
                    <TableCell className="text-right">{modValor}</TableCell>
                  </TableRow>
                 );
              } else {
                const modCreditos = parseToNumber(mod?.limite);
                const modAircraft = mod?.aircraft_name || mod?.aviao_nome || '—';
                const modEtapa = mod?.etapa || '—';
                return (
                  <TableRow key={`${stageName}-${idx}`}>
                    <TableCell className="font-medium">{modTitle}</TableCell>
                    <TableCell>{modEtapa}</TableCell>
                    <TableCell>{modCreditos}</TableCell>
                    <TableCell>{modAircraft}</TableCell>
                    <TableCell className="text-right">{modValor}</TableCell>
                  </TableRow>
                );
              }
            })}
            
            {/* Subtotal da Etapa */}
            <TableRow className="bg-muted/20">
              <TableCell colSpan={isEtapa1 ? 3 : 4} className="text-right font-medium">
                Subtotal {stageName}:
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatValue(stageSubtotal)}
              </TableCell>
            </TableRow>

            {/* Desconto específico da Etapa 1 */}
            {isEtapa1 && etapa1Discount > 0 && (
              <>
                <TableRow className="bg-muted/20">
                  <TableCell colSpan={3} className="text-right font-medium text-red-600">
                    Desconto especial:
                  </TableCell>
                  <TableCell className="text-right font-medium text-red-600">
                    - {formatValue(etapa1Discount)}
                  </TableCell>
                </TableRow>
                <TableRow className="bg-muted/20">
                  <TableCell colSpan={3} className="text-right font-bold">
                    Total {stageName}:
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatValue(stageTotal)}
                  </TableCell>
                </TableRow>
              </>
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

            {/* Resumo Financeiro Global */}
             <div className="mt-4 pt-4 border-t">
               <Table>
                 <TableBody>
                   {subtotalMasked && (
                    <TableRow className="border-b-0">
                      <TableCell className="font-medium text-right w-full pt-1 pb-1">Subtotal Geral:</TableCell>
                      <TableCell className="text-right font-medium w-[150px] whitespace-nowrap pt-1 pb-1">{subtotalMasked}</TableCell>
                    </TableRow>
                   )}
                   {discountAmountMasked && (
                    <TableRow className="border-b-0">
                      <TableCell className="font-medium text-right w-full pt-1 pb-1">
                         <span className="text-red-600">{discountLabel}:</span>
                      </TableCell>
                      <TableCell className="text-right text-red-600 w-[150px] whitespace-nowrap pt-1 pb-1">
                        - {discountAmountMasked}
                      </TableCell>
                    </TableRow>
                   )}
                   {totalMasked && (
                    <TableRow className="border-b-0">
                      <TableCell className="font-bold text-right text-lg w-full pt-2">Total do Orçamento:</TableCell>
                      <TableCell className="text-right font-bold text-lg w-[150px] whitespace-nowrap pt-2">{totalMasked}</TableCell>
                    </TableRow>
                   )}
                 </TableBody>
               </Table>
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