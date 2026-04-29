import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  getCurrentMonthInputValue,
  getDashboardMonthOptions,
  shiftDashboardMonth,
} from '@/lib/dashboardMonth';

interface DashboardMonthSelectorProps {
  selectedMonth: string;
  onChange: (month: string) => void;
  label?: string;
  helperText?: string;
  className?: string;
}

/**
 * Seletor mensal reutilizável para dashboards com navegação por setas e lista de meses.
 */
export function DashboardMonthSelector({
  selectedMonth,
  onChange,
  label = 'Mês de referência',
  helperText,
  className,
}: DashboardMonthSelectorProps) {
  const monthOptions = useMemo(() => getDashboardMonthOptions(), []);
  const currentMonthValue = getCurrentMonthInputValue();

  return (
    <div className={className}>
      <Label htmlFor="dashboard-month-selector" className="text-xs font-medium uppercase tracking-wide">
        {label}
      </Label>
      <div className="mt-2 flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => onChange(shiftDashboardMonth(selectedMonth, -1))}
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={selectedMonth} onValueChange={onChange}>
            <SelectTrigger id="dashboard-month-selector" className="min-w-[180px]">
              <SelectValue placeholder="Selecione o mês" />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="secondary"
            size="icon"
            onClick={() => onChange(shiftDashboardMonth(selectedMonth, 1))}
            disabled={selectedMonth >= currentMonthValue}
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {helperText ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {helperText}
        </p>
      ) : null}
    </div>
  );
}

export default DashboardMonthSelector;
