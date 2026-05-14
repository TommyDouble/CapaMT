/**
 * CasePowerComparison — Traçabilité compacte des puissances.
 * Le résumé métier reste dans les cartes workflow; ce bloc explique les
 * valeurs utilisées par les moteurs.
 */
import React, { useState } from 'react';
import { f1 } from '../../../../utils/format.js';
import { INJ_SOURCE_ICONS, PREV_USAGE_ICONS, getFoisonnement } from '../../../../constants/index.js';
import { computeCapacityImpact } from '../../../../engines/capacityImpact.js';
import {
  getAssessment,
  getCustomer,
  getRequestedInjection,
  getRequestedLoad,
} from '../../../../engines/requestModel.js';

const IMPACT_LABELS = {
  NONE: 'Aucun impact',
  QUEUE_RESERVED: 'File réservée',
  STUDY_RESERVED: 'Étude réservée',
  ACQUIRED: 'Acquise',
  RELEASED: 'Libérée',
  CONNECTED_RESERVED: 'Raccordé maintenu',
  CONNECTED_RELEASED: 'Raccordé libéré',
};

const SOURCE_LABELS = {
  NONE: 'Aucune',
  CUSTOMER_REQUEST: 'Demande client',
  TECHNICAL_RESPONSE: 'Réponse technique',
  OFFER_ACCEPTED: 'Offre acceptée',
  CONNECTED_RETENTION: 'Maintien raccordé',
  CONNECTED_MANUAL_RELEASE: 'Libération manuelle raccordé',
  RETENTION_ENDED: 'Maintien raccordé expiré',
  CUSTOMER_CANCELLATION: 'Libération client',
  BASELINE_UPDATED: 'Baseline mise à jour',
  BASELINE: 'Baseline raccordée',
};

function mva(value) {
  return `${f1(value)} MVA`;
}

function splitValue(split, fallback = 'Étude non finalisée') {
  if (!split || split.status === 'PENDING') return fallback;
  return `P ${f1(split.permanent)} / F ${f1(split.flexible)} MVA`;
}

function impactValue(permanent, flexible, impactStatus) {
  const total = Number(permanent || 0) + Number(flexible || 0);
  if (total <= 0) return IMPACT_LABELS[impactStatus] || 'Aucun impact';
  return `P ${f1(permanent)} / F ${f1(flexible)} MVA`;
}

function permanentDelta(requested, split) {
  if (!split || split.status === 'PENDING') return null;
  return Number(split.permanent || 0) - Number(requested || 0);
}

