import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formata uma data para exibição no formato brasileiro
 */
/**
 * Formata data/hora para exibição com hífen entre data e hora.
 * Always formats as dd/MM/yyyy-HH:mm:ss (pt-BR style with hyphen).
 */
export function formatDate(date: string | Date): string {
  if (!date) return '-';

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  const HH = String(d.getHours()).padStart(2, '0');
  const MM = String(d.getMinutes()).padStart(2, '0');
  const SS = String(d.getSeconds()).padStart(2, '0');

  return `${dd}/${mm}/${yyyy}-${HH}:${MM}:${SS}`;
}

/**
 * Formata pontos como números inteiros com separadores de milhares
 */
export function formatPoints(points: number): string {
  if (typeof points !== 'number' || isNaN(points)) return '0';
  
  // Converte para inteiro e formata com separadores de milhares
  return Math.floor(points).toLocaleString('pt-BR');
}
