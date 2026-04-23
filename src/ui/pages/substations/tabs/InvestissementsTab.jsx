import React, { useState } from 'react';
import { PROJ_STATUSES } from '../../../../constants/index.js';
import { useProjects } from '../../../App.jsx';
import { getCapacityAtYear, calcCapacityN1 } from '../../../../engines/capacity.js';
import { f1, fmtShortDate, statusLabel } from '../../../../utils/format.js';

const PROJ_TYPE_CONFIG = {
  renforcement: { label: 'Renforcement', icon: '—', bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
  création:     { label: 'Création',     icon: '✦',  bg: '#f5f3ff', color: '#7c3aed', border: '#c4b5fd' },
  suppression:  { label: 'Suppression',  icon: '⛔', bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
};

export function InvestissementsTab({sub}) {
  const projects = useProjects();
  // Projets qui impactent cette SS
  const relatedProjects = projects.filter(p=>
    (p.effects||[]).some(e=>e.ssId===sub.id || (e.newSS?.id===sub.id))
  );
  const active = relatedProjects.filter(p=>p.status!=='annulé');

  const TYPE_C = PROJ_TYPE_CONFIG;
  const INV_STATUS_PILL = {
    validé:'pill-validé', en_cours:'pill-en-cours',
    planifié:'pill-planifié', annulé:'pill-annulé',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          <strong className="text-primary">{active.length}</strong> projet(s) réseau impactant cette SS ·&nbsp;
          <span className="text-muted">Gestion globale dans l'onglet Investissements</span>
        </div>
      </div>
      <div className="card" style={{overflow:"hidden"}}>
        <table className="w-full">
          <thead><tr className="thead-row">
            <th className="text-left">Projet réseau</th>
            <th className="text-center">Type</th>
            <th className="text-center">MES</th>
            <th className="text-left">Effets sur cette SS</th>
            <th className="text-right">Coût (k€)</th>
            <th className="text-center">Statut</th>
          </tr></thead>
          <tbody>
            {relatedProjects.length>0
              ? relatedProjects.map(proj=>{
                const tc = TYPE_C[proj.type]||TYPE_C.renforcement;
                const myEffects = (proj.effects||[]).filter(e=>e.ssId===sub.id||e.newSS?.id===sub.id);
                const ACTION_SHORT = {
                  modify_tfo:(e)=>{
                    const baseTfos = sub?.transformerConfig?.transformers || [];
                    const rmDetails = (e.tfoChanges?.remove||[]).map(id=>{
                      const t = baseTfos.find(x=>x.id===id);
                      return t ? `${t.id} (${t.power} MVA, ${t.role})` : id;
                    });
                    const addDetails = (e.tfoChanges?.add||[]).map(t=>`${t.id}: ${t.power} MVA (${t.role})`);
                    const parts = [];
                    if (rmDetails.length) parts.push(`⛔ Retirer : ${rmDetails.join(', ')}`);
                    if (addDetails.length) parts.push(`✦ Ajouter : ${addDetails.join(', ')}`);
                    return parts.join(' · ') || '—';
                  },
                  load_transfer:(e)=>`Transfert ${e.loadDelta>0?'+':''}${e.loadDelta} MVA`,
                  decommission:()=>'⛔ Mise hors service à la MES',
                  create_ss:()=>'✦ Création de cette SS',
                };
                return (
                  <tr key={proj.id} className={`data-row ${proj.status==='annulé'?'opacity-40':''}`}>
                    <td className="font-medium text-gray-900">{proj.name}</td>
                    <td className="text-center">
                      <span style={{background:tc.bg,color:tc.color,border:`1px solid ${tc.border}`,padding:'2px 7px',borderRadius:10,fontSize:11,fontWeight:700}}>
                        {tc.icon} {tc.label}
                      </span>
                    </td>
                    <td className="text-center mono font-bold">{proj.year}</td>
                    <td>
                      {myEffects.map((e,i)=>(
                        <div key={i} className="text-xs text-gray-600">{ACTION_SHORT[e.action]?.(e)||e.action}</div>
                      ))}
                    </td>
                    <td className="text-right mono text-muted">{proj.cost?proj.cost.toLocaleString('fr'):'-'}</td>
                    <td className="text-center">
                      <span className={INV_STATUS_PILL[proj.status]||'pill-planifié'}>
                        {statusLabel(proj.status)}
                      </span>
                    </td>
                  </tr>
                );
              })
              : <tr><td colSpan={6} className="empty-state">Aucun projet réseau impactant cette sous-station.</td></tr>}
          </tbody>
        </table>
      </div>
      {relatedProjects.length===0 && (
        <p className="text-xs text-muted text-center">Pour créer ou modifier des projets réseau, rendez-vous dans l'onglet <strong>Investissements</strong> du menu principal.</p>
      )}
    </div>
  );
}
