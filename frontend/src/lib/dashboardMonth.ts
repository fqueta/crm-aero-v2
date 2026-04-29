/**
 * Retorna a data de hoje no formato yyyy-mm-dd.
 */
export function getTodayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Retorna o mês atual no formato yyyy-mm.
 */
export function getCurrentMonthInputValue(): string {
  return getTodayInputValue().slice(0, 7);
}

/**
 * Garante que o mês informado siga o formato esperado e não fique no futuro.
 */
export function normalizeDashboardMonth(period?: string): string {
  const currentMonth = getCurrentMonthInputValue();

  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return currentMonth;
  }

  return period > currentMonth ? currentMonth : period;
}

/**
 * Formata um mês yyyy-mm para exibição amigável em pt-BR.
 */
export function formatMonthLabel(period?: string): string {
  const normalizedMonth = normalizeDashboardMonth(period);
  const parsed = new Date(`${normalizedMonth}-01T00:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return normalizedMonth;
  }

  return parsed.toLocaleDateString('pt-BR', {
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Retorna um mês deslocado para frente ou para trás.
 */
export function shiftDashboardMonth(period: string, offset: number): string {
  const normalizedMonth = normalizeDashboardMonth(period);
  const [year, month] = normalizedMonth.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  date.setMonth(date.getMonth() + offset);
  return normalizeDashboardMonth(date.toISOString().slice(0, 7));
}

/**
 * Gera uma lista dos meses recentes disponíveis para seleção.
 */
export function getDashboardMonthOptions(totalMonths = 18): Array<{ value: string; label: string }> {
  const currentMonth = getCurrentMonthInputValue();
  const [year, month] = currentMonth.split('-').map(Number);
  const date = new Date(year, month - 1, 1);

  return Array.from({ length: totalMonths }, (_, index) => {
    const optionDate = new Date(date);
    optionDate.setMonth(date.getMonth() - index);
    const value = optionDate.toISOString().slice(0, 7);

    return {
      value,
      label: formatMonthLabel(value),
    };
  });
}

/**
 * Constrói as datas de início e fim para um mês selecionado.
 */
export function getMonthDateRange(period?: string): { startDate: string; endDate: string } {
  const normalizedMonth = normalizeDashboardMonth(period);
  const [year, month] = normalizedMonth.split('-').map(Number);
  const endDate = new Date(year, month, 0);
  endDate.setHours(0, 0, 0, 0);

  const computedEndDate = endDate.toISOString().slice(0, 10);

  return {
    startDate: `${normalizedMonth}-01`,
    endDate: computedEndDate > getTodayInputValue() ? getTodayInputValue() : computedEndDate,
  };
}

/**
 * Verifica se uma data pertence ao mês selecionado.
 */
export function isDateInDashboardMonth(dateValue: string | undefined | null, period: string): boolean {
  if (!dateValue) {
    return false;
  }

  const normalizedMonth = normalizeDashboardMonth(period);
  return dateValue.slice(0, 7) === normalizedMonth;
}