function DeltaCell({ value }) {
  if (value == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const color = value < -0.05 ? 'var(--prelev)' : value > 0.05 ? 'var(--inj)' : 'var(--text-secondary)';
  const prefix = value > 0.05 ? '+' : '';
  return (
    <span className="mono" style={{ color, fontWeight: 800 }}>
      {prefix}{mva(value)}
    </span>
  );
}

function TraceRow({ label, requested, split, impactPermanent, impactFlexible, impactStatus }) {
  return (
    <tr>
      <td style={tdStyle}>
        <span style={{ fontWeight: 800, color: label === 'Injection' ? 'var(--inj)' : 'var(--prelev)' }}>{label}</span>
      </td>
      <td style={tdStyle} className="mono">{mva(requested)}</td>
      <td style={tdStyle} className="mono">{splitValue(split)}</td>
      <td style={tdStyle} className="mono">{impactValue(impactPermanent, impactFlexible, impactStatus)}</td>
      <td style={tdStyle}><DeltaCell value={permanentDelta(requested, split)} /></td>
    </tr>
  );
}

const thStyle = {
  textAlign: 'left',
  padding: '9px 10px',
  borderBottom: '1px solid var(--border)',
  fontSize: 10,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: 'var(--text-muted)',
  background: 'var(--bg-muted)',
};

const tdStyle = {
  padding: '9px 10px',
  borderBottom: '1px solid var(--border)',
  fontSize: 12,
  color: 'var(--text-secondary)',
  verticalAlign: 'top',
};

function DetailList({ title, items, kind }) {
  if (!items || items.length === 0) return (
    <div style={detailBoxStyle}>
      <p style={detailTitleStyle}>{title}</p>
      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>Aucun détail encodé.</p>
    </div>
  );

  return (
    <div style={detailBoxStyle}>
      <p style={detailTitleStyle}>{title}</p>
      <div style={{ display: 'grid', gap: 5 }}>
        {items.map((item, index) => {
          const icon = kind === 'load'
            ? (PREV_USAGE_ICONS[item.type] || '•')
            : (INJ_SOURCE_ICONS[item.source] || '•');
          const label = item.label || item.type || item.source || 'Composant';
          const flag = kind === 'load'
            ? (item.flexible ? 'flexible' : 'ferme')
            : (item.curtailable ? 'curtailable' : 'garantie');
          return (
            <div key={item.id || index} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
              <span>{icon} {label} · {flag}</span>
              <span className="mono" style={{ fontWeight: 800 }}>{mva(item.powerMva)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const detailBoxStyle = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: 10,
  background: 'var(--bg-muted)',
};

const detailTitleStyle = {
  fontSize: 10,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
  color: 'var(--text-muted)',
  marginBottom: 7,
};

function impactRule(impact) {
  if (impact.status === 'QUEUE_RESERVED') return 'Dossier en file: la réservation active provient de la puissance demandée par le client.';
  if (impact.status === 'STUDY_RESERVED') return 'Étude finalisée: la réservation active provient de la réponse technique.';
  if (impact.status === 'ACQUIRED') return 'Offre acceptée: la capacité reste acquise jusqu’au raccordement.';
  if (impact.status === 'RELEASED') return 'Dossier annulé ou refusé: la capacité est libérée.';
  if (impact.status === 'CONNECTED_RESERVED') return 'Dossier raccordé: la capacité reste maintenue temporairement.';
  if (impact.status === 'CONNECTED_RELEASED') return 'Dossier raccordé: le délai de maintien est dépassé et l’impact est nul.';
  return 'Dossier incomplet ou sans impact capacitaire actif.';
}

export function CasePowerComparison({ req, sub }) {
  const [showDetail, setShowDetail] = useState(false);
  const customer = getCustomer(req);
  const assessment = getAssessment(req);
  const impact = computeCapacityImpact(req);
  const requestedLoad = getRequestedLoad(req);
  const requestedInjection = getRequestedInjection(req);
  const type = customer.client?.type || 'autre';
  const foisonnement = getFoisonnement({ ...req, type }, sub);
  const loadImpactFoisoned = (impact.reservedLoadPermanent || 0) * foisonnement;
  const injectionImpactFoisoned = (impact.reservedInjectionPermanent || 0) * foisonnement;

  const hasLoad = requestedLoad > 0;
  const hasInjection = requestedInjection > 0;

  return (
    <div className="card" style={{ padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--accent)' }}>
            Traçabilité des puissances
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
            Demande client, réponse technique et impact réellement compté.
          </p>
        </div>
        <button type="button" onClick={() => setShowDetail(s => !s)}
          style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
          {showDetail ? 'Réduire' : 'Détail calcul'}
        </button>
      </div>

      <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
          <thead>
            <tr>
              <th style={thStyle}>Sens</th>
              <th style={thStyle}>Demandé client</th>
              <th style={thStyle}>Accordé étude</th>
              <th style={thStyle}>Réservé / impact actif</th>
              <th style={thStyle}>Écart</th>
            </tr>
          </thead>
          <tbody>
            {hasLoad && (
              <TraceRow
                label="Prélèvement"
                requested={requestedLoad}
                split={assessment.final?.load}
                impactPermanent={impact.reservedLoadPermanent}
                impactFlexible={impact.reservedLoadFlexible}
                impactStatus={impact.status}
              />
            )}
            {hasInjection && (
              <TraceRow
                label="Injection"
                requested={requestedInjection}
                split={assessment.final?.injection}
                impactPermanent={impact.reservedInjectionPermanent}
                impactFlexible={impact.reservedInjectionFlexible}
                impactStatus={impact.status}
              />
            )}
            {!hasLoad && !hasInjection && (
              <tr>
                <td colSpan={5} style={{ ...tdStyle, color: 'var(--text-muted)' }}>Aucune puissance demandée.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showDetail && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 12 }}>
          <DetailList title="Détail usages client" items={customer.powerBreakdown?.load || []} kind="load" />
          <DetailList title="Détail sources injection" items={customer.powerBreakdown?.injection || []} kind="injection" />
          <div style={detailBoxStyle}>
            <p style={detailTitleStyle}>Foisonnement et source</p>
            <div style={{ display: 'grid', gap: 5, fontSize: 11, color: 'var(--text-secondary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>Coefficient {type}</span>
                <span className="mono" style={{ fontWeight: 800 }}>×{foisonnement.toFixed(2)}</span>
              </div>
              {hasLoad && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>Impact prélèvement foisonné</span>
                  <span className="mono" style={{ fontWeight: 800 }}>{mva(loadImpactFoisoned)}</span>
                </div>
              )}
              {hasInjection && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>Impact injection foisonné</span>
                  <span className="mono" style={{ fontWeight: 800 }}>{mva(injectionImpactFoisoned)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>Statut impact</span>
                <span style={{ fontWeight: 800 }}>{IMPACT_LABELS[impact.status] || impact.status}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>Source</span>
                <span style={{ fontWeight: 800 }}>{SOURCE_LABELS[impact.source] || impact.source}</span>
              </div>
              <p style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                {impactRule(impact)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
