import React, { useState } from 'react';
import { buildRequestStatusSummary } from '../../engines/statusSummary.js';
import { ALERT_CONFIG, DECISION_CONFIG, TYPE_COLORS, STATUS_COLORS,
         INJ_SOURCES, PREV_USAGES } from '../../constants/index.js';
import { f1, pct, statusLabel, fmtShortDate } from '../../utils/format.js';
import { getAlertLevel } from '../../engines/load.js';

/** Indicateur de niveau d'alerte (N-1, tension, critique…). */
export function AlertBadge({level, size='sm'}) {
  const c = ALERT_CONFIG[level];
  const pad = size==='xs' ? 'px-1.5 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-semibold';
  return (
    <span style={{background:c.bg,color:c.text,border:`1px solid ${c.border}`}}
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
    <span style={{background:c.bg,color:c.color,border:`1px solid ${c.border}`}}
      className={`inline-flex items-center gap-1.5 rounded-full ${pad} font-semibold`}>
      <span className="font-bold">{c.icon}</span>
      {c.label}
    </span>
  );
}

/** Chip de péremption d'une réservation. */
export function ExpiryChip({expiry}) {
  if (!expiry) return null;
  if (expiry.status==='signé')   return <span className="expiry-chip expiry-signed">✓ Conv. {fmtShortDate(expiry.date)}</span>;
  if (expiry.status==='expiré')  return <span className="expiry-chip expiry-expired">⚠ Expirée {fmtShortDate(expiry.date)}</span>;
  if (expiry.status==='bientôt') return <span className="expiry-chip expiry-soon">Expire dans {expiry.daysLeft}j</span>;
  return <span className="expiry-chip expiry-ok">🕐 {fmtShortDate(expiry.date)}</span>;
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
    <span style={{
      display:'inline-block', padding:'2px 8px', borderRadius:20,
      fontSize:11, fontWeight:600, lineHeight:'18px', whiteSpace:'nowrap',
      background:c.bg, color:c.color, border:`1px solid ${c.border}`,
      textDecoration: c.strike ? 'line-through' : 'none',
    }}>
      {statusLabel(v)}
    </span>
  );
}

/**
 * Badge de phase métier d'une demande de raccordement.
 * Traduit le statut technique en phase lisible (Déposée, Analysée, Acceptable…).
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
