/**
 * SubstationListPage.jsx — v3.1 directional
 * Injection column now shows ENR capacity + reverse flow risk instead of empty utilization.
 */
import React, { useState } from 'react';
import { YEARS } from '../../../constants/index.js';
import { f1, pct } from '../../../utils/format.js';
import { useProjects } from '../../App.jsx';
import {
  getUtilizationWithdrawalRigid,
  getUtilizationInjectionRigid,
  getDirectCapacityN1AtYear,
  getReverseCapacityN1AtYear,
} from '../../../engines/directionalSubstation.js';
import {
  getResidualWithdrawalRigid,
  getFirstInjectionSaturationYear,
  getInjectionRigid,
} from '../../../engines/directionalSubstation.js';
import { getWorstWithdrawalAlert, getFirstWithdrawalSaturation } from '../../../engines/alerts.js';
import { AlertBadge } from '../../shared/badges.jsx';
import { UtilBar } from '../../shared/charts.jsx';

// Detect first year where reverse flow occurs
function getFirstReverseFlowYear(sub, projects) {
  for (const y of YEARS) {
    const iR = getInjectionRigid(sub, y, false, projects);
    if (iR < 0) return y;
  }
  return null;
}

// Get total ENR capacity from directional model
function getENRCapacity(sub) {
  const iv = sub.directionalModel?.injectionView;
  if (!iv) return 0;
  return (iv.maxHistoricInjectionBT || 0) + (iv.maxHistoricInjectionMT || 0);
}

