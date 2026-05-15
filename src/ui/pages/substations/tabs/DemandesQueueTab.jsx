/**
 * DemandesQueueTab.jsx — v2.0
 * Slim orchestrator: KPIs, FIFO table, archive section.
 * QueueRow + ResidualPair extracted to components/QueueRow.jsx.
 *
 * Original: 548 lines → Now: ~280 lines
 */
import React, { useState } from 'react';
import {
  CONNECTED_RETENTION_DEFAULT_MONTHS,
  YEARS,
  DECISION_CONFIG,
} from '../../../../constants/index.js';
import { f1 } from '../../../../utils/format.js';
import { useProjects } from '../../../App.jsx';
import { getCapacityAtYear } from '../../../../engines/capacity.js';
import {
  getWithdrawalBaseNet,
  getResidualWithdrawalRigid,
  getResidualInjectionRigid,
} from '../../../../engines/directionalSubstation.js';
import {
  getQueueAnalysis,
  reqGrdInjFerme,
  getEffectiveRigidReservation,
} from '../../../../engines/queue.js';
import { getCapacityImpact } from '../../../../engines/requests.js';
import { normalizeRequest, getCustomer, getOffer } from '../../../../engines/requestModel.js';
import { DecisionBadge, ExpiryChip, StatusPhaseBadge, Tag } from '../../../shared/badges.jsx';
import { ArchiveModal } from './ArchiveModal.jsx';
import { QueueRow } from './components/QueueRow.jsx';

