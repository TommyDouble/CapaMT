/**
 * CaseNetworkSummary — Résumé réseau : résiduel avant/après + projets conditionnants.
 */
import React from 'react';
import { f1 } from '../../../../utils/format.js';
import { YEARS } from '../../../../constants/index.js';
import { Sparkline } from '../../../shared/Sparkline.jsx';
import { getConditioningProjects } from '../../../../engines/requests.js';
import { getQueueAnalysis } from '../../../../engines/queue.js';
import { getEffectiveRigidReservation } from '../../../../engines/requests.js';
import { getFoisonnement } from '../../../../constants/index.js';
import {
  getDirectCapacityN1AtYear,
  getReverseCapacityN1AtYear,
  getWithdrawalBaseNet,
} from '../../../../engines/directionalSubstation.js';
import { getCustomer } from '../../../../engines/requestModel.js';

function ResidualBar({ label, value, capacity, color }) {
  const pct = capacity > 0 ? Math.max(0, Math.min(1, value / capacity)) : 0;
  const c = value < 0 ? 'var(--red)' : value < 3 ? 'var(--amber)' : color || 'var(--green)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 120 }}>{label}</span>
      <div
        style={{
          flex: 1,
          height: 8,
          borderRadius: 4,
          background: 'var(--bg-muted)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct * 100}%`,
            height: '100%',
            background: c,
            borderRadius: 4,
            transition: 'width .3s',
          }}
        />
      </div>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          fontWeight: 700,
          color: c,
          minWidth: 60,
          textAlign: 'right',
        }}
      >
        {value != null ? f1(value) : '—'} MVA
      </span>
    </div>
  );
}

