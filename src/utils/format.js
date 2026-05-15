/**
 * utils/format.js
 * Utilitaires de présentation UI.
 * Aucune dépendance métier — uniquement formatage.
 */

export const f1 = (v) => {
  const n = parseFloat(v);
  return isFinite(n) ? n.toFixed(1) : '—';
};
export const f2 = (n) => (n != null ? n.toFixed(2) : '—');
export const pct = (n) => (n != null ? Math.round(n * 100) + '%' : '—');
export const pct1 = (n) => (n != null ? (n * 100).toFixed(1) + '%' : '—');

export const uid = () => {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === 'function') return randomUUID.call(globalThis.crypto);
  return 'id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
};

export const statusLabel = (s) =>
  ({
    en_étude: 'En étude',
    engagé: 'Engagé',
    conditionnel: 'Conditionnel',
    étudiée: 'Étudiée',
    raccordée: 'Raccordée',
    raccordé: 'Raccordé',
    annulée: 'Annulée',
    annulé: 'Annulé',
    planifié: 'Planifié',
    en_cours: 'En cours',
    validé: 'Validé',
  })[s] || s;

export const fmtDate = (d) =>
  new Date(d).toLocaleDateString('fr-BE', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export const fmtShortDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '—';

export const fmtMonth = (d) =>
  d ? new Date(d).toLocaleDateString('fr-BE', { month: 'short', year: 'numeric' }) : '—';
