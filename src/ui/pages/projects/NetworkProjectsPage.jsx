/**
 * NetworkProjectsPage.jsx — v2.0
 * Slim orchestrator: KPIs, filters, table, wizard trigger.
 * Heavy components extracted to /components/.
 *
 * Original: 926 lines → Now: ~230 lines
 */
import React, { useState } from 'react';
import { PROJ_STATUSES, YEARS } from '../../../constants/index.js';
import { f1, statusLabel } from '../../../utils/format.js';
import { useProjects } from '../../App.jsx';
import { getFirstSatYearRigid, isSubstationAtRisk } from '../../../engines/load.js';
import { getFirstInjectionSaturationYear, getFirstWithdrawalSaturationYear } from '../../../engines/directionalSubstation.js';
import { ProjectBudgetChart } from './components/ProjectBudgetChart.jsx';
import { ProjectWizard } from './components/ProjectWizard.jsx';

// UI-level injection at-risk check (engine only checks withdrawal)
function isSubstationAtRiskInjection(sub, projects) {
  const ACTIVE = new Set(['planifié', 'en_cours', 'validé']);
  const risky = (projects || []).filter(p =>
    ACTIVE.has(p.status) && (p.effects || []).some(e =>
      e.ssId === sub.id && ['modify_tfo', 'create_ss'].includes(e.action)
    )
  );
  if (!risky.length) return false;
  const without = (projects || []).filter(p => !risky.find(r => r.id === p.id));
  const satWith = getFirstInjectionSaturationYear(sub, projects);
  const satWithout = getFirstInjectionSaturationYear(sub, without);
  return (!satWith && !!satWithout) || (satWith && satWithout && satWithout < satWith);
}

