/**
 * zapsign.ts
 * Utilitários para normalização de status e labels do ZapSign.
 * Aplica o padrão Strategy via mapa de configurações — cada status tem
 * sua label e classe CSS associadas, evitando if/else espalhados pela UI.
 */

interface SignerStatusConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
}

/** Mapa de configuração por status (Strategy) */
const SIGNER_STATUS_MAP: Record<string, SignerStatusConfig> = {
  signed: {
    label: 'Assinado',
    badgeClass: 'bg-green-600 text-white shadow-sm shadow-green-200',
    dotClass: 'bg-green-50 border-green-200 text-green-700',
  },
  completed: {
    label: 'Concluído',
    badgeClass: 'bg-green-600 text-white shadow-sm shadow-green-200',
    dotClass: 'bg-green-50 border-green-200 text-green-700',
  },
  opened: {
    label: 'Visualizado',
    badgeClass: 'bg-blue-600 text-white shadow-sm shadow-blue-200',
    dotClass: 'bg-blue-50 border-blue-200 text-blue-700',
  },
  new: {
    label: 'Pendente',
    badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200',
    dotClass: 'bg-slate-50 border-slate-200 text-slate-600',
  },
  pending: {
    label: 'Pendente',
    badgeClass: 'bg-amber-500 text-white',
    dotClass: 'bg-slate-50 border-slate-200 text-slate-600',
  },
  rejected: {
    label: 'Rejeitado',
    badgeClass: 'bg-red-600 text-white shadow-sm shadow-red-200',
    dotClass: 'bg-red-50 border-red-200 text-red-700',
  },
};

const DEFAULT_STATUS_CONFIG: SignerStatusConfig = {
  label: 'Processando',
  badgeClass: 'bg-slate-100 text-slate-600 border border-slate-200',
  dotClass: 'bg-slate-50 border-slate-200 text-slate-600',
};

function getStatusConfig(status?: string): SignerStatusConfig {
  if (!status) return DEFAULT_STATUS_CONFIG;
  return SIGNER_STATUS_MAP[status] ?? { ...DEFAULT_STATUS_CONFIG, label: status };
}

/** Retorna o label legível do status de um signatário. */
export function getSignerStatusLabel(status?: string): string {
  return getStatusConfig(status).label;
}

/** Retorna as classes CSS do badge de status de um signatário. */
export function getSignerBadgeClass(status?: string): string {
  return getStatusConfig(status).badgeClass;
}

/** Retorna as classes CSS do avatar/dot de status de um signatário. */
export function getSignerDotClass(status?: string): string {
  return getStatusConfig(status).dotClass;
}

/** Mapa para status do documento ZapSign (nível documento, não signatário) */
const DOC_STATUS_MAP: Record<string, { label: string; badgeClass: string }> = {
  signed: { label: 'Concluído', badgeClass: 'bg-green-600 text-white' },
  completed: { label: 'Concluído', badgeClass: 'bg-green-600 text-white' },
  pending: { label: 'Pendente', badgeClass: 'bg-amber-500 text-white' },
  rejected: { label: 'Rejeitado', badgeClass: 'bg-red-600 text-white' },
};

export function getDocStatusLabel(status?: string): string {
  return DOC_STATUS_MAP[status ?? '']?.label ?? 'Processando';
}

export function getDocBadgeClass(status?: string): string {
  return DOC_STATUS_MAP[status ?? '']?.badgeClass ?? 'bg-slate-400 text-white';
}

/** Verifica se um documento ZapSign está presente e tem dados válidos. */
export function isZapsignActive(doc: any): boolean {
  return doc && typeof doc === 'object' && Object.keys(doc).length > 0 && (doc.token || doc.signers);
}
