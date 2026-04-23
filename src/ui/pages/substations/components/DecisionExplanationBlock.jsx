/**
 * DecisionExplanationBlock.jsx — Displays structured decision explanation.
 * Consumes buildDecisionExplanation from the engine, performs no calculations.
 * Extracted from EditRequestPanel.
 */
import React from 'react';
import { buildDecisionExplanation } from '../../../../engines/explanation.js';
import { f1 } from '../../../../utils/format.js';

export function DecisionExplanationBlock({ sub, form, projects, grdForm, onApply }) {
  const exp = buildDecisionExplanation(sub, form, projects);
  if (!exp) return null;

  const { verdictKey, verdictLabel, decisionFactors, recommendation,
    engagedSummary, projectImpact, residual, canFullFerme, noRigid } = exp;

  const borderColor = canFullFerme ? '#bbf7d0' : noRigid ? '#fecaca' : '#fde68a';
  const bgColor     = canFullFerme ? '#f0fdf4' : noRigid ? '#fef2f2' : '#fffbeb';
  const titleColor  = canFullFerme ? '#166534' : noRigid ? '#7f1d1d' : '#92400e';
  const icon        = canFullFerme ? '✓' : noRigid ? '✕' : '⚠';

  const gF  = parseFloat(grdForm?.prelevFerme) || 0;
  const gFl = parseFloat(grdForm?.prelevFlexible) || 0;
  const already = Math.abs(gF - recommendation.ferme) < 0.05
    && Math.abs(gFl - recommendation.flexible) < 0.05;

  const factors = Object.entries(decisionFactors)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => ({ key: k, ...v }));

  return (
    <div style={{ border: `1.5px solid ${borderColor}`, background: bgColor,
      borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase',
          letterSpacing: '.06em', color: titleColor, marginBottom: 8 }}>
          {icon} {verdictLabel}
        </p>
        {!already ? (
          <button type="button"
            onClick={() => onApply(recommendation.ferme, recommendation.flexible,
              recommendation.injFerme, recommendation.injFlex)}
            style={{ background: 'var(--navy)', color: '#fff', border: 'none',
              padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, whiteSpace: 'nowrap' }}>
            ↓ Appliquer
          </button>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', flexShrink: 0 }}>
            Déjà appliqué
          </span>
        )}
      </div>

      {/* Key factors grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', fontSize: 12, marginBottom: 8 }}>
        {factors.map(f => (
          <span key={f.key} style={{ color: 'var(--text-secondary)' }}>
            {f.label} :&nbsp;
            <strong className="mono" style={{
              color: (f.key === 'residualWithdrawal' || f.key === 'residual')
                ? (residual <= 0 ? '#dc2626' : residual < 5 ? '#d97706' : '#059669')
                : f.key === 'engagedRigid' ? '#dc2626' : 'var(--text-primary)'
            }}>
              {typeof f.value === 'number' ? f1(f.value) : f.value} {f.unit ?? ''}
            </strong>
            {f.detail && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>({f.detail})</span>}
          </span>
        ))}
      </div>

      {/* Engaged reservations */}
      {engagedSummary.count > 0 && (
        <div style={{ borderTop: '1px solid rgba(0,0,0,.06)', paddingTop: 8, marginTop: 4 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
            Réservations déjà engagées ({engagedSummary.count}) :
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {engagedSummary.requests.map(r => (
              <span key={r.id} style={{ fontSize: 11, background: 'rgba(0,0,0,.05)',
                padding: '2px 8px', borderRadius: 20, color: 'var(--text-secondary)' }}>
                {r.name} <span className="mono" style={{ color: '#dc2626' }}>
                  {(r.wFirmReserved ?? r.reservedRigid ?? 0) > 0 ? `${f1(r.wFirmReserved ?? r.reservedRigid)} MVA` : ''}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Project impact */}
      {projectImpact.hasImpact && (
        <p style={{ fontSize: 11, color: '#1d4ed8', marginTop: 8, borderTop: '1px solid rgba(0,0,0,.06)', paddingTop: 6 }}>
          Capacité augmentée de {f1(projectImpact.deltaMVA)} MVA grâce aux projets réseau planifiés
          {projectImpact.appliedProjects.length > 0 &&
            ` (${projectImpact.appliedProjects.map(p => p.name).join(', ')})`}.
        </p>
      )}

      {/* Recommended GRD offer */}
      {(recommendation.ferme > 0 || recommendation.flexible > 0) && (
        <div style={{ marginTop: 8, borderTop: '1px solid rgba(0,0,0,.06)', paddingTop: 8,
          display: 'flex', gap: 16, fontSize: 12, flexWrap: 'wrap' }}>
          <span style={{ color: '#1d4ed8', fontWeight: 700 }}>
            Offre GRD recommandée : <span className="mono">{f1(recommendation.ferme)} MVA ferme</span>
            {recommendation.flexible > 0 &&
              <span style={{ color: '#d97706' }}> + <span className="mono">{f1(recommendation.flexible)} MVA flexible</span></span>}
          </span>
        </div>
      )}
    </div>
  );
}
