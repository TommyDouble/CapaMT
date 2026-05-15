/**
 * SummaryCards.jsx — Directional summary cards (withdrawal / injection / global).
 * Extracted from EvolutionTab.
 */
import React from 'react';
import { YEARS, ALERT_CONFIG } from '../../../../../constants/index.js';
import { f1, pct } from '../../../../../utils/format.js';
import {
  getUtilizationWithdrawalRigid,
  getUtilizationInjectionRigid,
  getWithdrawalRigid,
  getInjectionRigid,
  getFirstWithdrawalSaturationYear,
  getFirstInjectionSaturationYear,
  getDirectionalAlertState,
} from '../../../../../engines/directionalSubstation.js';

const ALERT_LEVEL = (r) =>
  r >= 1.0 ? 'critical' : r >= 0.85 ? 'warning' : r >= 0.7 ? 'caution' : 'ok';

function DirectionCard({ isW, view, setView, util, rigid, sat }) {
  const active = view === (isW ? 'withdrawal' : 'injection');
  const lv = ALERT_LEVEL(util);
  const ac = ALERT_CONFIG[lv];
  return (
    <div
      onClick={() => setView(isW ? 'withdrawal' : 'injection')}
      className={`summary-card ${active ? (isW ? 'summary-card--prelev-active' : 'summary-card--inj-active') : ''}`}
    >
      <div
        className="summary-card__direction"
        style={{ color: isW ? 'var(--prelev)' : 'var(--inj)' }}
      >
        <span>{isW ? '⬆' : '⬇'}</span> {isW ? 'Prélèvement' : 'Injection'}
      </div>
      <div className="summary-card__value" style={{ color: isW ? 'var(--prelev)' : 'var(--inj)' }}>
        {f1(rigid)} <span className="summary-card__unit">MVA rigide</span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
        Util. N-1 :{' '}
        <strong style={{ color: ac.color, fontFamily: 'var(--font-mono)' }}>{pct(util)}</strong>
      </div>
      <div className="alert-inline" style={{ background: ac.bg, border: `1px solid ${ac.border}` }}>
        <span className="alert-inline__dot" style={{ background: ac.color }} />
        <span style={{ color: ac.text }}>{ac.label}</span>
      </div>
      <div
        style={{
          fontSize: 10,
          marginTop: 6,
          fontWeight: 600,
          color: sat ? (isW ? 'var(--prelev)' : 'var(--inj)') : 'var(--green)',
        }}
      >
        {sat ? `Sat. N-1 : ${sat}` : '✓ Pas de saturation'}
      </div>
    </div>
  );
}

export function SummaryCards({ sub, projects, activeYear, view, setView }) {
  const uWR = getUtilizationWithdrawalRigid(sub, YEARS[0], projects);
  const uIR = getUtilizationInjectionRigid(sub, YEARS[0], projects);
  const satW = getFirstWithdrawalSaturationYear(sub, projects);
  const satI = getFirstInjectionSaturationYear(sub, projects);
  const wRigid = getWithdrawalRigid(sub, YEARS[0], false, projects);
  const iRigid = getInjectionRigid(sub, YEARS[0], false, projects);
  const state = getDirectionalAlertState(sub, activeYear, false, projects);
  const worst = state.worstLevel;
  const wac = ALERT_CONFIG[worst];

  return (
    <div className="summary-cards-row">
      <DirectionCard
        isW={true}
        view={view}
        setView={setView}
        util={uWR}
        rigid={wRigid}
        sat={satW}
      />
      <DirectionCard
        isW={false}
        view={view}
        setView={setView}
        util={uIR}
        rigid={Math.abs(iRigid)}
        sat={satI}
      />
      {/* Global card */}
      <div
        className="summary-card summary-card--global"
        style={{ borderColor: wac.color, background: wac.bg }}
      >
        <div className="summary-card__direction" style={{ color: wac.color }}>
          Synthèse globale
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: wac.color, marginBottom: 4 }}>
          {wac.label}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8 }}>
          Pire sens · {worst === state.worstWithdrawal ? 'prélèvement' : 'injection'}
        </div>
        <div style={{ fontSize: 10, color: wac.text }}>
          {satW && satI
            ? `Sat. prél. ${satW} · inj. ${satI}`
            : satW
              ? `Sat. prélèvement ${satW}`
              : satI
                ? `Sat. injection ${satI}`
                : '✓ Aucune saturation 2026–2035'}
        </div>
      </div>
    </div>
  );
}
