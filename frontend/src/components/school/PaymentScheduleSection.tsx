import * as React from "react";
import { Control, useWatch } from "react-hook-form";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { currencyApplyMask, currencyRemoveMaskToNumber } from "@/lib/masks/currency";
import {
  buildPaymentSchedule,
  formatScheduleCurrencyBRL,
  formatScheduleDateBR,
  resolveSelectedRowValue,
  type PaymentScheduleLine,
} from "@/lib/paymentSchedule";

export interface PaymentScheduleSectionProps {
  /** react-hook-form control da página (Create/Edit usam os mesmos field names) */
  control: Control<any>;
  /** Função setValue do formulário para sincronizar campos relacionados */
  setValue?: (name: string, value: any, options?: any) => void;
  /** Linhas disponíveis: {parcelas, valor, desconto?} (mascarados ou plain) */
  lines: PaymentScheduleLine[];
  /** Chamado ao trocar a parcela (ex.: Edit sincroniza a linha ativa) */
  onSelectParcela?: (parcela: string) => void;
  /** Chamado ao alterar a regra de recebimento da matrícula */
  onRecebimentoMatriculaChange?: (mode: string) => void;
  disabled?: boolean;
}

function todayYMD(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * PaymentScheduleSection
 * pt-BR: Seção "Programação de Pagamento" do Gerenciamento de Parcelamento:
 * parcela do financiamento, recebimento da matrícula (diluída, avulsa ou na 1ª parcela),
 * primeira parcela (valor/data), dia do pagamento, edição inline de vencimentos e preview ao vivo.
 * en-US: "Payment Schedule" section of the Installment Management card.
 */
export function PaymentScheduleSection({
  control,
  setValue,
  lines,
  onSelectParcela,
  onRecebimentoMatriculaChange,
  disabled,
}: PaymentScheduleSectionProps) {
  const selecionada = useWatch({ control, name: "parcela_selecionada" }) as string | undefined;
  const primeiraValorMasked = useWatch({ control, name: "primeira_parcela_valor" }) as string | undefined;
  const primeiraData = useWatch({ control, name: "primeira_parcela_data" }) as string | undefined;
  const dia = useWatch({ control, name: "dia_pagamento" }) as string | undefined;
  const recebimentoMatricula = (useWatch({ control, name: "recebimento_matricula" }) as string | undefined) || "diluida";
  const matriculaVencimentoData = useWatch({ control, name: "matricula_vencimento_data" }) as string | undefined;
  const inscricaoMasked = useWatch({ control, name: "inscricao" }) as string | undefined;
  const vencimentosWatched = useWatch({ control, name: "vencimentos_personalizados" });

  const customDueDates = React.useMemo(() => {
    if (!vencimentosWatched) return {};
    if (typeof vencimentosWatched === "object") return vencimentosWatched as Record<string, string>;
    try {
      return JSON.parse(String(vencimentosWatched)) || {};
    } catch {
      return {};
    }
  }, [vencimentosWatched]);

  const hasCustomDates = Object.keys(customDueDates).length > 0;

  const handleDateChange = (n: number, newDate: string) => {
    const updated = { ...customDueDates, [String(n)]: newDate };
    if (setValue) {
      setValue("vencimentos_personalizados", updated, { shouldDirty: true });
      if (n === 1) setValue("primeira_parcela_data", newDate, { shouldDirty: true });
      if (n === 0) setValue("matricula_vencimento_data", newDate, { shouldDirty: true });
    } else if (typeof (control as any)?._formValues === "object") {
      (control as any)._formValues.vencimentos_personalizados = updated;
      if (n === 1) (control as any)._formValues.primeira_parcela_data = newDate;
      if (n === 0) (control as any)._formValues.matricula_vencimento_data = newDate;
    }
  };

  const handleResetSingleDate = (n: number) => {
    const updated = { ...customDueDates };
    delete updated[String(n)];
    delete updated[n];
    if (setValue) {
      setValue("vencimentos_personalizados", updated, { shouldDirty: true });
      if (n === 1) setValue("primeira_parcela_data", "", { shouldDirty: true });
      if (n === 0) setValue("matricula_vencimento_data", "", { shouldDirty: true });
    } else if (typeof (control as any)?._formValues === "object") {
      (control as any)._formValues.vencimentos_personalizados = updated;
      if (n === 1) (control as any)._formValues.primeira_parcela_data = "";
      if (n === 0) (control as any)._formValues.matricula_vencimento_data = "";
    }
  };

  const handleResetAllDates = () => {
    if (setValue) {
      setValue("vencimentos_personalizados", {}, { shouldDirty: true });
      setValue("primeira_parcela_data", "", { shouldDirty: true });
      setValue("matricula_vencimento_data", "", { shouldDirty: true });
    } else if (typeof (control as any)?._formValues === "object") {
      (control as any)._formValues.vencimentos_personalizados = {};
      (control as any)._formValues.primeira_parcela_data = "";
      (control as any)._formValues.matricula_vencimento_data = "";
    }
  };

  const options = React.useMemo(
    () =>
      (lines || [])
        .filter((r) => String(r?.parcelas ?? "").trim() !== "")
        .map((r) => ({
          value: String(r.parcelas),
          label: `${r.parcelas}x — R$ ${formatScheduleCurrencyBRL(
            Number(String(r.valor || "").replace(/\D/g, "")) / 100 || 0
          )}`,
        })),
    [lines]
  );

  const rowValor = resolveSelectedRowValue(lines, selecionada);
  const hasRowForSelected = !!selecionada && rowValor !== null;
  const valorMatricula = currencyRemoveMaskToNumber(String(inscricaoMasked || "")) || 0;

  // Validação imediata: a 1ª não pode superar o total fixo (qtd × linha),
  // pois as demais ficariam negativas ao redistribuir (espelha o backend 422).
  const primeiraValorNum = primeiraValorMasked ? currencyRemoveMaskToNumber(primeiraValorMasked) : null;
  const totalFinanciadoLinha =
    hasRowForSelected && Number(selecionada) > 0 && rowValor !== null
      ? Math.round(Number(selecionada) * rowValor * 100) / 100
      : null;
  const primeiraExcedeTotal =
    primeiraValorNum !== null &&
    totalFinanciadoLinha !== null &&
    Number(selecionada) > 1 &&
    Math.round(primeiraValorNum * 100) / 100 > totalFinanciadoLinha;

  const schedule = React.useMemo(
    () =>
      buildPaymentSchedule({
        totalParcelas: Number(selecionada) || null,
        valorParcela: rowValor,
        primeiraValor: primeiraValorMasked ? currencyRemoveMaskToNumber(primeiraValorMasked) || null : null,
        primeiraData: primeiraData || null,
        diaPagamento: dia ? Number(dia) || null : null,
        recebimentoMatricula: (recebimentoMatricula as any) || "diluida",
        valorMatricula,
        matriculaVencimentoData: matriculaVencimentoData || null,
        customDueDates,
      }),
    [selecionada, rowValor, primeiraValorMasked, primeiraData, dia, recebimentoMatricula, valorMatricula, matriculaVencimentoData, customDueDates]
  );

  return (
    <div className="mt-6 rounded-xl border p-4 space-y-4">
      <div>
        <h4 className="text-sm font-semibold">Programação de Pagamento</h4>
        <p className="text-xs text-muted-foreground">
          Define a parcela do financiamento, a forma de recebimento da matrícula e as datas de vencimento. Alimenta o contrato ({`{tabela_parcelas}`}) e as cobranças do Asaas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={control}
          name="parcela_selecionada"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Parcela do Financiamento</FormLabel>
              {options.length > 0 ? (
                <Select
                  value={field.value || ""}
                  onValueChange={(v) => {
                    field.onChange(v);
                    onSelectParcela?.(v);
                  }}
                  disabled={disabled}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a parcela" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <FormControl>
                  <Input
                    placeholder="Ex: 12"
                    inputMode="numeric"
                    value={field.value || ""}
                    disabled={disabled}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "");
                      field.onChange(v);
                      onSelectParcela?.(v);
                    }}
                  />
                </FormControl>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="dia_pagamento"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dia do Pagamento</FormLabel>
              <Select value={field.value || ""} onValueChange={field.onChange} disabled={disabled}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Dia do vencimento" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Array.from({ length: 31 }, (_, i) => String(i + 1)).map((d) => (
                    <SelectItem key={d} value={d}>
                      Dia {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/**
         * Recebimento da Matrícula
         * pt-BR: Permite definir se a matrícula é avulsa, na 1ª parcela ou diluída.
         */}
        <FormField
          control={control}
          name="recebimento_matricula"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Recebimento da Matrícula</FormLabel>
              <Select
                value={field.value || "diluida"}
                onValueChange={(val) => {
                  field.onChange(val);
                  onRecebimentoMatriculaChange?.(val);
                }}
                disabled={disabled}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Forma de recebimento" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="diluida">Diluído nas parcelas</SelectItem>
                  <SelectItem value="avulsa">Parcela avulsa (cobrança separada)</SelectItem>
                  <SelectItem value="primeira_parcela">Junto com a 1ª parcela</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {recebimentoMatricula === "avulsa" ? (
          <FormField
            control={control}
            name="matricula_vencimento_data"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vencimento da Matrícula</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    min={todayYMD()}
                    value={field.value || ""}
                    disabled={disabled}
                    onChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : (
          <div className="flex flex-col justify-center">
            <span className="text-xs text-muted-foreground">Taxa de Matrícula informada:</span>
            <span className="text-sm font-semibold text-foreground">
              {valorMatricula > 0 ? `R$ ${formatScheduleCurrencyBRL(valorMatricula)}` : "R$ 0,00 (sem taxa)"}
            </span>
          </div>
        )}

        <FormField
          control={control}
          name="primeira_parcela_valor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Primeira Parcela (valor)</FormLabel>
              <FormControl>
                <Input
                  placeholder="R$ 0,00 (vazio = divide igual; demais se ajustam ao total)"
                  value={field.value || ""}
                  disabled={disabled}
                  onChange={(e) => field.onChange(currencyApplyMask(e.target.value, "pt-BR", "BRL"))}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="primeira_parcela_data"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Primeira Parcela (data)</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  min={todayYMD()}
                  value={field.value || ""}
                  disabled={disabled}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {!!selecionada && !hasRowForSelected && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Preencha a linha {selecionada}x na tabela acima (valor) para gerar a programação.
        </p>
      )}

      {primeiraExcedeTotal ? (
        <p className="text-xs font-medium text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-2.5 py-2">
          A 1ª parcela (R$ {formatScheduleCurrencyBRL(primeiraValorNum || 0)}) não pode ser maior que o total do
          financiamento (R$ {formatScheduleCurrencyBRL(totalFinanciadoLinha || 0)}). Reduza o valor da 1ª parcela.
        </p>
      ) : null}

      {schedule ? (
        <div className="rounded-lg bg-muted/50 p-3">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs">
              {schedule.primeiraCustomizada && schedule.qtd > 1 ? (
                <>1ª R$ {formatScheduleCurrencyBRL(schedule.primeira.valor)} + {schedule.qtd - 1}x de R${" "}
                  {formatScheduleCurrencyBRL(schedule.valorDemaisParcelas)}</>
              ) : (
                <>{schedule.qtd}x de R$ {formatScheduleCurrencyBRL(schedule.valorParcela)}</>
              )}
            </span>
            {schedule.recebimentoMatricula === "avulsa" && schedule.valorMatricula > 0 && (
              <span className="inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-2 py-1 text-xs font-medium">
                Matrícula Avulsa: R$ {formatScheduleCurrencyBRL(schedule.valorMatricula)}
              </span>
            )}
            {schedule.recebimentoMatricula === "primeira_parcela" && schedule.valorMatricula > 0 && (
              <span className="inline-flex items-center rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 px-2 py-1 text-xs font-medium">
                Matrícula na 1ª: R$ {formatScheduleCurrencyBRL(schedule.valorMatricula)}
              </span>
            )}
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs">
              1ª Parcela em {formatScheduleDateBR(schedule.primeira.data)}
            </span>
            <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-semibold">
              Total R$ {formatScheduleCurrencyBRL(schedule.total)}
            </span>
          </div>
          <div className="max-h-60 overflow-y-auto rounded-md border border-border bg-background shadow-xs">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur-xs text-muted-foreground border-b border-border font-semibold">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Descrição</th>
                  <th className="px-3 py-2 text-center font-semibold">Vencimento (editável)</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {schedule.programacao.map((p) => {
                  const isCustom = !!customDueDates[p.n] || !!customDueDates[String(p.n)];
                  return (
                    <tr key={`${p.tipo || "p"}-${p.n}`} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-1.5 font-medium">
                        {p.n === 0 ? (
                          <div className="flex items-center gap-1.5">
                            <span className="inline-flex items-center rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 text-[10px] font-semibold">
                              Matrícula
                            </span>
                            <span>Taxa de Inscrição / Matrícula</span>
                          </div>
                        ) : p.n === 1 && schedule.recebimentoMatricula === "primeira_parcela" ? (
                          <div className="flex items-center gap-1.5">
                            <span>1ª Parcela</span>
                            <span className="inline-flex items-center rounded-md bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 px-1.5 py-0.5 text-[10px] font-semibold">
                              + Matrícula
                            </span>
                          </div>
                        ) : (
                          <span>{p.n}ª Parcela</span>
                        )}
                      </td>
                      <td className="px-3 py-1 text-center">
                        <div className="inline-flex items-center justify-center gap-1">
                          <Input
                            type="date"
                            value={p.vencimento}
                            disabled={disabled}
                            className={`h-7 w-32 px-1.5 py-0 text-xs text-center font-mono inline-block bg-background ${
                              isCustom
                                ? "border-primary text-primary font-semibold ring-1 ring-primary/30"
                                : "border-border/70 hover:border-primary/50"
                            }`}
                            onChange={(e) => handleDateChange(p.n, e.target.value)}
                          />
                          {isCustom && !disabled && (
                            <button
                              type="button"
                              title="Restaurar vencimento calculado"
                              className="text-muted-foreground hover:text-foreground text-xs px-0.5 transition-colors"
                              onClick={() => handleResetSingleDate(p.n)}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right font-semibold">R$ {formatScheduleCurrencyBRL(p.valor)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="sticky bottom-0 z-10 border-t border-border bg-muted/80 backdrop-blur-xs font-semibold">
                <tr>
                  <td colSpan={2} className="px-3 py-2 text-right font-semibold">
                    Total:
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-foreground">
                    R$ {formatScheduleCurrencyBRL(schedule.total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {hasCustomDates && (
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-border/40 text-xs">
              <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 text-[11px]">
                ● Vencimentos personalizados ativos nesta proposta
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                onClick={handleResetAllDates}
                disabled={disabled}
              >
                <RotateCcw className="h-3 w-3 mr-1" /> Restaurar vencimentos padrão
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Selecione a parcela e informe primeira parcela/dia para ver a programação.
        </p>
      )}
    </div>
  );
}

export default PaymentScheduleSection;
