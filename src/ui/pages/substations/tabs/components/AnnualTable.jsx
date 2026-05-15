/**
 * AnnualTable.jsx — Foldable annual data table (2 rows per year).
 * Extracted from EvolutionTab.
 */
import React, { useState } from 'react';
import { YEARS, ALERT_CONFIG } from '../../../../../constants/index.js';
import { f1, pct } from '../../../../../utils/format.js';
import {
  getWithdrawalBaseNet,
  getWithdrawalFirmReservation,
  getWithdrawalFlexibleReservation,
  getInjectionBaseNet,
  getInjectionFirmReservation,
  getInjectionFlexibleReservation,
  getDirectionalAlertState,
  projectDirectionalComponent,
} from '../../../../../engines/directionalSubstation.js';

export function AnnualTable({ sub, projects, activeYear, onSelectYear }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="annual-table-toggle"
        style={{ borderRadius: open ? '10px 10px 0 0' : 10 }}
      >
        <span style={{ transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'none' }}>
          ▶
        </span>
        Tableau annuel détaillé — 2026 à 2035
        <span
          style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}
        >
          2 lignes/année · prélèvement + injection
        </span>
      </button>
      {open && (
        <div
          style={{
            overflowX: 'auto',
            border: '1px solid var(--border)',
            borderTop: 'none',
            borderRadius: '0 0 10px 10px',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: 'var(--bg-muted)' }}>
                {[
                  'Année',
                  'Vue',
                  'Cap. N-1',
                  'Cap. N',
                  'Dom. BT',
                  'Dom. MT',
                  'Opp. BT',
                  'Opp. MT',
                  'Base',
                  'Rés. ferme',
                  'Rés. flex',
                  'Rigide',
                  'Totale',
                  'Util. rig.',
                  'Util. tot.',
                  'Statut',
                ].map((c, i) => (
                  <th
                    key={c}
                    style={{
                      padding: '7px 8px',
                      fontWeight: 700,
                      fontSize: 9,
                      textTransform: 'uppercase',
                      letterSpacing: '.06em',
                      color: 'var(--text-muted)',
                      borderBottom: '1px solid var(--border)',
                      textAlign: i < 2 ? 'left' : 'right',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {YEARS.flatMap((y) => {
                const state = getDirectionalAlertState(sub, y, false, projects);
                const m = sub.directionalModel;
                const wv = m?.withdrawalView || {};
                const iv = m?.injectionView || {};
                const refY = m?.referenceYear || 2025;
                const pc = (b, r) => projectDirectionalComponent(b, r, refY, y);
                const wBase = getWithdrawalBaseNet(sub, y, projects);
                const wFirm = getWithdrawalFirmReservation(sub, y);
                const wFlex = getWithdrawalFlexibleReservation(sub, y);
                const iBase = getInjectionBaseNet(sub, y, projects);
                const iFirm = getInjectionFirmReservation(sub, y);
                const iFlex = getInjectionFlexibleReservation(sub, y);
                const isActive = y === activeYear;
                const bg = isActive ? 'var(--accent-dim)' : 'transparent';
                const tdR = (key, v, c, bold) => (
                  <td
                    key={`${y}-${key}`}
                    style={{
                      padding: '5px 8px',
                      textAlign: 'right',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: c || 'var(--text-primary)',
                      fontWeight: bold ? 700 : 400,
                      background: bg,
                    }}
                  >
                    {v}
                  </td>
                );
                const ac = ALERT_CONFIG[state.worstWithdrawal];
                const ai = ALERT_CONFIG[state.worstInjection];
                return [
                  <tr
                    key={`${y}-w`}
                    onClick={() => onSelectYear(y)}
                    style={{ cursor: 'pointer', borderBottom: 'none' }}
                  >
                    <td
                      style={{
                        padding: '5px 8px',
                        fontWeight: 800,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        background: bg,
                      }}
                    >
                      {isActive ? '▶ ' : ''}
                      {y}
                    </td>
                    <td
                      style={{
                        padding: '5px 8px',
                        fontWeight: 700,
                        fontSize: 9,
                        color: 'var(--prelev)',
                        background: bg,
                      }}
                    >
                      ⬆ PRÉL.
                    </td>
                    {tdR('w-cap-n1', f1(state.capDirN1))}{' '}
                    {tdR('w-cap-n', state.capDirN ? f1(state.capDirN) : '—', 'var(--text-muted)')}
                    {tdR(
                      'w-dom-bt',
                      f1(pc(wv.maxHistoricLoadBT, wv.growthLoadMaxBT)),
                      'var(--accent)',
                    )}
                    {tdR(
                      'w-dom-mt',
                      f1(pc(wv.maxHistoricLoadMT, wv.growthLoadMaxMT)),
                      'var(--accent)',
                    )}
                    {tdR(
                      'w-opp-bt',
                      f1(pc(wv.minHistoricInjectionBT, wv.growthMinInjectionBT)),
                      'var(--inj)',
                    )}
                    {tdR(
                      'w-opp-mt',
                      f1(pc(wv.minHistoricInjectionMT, wv.growthMinInjectionMT)),
                      'var(--inj)',
                    )}
                    {tdR('w-base', f1(wBase), 'var(--accent)', true)}
                    {tdR('w-firm', f1(wFirm), 'var(--prelev)')}{' '}
                    {tdR('w-flex', f1(wFlex), 'var(--amber)')}
                    {tdR('w-rigid', f1(state.wRigid), null, true)}{' '}
                    {tdR('w-total', f1(state.wTotal))}
                    <td
                      style={{
                        padding: '5px 8px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        fontWeight: 700,
                        color:
                          state.uWRvsN1 >= 1
                            ? 'var(--red)'
                            : state.uWRvsN1 >= 0.85
                              ? 'var(--amber)'
                              : 'var(--green)',
                        background: bg,
                      }}
                    >
                      {pct(state.uWRvsN1)}
                    </td>
                    <td
                      style={{
                        padding: '5px 8px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        background: bg,
                      }}
                    >
                      {pct(state.uWTvsN1)}
                    </td>
                    <td style={{ padding: '5px 8px', background: bg }}>
                      <span
                        style={{
                          background: ac.bg,
                          color: ac.text,
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ac.label}
                      </span>
                    </td>
                  </tr>,
                  <tr
                    key={`${y}-i`}
                    onClick={() => onSelectYear(y)}
                    style={{ cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                  >
                    <td
                      style={{
                        padding: '5px 8px',
                        background: isActive ? 'var(--inj-dim)' : 'var(--bg-muted)',
                        opacity: 0.85,
                      }}
                    />
                    <td
                      style={{
                        padding: '5px 8px',
                        fontWeight: 700,
                        fontSize: 9,
                        color: 'var(--inj)',
                        background: isActive ? 'var(--inj-dim)' : 'var(--bg-muted)',
                      }}
                    >
                      ⬇ INJ.
                    </td>
                    {[
                      f1(state.capRevN1),
                      state.capRevN ? f1(state.capRevN) : '—',
                      f1(pc(iv.maxHistoricInjectionBT, iv.growthMaxInjectionBT)),
                      f1(pc(iv.maxHistoricInjectionMT, iv.growthMaxInjectionMT)),
                      f1(pc(iv.minHistoricLoadBT, iv.growthMinLoadBT)),
                      f1(pc(iv.minHistoricLoadMT, iv.growthMinLoadMT)),
                      f1(Math.abs(iBase)),
                      f1(iFirm),
                      f1(iFlex),
                      f1(Math.abs(state.injRigid)),
                      f1(Math.abs(state.injTotal)),
                    ].map((v, j) => (
                      <td
                        key={`${y}-i-${j}`}
                        style={{
                          padding: '5px 8px',
                          textAlign: 'right',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          color:
                            j <= 1
                              ? 'var(--text-muted)'
                              : j === 6
                                ? 'var(--inj)'
                                : j <= 8
                                  ? 'var(--inj)'
                                  : 'var(--text-primary)',
                          background: isActive ? 'var(--inj-dim)' : 'var(--bg-muted)',
                          fontWeight: j === 6 ? 700 : 400,
                        }}
                      >
                        {v}
                      </td>
                    ))}
                    <td
                      style={{
                        padding: '5px 8px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        fontWeight: 700,
                        color:
                          state.uIRvsN1 >= 1
                            ? 'var(--red)'
                            : state.uIRvsN1 >= 0.85
                              ? 'var(--amber)'
                              : 'var(--green)',
                        background: isActive ? 'var(--inj-dim)' : 'var(--bg-muted)',
                      }}
                    >
                      {pct(state.uIRvsN1)}
                    </td>
                    <td
                      style={{
                        padding: '5px 8px',
                        textAlign: 'right',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 10,
                        color: 'var(--text-muted)',
                        background: isActive ? 'var(--inj-dim)' : 'var(--bg-muted)',
                      }}
                    >
                      {pct(state.uITvsN1)}
                    </td>
                    <td
                      style={{
                        padding: '5px 8px',
                        background: isActive ? 'var(--inj-dim)' : 'var(--bg-muted)',
                      }}
                    >
                      <span
                        style={{
                          background: ai.bg,
                          color: ai.text,
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontSize: 9,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ai.label}
                      </span>
                    </td>
                  </tr>,
                ];
              })}
            </tbody>
          </table>
          <div
            style={{
              padding: '8px 16px',
              background: 'var(--bg-muted)',
              borderTop: '1px solid var(--border)',
              fontSize: 10,
              color: 'var(--text-muted)',
              borderRadius: '0 0 10px 10px',
            }}
          >
            Toutes valeurs en MVA · Cliquer une ligne pour sélectionner l'année
          </div>
        </div>
      )}
    </div>
  );
}