export function CaseNetworkSummary({ req, sub, projects, queueItem }) {
  const condProjects = getConditioningProjects(req, projects);
  const hasCondition = (req.conditionedOnProjectIds || []).length > 0;
  const condMissing = hasCondition && condProjects.length === 0;

  const reqYear = getCustomer(req).requested?.year || 2026;
  const capDirN1 = getDirectCapacityN1AtYear(sub, reqYear, projects);
  const capRevN1 = getReverseCapacityN1AtYear(sub, reqYear, projects);

  const wBefore = queueItem?.withdrawalResidualBefore ?? null;
  const wAfter = queueItem?.withdrawalResidualAfter ?? null;
  const iBefore = queueItem?.injectionResidualBefore ?? null;
  const iAfter = queueItem?.injectionResidualAfter ?? null;

  // Sparkline résiduel prélèvement 2026-2035 (toute la queue de la SS)
  const { queue } = getQueueAnalysis(sub, projects);
  const sparkVals = YEARS.map((y) => {
    const cap = getDirectCapacityN1AtYear(sub, y, projects);
    const base = getWithdrawalBaseNet(sub, y, projects);
    const committed = queue
      .filter((item) => (getCustomer(item.req).requested?.year || 2026) <= y)
      .reduce(
        (s, item) => s + getEffectiveRigidReservation(item.req) * getFoisonnement(item.req, sub),
        0,
      );
    return +(cap - base - committed).toFixed(1);
  });

  return (
    <div className="card" style={{ padding: '14px 18px' }}>
      <p
        style={{
          fontSize: 10,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '.07em',
          color: 'var(--accent)',
          marginBottom: 14,
        }}
      >
        Contexte réseau
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Résiduels */}
        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-secondary)',
              marginBottom: 10,
            }}
          >
            Résiduel à l'année de la demande ({reqYear})
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {wBefore != null ? (
              <>
                <ResidualBar
                  label="Prél. avant demande"
                  value={wBefore}
                  capacity={capDirN1}
                  color="var(--prelev)"
                />
                <ResidualBar
                  label="Prél. après demande"
                  value={wAfter}
                  capacity={capDirN1}
                  color="var(--prelev)"
                />
              </>
            ) : (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                Demande conditionnelle — résiduel non calculé dans la FIFO
              </p>
            )}
            {iBefore != null && capRevN1 > 0 && (
              <>
                <ResidualBar
                  label="Inj. avant demande"
                  value={iBefore}
                  capacity={capRevN1}
                  color="var(--inj)"
                />
                {iAfter != null && (
                  <ResidualBar
                    label="Inj. après demande"
                    value={iAfter}
                    capacity={capRevN1}
                    color="var(--inj)"
                  />
                )}
              </>
            )}
          </div>

          {/* Capacités de référence */}
          <div style={{ display: 'flex', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
            <div
              style={{
                padding: '4px 10px',
                background: 'var(--slate)',
                borderRadius: 6,
                fontSize: 11,
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>Cap. dir. N-1 : </span>
              <strong className="mono">{f1(capDirN1)} MVA</strong>
            </div>
            {capRevN1 > 0 && (
              <div
                style={{
                  padding: '4px 10px',
                  background: 'var(--slate)',
                  borderRadius: 6,
                  fontSize: 11,
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>Cap. inv. N-1 : </span>
                <strong className="mono">{f1(capRevN1)} MVA</strong>
              </div>
            )}
          </div>
        </div>

        {/* Sparkline 2026-2035 */}
        <div>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: 'var(--text-secondary)',
              marginBottom: 10,
            }}
          >
            Résiduel prélèvement 2026–2035 (SS entière)
          </p>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
            <Sparkline values={sparkVals} width={180} height={48} threshold={0} />
            <div style={{ fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              {YEARS.map((y, i) => (
                <div
                  key={y}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 8,
                    color:
                      sparkVals[i] < 0
                        ? 'var(--red)'
                        : sparkVals[i] < 3
                          ? 'var(--amber)'
                          : 'var(--text-muted)',
                    fontWeight: y === reqYear ? 800 : 400,
                  }}
                >
                  <span>
                    {y}
                    {y === reqYear ? ' ←' : ''}
                  </span>
                  <span className="mono">{f1(sparkVals[i])}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Projets conditionnants */}
      <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <p
          style={{
            fontSize: 10,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '.07em',
            color: condMissing ? 'var(--amber)' : 'var(--text-muted)',
            marginBottom: 10,
          }}
        >
          Projets réseau conditionnants
        </p>

        {condMissing && (
          <div
            style={{
              background: 'var(--amber-dim)',
              border: '1px solid rgba(217,119,6,.25)',
              borderRadius: 8,
              padding: '8px 12px',
              marginBottom: 10,
            }}
          >
            <p style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>
              ⚠ Demande conditionnelle sans projet lié — à compléter via Modifier
            </p>
          </div>
        )}

        {condProjects.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {condProjects.map((proj) => {
              const statusColors = {
                planifié: {
                  color: 'var(--accent-muted)',
                  bg: 'var(--accent-soft)',
                  border: 'var(--accent-border)',
                },
                en_cours: { color: '#78350f', bg: '#fffbeb', border: '#fde68a' },
                validé: { color: '#065f46', bg: '#ecfdf5', border: '#a7f3d0' },
                annulé: { color: 'var(--red)', bg: '#fef2f2', border: '#fecaca' },
              };
              const sc = statusColors[proj.status] || statusColors.planifié;
              return (
                <div
                  key={proj.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 12px',
                    background: 'var(--slate)',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {proj.name}
                    </span>
                    {proj.notes && (
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {proj.notes}
                      </p>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontFamily: 'var(--font-mono)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    MES {proj.year || '—'}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: 12,
                      background: sc.bg,
                      color: sc.color,
                      border: `1px solid ${sc.border}`,
                    }}
                  >
                    {proj.status}
                  </span>
                  {proj.cost && (
                    <span
                      style={{
                        fontSize: 10,
                        fontFamily: 'var(--font-mono)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {(proj.cost / 1000).toFixed(0)} M€
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          !condMissing && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Aucun projet réseau lié à cette demande.
            </p>
          )
        )}
      </div>
    </div>
  );
}
