import React, { useState } from 'react';
import { buildRequestStatusSummary } from '../../engines/statusSummary.js';
import { ALERT_CONFIG, DECISION_CONFIG, TYPE_COLORS, STATUS_COLORS,
         CAPACITY_IMPACT_CONFIG,
         CUSTOMER_STATUS_CONFIG, ASSESSMENT_STATUS_CONFIG, OFFER_STATUS_CONFIG, CAPACITY_SPLIT_CONFIG, CONFIDENCE_CONFIG,
         INJ_SOURCES, PREV_USAGES } from '../../constants/index.js';
import { f1, pct, statusLabel, fmtShortDate } from '../../utils/format.js';
import { getAlertLevel } from '../../engines/alerts.js';

const BADGE_TOOLTIPS = {
  decision: {
    acceptable: 'Décision GRD: la capacité permanente demandée peut être accordée.',
    conditionnel: 'Décision GRD: raccordement possible sous condition, généralement liée à un projet réseau ou à une limitation.',
    liste_attente: 'Décision GRD: capacité indisponible à ce stade, dossier à maintenir en attente ou à retravailler.',
    en_analyse: 'Décision non encore finalisée.',
  },
  impact: {
    NONE: 'Aucun impact capacité actif.',
    QUEUE_RESERVED: 'Dossier complet en file: la puissance demandée est réservée avant finalisation de l’étude.',
    STUDY_RESERVED: 'Dossier étudié: la réservation suit la réponse technique.',
    ACQUIRED: 'Offre acceptée: la capacité reste acquise jusqu’au raccordement ou traitement.',
    RELEASED: 'Capacité libérée après annulation ou refus.',
    CONNECTED_RESERVED: 'Dossier raccordé: la capacité reste maintenue temporairement.',
    CONNECTED_RELEASED: 'Dossier raccordé: le délai de maintien est dépassé et l’impact est nul.',
  },
  customer: {
    incomplete: 'Informations client incomplètes.',
    ready_for_study: 'Informations client complètes: le dossier peut être étudié.',
    cancelled: 'Demande client annulée.',
  },
  assessment: {
    not_started: 'Étude technique non démarrée.',
    under_study: 'Étude technique en cours.',
    studied: 'Étude technique finalisée.',
    blocked: 'Étude bloquée par une donnée ou une réponse manquante.',
  },
  offer: {
    not_applicable: 'Aucune offre formulée à ce stade.',
    offer_formulated: 'Offre formulée ou envoyée.',
    offer_expired: 'Offre expirée, mais la réservation reste à traiter.',
    offer_cancelled: 'Offre annulée: capacité libérée.',
    offer_accepted: 'Offre acceptée: raccordement attendu.',
    offer_connected: 'Dossier raccordé.',
  },
  split: {
    OK: 'Toute la puissance demandée peut être accordée en permanent.',
    LIMIT: 'Une partie de la puissance demandée peut être accordée en permanent; le solde est flexible.',
    FULL_FLEX: 'Aucune puissance permanente disponible; raccordement uniquement flexible.',
    KO: 'Aucune solution de raccordement disponible dans cette couche.',
    PENDING: 'Réponse à compléter: cette couche bloque la décision finale.',
  },
  confidence: {
    HIGH: 'Confiance haute: données complètes et réponse technique consolidée.',
    MEDIUM: 'Confiance moyenne: réponse exploitable avec quelques hypothèses.',
    LOW: 'Confiance basse: données incomplètes, hypothèses fortes ou étude non finalisée.',
  },
};

function badgeTitle(group, value, fallback) {
  return BADGE_TOOLTIPS[group]?.[value] || BADGE_TOOLTIPS[group]?.[fallback] || undefined;
}

/** Indicateur de niveau d'alerte (N-1, tension, critique…). */
export function AlertBadge({level, size='sm'}) {
  const c = ALERT_CONFIG[level];
  const pad = size==='xs' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';
  return (
    <span title={c.label} style={{background:c.bg,color:c.text,border:`1px solid ${c.border}`}}
      className={`inline-flex items-center gap-1.5 rounded-full ${pad}`}>
      <span style={{background:c.color}} className="alert-dot w-1.5 h-1.5"/>
      {c.label}
    </span>
  );
}

/** Badge décision file d'attente (acceptable, conditionnel…). */
export function DecisionBadge({decision, size='sm'}) {
  const c = DECISION_CONFIG[decision] || DECISION_CONFIG.en_analyse;
  const pad = size==='xs' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';
  return (
    <span title={badgeTitle('decision', decision, 'en_analyse')} style={{background:c.bg,color:c.color,border:`1px solid ${c.border}`}}
      className={`inline-flex items-center gap-1.5 rounded-full ${pad} font-semibold`}>
      <span className="font-bold">{c.icon}</span>
      {c.label}
    </span>
  );
}

