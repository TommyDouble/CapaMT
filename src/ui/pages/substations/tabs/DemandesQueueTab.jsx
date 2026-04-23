/**
 * DemandesQueueTab.jsx — v2.0
 * Slim orchestrator: KPIs, FIFO table, archive section.
 * QueueRow + ResidualPair extracted to components/QueueRow.jsx.
 *
 * Original: 548 lines → Now: ~280 lines
 */
import React, { useState } from 'react';
import { YEARS, DECISION_CONFIG } from '../../../../constants/index.js';
import { f1, uid } from '../../../../utils/format.js';
import { safeNum } from '../../../../utils/numbers.js';
import { useProjects } from '../../../App.jsx';
import { getCapacityAtYear } from '../../../../engines/capacity.js';
import { getWithdrawalBaseNet } from '../../../../engines/load.js';
import { getResidualWithdrawalRigid, getResidualInjectionRigid } from '../../../../engines/directionalSubstation.js';
import {
  getQueueAnalysis, getExpiryInfo,
  reqGrdPrelevFerme, reqGrdPrelevFlexible, reqGrdInjFerme, reqGrdInjFlexible,
  getEffectiveRigidReservation,
} from '../../../../engines/queue.js';
import { DecisionBadge, ExpiryChip, Tag } from '../../../shared/badges.jsx';
import { ArchiveModal } from './ArchiveModal.jsx';
import { QueueRow } from './components/QueueRow.jsx';