export function DemandesQueueTab({ sub, onAdd, onEdit, onDelete, onUpdate, onNavigateToRequest }) {
  const projects = useProjects();
  const { queue, conditionals, cancelled, fifoAlerts } = getQueueAnalysis(sub, projects);
  const [archiveModal, setArchiveModal] = useState(null);

  // KPIs
  const drafts = (sub.connectionRequests || []).filter((r) => {
    const impact = getCapacityImpact(r);
    return (
      impact === 'NONE' &&
      getCustomer(r).status === 'incomplete' &&
      !(r.conditionedOnProjectIds?.length > 0)
    );
  });
  const allActive = sub.connectionRequests.filter((r) => getOffer(r).status !== 'offer_cancelled');
  const totalWFerme = queue.reduce((s, i) => s + getEffectiveRigidReservation(i.req), 0);
  const totalIFerme = queue.reduce((s, i) => s + reqGrdInjFerme(i.req), 0);
  const resW2026 = getResidualWithdrawalRigid(sub, 2026, projects);
  const resI2026 = getResidualInjectionRigid(sub, 2026, projects);
  const expAlerts = queue.filter(
    (i) => i.expiry.status === 'expiré' || i.expiry.status === 'bientôt',
  );

  // Sparkline
  const sparkVals = YEARS.map((y) => {
    const cap = getCapacityAtYear(sub, y, projects);
    const base = getWithdrawalBaseNet(sub, y, projects);
    return +(
      cap -
      base -
      queue
        .filter((i) => (getCustomer(i.req).requested?.year || 2026) <= y)
        .reduce((s, i) => s + getEffectiveRigidReservation(i.req), 0)
    ).toFixed(1);
  });
  const spMin = Math.min(...sparkVals),
    spMax = Math.max(...sparkVals, 0.1);
  const spRange = spMax - spMin || 1;
  const spW = 100,
    spH = 28;
  const spPts = sparkVals
    .map(
      (v, i) =>
        `${(i / (YEARS.length - 1)) * spW},${spH - ((v - spMin) / spRange) * (spH - 4) + 2}`,
    )
    .join(' ');

  // Archive handlers
  const handleArchive = (req, targetStatus) => {
    setArchiveModal({ req, targetStatus });
  };

  const confirmArchive = () => {
    if (!archiveModal) return;
    const { req, targetStatus } = archiveModal;
    const today = new Date().toISOString().slice(0, 10);
    const updatedReqs = sub.connectionRequests.map((r) => {
      if (r.id !== req.id) return r;
      const offer = getOffer(r);
      const patch =
        targetStatus === 'raccordée'
          ? {
              status: 'offer_connected',
              connectedAt: today,
              connectedRetentionMonths:
                offer.connectedRetentionMonths ?? CONNECTED_RETENTION_DEFAULT_MONTHS,
            }
          : { status: 'offer_cancelled', cancelledAt: today };
      return normalizeRequest(
        {
          ...r,
          offer: { ...offer, ...patch },
        },
        sub.id,
      );
    });
    onUpdate({ ...sub, connectionRequests: updatedReqs });
    setArchiveModal(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="fade-in">
      {/* FIFO alert */}
      {fifoAlerts.length > 0 && (
        <div
          style={{
            background: 'var(--amber-dim)',
            border: '1.5px solid rgba(217,119,6,.3)',
            borderRadius: 10,
            padding: '10px 16px',
          }}
        >
          <p
            style={{
              fontSize: 10,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '.07em',
              color: 'var(--amber)',
              marginBottom: 6,
            }}
          >
            ⚠ Ordre FIFO non respecté
          </p>
          {fifoAlerts.map((a, i) => (
            <p key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <strong>{getCustomer(a.req).client?.name}</strong> est étudiée alors que{' '}
              <strong>{a.blockedBy.map((r) => getCustomer(r).client?.name).join(', ')}</strong>{' '}
              {a.blockedBy.length > 1 ? 'sont' : 'est'} encore en étude (dépôt antérieur).
            </p>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
        <div className="metric-box">
          <div className="metric-box__label">Demandes actives</div>
          <div className="metric-box__value">{allActive.length}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
            {queue.length} en file
          </div>
        </div>
        <div className="metric-box" style={{ borderLeft: '3px solid var(--prelev)' }}>
          <div className="metric-box__label">Réservé prél.</div>
          <div className="metric-box__value" style={{ color: 'var(--prelev)' }}>
            {f1(totalWFerme)} MVA
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>ferme cumulé</div>
        </div>
        <div className="metric-box" style={{ borderLeft: '3px solid var(--inj)' }}>
          <div className="metric-box__label">Réservé inj.</div>
          <div className="metric-box__value" style={{ color: 'var(--inj)' }}>
            {f1(totalIFerme)} MVA
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>ferme cumulé</div>
        </div>
        <div className="metric-box">
          <div className="metric-box__label">Résiduel prél. 2026</div>
          <div
            className="metric-box__value"
            style={{
              color: resW2026 < 0 ? 'var(--red)' : resW2026 < 5 ? 'var(--amber)' : 'var(--green)',
            }}
          >
            {f1(resW2026)} MVA
          </div>
          <div
            style={{ marginTop: 4 }}
            title={YEARS.map((y, i) => `${y}: ${sparkVals[i]} MVA`).join(' | ')}
          >
            <svg width={spW} height={spH} style={{ overflow: 'visible' }}>
              <polyline
                points={spPts}
                fill="none"
                stroke={spMin < 0 ? 'var(--red)' : 'var(--green)'}
                strokeWidth="1.5"
              />
              {sparkVals.map(
                (v, i) =>
                  v < 0 && (
                    <circle
                      key={i}
                      cx={(i / (YEARS.length - 1)) * spW}
                      cy={spH - ((v - spMin) / spRange) * (spH - 4) + 2}
                      r="2.5"
                      fill="var(--red)"
                    />
                  ),
              )}
            </svg>
          </div>
        </div>
        <div className="metric-box" style={{ borderLeft: '3px solid var(--inj)' }}>
          <div className="metric-box__label">Résiduel inj. 2026</div>
          <div
            className="metric-box__value"
            style={{
              color: resI2026 < 0 ? 'var(--red)' : resI2026 < 5 ? 'var(--amber)' : 'var(--inj)',
            }}
          >
            {f1(resI2026)} MVA
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>cap. inverse</div>
        </div>
        <div
          className="metric-box"
          style={{
            borderLeft: expAlerts.length > 0 ? '3px solid var(--amber)' : '3px solid var(--green)',
          }}
        >
          <div className="metric-box__label">Péremptions</div>
          <div
            className="metric-box__value"
            style={{ color: expAlerts.length > 0 ? 'var(--amber)' : 'var(--green)' }}
          >
            {expAlerts.length}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
            expirées ou &lt;90j
          </div>
        </div>
      </div>

      {/* Expiry alerts */}
      {expAlerts.length > 0 && (
        <div
          style={{
            background: 'var(--amber-dim)',
            border: '1px solid rgba(217,119,6,.25)',
            borderRadius: 10,
            padding: '10px 14px',
          }}
        >
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '.07em',
              color: 'var(--amber)',
              marginBottom: 6,
            }}
          >
            Réservations à traiter
          </p>
          {expAlerts.map((item) => (
            <div
              key={item.req.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 3,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 500 }}>
                {getCustomer(item.req).client?.name}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ExpiryChip expiry={item.expiry} />
                <button
                  className="btn-edit-link"
                  style={{ fontSize: 11 }}
                  onClick={() => onEdit(item.req)}
                >
                  Traiter →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div
          style={{
            padding: '11px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              File d'attente FIFO
            </p>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
              Résiduel calculé cumulativement
            </span>
          </div>
          <button
            className="btn-primary"
            style={{ fontSize: 12, padding: '6px 14px' }}
            onClick={onAdd}
          >
            + Nouvelle demande
          </button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-muted)' }}>
              {[
                { l: '#', al: 'center', w: 32 },
                { l: 'Demandeur', al: 'left' },
                { l: 'Client', al: 'right', w: 90 },
                { l: 'GRD', al: 'right', w: 110 },
                { l: 'Résiduel ⬆/⬇', al: 'center', w: 160 },
                { l: 'Réservation', al: 'center', w: 100 },
                { l: 'Décision', al: 'center', w: 90 },
                { l: '', al: 'right', w: 80 },
              ].map((h) => (
                <th
                  key={h.l}
                  style={{
                    padding: '8px 10px',
                    textAlign: h.al,
                    width: h.w || undefined,
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '.08em',
                    color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--border)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h.l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {queue.length === 0 && conditionals.length === 0 && drafts.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  style={{
                    textAlign: 'center',
                    padding: '40px',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                  }}
                >
                  Aucune demande active. Cliquez « + Nouvelle demande » pour commencer.
                </td>
              </tr>
            )}
            {queue.map((item) => (
              <QueueRow
                key={item.req.id}
                item={item}
                onEdit={onEdit}
                onArchive={handleArchive}
                onDelete={onDelete}
                onOpenDossier={
                  onNavigateToRequest ? () => onNavigateToRequest(sub.id, item.req.id) : null
                }
              />
            ))}

            {/* Conditionals */}
            {conditionals.length > 0 && (
              <>
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: '7px 18px',
                      background: 'var(--bg-muted)',
                      borderTop: '1px solid var(--border)',
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '.07em',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Conditionnels — hors file, non réservés
                  </td>
                </tr>
                {conditionals.map((item) => (
                  <tr key={item.req.id} className="data-row" style={{ opacity: 0.65 }}>
                    <td
                      style={{
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13,
                        padding: '8px 10px',
                      }}
                    >
                      —
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <div
                        style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}
                      >
                        {getCustomer(item.req).client?.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                        <Tag v={getCustomer(item.req).client?.type} />
                      </div>
                    </td>
                    <td colSpan={4} />
                    <td style={{ textAlign: 'center', padding: '8px 8px' }}>
                      <DecisionBadge decision="conditionnel" size="xs" />
                    </td>
                    <td style={{ textAlign: 'right', paddingRight: 12 }}>
                      <button
                        className="btn-edit-link"
                        style={{ fontSize: 11 }}
                        onClick={() => onEdit(item.req)}
                      >
                        Modifier
                      </button>
                    </td>
                  </tr>
                ))}
              </>
            )}

            {/* Brouillons */}
            {drafts.length > 0 && (
              <>
                <tr>
                  <td
                    colSpan={8}
                    style={{
                      padding: '7px 18px',
                      background: 'var(--bg-muted)',
                      borderTop: '1px solid var(--border)',
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '.07em',
                      color: 'var(--text-muted)',
                    }}
                  >
                    Brouillons — à compléter
                  </td>
                </tr>
                {drafts.map((req) => (
                  <tr key={req.id} className="data-row" style={{ opacity: 0.6 }}>
                    <td
                      style={{
                        textAlign: 'center',
                        color: 'var(--text-muted)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13,
                        padding: '8px 10px',
                      }}
                    >
                      —
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: 'var(--text-muted)',
                          fontStyle: 'italic',
                        }}
                      >
                        {getCustomer(req).client?.name || '(sans titre)'}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                        <Tag v={getCustomer(req).client?.type} />
                        <StatusPhaseBadge req={req} size="xs" />
                      </div>
                    </td>
                    <td colSpan={5} />
                    <td style={{ textAlign: 'right', paddingRight: 12 }}>
                      <button
                        className="btn-edit-link"
                        style={{ fontSize: 11 }}
                        onClick={() => onEdit(req)}
                      >
                        Modifier
                      </button>
                      <button
                        className="btn-danger-link"
                        style={{ fontSize: 11, marginLeft: 8 }}
                        onClick={() => onDelete(req)}
                      >
                        Suppr.
                      </button>
                    </td>
                  </tr>
                ))}
              </>
            )}
          </tbody>
        </table>

        {/* Legend */}
        <div
          style={{
            padding: '8px 18px',
            background: 'var(--bg-muted)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 14,
            alignItems: 'center',
          }}
        >
          {Object.entries(DECISION_CONFIG).map(([k, c]) => (
            <span
              key={k}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 10,
                color: 'var(--text-muted)',
              }}
            >
              <span style={{ color: c.color, fontWeight: 800 }}>{c.icon}</span> {c.label}
            </span>
          ))}
          <span
            style={{
              marginLeft: 'auto',
              fontSize: 10,
              color: 'var(--text-muted)',
              fontStyle: 'italic',
            }}
          >
            Décision auto · override via Modifier
          </span>
        </div>
      </div>

      {/* Cancelled */}
      {cancelled.length > 0 && (
        <details>
          <summary
            style={{
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '.06em',
              color: 'var(--text-muted)',
              padding: '8px 0',
              listStyle: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            ▶ Annulées ({cancelled.length})
          </summary>
          <div className="card" style={{ marginTop: 8, overflow: 'hidden', opacity: 0.7 }}>
            {cancelled.map((item) => (
              <div
                key={item.req.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>✕</span>
                <div style={{ flex: 1 }}>
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      textDecoration: 'line-through',
                    }}
                  >
                    {getCustomer(item.req).client?.name}
                  </span>
                </div>
                <Tag v={getCustomer(item.req).client?.type} />
                <button
                  className="btn-edit-link"
                  style={{ fontSize: 11 }}
                  onClick={() => onEdit(item.req)}
                >
                  Réactiver
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Archive modal */}
      <ArchiveModal
        archiveModal={archiveModal}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveModal(null)}
      />
    </div>
  );
}