/** Chip de péremption d'une réservation. */
export function ExpiryChip({expiry}) {
  if (!expiry) return null;
  if (expiry.status==='signé')   return <span title={`Convention signée le ${fmtShortDate(expiry.date)}.`} className="expiry-chip expiry-signed">✓ Conv. {fmtShortDate(expiry.date)}</span>;
  if (expiry.status==='expiré')  return <span title={`Échéance expirée le ${fmtShortDate(expiry.date)}.`} className="expiry-chip expiry-expired">⚠ Expirée {fmtShortDate(expiry.date)}</span>;
  if (expiry.status==='bientôt') return <span title={`Échéance de réservation proche: ${expiry.daysLeft} jour(s) restant(s).`} className="expiry-chip expiry-soon">Expire dans {expiry.daysLeft}j</span>;
  return <span title={`Échéance de réservation: ${fmtShortDate(expiry.date)}.`} className="expiry-chip expiry-ok">🕐 {fmtShortDate(expiry.date)}</span>;
}

/** Pilule générique colorée. */
export function Pill({children, color, style: extraStyle}) {
  return (
    <span style={{
      display:'inline-block', padding:'2px 9px', borderRadius:20,
      fontSize:11, fontWeight:600, lineHeight:'18px',
      background:'var(--slate)', color:'var(--text-muted)',
      border:'1px solid var(--border)',
      ...extraStyle,
    }}>
      {children}
    </span>
  );
}

/** Badge type/statut coloré avec lookup dans TYPE_COLORS et STATUS_COLORS. */
export function Tag({v}) {
  const c = TYPE_COLORS[v] || STATUS_COLORS[v] || {bg:'var(--slate)',color:'var(--text-muted)',border:'var(--border)'};
  return (
    <span title={`Type: ${statusLabel(v)}`} style={{
      display:'inline-block', padding:'2px 8px', borderRadius:20,
      fontSize:11, fontWeight:600, lineHeight:'18px', whiteSpace:'nowrap',
      background:c.bg, color:c.color, border:`1px solid ${c.border}`,
      textDecoration: c.strike ? 'line-through' : 'none',
    }}>
      {statusLabel(v)}
    </span>
  );
}

/** Chip capacityImpact (Valeurs client, Valeurs GRD, Non comptabilisé…). */
export function CapacityImpactChip({ impact, size = 'sm' }) {
  const c = CAPACITY_IMPACT_CONFIG[impact] || CAPACITY_IMPACT_CONFIG.NONE;
  const pad = size === 'xs' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';
  return (
    <span title={badgeTitle('impact', impact, 'NONE')} style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}
      className={`inline-flex items-center gap-1.5 rounded-full ${pad}`}>
      {c.label}
    </span>
  );
}

function ConfigBadge({ config, value, fallback, size = 'sm', title }) {
  const c = config[value] || config[fallback] || Object.values(config)[0];
  const pad = size === 'xs' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';
  return (
    <span title={title} style={{
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      textDecoration: c.strike ? 'line-through' : 'none',
    }} className={`inline-flex items-center gap-1.5 rounded-full ${pad}`}>
      {c.label}
    </span>
  );
}

export const CustomerStatusBadge = props =>
  <ConfigBadge config={CUSTOMER_STATUS_CONFIG} fallback="incomplete" value={props.status} size={props.size} title={badgeTitle('customer', props.status, 'incomplete')} />;

export const AssessmentStatusBadge = props =>
  <ConfigBadge config={ASSESSMENT_STATUS_CONFIG} fallback="not_started" value={props.status} size={props.size} title={badgeTitle('assessment', props.status, 'not_started')} />;

export const OfferStatusBadge = props =>
  <ConfigBadge config={OFFER_STATUS_CONFIG} fallback="not_applicable" value={props.status} size={props.size} title={badgeTitle('offer', props.status, 'not_applicable')} />;

export const CapacitySplitStatusBadge = props =>
  <ConfigBadge config={CAPACITY_SPLIT_CONFIG} fallback="PENDING" value={props.status} size={props.size} title={badgeTitle('split', props.status, 'PENDING')} />;

export const ConfidenceBadge = props =>
  <ConfigBadge config={CONFIDENCE_CONFIG} fallback="LOW" value={props.confidence} size={props.size} title={badgeTitle('confidence', props.confidence, 'LOW')} />;

/**
 * Badge de phase métier d'une demande de raccordement.
 * Traduit les dimensions workflow en phase lisible (Déposée, Analysée, Acceptable…).
 */
export function StatusPhaseBadge({ req, size = 'sm' }) {
  const s = buildRequestStatusSummary(req);
  if (!s) return null;
  const pad = size === 'xs' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';
  return (
    <span
      style={{
        background: s.phaseBg,
        color: s.phaseColor,
        border: `1px solid ${s.phaseBorder}`,
        textDecoration: s.strike ? 'line-through' : 'none',
      }}
      className={`inline-flex items-center gap-1.5 rounded-full ${pad}`}
      title={s.description}
    >
      {s.phaseLabel}
    </span>
  );
}