// ── Small power badge (for completed connections) ─────────────────────────────
function SmallPower({ label, v, color, signed }) {
  return (
    <div style={{ textAlign: 'center', padding: '5px 10px', background: 'var(--bg-raised)',
      border: `1px solid ${color}33`, borderRadius: 8, minWidth: 72 }}>
      <p style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>{label}</p>
      <p style={{ fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-mono)', color }}>
        {signed && v >= 0 ? '+' : ''}{f1(v)} <span style={{ fontSize: 9, fontWeight: 400 }}>MVA</span>
      </p>
    </div>
  );
}

export function DemandesQueueTab({ sub, onAdd, onEdit, onDelete, onUpdate }) {
  const projects = useProjects();
  const { queue, conditionals, cancelled, fifoAlerts } = getQueueAnalysis(sub, projects);
  const [archiveModal, setArchiveModal] = useState(null);
  const [chargeContrib, setChargeContrib] = useState({ prelevMW: '', injMW: '', note: '', effectYear: '' });

  // KPIs
  const allActive = sub.connectionRequests.filter(r => r.status !== 'annulée' && r.status !== 'annulé');
  const totalWFerme = queue.reduce((s, i) => s + getEffectiveRigidReservation(i.req), 0);
  const totalIFerme = queue.reduce((s, i) => s + reqGrdInjFerme(i.req), 0);
  const resW2026 = getResidualWithdrawalRigid(sub, 2026, projects);
  const resI2026 = getResidualInjectionRigid(sub, 2026, projects);
  const expAlerts = queue.filter(i => i.expiry.status === 'expiré' || i.expiry.status === 'bientôt');

  // Sparkline
  const sparkVals = YEARS.map(y => {
    const cap = getCapacityAtYear(sub, y, projects);
    const base = getWithdrawalBaseNet(sub, y, projects);
    return +(cap - base - queue.filter(i => (i.req.yearSouhaitee || i.req.year || 2026) <= y)
      .reduce((s, i) => s + getEffectiveRigidReservation(i.req), 0)).toFixed(1);
  });
  const spMin = Math.min(...sparkVals), spMax = Math.max(...sparkVals, 0.1);
  const spRange = spMax - spMin || 1;
  const spW = 100, spH = 28;
  const spPts = sparkVals.map((v, i) => `${(i / (YEARS.length - 1)) * spW},${spH - (v - spMin) / spRange * (spH - 4) + 2}`).join(' ');

  // Archive handlers
  const handleArchive = (req, targetStatus) => {
    setArchiveModal({ req, targetStatus });
    setChargeContrib({
      prelevMW: reqGrdPrelevFerme(req) > 0 ? String(reqGrdPrelevFerme(req)) : '',
      injMW: reqGrdInjFerme(req) > 0 ? String(reqGrdInjFerme(req)) : '',
      note: `Raccordement ${req.name}`,
      effectYear: String(req.yearSouhaitee || req.year || new Date().getFullYear()),
    });
  };

  const confirmArchive = () => {
    if (!archiveModal) return;
    const { req, targetStatus } = archiveModal;
    const today = new Date().toISOString().slice(0, 10);
    const updatedReqs = sub.connectionRequests.map(r =>
      r.id === req.id ? { ...r, status: targetStatus, raccordementDate: targetStatus === 'raccordée' ? today : r.raccordementDate } : r
    );
    let chargeHistory = [...(sub.chargeHistory || [])];
    if (targetStatus === 'raccordée') {
      const _pMW = parseFloat(chargeContrib.prelevMW);
      const _iMW = parseFloat(chargeContrib.injMW);
      chargeHistory.push({
        id: uid(), date: today,
        effectYear: parseInt(chargeContrib.effectYear) || (req.yearSouhaitee || req.year || new Date().getFullYear()),
        includeInBase: true,
        prelevMW: safeNum(isFinite(_pMW) ? _pMW : reqGrdPrelevFerme(req), 0),
        injMW: safeNum(isFinite(_iMW) ? _iMW : 0, 0),
        note: chargeContrib.note || `Raccordement ${req.name}`,
        reqId: req.id,
        contract: { prelevFerme: reqGrdPrelevFerme(req), prelevFlexible: reqGrdPrelevFlexible(req),
          injFerme: reqGrdInjFerme(req), injFlexible: reqGrdInjFlexible(req),
          decisionGRD: req.grd?.decisionGRD, noteDecision: req.grd?.noteDecision },
      });
    }
    onUpdate({ ...sub, connectionRequests: updatedReqs, chargeHistory });
    setArchiveModal(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="fade-in">
      {/* FIFO alert */}
      {fifoAlerts.length > 0 && (
        <div style={{ background: 'var(--amber-dim)', border: '1.5px solid rgba(217,119,6,.3)', borderRadius: 10, padding: '10px 16px' }}>
          <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--amber)', marginBottom: 6 }}>⚠ Ordre FIFO non respecté</p>
          {fifoAlerts.map((a, i) => (
            <p key={i} style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              <strong>{a.req.name}</strong> est étudiée alors que <strong>{a.blockedBy.map(r => r.name).join(', ')}</strong> {a.blockedBy.length > 1 ? 'sont' : 'est'} encore en étude (dépôt antérieur).
            </p>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
        <div className="metric-box">
          <div className="metric-box__label">Demandes actives</div>
          <div className="metric-box__value">{allActive.length}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{queue.length} en file</div>
        </div>
        <div className="metric-box" style={{ borderLeft: '3px solid var(--prelev)' }}>
          <div className="metric-box__label">Réservé prél.</div>
          <div className="metric-box__value" style={{ color: 'var(--prelev)' }}>{f1(totalWFerme)} MVA</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>ferme cumulé</div>
        </div>
        <div className="metric-box" style={{ borderLeft: '3px solid var(--inj)' }}>
          <div className="metric-box__label">Réservé inj.</div>
          <div className="metric-box__value" style={{ color: 'var(--inj)' }}>{f1(totalIFerme)} MVA</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>ferme cumulé</div>
        </div>
        <div className="metric-box">
          <div className="metric-box__label">Résiduel prél. 2026</div>
          <div className="metric-box__value" style={{ color: resW2026 < 0 ? 'var(--red)' : resW2026 < 5 ? 'var(--amber)' : 'var(--green)' }}>
            {f1(resW2026)} MVA
          </div>
          <div style={{ marginTop: 4 }} title={YEARS.map((y, i) => `${y}: ${sparkVals[i]} MVA`).join(' | ')}>
            <svg width={spW} height={spH} style={{ overflow: 'visible' }}>
              <polyline points={spPts} fill="none" stroke={spMin < 0 ? 'var(--red)' : 'var(--green)'} strokeWidth="1.5" />
              {sparkVals.map((v, i) => v < 0 && (
                <circle key={i} cx={(i / (YEARS.length - 1)) * spW} cy={spH - (v - spMin) / spRange * (spH - 4) + 2}
                  r="2.5" fill="var(--red)" />
              ))}
            </svg>
          </div>
        </div>
        <div className="metric-box" style={{ borderLeft: '3px solid var(--inj)' }}>
          <div className="metric-box__label">Résiduel inj. 2026</div>
          <div className="metric-box__value" style={{ color: resI2026 < 0 ? 'var(--red)' : resI2026 < 5 ? 'var(--amber)' : 'var(--inj)' }}>
            {f1(resI2026)} MVA
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>cap. inverse</div>
        </div>
        <div className="metric-box" style={{ borderLeft: expAlerts.length > 0 ? '3px solid var(--amber)' : '3px solid var(--green)' }}>
          <div className="metric-box__label">Péremptions</div>
          <div className="metric-box__value" style={{ color: expAlerts.length > 0 ? 'var(--amber)' : 'var(--green)' }}>{expAlerts.length}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>expirées ou &lt;90j</div>
        </div>
      </div>

      {/* Expiry alerts */}
      {expAlerts.length > 0 && (
        <div style={{ background: 'var(--amber-dim)', border: '1px solid rgba(217,119,6,.25)', borderRadius: 10, padding: '10px 14px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--amber)', marginBottom: 6 }}>Réservations à traiter</p>
          {expAlerts.map(item => (
            <div key={item.req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{item.req.name}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ExpiryChip expiry={item.expiry} />
                <button className="btn-edit-link" style={{ fontSize: 11 }} onClick={() => onEdit(item.req)}>Traiter →</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '11px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>File d'attente FIFO</p>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>Résiduel calculé cumulativement</span>
          </div>
          <button className="btn-primary" style={{ fontSize: 12, padding: '6px 14px' }} onClick={onAdd}>+ Nouvelle demande</button>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-muted)' }}>
              {[
                { l: '#', al: 'center', w: 32 }, { l: 'Demandeur', al: 'left' },
                { l: 'Client', al: 'right', w: 90 }, { l: 'GRD', al: 'right', w: 110 },
                { l: 'Résiduel ⬆/⬇', al: 'center', w: 160 }, { l: 'Réservation', al: 'center', w: 100 },
                { l: 'Décision', al: 'center', w: 90 }, { l: '', al: 'right', w: 80 },
              ].map(h => (
                <th key={h.l} style={{ padding: '8px 10px', textAlign: h.al, width: h.w || undefined,
                  fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em',
                  color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h.l}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {queue.length === 0 && conditionals.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 13 }}>
                Aucune demande active. Cliquez « + Nouvelle demande » pour commencer.
              </td></tr>
            )}
            {queue.map(item => (
              <QueueRow key={item.req.id} item={item}
                onEdit={onEdit} onArchive={handleArchive} onDelete={onDelete} />
            ))}

            {/* Conditionals */}
            {conditionals.length > 0 && <>
              <tr>
                <td colSpan={8} style={{ padding: '7px 18px', background: 'var(--bg-muted)',
                  borderTop: '1px solid var(--border)', fontSize: 9, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text-muted)' }}>
                  Conditionnels — hors file, non réservés
                </td>
              </tr>
              {conditionals.map(item => (
                <tr key={item.req.id} className="data-row" style={{ opacity: .65 }}>
                  <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: 13, padding: '8px 10px' }}>—</td>
                  <td style={{ padding: '8px 10px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>{item.req.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                      <Tag v={item.req.type} /><Tag v={item.req.status} />
                    </div>
                  </td>
                  <td colSpan={4} />
                  <td style={{ textAlign: 'center', padding: '8px 8px' }}><DecisionBadge decision="conditionnel" size="xs" /></td>
                  <td style={{ textAlign: 'right', paddingRight: 12 }}>
                    <button className="btn-edit-link" style={{ fontSize: 11 }} onClick={() => onEdit(item.req)}>Modifier</button>
                  </td>
                </tr>
              ))}
            </>}
          </tbody>
        </table>

        {/* Legend */}
        <div style={{ padding: '8px 18px', background: 'var(--bg-muted)', borderTop: '1px solid var(--border)',
          display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
          {Object.entries(DECISION_CONFIG).map(([k, c]) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
              <span style={{ color: c.color, fontWeight: 800 }}>{c.icon}</span> {c.label}
            </span>
          ))}
          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-muted)', fontStyle: 'italic' }}>Décision auto · override via Modifier</span>
        </div>
      </div>

      {/* Completed connections */}
      {(() => {
        const raccordées = sub.connectionRequests.filter(r => r.status === 'raccordée' || r.status === 'raccordé');
        if (!raccordées.length) return null;
        return (
          <details open>
            <summary style={{ cursor: 'pointer', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '.06em', color: 'var(--inj-text)', padding: '8px 0', listStyle: 'none',
              display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--inj)', display: 'inline-block' }} />
              Raccordements effectués ({raccordées.length})
            </summary>
            <div className="card" style={{ marginTop: 8, overflow: 'hidden', border: '1.5px solid var(--inj-border)', background: 'var(--inj-dim)' }}>
              {raccordées.map((req, i) => {
                const hist = (sub.chargeHistory || []).find(h => h.reqId === req.id && h.includeInBase);
                const grdPF = reqGrdPrelevFerme(req), grdFl = reqGrdPrelevFlexible(req);
                const grdIF = reqGrdInjFerme(req), grdIFl = reqGrdInjFlexible(req);
                const net = hist ? (hist.prelevMW - hist.injMW) : (grdPF - grdIF);
                return (
                  <div key={req.id} style={{ padding: '12px 16px', borderBottom: i < raccordées.length - 1 ? '1px solid var(--inj-border)' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--inj-text)' }}>{req.name}</span>
                          <Tag v={req.type} />
                        </div>
                        <p style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                          Raccordé le {req.raccordementDate || '—'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        {grdPF > 0 && <SmallPower label="Prél. ferme" v={grdPF} color="var(--prelev)" />}
                        {grdFl > 0 && <SmallPower label="Prél. flex." v={grdFl} color="var(--amber)" />}
                        {grdIF > 0 && <SmallPower label="Inj. garanti" v={grdIF} color="var(--inj)" />}
                        {hist?.effectYear && <SmallPower label={`Δ base dès ${hist.effectYear}`} v={net} color={net >= 0 ? 'var(--prelev)' : 'var(--inj)'} signed />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </details>
        );
      })()}

      {/* Cancelled */}
      {cancelled.length > 0 && (
        <details>
          <summary style={{ cursor: 'pointer', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '.06em', color: 'var(--text-muted)', padding: '8px 0', listStyle: 'none',
            display: 'flex', alignItems: 'center', gap: 6 }}>
            ▶ Annulées ({cancelled.length})
          </summary>
          <div className="card" style={{ marginTop: 8, overflow: 'hidden', opacity: .7 }}>
            {cancelled.map(item => (
              <div key={item.req.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>✕</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', textDecoration: 'line-through' }}>{item.req.name}</span>
                </div>
                <Tag v={item.req.type} />
                <button className="btn-edit-link" style={{ fontSize: 11 }} onClick={() => onEdit(item.req)}>Réactiver</button>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Archive modal */}
      <ArchiveModal
        archiveModal={archiveModal}
        chargeContrib={chargeContrib}
        setChargeContrib={setChargeContrib}
        sub={sub}
        onConfirm={confirmArchive}
        onCancel={() => setArchiveModal(null)}
      />
    </div>
  );
}