export function SubstationList({ substations, onSelect }) {
  const [search, setSearch] = useState('');
  const projects = useProjects();

  const visible = substations.filter((s) => s.status !== 'hors_service');
  const filtered = visible.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.code.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }} className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 className="page-title">Sous-stations</h2>
          <p className="page-subtitle">{visible.length} actives · Modèle directionnel N-1</p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher…"
          className="input-field"
          style={{ width: 200 }}
        />
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {[
                { l: 'Sous-station', al: 'left', w: null },
                { l: 'Cap. dir. N-1', al: 'right', w: 85 },
                { l: 'Cap. inv. N-1', al: 'right', w: 85 },
                { l: 'Prél. 2026', al: 'left', w: 130 },
                { l: 'Injection', al: 'center', w: 100 },
                { l: '26–28', al: 'center', w: 55 },
                { l: '29–31', al: 'center', w: 55 },
                { l: '32–35', al: 'center', w: 55 },
                { l: '1ère sat.', al: 'center', w: 65 },
                { l: '', al: 'right', w: 32 },
              ].map((h) => (
                <th
                  key={h.l}
                  style={{
                    textAlign: h.al,
                    padding: '8px 10px',
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '.08em',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-muted)',
                    borderBottom: '1px solid var(--border)',
                    width: h.w || undefined,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {h.l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((sub, idx) => {
              const w1 = getWorstWithdrawalAlert(sub, 2026, 2028, projects);
              const w2 = getWorstWithdrawalAlert(sub, 2029, 2031, projects);
              const w3 = getWorstWithdrawalAlert(sub, 2032, 2035, projects);
              const uWR = getUtilizationWithdrawalRigid(sub, 2026, projects);
              const uIR = getUtilizationInjectionRigid(sub, 2026, projects);
              const satW = getFirstWithdrawalSaturation(sub, projects);
              const satI = getFirstInjectionSaturationYear(sub, projects);
              const capDN1 = getDirectCapacityN1AtYear(sub, 2026, projects);
              const capRN1 = getReverseCapacityN1AtYear(sub, 2026, projects);
              const resW = getResidualWithdrawalRigid(sub, 2026, projects);
              const enrCap = getENRCapacity(sub);
              const reverseYear = getFirstReverseFlowYear(sub, projects);
              const iR2026 = getInjectionRigid(sub, 2026, false, projects);

              const firstSat = satW || satI;
              const satColor = !firstSat
                ? 'var(--green)'
                : firstSat <= 2028
                  ? 'var(--red)'
                  : firstSat <= 2031
                    ? 'var(--amber)'
                    : '#f59e0b';
              const satDir =
                firstSat && satW && satI
                  ? satW <= satI
                    ? 'P'
                    : 'I'
                  : firstSat
                    ? satW
                      ? 'P'
                      : 'I'
                    : '';

              return (
                <tr
                  key={sub.id}
                  className="data-row stagger-item"
                  style={{ cursor: 'pointer', animationDelay: `${idx * 18}ms` }}
                  onClick={() => onSelect(sub.id)}
                >
                  {/* Name + code */}
                  <td style={{ padding: '9px 10px' }}>
                    <div
                      style={{
                        fontWeight: 700,
                        color: 'var(--text-primary)',
                        fontSize: 12,
                        lineHeight: 1.2,
                      }}
                    >
                      {sub.name}
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        color: 'var(--text-muted)',
                        marginTop: 1,
                      }}
                    >
                      {sub.code} · {sub.commune}
                    </div>
                  </td>

                  {/* Cap. directe N-1 */}
                  <td
                    style={{
                      textAlign: 'right',
                      padding: '9px 10px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {f1(capDN1)}
                  </td>

                  {/* Cap. inverse N-1 */}
                  <td
                    style={{
                      textAlign: 'right',
                      padding: '9px 10px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {f1(capRN1)}
                  </td>

                  {/* Prélèvement 2026 */}
                  <td style={{ padding: '9px 10px' }} title={`Résiduel : ${f1(resW)} MVA`}>
                    <UtilBar rateRigid={uWR} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                      <span
                        style={{
                          fontSize: 9,
                          fontFamily: 'var(--font-mono)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {pct(uWR)}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color:
                            resW < 0 ? 'var(--red)' : resW < 3 ? 'var(--amber)' : 'var(--green)',
                        }}
                      >
                        {f1(resW)}
                      </span>
                    </div>
                  </td>

                  {/* Injection — NEW: always show meaningful data */}
                  <td style={{ textAlign: 'center', padding: '9px 8px' }}>
                    {enrCap > 0 ? (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 2,
                        }}
                      >
                        {/* ENR capacity */}
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 10,
                            fontWeight: 600,
                            color: iR2026 < 0 ? 'var(--inj)' : 'var(--text-secondary)',
                          }}
                        >
                          {f1(enrCap)} MVA
                        </span>
                        {/* Reverse flow indicator or utilization */}
                        {iR2026 < 0 ? (
                          <span
                            style={{
                              fontSize: 8,
                              fontWeight: 700,
                              padding: '1px 5px',
                              borderRadius: 3,
                              background: 'var(--inj-dim)',
                              color: 'var(--inj)',
                              border: '1px solid var(--inj-border)',
                            }}
                          >
                            INV. {pct(uIR)}
                          </span>
                        ) : reverseYear ? (
                          <span
                            style={{
                              fontSize: 8,
                              fontWeight: 600,
                              color: 'var(--text-muted)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            inv. {reverseYear}
                          </span>
                        ) : (
                          <span style={{ fontSize: 8, color: 'var(--text-muted)' }}>ENR</span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 9, color: 'var(--border-strong)' }}>—</span>
                    )}
                  </td>

                  {/* Alert periods */}
                  <td style={{ textAlign: 'center', padding: '9px 6px' }}>
                    <AlertBadge level={w1} size="xs" />
                  </td>
                  <td style={{ textAlign: 'center', padding: '9px 6px' }}>
                    <AlertBadge level={w2} size="xs" />
                  </td>
                  <td style={{ textAlign: 'center', padding: '9px 6px' }}>
                    <AlertBadge level={w3} size="xs" />
                  </td>

                  {/* 1ère saturation — now shows direction */}
                  <td
                    style={{
                      textAlign: 'center',
                      padding: '9px 10px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      fontWeight: 700,
                      color: satColor,
                    }}
                  >
                    {firstSat ? (
                      <>
                        <span style={{ fontSize: 8, marginRight: 2, opacity: 0.7 }}>{satDir}</span>
                        {firstSat}
                      </>
                    ) : (
                      <span style={{ color: 'var(--border-strong)', fontWeight: 400 }}>—</span>
                    )}
                  </td>

                  {/* CTA */}
                  <td style={{ textAlign: 'right', padding: '9px 12px' }}>
                    <span
                      style={{
                        color: 'var(--accent)',
                        fontSize: 12,
                        fontWeight: 600,
                        opacity: 0.6,
                      }}
                    >
                      →
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="empty-state">Aucune sous-station trouvée pour « {search} »</div>
        )}
      </div>
    </div>
  );
}
