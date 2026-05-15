import React from 'react';
import { ALERT_CONFIG } from '../../constants/index.js';
import { f1, pct } from '../../utils/format.js';
import { getAlertLevel } from '../../engines/alerts.js';

/** Single utilisation bar (rigide N-1). */
export function UtilBar({ rateRigid }) {
  const level = getAlertLevel(rateRigid);
  const c = ALERT_CONFIG[level];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 100 }}>
      <div className="bar-track" style={{ flex: 1, height: 6 }}>
        <div
          style={{
            width: `${Math.min(rateRigid * 100, 100)}%`,
            background: c.bar,
            height: '100%',
            borderRadius: 4,
            transition: 'width .3s',
          }}
        />
      </div>
      <span
        style={{
          color: c.color,
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          fontWeight: 700,
          minWidth: 34,
          textAlign: 'right',
        }}
      >
        {pct(rateRigid)}
      </span>
    </div>
  );
}

/** Mini barre de résiduel avec code couleur. */
export function ResidualMiniBar({ value, capacity }) {
  const rate = capacity > 0 ? Math.max(0, value) / capacity : 0;
  const color = value < 0 ? '#ef4444' : value < 3 ? '#f97316' : '#22c55e';
  return (
    <div className="flex items-center gap-2">
      <div className="residual-bar" style={{ flex: 1 }}>
        <div
          className="residual-bar-fill"
          style={{ width: `${Math.min(rate * 100, 100)}%`, background: color }}
        />
      </div>
      <span className="mono text-xs font-bold" style={{ color, minWidth: 40, textAlign: 'right' }}>
        {value != null ? (value > 0 ? '+' : '') + f1(value) + ' MVA' : '—'}
      </span>
    </div>
  );
}

/** Double barre rigide/total avec indicateurs N. */
export function DualUtilBar({ rateRigid, rateTotal, rateRigidN, rateTotalN }) {
  const lR = getAlertLevel(rateRigid);
  const lT = getAlertLevel(rateTotal);
  const cR = ALERT_CONFIG[lR];
  const cT = ALERT_CONFIG[lT];
  const rigidExceedsN = rateRigidN !== undefined && rateRigidN !== null && rateRigidN >= 1.0;
  const totalExceedsN = rateTotalN !== undefined && rateTotalN !== null && rateTotalN >= 1.0;
  return (
    <div className="dual-bar-wrap" style={{ minWidth: 120 }}>
      <div className="flex items-center gap-1">
        <div className="bar-track" style={{ flex: 1 }}>
          <div
            style={{
              width: `${Math.min(rateRigid * 100, 100)}%`,
              background: cR.bar,
              height: '100%',
              borderRadius: 6,
              transition: 'width .3s',
            }}
          />
        </div>
        <span style={{ color: cR.color }} className="mono text-xs font-bold w-10 text-right">
          {pct(rateRigid)}
        </span>
        {rigidExceedsN && (
          <span
            title="Dépasse la capacité N"
            style={{ color: '#7f1d1d', fontSize: 9, fontWeight: 900, marginLeft: 1 }}
          >
            ▲N
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <div className="bar-track" style={{ flex: 1 }}>
          <div
            style={{
              width: `${Math.min(rateTotal * 100, 100)}%`,
              background: `${cT.bar}70`,
              height: '100%',
              borderRadius: 6,
              transition: 'width .3s',
            }}
          />
        </div>
        <span
          style={{ color: cT.color, opacity: 0.75 }}
          className="mono text-xs font-semibold w-10 text-right"
        >
          {pct(rateTotal)}
        </span>
        {totalExceedsN && !rigidExceedsN && (
          <span
            title="Totale dépasse N — pilotage permanent"
            style={{ color: '#6d28d9', fontSize: 9, fontWeight: 900, marginLeft: 1 }}
          >
            ▲N
          </span>
        )}
      </div>
    </div>
  );
}

/** Badge double taux rigide/total dans une cellule de tableau. */
export function DualCellBadge({ rateRigid, rateTotal, rateRigidN, rateTotalN }) {
  const cR = ALERT_CONFIG[getAlertLevel(rateRigid)];
  const cT = ALERT_CONFIG[getAlertLevel(rateTotal)];
  const rigidExceedsN = rateRigidN !== undefined && rateRigidN !== null && rateRigidN >= 1.0;
  const totalExceedsN = rateTotalN !== undefined && rateTotalN !== null && rateTotalN >= 1.0;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1">
        <span
          style={{
            minWidth: 46,
            textAlign: 'center',
            background: cR.bg,
            color: cR.text,
            border: `1px solid ${cR.border}`,
            display: 'inline-block',
            padding: '0 4px',
            borderRadius: 3,
          }}
          className="mono text-xs font-bold leading-5"
        >
          {pct(rateRigid)}
        </span>
        {rigidExceedsN && (
          <span
            style={{
              background: '#7f1d1d',
              color: '#fef2f2',
              fontSize: 9,
              fontWeight: 900,
              padding: '1px 4px',
              borderRadius: 2,
              letterSpacing: '.03em',
              boxShadow: '0 0 0 1px #991b1b',
            }}
          >
            ▲N
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <span style={{ color: cT.text, opacity: 0.75 }} className="mono text-xs leading-4">
          {pct(rateTotal)}
        </span>
        {totalExceedsN && !rigidExceedsN && (
          <span
            style={{
              background: '#6d28d9',
              color: '#fff',
              fontSize: 9,
              fontWeight: 900,
              padding: '1px 3px',
              borderRadius: 2,
            }}
          >
            ▲N
          </span>
        )}
      </div>
    </div>
  );
}
