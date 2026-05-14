import React from 'react';
import { ALERT_CONFIG } from '../../constants/index.js';
import { f1, pct } from '../../utils/format.js';
import { getAlertLevel } from '../../engines/alerts.js';
import {
  getResidualWithdrawalRigid,
  getUtilizationWithdrawalRigid,
} from '../../engines/directionalSubstation.js';

export function SubstationSelector({ substations, value, onChange }) {
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {substations.map(sub => {
        const rate = getUtilizationWithdrawalRigid(sub, 2026);
        const level = getAlertLevel(rate);
        const c = ALERT_CONFIG[level];
        return (
          <button
            key={sub.id}
            type="button"
            className={`sub-option ${value === sub.id ? 'selected' : ''}`}
            onClick={() => onChange(sub.id)}
          >
            <span style={{ background: c.color }} className="sub-option-dot" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-primary truncate">{sub.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub.code} · {sub.voltageLevel}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="mono text-xs font-bold" style={{ color: c.color }}>{pct(rate)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{f1(getResidualWithdrawalRigid(sub, 2026))} MVA rés.</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
