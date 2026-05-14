import React, { useState } from 'react';
import { f1, fmtShortDate, uid } from '../../../utils/format.js';
import { useProjects } from '../../App.jsx';
import { calcCapacityN, calcCapacityN1 } from '../../../engines/capacity.js';
import {
  getDirectCapacityN1AtYear, getDirectCapacityNAtYear,
  getReverseCapacityN1AtYear, getReverseCapacityNAtYear,
  getWithdrawalRigid, getInjectionRigid, getResidualWithdrawalRigid,
  getUtilizationWithdrawalRigid, getUtilizationInjectionRigid,
  getFirstWithdrawalSaturationYear, getFirstInjectionSaturationYear,
  getWorstDirectionalAlertOverHorizon,
  buildDirectionalSnapshot,
} from '../../../engines/directionalSubstation.js';
import { normalizeSubstations } from '../../../utils/normalize.js';
import { AlertBadge } from '../../shared/badges.jsx';
import { ALERT_CONFIG } from '../../../constants/index.js';
import { EvolutionTab } from './tabs/EvolutionTab.jsx';
import { DemandesQueueTab } from './tabs/DemandesQueueTab.jsx';
import { ConnectedCapacityTab } from './tabs/ConnectedCapacityTab.jsx';
import { InvestissementsTab } from './tabs/InvestissementsTab.jsx';
import { EditSubstationPanel } from './EditSubstationPanel.jsx';
import { ModalShell } from '../../shared/ModalShell.jsx';
import { CustomerRequestForm } from '../requests/components/RequestWorkflowPanels.jsx';

