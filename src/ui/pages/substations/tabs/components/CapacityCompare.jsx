/**
 * CapacityCompare.jsx — Capacity bar comparison with metrics.
 * Extracted from EvolutionTab.
 */
import React from 'react';
import { ALERT_CONFIG } from '../../../../../constants/index.js';
import { f1, pct } from '../../../../../utils/format.js';
import {
  getDirectCapacityN1AtYear,
  getDirectCapacityNAtYear,
  getReverseCapacityN1AtYear,
  getReverseCapacityNAtYear,
  getWithdrawalBaseNet,
  getWithdrawalFirmReservation,
  getWithdrawalFlexibleReservation,
  getInjectionBaseNet,
  getInjectionFirmReservation,
  getInjectionFlexibleReservation,
} from '../../../../../engines/directionalSubstation.js';

const ALERT_LEVEL = (r) =>
  r >= 1.0 ? 'critical' : r >= 0.85 ? 'warning' : r >= 0.7 ? 'caution' : 'ok';

export function CapacityCompare({ sub, year, view, projects }) {
  const isW = view === 'withdrawal';
  const capN1 = isW
    ? getDirectCapacityN1AtYear(sub, year, projects)
    : getReverseCapacityN1AtYear(sub, year, projects);
  const capN = isW
    ? getDirectCapacityNAtYear(sub, year, projects)
    : getReverseCapacityNAtYear(sub, year, projects);
  const base = Math.abs(
    isW ? getWithdrawalBaseNet(sub, year, projects) : getInjectionBaseNet(sub, year, projects),
  );
  const firm = isW
    ? getWithdrawalFirmReservation(sub, year)
    : getInjectionFirmReservation(sub, year);
  const flex = isW
    ? getWithdrawalFlexibleReservation(sub, year)
    : getInjectionFlexibleReservation(sub, year);
  const rigid = base + firm;
  const total = rigid + flex;
  const maxBar = Math.max(total, capN1, capN || 0) * 1.08 || 1;

  const rRN1 = capN1 > 0 ? rigid / capN1 : 0;
  const rTN1 = capN1 > 0 ? total / capN1 : 0;
  const rRN = capN > 0 ? rigid / capN : 0;
  const rTN = capN > 0 ? total / capN : 0;

  const lv = ALERT_LEVEL(rRN1);
  const ac = ALERT_CONFIG[lv];
  const vc = isW ? 'var(--prelev)' : 'var(--inj)';
  const metricColor = (r) => (r >= 1 ? 'var(--red)' : r >= 0.85 ? 'var(--amber)' : 'var(--green)');

  return (
    <div style={{ marginTop: 14 }}>
      <div className="section-label">Comparaison à la capacité · {year}</div>

      {/* Segmented bar */}
      <div className="cap-bar-wrap">
        <div className="cap-bar">
          <div className="cap-bar__track">
            <div
              className="cap-bar__seg"
              style={{
                width: `${(base / maxBar) * 100}%`,
                background: isW ? 'rgba(99,102,241,.55)' : 'rgba(5,150,105,.50)',
              }}
              title={`Base: ${f1(base)} MVA`}
            />
            <div
              className="cap-bar__seg"
              style={{
                width: `${(firm / maxBar) * 100}%`,
                background: isW ? 'rgba(220,38,38,.70)' : 'rgba(5,150,105,.78)',
              }}
              title={`Ferme: ${f1(firm)} MVA`}
            />
            <div
              className="cap-bar__seg"
              style={{
                width: `${(flex / maxBar) * 100}%`,
                background: isW ? 'rgba(217,119,6,.55)' : 'rgba(5,150,105,.38)',
              }}
              title={`Flexible: ${f1(flex)} MVA`}
            />
          </div>
          <div
            className="cap-bar__marker"
            style={{ left: `${Math.min((capN1 / maxBar) * 100, 99.5)}%`, background: '#1a1230' }}
          >
            <div className="cap-bar__label" style={{ left: 2 }}>
              N-1 {f1(capN1)}
            </div>
          </div>
          {capN && (
            <div
              className="cap-bar__marker"
              style={{
                left: `${Math.min((capN / maxBar) * 100, 99.5)}%`,
                background: '#9ca3af',
                width: 2,
                opacity: 0.7,
              }}
            >
              <div
                className="cap-bar__label"
                style={{ left: 2, top: '100%', bottom: 'auto', marginTop: 4 }}
              >
                N {f1(capN)}
              </div>
            </div>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 9,
            color: 'var(--text-muted)',
            marginTop: 22,
            fontFamily: 'var(--font-mono)',
          }}
        >
          <span>0</span>
          <span>{f1(maxBar)} MVA</span>
        </div>
      </div>

      {/* Metrics */}
      <div className="metric-grid metric-grid--4" style={{ marginTop: 4 }}>
        {[
          { l: 'Rigide', v: f1(rigid) + ' MVA', c: vc },
          { l: 'Totale', v: f1(total) + ' MVA', c: 'var(--amber)' },
          { l: 'Cap. N-1', v: f1(capN1) + ' MVA', c: 'var(--text-primary)' },
          { l: 'Cap. N', v: capN ? f1(capN) + ' MVA' : '—', c: 'var(--text-muted)' },
        ].map(({ l, v, c }) => (
          <div key={l} className="metric-box">
            <div className="metric-box__label">{l}</div>
            <div className="metric-box__value" style={{ color: c }}>
              {v}
            </div>
          </div>
        ))}
      </div>
      <div className="metric-grid metric-grid--4" style={{ marginTop: 8 }}>
        {[
          { l: 'Util. rigide N-1', v: pct(rRN1), c: metricColor(rRN1) },
          { l: 'Util. totale N-1', v: pct(rTN1), c: metricColor(rTN1) },
          { l: 'Util. rigide N', v: pct(rRN), c: metricColor(rRN) },
          { l: 'Util. totale N', v: pct(rTN), c: metricColor(rTN) },
        ].map(({ l, v, c }) => (
          <div key={l} className="metric-box">
            <div className="metric-box__label">{l}</div>
            <div className="metric-box__value" style={{ color: c }}>
              {v}
            </div>
          </div>
        ))}
      </div>

      {/* Alert badge */}
      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div
          className="alert-inline alert-inline--lg"
          style={{ background: ac.bg, border: `1.5px solid ${ac.border}`, color: ac.text }}
        >
          <span className="alert-inline__dot" style={{ background: ac.color }} />
          {ac.label} · {pct(rRN1)}
        </div>
        {rRN1 >= 1 && (
          <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>
            ⚠ Saturation prélèvement atteinte
          </span>
        )}
      </div>
    </div>
  );
}
