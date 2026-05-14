/**
 * OverviewPage.jsx — v3.0 "GridOps"
 * Dense operational dashboard. Saturation matrix as hero.
 * No emoji in titles. Professional data hierarchy.
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { YEARS, ALERT_CONFIG } from '../../../constants/index.js';
import { f1 } from '../../../utils/format.js';
import { useProjects } from '../../App.jsx';
import {
  getCapacityAtYear, getEffectiveSubstations, getCapacityNAtYear,
} from '../../../engines/capacity.js';
import {
  getUtilizationWithdrawalRigid, getUtilizationWithdrawalTotal,
  getUtilizationInjectionRigid,
  getWithdrawalRigid, getWithdrawalTotal,
  getResidualWithdrawalRigid,
} from '../../../engines/directionalSubstation.js';
import {
  getInjectionRigid, getFirstInjectionSaturationYear,
} from '../../../engines/directionalSubstation.js';
import { getAlertLevel, getFirstWithdrawalSaturation } from '../../../engines/alerts.js';
import { getGlobalQueueStats, getQueueAnalysis } from '../../../engines/queue.js';
import { AlertBadge, DecisionBadge, ExpiryChip } from '../../shared/badges.jsx';
import { DualCellBadge } from '../../shared/charts.jsx';
import { Sparkline } from '../../shared/Sparkline.jsx';
import { reqClientPrelevTotal, reqClientPrelevFlexible } from '../../../engines/requests.js';
import { getCustomer } from '../../../engines/requestModel.js';

// ── KPI Strip Item ────────────────────────────────────────────────────────────
function KpiStrip({ label, value, sub, color, alert, sparkValues, onClick, delay = 0 }) {
  const borderColor = alert === 'red' ? 'var(--red)' : alert === 'orange' ? 'var(--amber)' : 'var(--border)';
  return (
    <div
      className="kpi-card stagger-item"
      style={{
        animationDelay: `${delay}ms`,
        cursor: onClick ? 'pointer' : 'default',
        borderLeft: `3px solid ${borderColor}`,
      }}
      onClick={onClick}
    >
      <p className="kpi-label">{label}</p>
      <p className="kpi-value" style={{ color: color || 'var(--text-primary)' }}>{value}</p>
      {sparkValues && sparkValues.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <Sparkline values={sparkValues} width={90} height={20} threshold={0}
            title={YEARS.map((y, i) => `${y}: ${sparkValues[i]}`).join(' | ')} />
        </div>
      )}
      {sub && <p className="kpi-sub" style={{ marginTop: sparkValues ? 3 : 5 }}>{sub}</p>}
    </div>
  );
}

// ── Saturation Matrix ─────────────────────────────────────────────────────────
function SaturationMatrix({ substations, onNavigate }) {
  const projects = useProjects();
  const [hoveredCell, setHoveredCell] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const active = substations.filter(s => s.status !== 'hors_service');

  const showTooltip = (event, data) => {
    if (typeof window === 'undefined') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const estimatedWidth = 244;
    const estimatedHeight = 150;
    const margin = 12;
    const left = Math.min(
      Math.max(rect.left + rect.width / 2 - estimatedWidth / 2, margin),
      Math.max(margin, window.innerWidth - estimatedWidth - margin)
    );
    const hasRoomAbove = rect.top - estimatedHeight - margin > 0;
    setHoveredCell({ ssId: data.sub.id, year: data.year });
    setTooltip({
      ...data,
      position: {
        left,
        top: hasRoomAbove ? rect.top - 8 : rect.bottom + 8,
        placement: hasRoomAbove ? 'above' : 'below',
      },
    });
  };

  const hideTooltip = () => {
    setHoveredCell(null);
    setTooltip(null);
  };

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>Matrice de saturation N-1</h3>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>
            Taux d'utilisation rigide prélèvement · Modèle directionnel · 2026–2035
          </p>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, minWidth: 700 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '7px 14px', fontWeight: 700, fontSize: 9, color: 'var(--text-muted)', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Sous-station</th>
              <th style={{ textAlign: 'center', padding: '7px 8px', fontWeight: 700, fontSize: 9, color: 'var(--text-muted)', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)', width: 90 }}>Tendance</th>
              {YEARS.map(y => (
                <th key={y} style={{ textAlign: 'center', padding: '7px 3px', fontWeight: 600, fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-muted)', borderBottom: '1px solid var(--border)', minWidth: 52, fontFamily: 'var(--font-mono)' }}>{y}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {active.map((sub, i) => {
              const residuals = YEARS.map(y => {
                const cap = getCapacityAtYear(sub, y, projects);
                const net = Math.max(0, getWithdrawalRigid(sub, y, false, projects));
                return +(cap - net).toFixed(1);
              });
              // Injection: first year with reverse flow for this SS
              const firstReverse = YEARS.find(y => getInjectionRigid(sub, y, false, projects) < 0);

              return (
                <tr key={sub.id} style={{ background: i % 2 === 0 ? 'var(--bg-raised)' : 'var(--bg-muted)' }}>
                  <td style={{ padding: '5px 14px', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12 }}
                    onClick={() => onNavigate(sub.id)}>
                    {sub.name}
                    {sub.id.startsWith('ss-new') && <span style={{ marginLeft: 5, fontSize: 9, color: 'var(--accent)', fontWeight: 700 }}>NEW</span>}
                    {firstReverse && (
                      <span style={{ marginLeft: 5, fontSize: 8, fontWeight: 700, padding: '1px 4px',
                        borderRadius: 3, background: 'var(--inj-dim)', color: 'var(--inj)',
                        border: '1px solid var(--inj-border)', fontFamily: 'var(--font-mono)' }}>
                        INV {firstReverse}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '3px 8px', textAlign: 'center' }}>
                    <Sparkline values={residuals} width={72} height={18} threshold={0}
                      title={YEARS.map((y, i) => `${y}: ${residuals[i]} MVA`).join(' | ')} />
                  </td>
                  {YEARS.map(y => {
                    const rR = getUtilizationWithdrawalRigid(sub, y, projects);
                    const cap = getCapacityAtYear(sub, y, projects);
                    const net = Math.max(0, getWithdrawalRigid(sub, y, false, projects));
                    const netT = Math.max(0, getWithdrawalTotal(sub, y, false, projects));
                    const res = +(cap - net).toFixed(1);
                    const level = getAlertLevel(rR);
                    const c = ALERT_CONFIG[level];
                    const isHovered = hoveredCell?.ssId === sub.id && hoveredCell?.year === y;
                    const invProjects = projects.filter(p =>
                      p.year === y && p.status !== 'annulé' && (p.effects || []).some(e => e.ssId === sub.id)
                    );
                    // Injection data for this cell
                    const iR = getInjectionRigid(sub, y, false, projects);
                    const uIR = getUtilizationInjectionRigid(sub, y, projects);
                    const hasReverse = iR < 0;
                    return (
                      <td key={y} style={{ padding: '3px', textAlign: 'center', position: 'relative' }}
                        onMouseEnter={event => showTooltip(event, { sub, year: y, cap, net, res, c, hasReverse, uIR, invProjects })}
                        onMouseLeave={hideTooltip}>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                          <span style={{
                            display: 'inline-block', minWidth: 42, textAlign: 'center',
                            background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                            padding: '2px 3px', borderRadius: 3,
                            fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 10,
                            cursor: 'default', transition: 'box-shadow .08s',
                            boxShadow: isHovered ? `0 0 0 2px var(--accent)` : 'none',
                          }}>
                            {Math.round(rR * 100)}%
                          </span>
                          {/* Injection indicator dot */}
                          {hasReverse && (
                            <span style={{
                              width: 4, height: 4, borderRadius: '50%',
                              background: 'var(--inj)', display: 'block',
                            }} title={`Inversion: ${(uIR*100).toFixed(0)}%`} />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ padding: '8px 18px', background: 'var(--bg-muted)', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 14 }}>
        {Object.entries(ALERT_CONFIG).filter(([k]) => ['ok','caution','warning','critical'].includes(k)).map(([k, c]) => (
          <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: c.text }}>
            <span style={{ background: c.bg, border: `1px solid ${c.border}`, width: 10, height: 10, borderRadius: 2, display: 'inline-block' }} />
            {c.label}&nbsp;{k === 'ok' ? '<70%' : k === 'caution' ? '70–85%' : k === 'warning' ? '85–100%' : '≥100%'}
          </span>
        ))}
        <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto', fontStyle: 'italic' }}>Conditionnels exclus</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--inj)' }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--inj)', display: 'inline-block' }} />
          Inversion de flux
        </span>
      </div>
      {tooltip && createPortal(<SaturationTooltip tooltip={tooltip} />, document.body)}
    </div>
  );
}

