/**
 * paymentSchedule.ts — Programação de pagamento da proposta
 * pt-BR: Regra pura de cálculo do cronograma de parcelas (espelha o backend
 * `PaymentScheduleService` + `FirstDueDateThenFixedDayStrategy`): 1ª parcela
 * em `primeiraData`; da 2ª em diante, todo `diaPagamento` com trava de fim
 * de mês. Sem data inicial, a 1ª é o próximo `diaPagamento` >= hoje.
 * en-US: Pure payment-schedule rule (mirrors backend `PaymentScheduleService`
 * + `FirstDueDateThenFixedDayStrategy`): 1st due on `primeiraData`; from the
 * 2nd on, every `diaPagamento` clamped to month-end. Without an initial date,
 * the 1st is the next `diaPagamento` >= today.
 */
import { currencyRemoveMaskToString } from "./masks/currency";

export interface PaymentScheduleLine {
  parcelas: string;
  valor: string;
  desconto?: string;
}

export interface PaymentScheduleInput {
  /** Quantidade de parcelas (parcela_selecionada) */
  totalParcelas: number | null;
  /** Valor padrão da parcela (linha ativa) */
  valorParcela: number | null;
  /** Valor próprio da 1ª parcela (entrada). Default = valorParcela */
  primeiraValor?: number | null;
  /** Data da 1ª parcela (Y-m-d). Vazio = próximo diaPagamento >= hoje */
  primeiraData?: string | null;
  /** Dia fixo de vencimento (1-31). Default = dia da primeira data */
  diaPagamento?: number | null;
  /** Modo de recebimento da matrícula: 'diluida' (default), 'avulsa' ou 'primeira_parcela' */
  recebimentoMatricula?: 'diluida' | 'avulsa' | 'primeira_parcela' | null;
  /** Valor da taxa de inscrição/matrícula */
  valorMatricula?: number | null;
  /** Data de vencimento da matrícula avulsa (Y-m-d) */
  matriculaVencimentoData?: string | null;
  /** Vencimentos customizados por número de parcela { [n]: 'YYYY-MM-DD' } */
  customDueDates?: Record<string | number, string> | null;
}

export interface ScheduledInstallment {
  n: number;
  tipo?: 'matricula' | 'parcela';
  descricao?: string;
  /** Y-m-d */
  vencimento: string;
  valor: number;
}

