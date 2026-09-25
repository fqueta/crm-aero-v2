import { getApiUrl } from '@/lib/qlib';

/**
 * getWebhookEndpointForIntegration
 * pt-BR: Mapeia o nome ou slug da integração para o respectivo endpoint de webhook do backend.
 * en-US: Maps integration name or slug to its corresponding backend webhook endpoint.
 */
export function getWebhookEndpointForIntegration(name?: string, slug?: string): string {
  const s = (slug || '').toLowerCase();
  const n = (name || '').toLowerCase();

  if (s.includes('zapsign') || s.includes('zapsing') || n.includes('zapsign') || n.includes('zapsing')) {
    return 'zapsign';
  }
  if (s.includes('asaas') || n.includes('asaas')) {
    return 'asaas';
  }
  if (s.includes('brevo') || n.includes('brevo')) {
    return 'brevo';
  }
  if (s.includes('zapguru') || n.includes('zapguru')) {
    return 'zapguru';
  }
  if (s.includes('zenvia') || n.includes('zenvia')) {
    return 'zenvia';
  }
  if (s.includes('rd') || n.includes('rd') || n.includes('station')) {
    return 'rd';
  }

  // Fallback baseado no slug limpo ou primeira palavra do nome
  const cleanSlug = s.replace(/^integracao[-_]/, '').trim();
  return cleanSlug || n.split(' ')[0].toLowerCase() || 'webhook';
}

/**
 * getWebhookUrlForIntegration
 * pt-BR: Retorna a URL pública completa do webhook para ser cadastrada no provedor terceiro.
 * en-US: Returns the full public webhook URL to be configured in the third-party provider.
 */
export function getWebhookUrlForIntegration(name?: string, slug?: string): string {
  const endpoint = getWebhookEndpointForIntegration(name, slug);
  return `${getApiUrl()}/webhook/${endpoint}`;
}
