/**
 * urls.ts
 * Utilitários de normalização de URLs.
 * Centraliza o tratamento de barras duplicadas (ex.: `https://host//aluno/x`),
 * que ocorrem quando a base termina com `/` e o path começa com `/`.
 */

/**
 * normalizeUrl
 * pt-BR: Remove espaços e colapsa barras duplicadas no path, preservando o `://`.
 * Retorna string vazia para entradas vazias/nulas.
 * en-US: Trims and collapses duplicate slashes in the path, keeping `://` intact.
 */
export function normalizeUrl(url: string | null | undefined): string {
  if (url === null || url === undefined) return '';
  const value = String(url).trim();
  if (!value) return '';
  // Colapsa 2+ barras que NÃO sejam precedidas por `:` (preserva `https://`).
  return value.replace(/(?<!:)\/{2,}/g, '/');
}

/**
 * joinUrl
 * pt-BR: Junta base + path com exatamente uma barra entre eles.
 * en-US: Joins base + path with exactly one slash.
 */
export function joinUrl(base: string | null | undefined, path: string | null | undefined): string {
  const b = String(base ?? '').trim().replace(/\/+$/, '');
  const p = String(path ?? '').trim().replace(/^\/+/, '');
  if (!b) return normalizeUrl(p);
  if (!p) return normalizeUrl(b);
  return normalizeUrl(`${b}/${p}`);
}