// ── AssumptionsBanner directionnelle ─────────────────────────────────────────
function AssumptionsBanner({ sub, projects }) {
  const [expanded, setExpanded] = useState(false);
  const a = buildDirectionalSnapshot(sub, 2026, 'withdrawal', projects);
  if (!a) return null;
  const wv = a.withdrawalView;

  return (
    <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent-border)', borderRadius: 8,
      padding: expanded ? '10px 14px 12px' : '8px 14px', marginBottom: 12, fontSize: 12, transition: 'all .15s' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--accent-muted)' }}>
            Hypothèses directionnelles
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Réf. <strong className="mono" style={{ color: 'var(--accent)' }}>{a.referenceYear}</strong>
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Ratio inv. <strong className="mono" style={{ color: 'var(--accent)' }}>×{a.reverseCapacityRatio.toFixed(2)}</strong>
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Cap. dir. N-1 <strong className="mono" style={{ color: 'var(--accent)' }}>{f1(a.capDirN1)} MVA</strong>
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Cap. inv. N-1 <strong className="mono" style={{ color: 'var(--accent)' }}>{f1(a.capRevN1)} MVA</strong>
          </span>
          {a.projectsIncluded.length > 0 && (
            <span style={{ color: 'var(--accent)' }}>{a.projectsIncluded.length} projet(s) intégré(s)</span>
          )}
        </div>
        <button type="button" onClick={() => setExpanded(e => !e)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11,
            color: 'var(--accent-muted)', fontFamily: 'inherit', padding: '2px 6px', borderRadius: 4 }}>
          {expanded ? '▲ Réduire' : '▾ Détail'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: '8px 24px', fontSize: 12 }}>
          <span style={{ color: 'var(--text-secondary)' }}>
            Load max BT/MT : <strong className="mono">{f1(wv.maxHistoricLoadBT)} / {f1(wv.maxHistoricLoadMT)} MVA</strong>
          </span>
          <span style={{ color: 'var(--text-secondary)' }}>
            Taux BT/MT : <strong className="mono">{(wv.growthLoadMaxBT*100).toFixed(1)} / {(wv.growthLoadMaxMT*100).toFixed(1)} %/an</strong>
          </span>
          {a.projectsIncluded.length > 0 && (
            <span style={{ color: 'var(--text-secondary)' }}>
              Projets inclus : <strong>{a.projectsIncluded.map(p => p.name).join(', ')}</strong>
            </span>
          )}
          {a.projectsExcluded.filter(p => p.reason !== 'annulé').length > 0 && (
            <span style={{ color: 'var(--text-muted)' }}>
              Après horizon : {a.projectsExcluded.filter(p => p.reason !== 'annulé').map(p => p.name).join(', ')}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── En-tête directionnel — 4 capacités + taux 2026 ──────────────────────────
function DirectionalHeader({ sub, projects }) {
  const capDN1 = getDirectCapacityN1AtYear(sub, 2026, projects);
  const capDN  = getDirectCapacityNAtYear(sub, 2026, projects);
  const capRN1 = getReverseCapacityN1AtYear(sub, 2026, projects);
  const capRN  = getReverseCapacityNAtYear(sub, 2026, projects);
  const wRigid = getWithdrawalRigid(sub, 2026, false, projects);
  const iRigid = getInjectionRigid(sub, 2026, false, projects);
  const uWR    = getUtilizationWithdrawalRigid(sub, 2026, projects);
  const uIR    = getUtilizationInjectionRigid(sub, 2026, projects);

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
      {/* Capacités directe */}
      <div className="dir-card" style={{ flex: '1 1 100px' }}>
        <div className="dir-card__label">Cap. directe N-1</div>
        <div className="dir-card__value" style={{ color: 'var(--text-primary)' }}>{f1(capDN1)} <span style={{ fontSize: 11, fontWeight: 500 }}>MVA</span></div>
        {capDN != null && <div className="dir-card__sub">N : {f1(capDN)} MVA</div>}
      </div>
      {/* Capacité inverse */}
      <div className="dir-card" style={{ flex: '1 1 100px' }}>
        <div className="dir-card__label">Cap. inverse N-1</div>
        <div className="dir-card__value" style={{ color: 'var(--text-primary)' }}>{f1(capRN1)} <span style={{ fontSize: 11, fontWeight: 500 }}>MVA</span></div>
        {capRN != null && <div className="dir-card__sub">N : {f1(capRN)} MVA</div>}
      </div>
      {/* Prélèvement 2026 */}
      <div className="dir-card prelev" style={{ flex: '1 1 120px' }}>
        <div className="dir-card__label">⬆ Prélèvement 2026</div>
        <div className="dir-card__value">{f1(wRigid)} <span style={{ fontSize: 11, fontWeight: 500 }}>MVA rigide</span></div>
        <div className="dir-card__sub">{(uWR*100).toFixed(1)}% util. N-1</div>
      </div>
      {/* Injection 2026 */}
      <div className="dir-card inj" style={{ flex: '1 1 120px' }}>
        <div className="dir-card__label">⬇ Injection 2026</div>
        <div className="dir-card__value">{f1(Math.abs(iRigid))} <span style={{ fontSize: 11, fontWeight: 500 }}>MVA rigide</span></div>
        <div className="dir-card__sub">{uIR > 0 ? `${(uIR*100).toFixed(1)}% util. N-1` : '— Pas de contrainte'}</div>
      </div>
    </div>
  );
}

// ── Page principale ────────────────────────────────────────────────────────────
export function SubstationDetail({ sub, initialTab = 'evolution', onBack, onUpdate, prevViewLabel, onNavigateToRequest }) {
  const [tab, setTab]       = useState(initialTab);
  const [editPanel, setEditPanel] = useState(null);
  const [toast, setToast]   = useState(null);
  const projects = useProjects();

  const worst = getWorstDirectionalAlertOverHorizon(sub, projects);
  const satW  = getFirstWithdrawalSaturationYear(sub, projects);
  const satI  = getFirstInjectionSaturationYear(sub, projects);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(null), 3500); };

  const handleSaveReq = data => {
    const exists = sub.connectionRequests.find(r => r.id === data.id);
    const reqs = exists
      ? sub.connectionRequests.map(r => r.id === data.id ? data : r)
      : [...sub.connectionRequests, { ...data, id: data.id || uid() }];
    onUpdate({ ...sub, connectionRequests: reqs });
    setEditPanel(null);
    showToast('✓ Demande enregistrée');
  };

  const handleDelReq = id => {
    onUpdate({ ...sub, connectionRequests: sub.connectionRequests.filter(r => r.id !== id) });
    showToast('Demande supprimée');
  };

  const handleSaveParams = data => {
    onUpdate(normalizeSubstations([data])[0]);
    setEditPanel(null);
    showToast('✓ Paramètres enregistrés');
  };

  const tabs = [
    { id: 'evolution',       label: 'Évolution' },
    { id: 'demandes',        label: 'Demandes' },
    { id: 'raccordes',       label: 'Raccordés' },
    { id: 'investissements', label: 'Investissements' },
  ];

  return (
    <div style={{ paddingBottom: 40 }}>
      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      {/* Breadcrumb */}
      <button onClick={onBack} className="btn-back">
        ← Retour {prevViewLabel ? `à ${prevViewLabel}` : 'à la liste'}
      </button>

      {/* Header SS */}
      <div className="ss-header">
        <div className="flex items-start justify-between gap-6">
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Nom + badge alerte */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <h2 className="ss-header__name">{sub.name}</h2>
              <AlertBadge level={worst}/>
              {sub.id.startsWith('ss-new') && <span className="ss-badge-new">✦ Nouvelle SS</span>}
              {sub.status === 'hors_service' && <span className="ss-badge-offline">Hors service</span>}
            </div>

            {/* Code + commune */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span className="ss-header__code">{sub.code}</span>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {sub.commune} · {sub.voltageLevel}
                {sub.voltageUpstream && ` · Alim. ${sub.voltageUpstream}`}
              </span>
            </div>

            {/* Métriques directionnelles */}
            <DirectionalHeader sub={sub} projects={projects} />

            {/* Notes */}
            {sub.notes && <div className="notes-box">{sub.notes}</div>}
          </div>

          {/* Actions */}
          <div className="actions-col">
            <button onClick={() => setEditPanel({ mode: 'substationParams', item: sub })}
              className="btn-secondary" style={{ fontSize: 12 }}>
              Paramètres
            </button>
            {satW && (
              <div className="status-dot-badge status-dot-badge--danger">
                <span className="status-dot-badge__dot"/>
                Sat. prél. · {satW}
              </div>
            )}
            {satI && (
              <div className="status-dot-badge status-dot-badge--purple">
                <span className="status-dot-badge__dot"/>
                Sat. inj. · {satI}
              </div>
            )}
            {!satW && !satI && (
              <div className="status-dot-badge status-dot-badge--success">
                <span className="status-dot-badge__dot"/>
                Pas de saturation
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <AssumptionsBanner sub={sub} projects={projects} />
        <div className="detail-tabs">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`detail-tab ${tab === t.id ? 'active' : ''}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ padding: 20 }}>
          {tab === 'evolution'       && <EvolutionTab sub={sub}/>}
          {tab === 'demandes'        && (
            <DemandesQueueTab sub={sub}
              onAdd   ={() => setEditPanel({ mode: 'request', item: null })}
              onEdit  ={item => item?.id && onNavigateToRequest
                ? onNavigateToRequest(sub.id, item.id)
                : setEditPanel({ mode: 'request', item })}
              onDelete={handleDelReq}
              onUpdate={onUpdate}
              onNavigateToRequest={onNavigateToRequest}/>
          )}
          {tab === 'raccordes'       && (
            <ConnectedCapacityTab sub={sub} onUpdate={onUpdate} onNavigateToRequest={onNavigateToRequest}/>
          )}
          {tab === 'investissements' && <InvestissementsTab sub={sub}/>}
        </div>
      </div>

      {/* Panels */}
      {editPanel?.mode === 'request' && (
        <ModalShell
          title="Nouvelle demande client"
          subtitle="Création limitée aux données client"
          onClose={() => setEditPanel(null)}
          wide
        >
          <CustomerRequestForm
            req={editPanel.item}
            sub={sub}
            onSave={handleSaveReq}
            onClose={() => setEditPanel(null)}
          />
        </ModalShell>
      )}
      {editPanel?.mode === 'substationParams' && (
        <EditSubstationPanel
          item={editPanel.item}
          subName={sub.name}
          onSave={handleSaveParams}
          onClose={() => setEditPanel(null)}
        />
      )}
    </div>
  );
}
