/**
 * constants/index.js
 * Constantes partagées — aucune logique, données statiques uniquement.
 */

export const YEARS    = [2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035];
export const REF_YEAR = 2025;
export const STORAGE_KEY = 'resa_planif_v12';

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

export const CUSTOMER_STATUSES     = ['incomplete', 'ready_for_study', 'cancelled'];
export const ASSESSMENT_STATUSES   = ['not_started', 'under_study', 'studied', 'blocked'];
export const OFFER_STATUSES        = ['not_applicable', 'offer_formulated', 'offer_expired', 'offer_cancelled', 'offer_accepted', 'offer_connected'];
export const CAPACITY_IMPACT_STATUSES = ['NONE', 'QUEUE_RESERVED', 'STUDY_RESERVED', 'ACQUIRED', 'RELEASED', 'CONNECTED_RESERVED', 'CONNECTED_RELEASED'];
export const CAPACITY_SPLIT_STATUSES  = ['OK', 'LIMIT', 'FULL_FLEX', 'KO', 'PENDING'];
export const CAPACITY_SPLIT_SOURCES   = ['UPSTREAM', 'SUBSTATION', 'NETWORK', 'FINAL'];
export const CONFIDENCE_LEVELS        = ['HIGH', 'MEDIUM', 'LOW'];
export const REQUEST_DIRECTIONS       = ['LOAD', 'INJECTION', 'BOTH'];
export const LIMITING_CONSTRAINTS     = ['UPSTREAM', 'SUBSTATION', 'NETWORK', 'UNKNOWN'];
export const SCENARIO_PROFILES        = ['central', 'prudent', 'stress'];
export const INV_STATUSES        = ['planifié', 'en_cours', 'validé', 'annulé'];
export const PROJ_STATUSES       = ['planifié', 'en_cours', 'validé', 'annulé'];
export const UPSTREAM_LEVELS     = ['36kV', '63kV', '70kV', '150kV', '220kV'];
export const CONNECTED_RETENTION_DEFAULT_MONTHS = 6;
export const CONNECTED_RETENTION_MIN_MONTHS = 1;
export const CONNECTED_RETENTION_MAX_MONTHS = 60;

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
  'planifié': { bg: 'var(--accent-soft)', color: 'var(--accent-muted)', border: 'var(--accent-border)' },
  'en_cours': { bg: '#fffbeb', color: '#78350f', border: '#fde68a' },
  'validé':   { bg: '#f0fdf4', color: '#065f46', border: '#a7f3d0' },
  'annulé':   { bg: '#fef2f2', color: '#ef4444', border: '#fecaca', strike: true },
};

export const CAPACITY_IMPACT_CONFIG = {
  NONE:          { label: 'Aucun impact',    color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  QUEUE_RESERVED:{ label: 'File réservée',   color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  STUDY_RESERVED:{ label: 'Étude réservée',  color: '#0369a1', bg: '#e0f2fe', border: '#7dd3fc' },
  ACQUIRED:      { label: 'Acquise',         color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  RELEASED:      { label: 'Libérée',         color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  CONNECTED_RESERVED: { label: 'Raccordé maintenu', color: '#047857', bg: '#ecfdf5', border: '#6ee7b7' },
  CONNECTED_RELEASED: { label: 'Raccordé libéré',   color: '#4c1d95', bg: '#f5f3ff', border: '#c4b5fd' },
};

export const CUSTOMER_STATUS_CONFIG = {
  incomplete:      { label: 'Incomplet', color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
  ready_for_study: { label: 'Prêt étude', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
  cancelled:       { label: 'Annulé',    color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', strike: true },
};

export const ASSESSMENT_STATUS_CONFIG = {
  not_started: { label: 'Non démarrée', color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  under_study: { label: 'En étude',     color: '#0369a1', bg: '#e0f2fe', border: '#7dd3fc' },
  studied:     { label: 'Étudiée',      color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  blocked:     { label: 'Bloquée',      color: '#7f1d1d', bg: '#fef2f2', border: '#fecaca' },
};

export const OFFER_STATUS_CONFIG = {
  not_applicable:   { label: 'Sans offre',       color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  offer_formulated: { label: 'Offre formulée',   color: '#0369a1', bg: '#e0f2fe', border: '#7dd3fc' },
  offer_expired:    { label: 'Offre expirée',    color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
  offer_cancelled:  { label: 'Offre annulée',    color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb', strike: true },
  offer_accepted:   { label: 'Offre acceptée',   color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  offer_connected:  { label: 'Raccordée',        color: '#065f46', bg: '#ecfdf5', border: '#6ee7b7' },
};

export const CAPACITY_SPLIT_CONFIG = {
  OK:        { label: 'OK',        color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  LIMIT:     { label: 'Limité',    color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  FULL_FLEX: { label: 'Full flex', color: '#4c1d95', bg: '#f5f3ff', border: '#c4b5fd' },
  KO:        { label: 'KO',        color: '#7f1d1d', bg: '#fef2f2', border: '#fecaca' },
  PENDING:   { label: 'À compléter', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe' },
};

export const CONFIDENCE_CONFIG = {
  HIGH:   { label: 'Confiance haute',   color: '#166534', bg: '#f0fdf4', border: '#bbf7d0' },
  MEDIUM: { label: 'Confiance moyenne', color: '#92400e', bg: '#fffbeb', border: '#fde68a' },
  LOW:    { label: 'Confiance basse',   color: '#7f1d1d', bg: '#fef2f2', border: '#fecaca' },
};

export const SCENARIO_PROFILE_CONFIG = {
  central: { label: 'Central', growthMultiplier: 1.0, confidencePenalty: 0 },
  prudent: { label: 'Prudent', growthMultiplier: 1.15, confidencePenalty: 0 },
  stress:  { label: 'Stress',  growthMultiplier: 1.35, confidencePenalty: 1 },
};

export const DECISION_CONFIG = {
  acceptable:    { label: 'Acceptable',      color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', icon: '✓' },
  conditionnel:  { label: 'Conditionnel',    color: '#92400e', bg: '#fffbeb', border: '#fde68a', icon: '⚠' },
  liste_attente: { label: "Liste d'attente", color: '#7f1d1d', bg: '#fef2f2', border: '#fecaca', icon: '✕' },
  en_analyse:    { label: 'En analyse',      color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe', icon: '…' },
};

/** Coefficient de foisonnement pour une demande. */
export function getFoisonnement(req, sub) {
  const type = req.customer?.client?.type || 'autre';
  if (sub?.foisonnement?.[type] !== undefined) return sub.foisonnement[type];
  return FOISON_DEFAULTS[type] ?? 1.0;
}
