import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CourseRecord, CourseModule } from '@/types/courses';

/**
 * SelectGeraValor
 * pt-BR: Componente de select que gera uma opção de valor com base nos módulos
 *        do curso selecionado. Renderiza opções quando o curso é do tipo "4".
 * en-US: Select component that generates a value option based on the selected
 *        course modules. Renders options when the course is of type "4".
 */
export interface SelectGeraValorProps {
  course?: CourseRecord | null;
  value?: string;
  onChange?: (val: string) => void;
  disabled?: boolean;
  /**
   * name
   * pt-BR: Nome do campo para submissão nativa de formulários (input hidden).
   * en-US: Field name for native form submission (hidden input).
   */
  name?: string;
}

/**
 * formatValorDisplay
 * pt-BR: Formata o valor do módulo em BRL. Para dígitos puros (ex.: "17820"),
 *        interpreta como reais: R$ 17.820,00.
 * en-US: Formats module price in BRL. For digits-only (e.g., "17820"),
 *        treats it as reais: R$ 17,820.00.
 */
function formatValorDisplay(value: number | string | null | undefined): string {
  if (value === null || value === undefined || String(value) === '') return 'Sem valor';
  if (typeof value === 'number') {
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(value);
    } catch {
      return `R$ ${(Number(value) || 0).toFixed(2)}`;
    }
  }
  const s = String(value).trim();
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    try {
      return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(n);
    } catch {
      return `R$ ${(Number(n) || 0).toFixed(2)}`;
    }
  }
  try {
    const n = Number(s.replace(/\./g, '').replace(',', '.'));
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(Number.isFinite(n) ? n : 0);
  } catch {
    return `R$ ${(Number(s.replace(/\D/g, '') || 0) / 100).toFixed(2)}`;
  }
}

/**
 * normalizePriceForSelectValue
 * pt-BR: Normaliza preço para compor o value do Select (antes de "::"),
 *        emitindo string mascarada BR (ex.: "17.820,00").
 * en-US: Normalizes price to compose Select value (before "::"),
 *        emitting BR masked string (e.g., "17,820.00").
 */
function normalizePriceForSelectValue(value: number | string | null | undefined): string {
  if (value === null || value === undefined || String(value) === '') return '0,00';
  if (typeof value === 'number') {
    try {
      return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    } catch {
      return (Number(value) || 0).toFixed(2).replace('.', ',');
    }
  }
  const s = String(value).trim();
  if (/^\d+$/.test(s)) {
    const n = parseInt(s, 10);
    try {
      return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    } catch {
      return (Number(n) || 0).toFixed(2).replace('.', ',');
    }
  }
  const normalized = s.includes(',') && s.includes('.')
    ? s.replace(/\./g, '').replace(',', ',')
    : (s.includes(',') ? s : s.replace('.', ','));
  return normalized;
}

/**
 * SelectGeraValor
 * pt-BR: Select que apresenta módulos do curso e gera um valor "preco::idx".
 *        Inclui um input hidden opcional com `name` para envio em formulários.
 * en-US: Select that presents course modules and generates a value "price::idx".
 *        Includes an optional hidden input with `name` for form submission.
 */
export function SelectGeraValor({ course, value, onChange, disabled, name }: SelectGeraValorProps) {
  /**
   * getModuleLabel
   * pt-BR: Monta o rótulo amigável para cada módulo (título • valor).
   * en-US: Builds a friendly label for each module (title • value).
   */
  const getModuleLabel = (m: CourseModule): string => {
    const title = m.nome || m.titulo || 'Módulo';
    const price = formatValorDisplay(m.valor as any);
    return `${title} • ${price}`;
  };

  /**
   * getItemValue
   * pt-BR: Gera um valor único para cada opção do Select combinando preço e índice.
   *        O Radix Select requer valores únicos; se dois módulos tiverem o mesmo
   *        preço, usamos o índice para diferenciar (ex.: "23.820,00::1").
   * en-US: Generates a unique value for each Select option by combining price and
   *        index. Radix Select requires unique values; if two modules share the
   *        same price, we differentiate using the index (e.g., "23.820,00::1").
   */
  const getItemValue = (m: CourseModule, idx: number): string => {
    const priceMasked = normalizePriceForSelectValue(m.valor as any);
    return `${priceMasked}::${idx}`;
  };

  const isTipo4 = (course?.tipo ?? '').toString() === '4';
  const modulos = Array.isArray(course?.modulos) ? course!.modulos : [];
  // Removido log de depuração para evitar ruído no console em produção
  return (
    <>
      {/*
       * HiddenInput
       * pt-BR: Garante que o valor seja enviado em submissões nativas (name/value).
       * en-US: Ensures the value is sent on native form submissions (name/value).
       */}
      {name ? <input type="hidden" name={name} value={value ?? ''} /> : null}
      <Select value={value ?? ''} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Gerar valor a partir dos módulos" />
        </SelectTrigger>
        <SelectContent>
          {isTipo4 && modulos.length > 0 ? (
            modulos.map((m, idx) => (
              <SelectItem key={`${course?.id || 'c'}-m${idx}`} value={getItemValue(m, idx)}>
                {getModuleLabel(m)}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="__no_modules__" disabled>
              Nenhum módulo disponível para este curso
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </>
  );
}

export default SelectGeraValor;