function SaturationTooltip({ tooltip }) {
  const { sub, year, cap, net, res, c, hasReverse, uIR, invProjects, position } = tooltip;
  return (
    <div
      className="sat-tooltip"
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        transform: position.placement === 'above' ? 'translateY(-100%)' : 'none',
        width: 220,
      }}
    >
      <p style={{ fontWeight: 800, marginBottom: 5, fontFamily: 'var(--font-mono)', fontSize: 11 }}>{sub.name} · {year}</p>
      <p style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Cap. dir. N-1 : <strong style={{ color: 'var(--text-primary)' }}>{f1(cap)} MVA</strong></p>
      <p style={{ color: 'var(--text-muted)', marginBottom: 2 }}>Charge rigide : <strong style={{ color: c.text }}>{f1(net)} MVA</strong></p>
      <p style={{ color: res < 0 ? 'var(--red)' : res < 5 ? 'var(--amber)' : 'var(--green)', fontWeight: 700 }}>
        Résiduel prél. : {f1(res)} MVA
      </p>
      {(hasReverse || uIR > 0) && (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
          <p style={{ color: 'var(--inj)', fontWeight: 700, fontSize: 10 }}>
            Injection : {(uIR*100).toFixed(0)}% util. inv.
            {hasReverse && <span style={{ marginLeft: 3 }}>← inversion</span>}
          </p>
        </div>
      )}
      {invProjects.length > 0 && (
        <p style={{ fontSize: 9, color: 'var(--accent)', borderTop: '1px solid var(--border)', paddingTop: 3, marginTop: 3 }}>
          Projet : {invProjects.map(p => p.name).join(', ')}
        </p>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export function Overview({ substations, onNavigate }) {
  const projects = useProjects();
  const active = substations.filter(s => s.status !== 'hors_service');

  const criticals = active.filter(s =>
    YEARS.some(y => getAlertLevel(getUtilizationWithdrawalRigid(s, y, projects)) === 'critical')
  );
  const warnings = active.filter(s =>
    YEARS.some(y => getAlertLevel(getUtilizationWithdrawalRigid(s, y, projects)) === 'warning') &&
    !YEARS.some(y => getAlertLevel(getUtilizationWithdrawalRigid(s, y, projects)) === 'critical')
  );

  const qStats = getGlobalQueueStats(substations, projects);
  const expiryUrgent = qStats.expired + qStats.expiringSoon;

  const satByYear = YEARS.map(y =>
    active.filter(s => getAlertLevel(getUtilizationWithdrawalRigid(s, y, projects)) === 'critical').length
  );

  // Injection: substations with reverse flow or approaching it
  const reverseFlowNow = active.filter(s => getInjectionRigid(s, 2026, false, projects) < 0);
  const reverseFlowHorizon = active.filter(s =>
    YEARS.some(y => getInjectionRigid(s, y, false, projects) < 0)
  );
  const injSaturation = active.filter(s => getFirstInjectionSaturationYear(s, projects) !== null);

  const expiredItems = active.flatMap(sub => {
    const { queue } = getQueueAnalysis(sub, projects);
    return queue
      .filter(item => item.expiry.status === 'expiré' || item.expiry.status === 'bientôt')
      .map(item => ({ ...item, sub }));
  }).sort((a, b) => (a.expiry.daysLeft ?? 0) - (b.expiry.daysLeft ?? 0));

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div>
        <h2 className="page-title">Tableau de bord réseau</h2>
        <p className="page-subtitle">
          Province de Liège · {active.length} sous-stations actives · Horizon 2026–2035
        </p>
      </div>

      {/* KPI strip — 5 columns including injection */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        <KpiStrip label="Sous-stations" value={active.length}
          sub={`${substations.length} au total`} delay={0} />
        <KpiStrip label="Saturées prél. N-1" value={criticals.length}
          alert={criticals.length > 0 ? 'red' : null}
          color={criticals.length > 0 ? 'var(--red)' : 'var(--green)'}
          sub={criticals.length > 0 ? criticals.map(s => s.name).join(', ') : 'Aucune saturation'}
          sparkValues={satByYear} delay={40}
          onClick={criticals.length > 0 ? () => onNavigate(criticals[0].id) : null} />
        <KpiStrip label="Alerte prél." value={warnings.length}
          alert={warnings.length > 0 ? 'orange' : null}
          color={warnings.length > 0 ? 'var(--amber)' : 'var(--green)'}
          sub={warnings.length > 0 ? warnings.map(s => s.name).join(', ') : 'Aucune alerte'}
          delay={80}
          onClick={warnings.length > 0 ? () => onNavigate(warnings[0].id) : null} />
        <KpiStrip label="Inversion de flux" value={reverseFlowNow.length}
          alert={reverseFlowNow.length > 0 ? 'orange' : null}
          color={reverseFlowNow.length > 0 ? 'var(--inj)' : 'var(--green)'}
          sub={reverseFlowHorizon.length > reverseFlowNow.length
            ? `${reverseFlowHorizon.length} SS à l'horizon`
            : reverseFlowNow.length > 0
              ? reverseFlowNow.map(s => s.name).join(', ')
              : 'Aucune inversion'}
          delay={120} />
        <KpiStrip label="Réservations urgentes" value={expiryUrgent}
          alert={expiryUrgent > 0 ? 'orange' : null}
          color={expiryUrgent > 0 ? 'var(--amber)' : 'var(--green)'}
          sub={expiryUrgent > 0
            ? `${qStats.expired} expirée(s) · ${qStats.expiringSoon} bientôt`
            : 'Toutes réservations valides'}
          delay={160} />
      </div>

      {/* Expired reservations alert */}
      {expiredItems.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border)', background: 'var(--amber-dim)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>Réservations à traiter en priorité</h3>
              <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 2 }}>
                Expirées ou expirant sous 90 jours — action GRD requise
              </p>
            </div>
          </div>
          <div>
            {expiredItems.slice(0, 5).map(item => (
              <div key={item.req.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 18px', borderBottom: '1px solid var(--border)', transition: 'background .08s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; }}>
                <ExpiryChip expiry={item.expiry} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>{getCustomer(item.req).client?.name || item.req.id}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 10, margin: '0 5px' }}>·</span>
                  <button onClick={() => onNavigate(item.sub.id, 'file')}
                    style={{ color: 'var(--accent)', fontSize: 10, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                    {item.sub.name}
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                  <DecisionBadge decision={item.decision} size="xs" />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>{f1(reqClientPrelevTotal(item.req))} MVA</span>
                  <button onClick={() => onNavigate(item.sub.id, 'file')} className="btn-edit-link" style={{ fontSize: 10 }}>Traiter →</button>
                </div>
              </div>
            ))}
            {expiredItems.length > 5 && (
              <div style={{ padding: '6px 18px', fontSize: 10, color: 'var(--text-muted)', background: 'var(--bg-muted)', textAlign: 'center' }}>
                +{expiredItems.length - 5} autre(s)
              </div>
            )}
          </div>
        </div>
      )}

      {/* Saturation matrix — HERO */}
      <SaturationMatrix substations={substations} onNavigate={onNavigate} />

      {/* Critical substations */}
      {criticals.length > 0 && (
        <div>
          <h3 style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 10 }}>
            Sous-stations en saturation (charge rigide)
          </h3>
          <div className="space-y-2">
            {criticals.map(s => {
              const sat = getFirstWithdrawalSaturation(s, projects);
              return (
                <div key={s.id} style={{ background: ALERT_CONFIG.critical.bg, border: `1px solid ${ALERT_CONFIG.critical.border}`, borderRadius: 8, padding: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 13 }}>{s.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-muted)' }}>{s.code}</span>
                    </div>
                    <p style={{ fontSize: 11, marginTop: 3, color: ALERT_CONFIG.critical.text }}>
                      Saturation rigide en <strong>{sat}</strong> · Résiduel :&nbsp;
                      <strong style={{ fontFamily: 'var(--font-mono)' }}>{f1(getResidualWithdrawalRigid(s, sat || 2026, projects))} MVA</strong>
                      {!projects.some(p => p.status !== 'annulé' && (p.effects || []).some(e => e.ssId === s.id)) &&
                        <span style={{ marginLeft: 6, fontWeight: 600 }}>· Aucun projet planifié</span>}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <AlertBadge level="critical" />
                    <button onClick={() => onNavigate(s.id)}
                      style={{ color: 'var(--accent)', fontSize: 11, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      Détail →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