const PROJ_TYPES = ['renforcement', 'création', 'suppression'];
const PROJ_TYPE_CONFIG = {
  renforcement: { label: 'Renforcement', icon: '—', bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
  création:     { label: 'Création',     icon: '✦',  bg: '#f5f3ff', color: '#7c3aed', border: '#c4b5fd' },
  suppression:  { label: 'Suppression',  icon: '⛔', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
};

const INV_STATUS_PILL = {
  validé: 'pill-validé', en_cours: 'pill-en-cours',
  planifié: 'pill-planifié', annulé: 'pill-annulé',
};

export function NetworkProjectsPage({ substations, allSubstations, projects, onNavigate, onUpdateProject, onAddProject, onDeleteProject }) {
  const [filterType,   setFilterType]   = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [wizard,       setWizard]       = useState(null);

  const active    = projects.filter(p => p.status !== 'annulé');
  const totalCost = active.filter(p => p.cost).reduce((s, p) => s + p.cost, 0);
  const validated = active.filter(p => p.status === 'validé').length;
  const planifié  = active.filter(p => p.status === 'planifié').length;

  const atRisk = allSubstations.filter(sub =>
    sub.status !== 'hors_service' && isSubstationAtRisk(sub, projects)
  );
  const atRiskInj = allSubstations.filter(sub =>
    sub.status !== 'hors_service' && isSubstationAtRiskInjection(sub, projects)
  );

  let filtered = projects;
  if (filterType   !== 'all') filtered = filtered.filter(p => p.type === filterType);
  if (filterStatus !== 'all') filtered = filtered.filter(p => p.status === filterStatus);

  return (
    <div className="space-y-5 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="page-title">Portefeuille projets réseau</h2>
          <p className="page-subtitle">Tous projets · Province de Liège · 2026–2035</p>
        </div>
        <button onClick={() => setWizard({})} className="btn-primary">+ Nouveau projet</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Projets actifs',    val: active.length,                         sub: 'hors annulés',            color: 'var(--text-primary)' },
          { label: 'Validés',           val: validated,                              sub: 'budget engagé',            color: 'var(--green)' },
          { label: 'À valider',         val: planifié,                               sub: 'budget non encore engagé', color: planifié > 0 ? 'var(--amber)' : 'var(--green)' },
          { label: 'Enveloppe estimée', val: `${(totalCost / 1000).toFixed(1)} M€`, sub: `${totalCost.toLocaleString('fr')} k€ cumulés`, color: 'var(--text-primary)' },
        ].map(k => (
          <div key={k.label} className="card" style={{ padding: 14, borderLeft: `3px solid ${k.color}` }}>
            <p className="kpi-label">{k.label}</p>
            <p className="kpi-value" style={{ color: k.color }}>{k.val}</p>
            <p className="kpi-sub">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* At-risk alert — withdrawal */}
      {atRisk.length > 0 && (
        <div style={{ background: 'var(--red-dim)', border: '1px solid rgba(220,38,38,.15)', borderRadius: 8, padding: '12px 16px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
            Prélèvement — {atRisk.length} SS dont la saturation dépend d'un projet non validé
          </p>
          <div className="flex flex-wrap gap-3">
            {atRisk.map(sub => {
              const satNominal = getFirstSatYearRigid(sub, 1.0, projects);
              const satRisk = getFirstSatYearRigid(sub, 1.0, projects.filter(p => p.status !== 'planifié'));
              return (
                <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-raised)', borderRadius: 6, padding: '5px 10px', fontSize: 11, border: '1px solid rgba(220,38,38,.15)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{sub.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--red)' }}>sans : {satRisk || '>2035'} · avec : {satNominal || 'OK'}</span>
                  <button onClick={() => onNavigate(sub.id, 'evolution')} className="btn-edit-link" style={{ fontSize: 10 }}>Voir →</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* At-risk alert — injection */}
      {atRiskInj.length > 0 && (
        <div style={{ background: 'var(--inj-dim)', border: '1px solid var(--inj-border)', borderRadius: 8, padding: '12px 16px' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--inj)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
            Injection — {atRiskInj.length} SS dont la saturation inverse dépend d'un projet non validé
          </p>
          <div className="flex flex-wrap gap-3">
            {atRiskInj.map(sub => {
              const satNom = getFirstInjectionSaturationYear(sub, projects);
              const satNo = getFirstInjectionSaturationYear(sub, projects.filter(p => p.status !== 'planifié'));
              return (
                <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-raised)', borderRadius: 6, padding: '5px 10px', fontSize: 11, border: '1px solid var(--inj-border)' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{sub.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--inj)' }}>sans : {satNo || '>2035'} · avec : {satNom || 'OK'}</span>
                  <button onClick={() => onNavigate(sub.id, 'evolution')} className="btn-edit-link" style={{ fontSize: 10 }}>Voir →</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Budget chart */}
      <div className="card" style={{ padding: 20 }}>
        <h3 className="font-semibold text-primary mb-1">Enveloppe budgétaire par année de mise en service</h3>
        <p className="text-xs text-muted mb-4">Empilé par statut · survol pour voir les projets de l'année</p>
        <ProjectBudgetChart projects={projects} />
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center flex-wrap">
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input-field" style={{ width: 170 }}>
          <option value="all">Tous les types</option>
          {PROJ_TYPES.map(t => <option key={t} value={t}>{PROJ_TYPE_CONFIG[t].icon} {PROJ_TYPE_CONFIG[t].label}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="input-field" style={{ width: 160 }}>
          <option value="all">Tous les statuts</option>
          {PROJ_STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
        </select>
        <span className="text-xs text-muted ml-auto">{filtered.length} projet(s)</span>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="w-full">
          <thead>
            <tr className="thead-row">
              <th className="text-left" style={{ minWidth: 240 }}>Projet</th>
              <th className="text-center">Type</th>
              <th className="text-center">Statut</th>
              <th className="text-center">MES</th>
              <th className="text-right">Coût (k€)</th>
              <th className="text-left">SS impactées</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: 13 }}>Aucun projet ne correspond aux filtres.</td></tr>
            )}
            {filtered.map(proj => {
              const tc = PROJ_TYPE_CONFIG[proj.type] || PROJ_TYPE_CONFIG.renforcement;
              const impactedSS = [...new Set((proj.effects || []).map(e => e.ssId))];
              return (
                <tr key={proj.id} className={`data-row ${proj.status === 'annulé' ? 'opacity-40' : ''}`}>
                  <td>
                    <div className="font-medium text-primary text-sm">{proj.name}</div>
                    {proj.notes && <div className="text-xs text-muted truncate max-w-xs">{proj.notes}</div>}
                  </td>
                  <td className="text-center">
                    <span style={{ background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {tc.icon} {tc.label}
                    </span>
                  </td>
                  <td className="text-center">
                    <span className={INV_STATUS_PILL[proj.status] || 'pill-planifié'}>{statusLabel(proj.status)}</span>
                  </td>
                  <td className="text-center mono font-bold text-gray-900">{proj.year}</td>
                  <td className="text-right mono text-gray-700">{proj.cost ? proj.cost.toLocaleString('fr') : <span style={{ color: 'var(--border-strong)' }}>—</span>}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {impactedSS.slice(0, 3).map(ssId => {
                        const ss = allSubstations.find(s => s.id === ssId);
                        const eff = (proj.effects || []).find(e => e.ssId === ssId);
                        const name = ss?.name || eff?.newSS?.name || ssId;
                        const isNew = ssId.startsWith('ss-new');
                        const isDecom = (proj.effects || []).some(e => e.ssId === ssId && e.action === 'decommission');
                        return (
                          <button key={ssId} onClick={() => ss && onNavigate(ss.id, 'evolution')}
                            style={{
                              background: isDecom ? '#fef2f2' : isNew ? '#f5f3ff' : '#eff6ff',
                              color: isDecom ? '#dc2626' : isNew ? '#7c3aed' : '#1d4ed8',
                              border: `1px solid ${isDecom ? '#fecaca' : isNew ? '#c4b5fd' : '#bfdbfe'}`,
                              borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                              cursor: ss ? 'pointer' : 'default', fontFamily: 'inherit',
                            }}>
                            {isDecom && '⛔ '}{isNew && '✦ '}{name}
                          </button>
                        );
                      })}
                      {impactedSS.length > 3 && <span className="text-xs text-gray-400">+{impactedSS.length - 3}</span>}
                    </div>
                  </td>
                  <td className="text-right pr-3">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => setWizard(proj)} className="btn-edit-link text-xs">Modifier</button>
                      {proj.status === 'annulé'
                        ? <button onClick={() => onDeleteProject(proj.id)} className="text-xs text-red-400 hover:text-red-600">Supprimer</button>
                        : <button onClick={() => onUpdateProject({ ...proj, status: 'annulé' })} className="text-xs text-muted hover:text-red-500">Annuler</button>
                      }
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Wizard */}
      {wizard !== null && (
        <ProjectWizard
          project={Object.keys(wizard).length > 0 ? wizard : null}
          substations={substations}
          allSubstations={allSubstations}
          onSave={proj => {
            if (proj.id) onUpdateProject(proj);
            else onAddProject(proj);
            setWizard(null);
          }}
          onClose={() => setWizard(null)}
        />
      )}
    </div>
  );
}
