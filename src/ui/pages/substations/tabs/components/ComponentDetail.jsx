/**
 * ComponentDetail.jsx — Directional component breakdown table.
 * Extracted from EvolutionTab.
 */
import React from 'react';
import { f1 } from '../../../../../utils/format.js';
import {
  getWithdrawalBaseNet, getWithdrawalFirmReservation, getWithdrawalFlexibleReservation,
  getWithdrawalRigid, getWithdrawalTotal,
  getInjectionBaseNet, getInjectionFirmReservation, getInjectionFlexibleReservation,
  getInjectionRigid, getInjectionTotal,
  projectDirectionalComponent,
} from '../../../../../engines/directionalSubstation.js';

export function ComponentDetail({ sub, year, view, projects }) {
  const m = sub.directionalModel;
  const wv = m?.withdrawalView || {};
  const iv = m?.injectionView || {};
  const refY = m?.referenceYear || 2025;
  const pc = (base, rate) => projectDirectionalComponent(base, rate, refY, year);
  const isW = view === 'withdrawal';

  const viewColor = isW ? 'var(--prelev)' : 'var(--inj)';
  const oppColor = isW ? 'var(--inj)' : 'var(--prelev)';

  const rows = isW ? [
    { sign: '+', label: 'Charge max BT (dominante)', val: pc(wv.maxHistoricLoadBT, wv.growthLoadMaxBT), color: 'var(--accent)' },
    { sign: '+', label: 'Charge max MT (dominante)', val: pc(wv.maxHistoricLoadMT, wv.growthLoadMaxMT), color: 'var(--accent)' },
    { sign: '−', label: 'Inj. min BT (opposée)', val: pc(wv.minHistoricInjectionBT, wv.growthMinInjectionBT), color: oppColor },
    { sign: '−', label: 'Inj. min MT (opposée)', val: pc(wv.minHistoricInjectionMT, wv.growthMinInjectionMT), color: oppColor },
    { sign: '=', label: 'Base nette hors réservations', val: getWithdrawalBaseNet(sub, year, projects), color: viewColor, sep: true },
    { sign: '+', label: 'Réservations ferme', val: getWithdrawalFirmReservation(sub, year), color: '#ea580c' },
    { sign: '=', label: 'Résultante rigide', val: getWithdrawalRigid(sub, year, false, projects), color: viewColor, sep: true },
    { sign: '+', label: 'Réservations flexible', val: getWithdrawalFlexibleReservation(sub, year), color: '#d97706' },
    { sign: '=', label: 'Résultante totale', val: getWithdrawalTotal(sub, year, false, projects), color: viewColor, sep: true },
  ] : [
    { sign: '−', label: 'Inj. max BT (dominante)', val: pc(iv.maxHistoricInjectionBT, iv.growthMaxInjectionBT), color: viewColor },
    { sign: '−', label: 'Inj. max MT (dominante)', val: pc(iv.maxHistoricInjectionMT, iv.growthMaxInjectionMT), color: viewColor },
    { sign: '+', label: 'Charge min BT (opposée)', val: pc(iv.minHistoricLoadBT, iv.growthMinLoadBT), color: oppColor },
    { sign: '+', label: 'Charge min MT (opposée)', val: pc(iv.minHistoricLoadMT, iv.growthMinLoadMT), color: oppColor },
    { sign: '=', label: 'Base nette hors réservations', val: getInjectionBaseNet(sub, year, projects), color: viewColor, sep: true },
    { sign: '−', label: 'Réservations ferme', val: getInjectionFirmReservation(sub, year), color: '#ea580c' },
    { sign: '=', label: 'Résultante rigide', val: getInjectionRigid(sub, year, false, projects), color: viewColor, sep: true },
    { sign: '−', label: 'Réservations flexible', val: getInjectionFlexibleReservation(sub, year), color: '#d97706' },
    { sign: '=', label: 'Résultante totale', val: getInjectionTotal(sub, year, false, projects), color: viewColor, sep: true },
  ];

  return (
    <div style={{ marginTop: 14 }}>
      <div className="section-label">Détail composantes · {year}</div>
      <div className="comp-table">
        {rows.map((r, i) => (
          <div key={i} className={`comp-row${r.sep ? ' separator' : ''}`}>
            <span className="comp-sign" style={{ color: r.color }}>{r.sign}</span>
            <span className="comp-label">{r.label}</span>
            <span className="comp-value" style={{ color: r.color }}>{f1(Math.abs(r.val))} MVA</span>
          </div>
        ))}
      </div>
    </div>
  );
}
