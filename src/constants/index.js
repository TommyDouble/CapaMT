/**
 * constants/index.js
 * Constantes partagées — aucune logique, données statiques uniquement.
 * v6 : suppression du modèle scénario bas/central/haut (remplacé par le modèle directionnel).
 */

export const YEARS    = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035];
export const REF_YEAR = 2025;
export const STORAGE_KEY = 'resa_planif_v6';

export const ALERT_CONFIG = {
  ok:       { thr: 0,    label: 'OK',          color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', bar: '#22c55e' },
  caution:  { thr: 0.70, label: 'Tension',     color: '#d97706', bg: '#fffbeb', border: '#fde68a', text: '#92400e', bar: '#f59e0b' },
  warning:  { thr: 0.85, label: 'Alerte N-1',  color: '#ea580c', bg: '#fff7ed', border: '#fed7aa', text: '#7c2d12', bar: '#f97316' },
  critical: { thr: 1.0,  label: 'Saturé N-1',  color: '#dc2626', bg: '#fef2f2', border: '#fecaca', text: '#7f1d1d', bar: '#ef4444' },
  rigid_n:  {            label: 'CRITIQUE N',   color: '#7f1d1d', bg: '#fef2f2', border: '#f87171', text: '#450a0a', bar: '#b91c1c' },
  pilot_n1: {            label: 'Pilotage N-1', color: '#0369a1', bg: '#e0f2fe', border: '#7dd3fc', text: '#0c4a6e', bar: '#0ea5e9' },
  pilot_n:  {            label: 'Pilotage ∞',  color: '#6d28d9', bg: '#f5f3ff', border: '#c4b5fd', text: '#4c1d95', bar: '#7c3aed' },
};

export const ALERT_ORDER = ['ok', 'pilot_n1', 'caution', 'pilot_n', 'warning', 'critical', 'rigid_n'];

export const FOISON_DEFAULTS = {
  industriel:  0.85,
  résidentiel: 0.70,
  tertiaire:   0.80,
  ENR:         0.60,
  stockage:    0.75,
  autre:       0.80,
};

export const REQ_TYPES         = ['industriel', 'résidentiel', 'tertiaire', 'ENR', 'stockage', 'autre'];
export const INJ_SOURCES        = ['PV', 'éolien', 'cogen', 'hydro', 'stockage'];
export const PREV_USAGES        = ['process', 'batteries', 'recharge_VE', 'tertiaire', 'autre'];
export const INJ_SOURCE_ICONS   = { PV: '☀', éolien: '💨', cogen: '🔥', hydro: '💧', stockage: '🔋' };
export const PREV_USAGE_ICONS   = { process: '⚙', batteries: '🔋', recharge_VE: '⚡', tertiaire: '🏢', autre: '📦' };

export const REQ_STATUSES        = ['en_étude', 'étudiée', 'conditionnel', 'raccordée', 'annulée'];
export const REQ_STATUSES_ACTIVE = ['en_étude', 'étudiée', 'conditionnel', 'raccordée'];
export const INV_STATUSES        = ['planifié', 'en_cours', 'validé', 'annulé'];
export const PROJ_STATUSES       = ['planifié', 'en_cours', 'validé', 'annulé'];
export const UPSTREAM_LEVELS     = ['36kV', '63kV', '70kV', '150kV', '220kV'];

export const TYPE_COLORS = {
  industriel:   { bg: '#f5f3ff', color: '#5b21b6', border: '#ddd6fe' },
  résidentiel:  { bg: '#f0fdfa', color: '#0f766e', border: '#99f6e4' },
  tertiaire:    { bg: '#eef2ff', color: '#3730a3', border: '#c7d2fe' },
  ENR:          { bg: '#ecfdf5', color: '#065f46', border: '#6ee7b7' },
  stockage:     { bg: '#fffbeb', color: '#78350f', border: '#fde68a' },
  autre:        { bg: 'var(--slate)', color: 'var(--text-muted)', border: 'var(--border)' },
  renforcement: { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
  création:     { bg: '#faf5ff', color: '#6b21a8', border: '#d8b4fe' },
  extension:    { bg: '#f0f9ff', color: '#0c4a6e', border: '#7dd3fc' },
  remplacement: { bg: '#fff7ed', color: '#7c2d12', border: '#fdba74' },
};

export const STATUS_COLORS = {
  'en_étude':     { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
  'étudiée':      { bg: '#f0fdf4', color: '#065f46', border: '#a7f3d0' },
  'conditionnel': { bg: 'var(--slate)', color: 'var(--text-muted)', border: 'var(--border)' },
  'planifié':     { bg: 'var(--navy-10)', color: 'var(--navy-60)', border: 'var(--navy-20)' },
  'en_cours':     { bg: '#fffbeb', color: '#78350f', border: '#fde68a' },
  'validé':       { bg: '#f0fdf4', color: '#065f46', border: '#a7f3d0' },
  'annulée':      { bg: '#fef2f2', color: '#ef4444', border: '#fecaca', strike: true },
  'annulé':       { bg: '#fef2f2', color: '#ef4444', border: '#fecaca', strike: true },
  'raccordée':    { bg: '#ecfdf5', color: '#065f46', border: '#6ee7b7' },
  'raccordé':     { bg: '#ecfdf5', color: '#065f46', border: '#6ee7b7' },
};

export const DECISION_CONFIG = {
  acceptable:    { label: 'Acceptable',      color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', icon: '✓' },
  conditionnel:  { label: 'Conditionnel',    color: '#92400e', bg: '#fffbeb', border: '#fde68a', icon: '⚠' },
  liste_attente: { label: "Liste d'attente", color: '#7f1d1d', bg: '#fef2f2', border: '#fecaca', icon: '✕' },
  en_analyse:    { label: 'En analyse',      color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe', icon: '…' },
};

/** Coefficient de foisonnement pour une demande. */
export function getFoisonnement(req, sub) {
  const type = req.type || 'autre';
  if (sub?.foisonnement?.[type] !== undefined) return sub.foisonnement[type];
  return FOISON_DEFAULTS[type] ?? 1.0;
}