export interface PaymentScheduleResult {
  qtd: number;
  valorParcela: number;
  primeira: { valor: number; data: string };
  diaPagamento: number;
  recebimentoMatricula: 'diluida' | 'avulsa' | 'primeira_parcela';
  valorMatricula: number;
  matriculaVencimentoData?: string | null;
  vencimentosPersonalizados?: Record<string, string>;
  programacao: ScheduledInstallment[];
  total: number;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function parseYMD(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * nextFixedDay — próxima ocorrência do dia fixo >= hoje (com trava de fim de mês).
 */
export function nextFixedDay(day: number, from: Date = new Date()): Date {
  const d = Math.max(1, Math.min(31, Math.floor(day) || 1));
  const base = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let candidate = new Date(base.getFullYear(), base.getMonth(), Math.min(d, daysInMonth(base.getFullYear(), base.getMonth())));
  if (candidate < base) {
    const nm = new Date(base.getFullYear(), base.getMonth() + 1, 1);
    candidate = new Date(nm.getFullYear(), nm.getMonth(), Math.min(d, daysInMonth(nm.getFullYear(), nm.getMonth())));
  }
  return candidate;
}

/**
 * buildPaymentSchedule — monta o cronograma ou retorna null quando inválido.
 */
export function buildPaymentSchedule(input: PaymentScheduleInput): PaymentScheduleResult | null {
  const qtd = Math.floor(Number(input.totalParcelas) || 0);
  const valor = Number(input.valorParcela) || 0;
  if (qtd < 1 || !(valor > 0)) return null;

  const recebimentoMatricula = input.recebimentoMatricula || 'diluida';
  const valorMatricula = Math.max(0, Number(input.valorMatricula) || 0);

  const parsedFirst = input.primeiraData ? parseYMD(input.primeiraData) : null;
  if (input.primeiraData && !parsedFirst) return null;

  const day = Math.max(1, Math.min(31, Math.floor(Number(input.diaPagamento) || 0) || (parsedFirst ? parsedFirst.getDate() : new Date().getDate())));
  const first = parsedFirst ?? nextFixedDay(day);

  let primeiraValor = input.primeiraValor !== null && input.primeiraValor !== undefined && isFinite(Number(input.primeiraValor))
    ? Number(input.primeiraValor)
    : valor;
  if (!(primeiraValor >= 0)) return null;

  const programacao: ScheduledInstallment[] = [];

  const custom = input.customDueDates || {};

  // Se recebimento for avulsa e houver matrícula, adiciona como item n: 0
  if (recebimentoMatricula === 'avulsa' && valorMatricula > 0) {
    const dataVenc = (custom[0] || custom['0']) || input.matriculaVencimentoData || (input.primeiraData || toYMD(new Date()));
    programacao.push({
      n: 0,
      tipo: 'matricula',
      descricao: 'Taxa de Inscrição / Matrícula',
      vencimento: dataVenc,
      valor: round2(valorMatricula),
    });
  }

  // Se recebimento for junto com a 1ª parcela, soma à entrada
  let primeiraDescricao = '1ª Parcela';
  if (recebimentoMatricula === 'primeira_parcela' && valorMatricula > 0) {
    primeiraValor += valorMatricula;
    primeiraDescricao = '1ª Parcela (com Matrícula)';
  }

  const venc1 = (custom[1] || custom['1']) || toYMD(first);
  programacao.push({
    n: 1,
    tipo: 'parcela',
    descricao: primeiraDescricao,
    vencimento: venc1,
    valor: round2(primeiraValor),
  });

  for (let i = 1; i < qtd; i++) {
    const m = new Date(first.getFullYear(), first.getMonth() + i, 1);
    const dd = Math.min(day, daysInMonth(m.getFullYear(), m.getMonth()));
    const defaultDate = toYMD(new Date(m.getFullYear(), m.getMonth(), dd));
    const vencN = (custom[i + 1] || custom[String(i + 1)]) || defaultDate;
    programacao.push({
      n: i + 1,
      tipo: 'parcela',
      descricao: `${i + 1}ª Parcela`,
      vencimento: vencN,
      valor: round2(valor),
    });
  }

  const normalizedCustom: Record<string, string> = {};
  for (const [k, v] of Object.entries(custom)) {
    if (v && String(v).trim()) normalizedCustom[String(k)] = String(v).trim();
  }

  const total = round2(programacao.reduce((s, p) => s + p.valor, 0));
  return {
    qtd,
    valorParcela: round2(valor),
    primeira: { valor: round2(primeiraValor), data: venc1 },
    diaPagamento: day,
    recebimentoMatricula,
    valorMatricula,
    matriculaVencimentoData: input.matriculaVencimentoData || null,
    vencimentosPersonalizados: Object.keys(normalizedCustom).length > 0 ? normalizedCustom : undefined,
    programacao,
    total,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** dd/mm/aaaa a partir de Y-m-d */
export function formatScheduleDateBR(ymd: string): string {
  const d = parseYMD(ymd);
  return d ? `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}` : ymd;
}

/** R$ 2.636,72 */
export function formatScheduleCurrencyBRL(n: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
}

/** "1ª Parcela: Vencimento em 11/10/2026 — Valor: R$ 2.636,72" */
export function formatScheduleLine(item: ScheduledInstallment): string {
  const label = item.descricao || (item.n === 0 ? 'Taxa de Inscrição / Matrícula' : `${item.n}ª Parcela`);
  return `${label}: Vencimento em ${formatScheduleDateBR(item.vencimento)} — Valor: R$ ${formatScheduleCurrencyBRL(item.valor)}`;
}

export interface PaymentScheduleFormValues {
  parcela_selecionada?: string;
  primeira_parcela_valor?: string;
  primeira_parcela_data?: string;
  dia_pagamento?: string;
  recebimento_matricula?: string;
  matricula_vencimento_data?: string;
  vencimentos_personalizados?: Record<string, string> | string;
}

/**
 * getParcelamentoProgramacao — normaliza os campos da programação para o payload
 * `orc.parcelamento` (valores plain, strings vazias viram null no backend).
 * pt-BR: Usado por ProposalsCreate e ProposalsEdit.
 */
export function getParcelamentoProgramacao(values: PaymentScheduleFormValues) {
  const primeiraValor = String(values.primeira_parcela_valor || "").trim();
  let customDates: Record<string, string> | undefined = undefined;
  if (values.vencimentos_personalizados) {
    if (typeof values.vencimentos_personalizados === 'string') {
      try {
        customDates = JSON.parse(values.vencimentos_personalizados);
      } catch {}
    } else if (typeof values.vencimentos_personalizados === 'object') {
      customDates = values.vencimentos_personalizados;
    }
  }

  return {
    parcela_selecionada: String(values.parcela_selecionada || ""),
    primeira_parcela_valor: primeiraValor ? currencyRemoveMaskToString(primeiraValor) : "",
    primeira_parcela_data: String(values.primeira_parcela_data || ""),
    dia_pagamento: String(values.dia_pagamento || ""),
    recebimento_matricula: String(values.recebimento_matricula || "diluida"),
    matricula_vencimento_data: String(values.matricula_vencimento_data || ""),
    vencimentos_personalizados: customDates || {},
  };
}

/**
 * resolveSelectedRowValue — valor da linha selecionada (linhas: {parcelas, valor}).
 * pt-BR: `valor` pode vir mascarado ("R$ 2.636,72") ou ponto decimal ("2636.72").
 */
export function resolveSelectedRowValue(lines: PaymentScheduleLine[] | undefined, selected: string | null | undefined): number | null {
  if (!selected || !Array.isArray(lines)) return null;
  const row = lines.find((r) => String(r?.parcelas ?? '') === String(selected));
  if (!row) return null;
  const digits = String(row.valor || '').replace(/\D/g, '');
  if (!digits) return null;
  const amount = Number(digits) / 100;
  return isFinite(amount) && amount > 0 ? amount : null;
}
