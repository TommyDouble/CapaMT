import React, { useState } from 'react';
import { REQ_TYPES, ALERT_CONFIG,
  YEARS, REQ_STATUSES, INV_STATUSES
} from '../../../constants/index.js';
import { f1, pct, uid, fmtDate,
  statusLabel
} from '../../../utils/format.js';
import { safeNum } from '../../../utils/numbers.js';
import { useProjects } from '../../App.jsx';
import { getCapacityAtYear } from '../../../engines/capacity.js';
import {
  getOrganicLoad, getNetRigidLoad, getResidualRigid, getUtilizationRigid, getAlertLevel,
  getUtilizationTotal, getWorstAlertRigid, getFirstSatYearRigid, getFirstCritNYearRigid
} from '../../../engines/load.js';
import { getQueueAnalysis, getEffectiveRigidReservation } from '../../../engines/queue.js';
import { FormRow } from '../../shared/forms.jsx';
import { reqClientPrelevFerme, reqClientPrelevFlexible, reqClientInjFerme, reqClientInjFlexible, reqGrdPrelevFerme, reqGrdPrelevFlexible } from '../../../engines/requests.js';
import { AlertBadge, Tag } from '../../shared/badges.jsx';

const INV_TYPES = ['renforcement', 'extension', 'remplacement', 'création'];
const SAISIE_REQ_DEFAULTS = {
  name:'', refProjet:'', type:'industriel', status:'en_étude',
  yearSouhaitee:2027, year:2027,
  client:{ prelevFerme:'', prelevFlexible:'', injFerme:'', injFlexible:'',
    detailInjection:[], detailPrelevement:[] },
  grd:null,
};
const SAISIE_INV_DEFAULTS = {
  name:'', type:'renforcement', status:'planifié', year:2028,
  capacityAdded:'', cost:'', notes:'',
};


/** Sélecteur de sous-station pour la page de saisie. */
function SubSelector({substations, value, onChange}) {
  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {substations.map(s=>{
        const rR = getUtilizationRigid(s,2026, 1.0);
        const lvl = getAlertLevel(rR);
        const c = ALERT_CONFIG[lvl];
        return (
          <div key={s.id} className={`sub-option ${value===s.id?'selected':''}`} onClick={()=>onChange(s.id)}>
            <span style={{background:c.color}} className="sub-option-dot"/>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-primary truncate">{s.name}</div>
              <div style={{fontSize:11,color:"var(--text-muted)"}}>{s.code} · {s.voltageLevel}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="mono text-xs font-bold" style={{color:c.color}}>{pct(rR)}</div>
              <div style={{fontSize:11,color:"var(--text-muted)"}}>{f1(getResidualRigid(s,2026, 1.0))} MVA rés.</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SaisieImpactPreview({sub, entryType, form}) {
  const projects = useProjects();
  if (!sub) return (
    <div className="card flex flex-col items-center justify-center p-10 text-center" style={{minHeight:400}}>
      <div style={{fontSize:48,marginBottom:12,opacity:.3}}>—</div>
      <p style={{fontSize:13,fontWeight:600,color:'var(--text-muted)'}}>Aperçu d'impact</p>
      <p className="form-hint">Sélectionnez une sous-station<br/>pour voir l'impact en temps réel</p>
    </div>
  );
  const pR = parseFloat(form.client?.prelevFerme)||0;
  const pP = parseFloat(form.client?.prelevFlexible)||0;
  const iR = parseFloat(form.client?.injFerme)||0;
  const iP = parseFloat(form.client?.injFlexible)||0;
  const year = parseInt(form.yearSouhaitee||form.year)||2026;
  const isValidReq = entryType==='demande' && (pR+pP+iR+iP)>0;
  const isValid = isValidReq;

  const simSub = isValid ? {
    ...sub,
    connectionRequests: entryType==='demande'
      ? [...sub.connectionRequests, {
          id:'__prev__',
          name: form.name || '(prévisualisation)',
          type: form.type || 'industriel',
          year, yearSouhaitee: year,
          status: form.status || 'en_étude',
          // A8: utiliser modèle client/grd
          client: {
            prelevFerme:    pR, prelevFlexible: pP,
            injFerme:       iR, injFlexible:    iP,
            detailInjection: [], detailPrelevement: [],
          },
          grd: null,
        }]
      : sub.connectionRequests,
  } : null;

  const displayYears = YEARS.filter(y=>y>=year).slice(0,6);

  return (
    <div className="space-y-4">
      <div className="card" style={{padding:16}}>
        <div className="flex items-center gap-2 mb-1">
          <span style={{fontWeight:700,color:'var(--text-primary)'}}>{sub.name}</span>
          <AlertBadge level={getWorstAlertRigid(sub,2026,2035, 1.0,projects)} size="xs"/>
        </div>
        <div className="text-xs text-muted flex gap-3">
          <span>Cap. N-1 : <strong className="mono">{f1(sub.plannableCapacity)} MVA</strong></span>
          <span>Rés. rigide 2026 : <strong className="mono">{f1(getResidualRigid(sub,2026, 1.0,projects))} MVA</strong></span>
        </div>
      </div>

      <div className="card" style={{overflow:"hidden"}}>
        <div className="px-4 py-3 border-b border-lighter flex items-center justify-between">
          <h4 className="text-xs font-bold text-secondary uppercase tracking-wider">Impact sur la charge</h4>
          {isValid && (
            <span style={{background:'#f0fdf4',border:'1px solid #bbf7d0',color:'#166534'}}
              className="text-xs px-2 py-0.5 rounded-full font-semibold">● Simulation active</span>
          )}
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr style={{background:'var(--bg-muted)'}}>
              <th className="text-left px-4 py-2 font-semibold text-muted border-b border-lighter">Année</th>
              <th className="text-right px-3 py-2 font-semibold text-muted border-b border-lighter">Taux rig. avant</th>
              {isValid && <th style={{textAlign:"right",padding:"8px 12px",fontWeight:600,color:"var(--accent)",borderBottom:"1px solid var(--border)"}}>Taux rig. après</th>}
              <th className="text-right px-3 py-2 font-semibold text-muted border-b border-lighter">Taux tot. avant</th>
              {isValid && <th className="text-right px-3 py-2 font-semibold text-orange-600 border-b border-lighter">Taux tot. après</th>}
              {isValid && <th className="text-right px-4 py-2 font-semibold text-muted border-b border-lighter">Δ rés. rigide</th>}
            </tr>
          </thead>
          <tbody>
            {displayYears.map(y=>{
              const rRb = getUtilizationRigid(sub,y, 1.0,projects);
              const rTb = getUtilizationTotal(sub,y, 1.0,projects);
              const rRa = simSub ? getUtilizationRigid(simSub,y, 1.0,projects) : null;
              const rTa = simSub ? getUtilizationTotal(simSub,y, 1.0,projects) : null;
              const delta = (rRa!==null) ? (getResidualRigid(simSub,y, 1.0,projects)-getResidualRigid(sub,y, 1.0,projects)) : null;
              const isEY = y===year;
              return (
                <tr key={y} style={{background: isEY&&isValid ? 'var(--accent-dim)' : y%2===0 ? 'var(--bg-raised)' : 'var(--bg-muted)'}}>
                  <td style={{padding:'8px 16px',fontFamily:'var(--font-mono)',fontWeight:700,color:isEY&&isValid?'var(--accent)':'var(--text-primary)'}}>{y}{isEY&&isValid&&<span style={{marginLeft:4,color:'var(--accent-light)'}}>←</span>}</td>
                  <td className="px-3 py-2 text-right"><span style={{color:ALERT_CONFIG[getAlertLevel(rRb)].color}} className="mono font-semibold">{pct(rRb)}</span></td>
                  {isValid && <td className="px-3 py-2 text-right"><span style={{color:ALERT_CONFIG[getAlertLevel(rRa)].color}} className="mono font-bold">{pct(rRa)}</span></td>}
                  <td className="px-3 py-2 text-right"><span style={{color:ALERT_CONFIG[getAlertLevel(rTb)].color,opacity:.8}} className="mono">{pct(rTb)}</span></td>
                  {isValid && <td className="px-3 py-2 text-right"><span style={{color:ALERT_CONFIG[getAlertLevel(rTa)].color}} className="mono">{pct(rTa)}</span></td>}
                  {isValid && <td className="px-4 py-2 text-right mono font-bold">
                    {delta!=null ? <span className={delta>0?'delta-neg':delta<0?'delta-pos':'delta-0'}>{delta>0?'+':''}{f1(delta)}</span> : '—'}
                  </td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {isValid && simSub && (()=>{
        const satRbefore = getFirstSatYearRigid(sub, 1.0,projects);
        const satRafter  = getFirstSatYearRigid(simSub, 1.0,projects);
        const satNbefore = getFirstCritNYearRigid(sub, 1.0,projects);
        const satNafter  = getFirstCritNYearRigid(simSub, 1.0,projects);
        // Cas le plus grave d'abord
        if (!satNbefore && satNafter) return (
          <div style={{background:'#fef2f2',border:'1.5px solid #f87171',borderRadius:12,padding:14}}>
            <p className="font-bold text-xs uppercase tracking-wide" style={{color:'#450a0a'}}>PROBLÈME CRITIQUE — Dépassement de la capacité N</p>
            <p className="text-xs mt-1" style={{color:'#7f1d1d'}}>
              La charge rigide dépasse la capacité en exploitation normale dès <strong>{satNafter}</strong>. Cette situation est un problème en fonctionnement courant, pas uniquement en secours.
            </p>
          </div>
        );
        if (!satRbefore && satRafter) return (
          <div style={{background:'#fef2f2',border:'1.5px solid #fecaca',borderRadius:12,padding:14}}>
            <p className="font-bold text-xs" style={{color:'#7f1d1d'}}>⚠ Cette demande crée une saturation N-1</p>
            <p className="text-xs mt-1" style={{color:'#dc2626'}}>{sub.name} atteindra la saturation N-1 en <strong>{satRafter}</strong>.</p>
          </div>
        );
        if (false && satRbefore && !satRafter) return (
          <div style={{background:'#f0fdf4',border:'1.5px solid #bbf7d0',borderRadius:12,padding:14}}>
            <p style={{fontWeight:700,fontSize:11,color:"var(--green)"}}>✓ Cet investissement résout la saturation N-1</p>
            <p style={{fontSize:11,marginTop:4,color:"var(--green)"}}>La saturation prévue en <strong>{satRbefore}</strong> est levée.</p>
          </div>
        );
        return null;
      })()}
    </div>
  );
}

export function ActivityLog({log, onDelete, onNavigate}) {
  if (log.length===0) return null;
  const fmt = d => {
    const diff = Math.floor((new Date()-new Date(d))/1000);
    if (diff<60) return 'À l\'instant';
    if (diff<3600) return `Il y a ${Math.floor(diff/60)} min`;
    return new Date(d).toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'});
  };
  return (
    <div className="card" style={{overflow:"hidden"}}>
      <div className="px-5 py-3.5 border-b border-lighter flex items-center justify-between">
        <div><h3 style={{fontSize:13,fontWeight:700,color:'var(--text-primary)'}}>Journal de session</h3>
          <p className="text-xs text-muted mt-0.5">{log.length} saisie(s) · la suppression retire l'entrée du réseau</p></div>
      </div>
      <div>
        {log.map((entry,i)=>{
          const isDem = entry.entryType==='demande';
          const d = entry.data;
          return (
            <div key={entry.id} className={`log-row ${i===0?'slide-down':''}`}>
              <span style={{fontSize:16}}>{isDem?'DR':'PR'}</span>
              <div style={{flex:1,minWidth:0}}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span style={{fontWeight:600,color:'var(--text-secondary)',fontSize:11}}>{d.name}</span>
                  {d.type && <Tag v={d.type}/>}
                  {d.status && <Tag v={d.status}/>}
                  <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--text-muted)'}}>
                    {isDem
                      ? (() => {
                          const pF = reqClientPrelevFerme(d), pFl = reqClientPrelevFlexible(d);
                          const iF = reqClientInjFerme(d),    iFl = reqClientInjFlexible(d);
                          const yr = d.yearSouhaitee || d.year || '?';
                          const grdStr = d.grd ? ` → GRD: ${f1(reqGrdPrelevFerme(d))}f+${f1(reqGrdPrelevFlexible(d))}flex` : ' (en étude)';
                          return `↓${f1(pF+pFl)} MVA${pFl>0?` (${f1(pF)}f+${f1(pFl)}fl)`:''}`
                            + (iF+iFl>0?` ↑${f1(iF+iFl)} MVA`:'')
                            + grdStr + ` · MES ${yr}`;
                        })()
                      : `+${f1(d.capacityAdded)} MVA cap · MES ${d.year}`}
                  </span>
                </div>
                <div className="text-xs text-muted mt-0.5">
                  <button onClick={()=>onNavigate(entry.subId)} style={{color:"var(--accent)",fontWeight:600,background:"none",border:"none",cursor:"pointer",fontFamily:"inherit"}}>{entry.subName}</button>
                  <span className="mx-1">·</span><span className="mono">{entry.subCode}</span>
                  <span className="mx-1">·</span><span>{fmt(entry.timestamp)}</span>
                </div>
              </div>
              <button onClick={()=>onDelete({logId:entry.id,subId:entry.subId,entryType:entry.entryType,dataId:entry.data.id})}
                className="btn-danger-link flex-shrink-0">Annuler</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SaisiePage({substations, activityLog, onSubmit, onLogDelete, onNavigate, onGoToProjects, inModal}) {
  const [entryType, setEntryType] = useState('demande');
  const [subId, setSubId] = useState('');
  const [form, setForm] = useState(SAISIE_REQ_DEFAULTS);
  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);
  const sub = substations.find(s=>s.id===subId);
  const isDemande = entryType==='demande';
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const switchType = t => { setEntryType(t); setForm(t==='demande'?SAISIE_REQ_DEFAULTS:SAISIE_INV_DEFAULTS); setErrors({}); };

  const validate = () => {
    const e = {};
    if (!subId) e.sub='Sélectionnez une sous-station';
    if (!form.name?.trim()) e.name='Champ requis';
    const pF=parseFloat(form.client?.prelevFerme)||0,
          pFl=parseFloat(form.client?.prelevFlexible)||0,
          iF=parseFloat(form.client?.injFerme)||0,
          iFl=parseFloat(form.client?.injFlexible)||0;
    if (pF+pFl+iF+iFl===0) e.power='Au moins un champ de puissance requis';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length>0) return;
    const yr = parseInt(form.yearSouhaitee||form.year)||2027;
    const data = {
      ...form,
      year: yr, yearSouhaitee: yr,
      client: {
        prelevFerme:    parseFloat(form.client?.prelevFerme)||0,
        prelevFlexible: parseFloat(form.client?.prelevFlexible)||0,
        injFerme:       parseFloat(form.client?.injFerme)||0,
        injFlexible:    parseFloat(form.client?.injFlexible)||0,
        detailInjection:    form.client?.detailInjection    || [],
        detailPrelevement:  form.client?.detailPrelevement  || [],
      },
      grd: null,
    };
    onSubmit({subId,entryType:'demande',data});
    setToast(`✓ Demande "${data.name}" ajoutée sur ${sub.name}`);
    setTimeout(()=>setToast(null),4000);
    setForm(SAISIE_REQ_DEFAULTS);
    setErrors({});
  };

  const accent = 'var(--accent)';
  const accentBg = '#eff6ff';

  return (
    <div className={inModal ? "space-y-4" : "space-y-5 fade-in"}>
      {!inModal && <div><h2 style={{fontSize:18,fontWeight:800,color:"var(--text-primary)",letterSpacing:"-.01em"}}>Saisie centralisée</h2>
        <p style={{fontSize:13,color:"var(--text-muted)",marginTop:3}}>Encodez une demande de raccordement ou un investissement réseau, avec aperçu d'impact immédiat.</p>
      </div>}
      {toast && (
        <div className="toast fixed top-20 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium"
          style={{background:'#f0fdf4',border:'1.5px solid #bbf7d0',color:'#166534',maxWidth:460,zIndex:55}}>
          <span>✓</span><span>{toast}</span>
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'420px 1fr',gap:20,alignItems:'start'}}>
        {/* Formulaire */}
        <div className="space-y-4">
          {/* Étape 1 */}
          <div className="card" style={{padding:20}}>
            <div className="flex items-center gap-2 mb-4">
              <span className="step-num">1</span>
              <span style={{fontSize:13,fontWeight:700,color:'var(--text-primary)'}}>Type d'entrée</span>
            </div>
            <div style={{display:'flex',gap:10}}>
              <button className={`type-card ${isDemande?'active':''}`} onClick={()=>switchType('demande')}>
                <span style={{fontSize:14,display:'block',marginBottom:6,fontWeight:800,fontFamily:'var(--font-mono)',color:'var(--accent)'}}>DR</span>
                <span style={{fontWeight:700,display:'block',fontSize:13}}>Demande de raccordement</span>
                <span style={{fontSize:11,color:'#64748b'}}>Nouveau client, charge ou injection ENR</span>
              </button>
              <div style={{flex:1,border:'1.5px dashed #c4b5fd',borderRadius:10,padding:'14px 16px',background:'#faf5ff',display:'flex',flexDirection:'column',gap:6,justifyContent:'center'}}>
                <span style={{fontSize:14,display:'block',fontWeight:800,fontFamily:'var(--font-mono)',color:'var(--accent)'}}>PR</span>
                <span style={{fontWeight:700,display:'block',fontSize:13,color:'#7c3aed'}}>Projet réseau</span>
                <span style={{fontSize:11,color:'#7c3aed',opacity:.8}}>Renforcement · Création · Suppression</span>
                <button onClick={onGoToProjects}
                  style={{marginTop:4,background:'#7c3aed',color:'#fff',border:'none',borderRadius:6,padding:'5px 12px',cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:600,width:'fit-content'}}>
                  → Aller au portefeuille projets
                </button>
              </div>
            </div>
          </div>
          {/* Étape 2 */}
          <div className="card" style={{padding:20}}>
            <div className="flex items-center gap-2 mb-4">
              <span className={`step-num ${subId?(isDemande?'done':'inv'):''}`} style={!isDemande&&subId?{background:'#7c3aed'}:{}}>2</span>
              <span style={{fontSize:13,fontWeight:700,color:'var(--text-primary)'}}>Sous-station concernée</span>
            </div>
            <FormRow label="" error={errors.sub}>
              <SubSelector substations={substations} value={subId} onChange={v=>{setSubId(v);setErrors(e=>({...e,sub:null}));}}/>
            </FormRow>
          </div>
          {/* Étape 3 */}
          <div className="card" style={{padding:20}}>
            <div className="flex items-center gap-2 mb-4">
              <span className="step-num" style={{background:accent}}>3</span>
              <span style={{fontSize:13,fontWeight:700,color:'var(--text-primary)'}}>{isDemande?'Détails de la demande':'Détails de l\'investissement'}</span>
            </div>
            <div className="space-y-4">
              <FormRow label="Intitulé" error={errors.name}>
                <input value={form.name||''} onChange={e=>set('name',e.target.value)}
                  placeholder={isDemande?'Ex : Parc logistique Bierset Ph.3':'Ex : Remplacement T1 40→63 MVA'}
                  className="input-field"/>
              </FormRow>
              <div className="grid grid-cols-2 gap-3">
                <FormRow label="Type">
                  <select value={form.type||'industriel'} onChange={e=>set('type',e.target.value)} className="input-field">
                    {(isDemande?REQ_TYPES:INV_TYPES).map(t=><option key={t}>{t}</option>)}
                  </select>
                </FormRow>
                <FormRow label="Statut">
                  <select value={form.status} onChange={e=>set('status',e.target.value)} className="input-field">
                    {(isDemande?REQ_STATUSES:INV_STATUSES).map(s=><option key={s} value={s}>{statusLabel(s)}</option>)}
                  </select>
                </FormRow>
              </div>
              {isDemande ? (
                <>
                  <FormRow label="Année de raccordement">
                    <select value={form.year} onChange={e=>set('year',e.target.value)} className="input-field">
                      {YEARS.map(y=><option key={y}>{y}</option>)}
                    </select>
                  </FormRow>
                  <div>
                    <p className="text-xs font-bold text-secondary uppercase tracking-wide mb-2">Prélèvements (↓)</p>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <FormRow label="Ferme (MVA)" error={errors.power}>
                        <input type="number" step=".1" min="0" placeholder="0.0" className="input-field"
                          value={form.client?.prelevFerme||''}
                          onChange={e=>set('client',{...form.client,prelevFerme:e.target.value})}/>
                      </FormRow>
                      <FormRow label="Flexible (MVA)">
                        <input type="number" step=".1" min="0" placeholder="0.0" className="input-field"
                          value={form.client?.prelevFlexible||''}
                          onChange={e=>set('client',{...form.client,prelevFlexible:e.target.value})}/>
                      </FormRow>
                    </div>
                    <p className="text-xs font-bold text-secondary uppercase tracking-wide mb-2">Injections (↑)</p>
                    <div className="grid grid-cols-2 gap-2">
                      <FormRow label="Garanti (MVA)">
                        <input type="number" step=".1" min="0" placeholder="0.0" className="input-field"
                          value={form.client?.injFerme||''}
                          onChange={e=>set('client',{...form.client,injFerme:e.target.value})}/>
                      </FormRow>
                      <FormRow label="Curtailable (MVA)">
                        <input type="number" step=".1" min="0" placeholder="0.0" className="input-field"
                          value={form.client?.injFlexible||''}
                          onChange={e=>set('client',{...form.client,injFlexible:e.target.value})}/>
                      </FormRow>
                    </div>
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <FormRow label="Cap. ajoutée (MVA)" error={errors.cap}>
                    <input type="number" step=".5" min="0" value={form.capacityAdded||''} onChange={e=>set('capacityAdded',e.target.value)} placeholder="Ex : 23" className="input-field"/>
                  </FormRow>
                  <FormRow label="Année MES">
                    <select value={form.year} onChange={e=>set('year',e.target.value)} className="input-field">
                      {YEARS.map(y=><option key={y}>{y}</option>)}
                    </select>
                  </FormRow>
                  <FormRow label="Coût (k€)">
                    <input type="number" step="100" min="0" value={form.cost||''} onChange={e=>set('cost',e.target.value)} placeholder="Ex : 1800" className="input-field"/>
                  </FormRow>
                </div>
              )}
            </div>
          </div>
          <button onClick={handleSubmit}
            style={{width:'100%',background:accent,padding:'12px 20px',borderRadius:10,border:'none',color:'#fff',fontFamily:'inherit',fontSize:14,fontWeight:700,cursor:'pointer'}}>
            {isDemande?'+ Enregistrer la demande':'+ Enregistrer l\'investissement'}
          </button>
          {sub && <div className="text-center">
            <button onClick={()=>onNavigate(sub.id)} style={{fontSize:11,color:'var(--accent)',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit'}}>
              Voir le détail complet de {sub.name} →
            </button>
          </div>}
        </div>
        {/* Preview */}
        <div style={{position:'sticky',top:80}}>
          <SaisieImpactPreview sub={sub} entryType={entryType} form={form}/>
        </div>
      </div>
      {!inModal && <ActivityLog log={activityLog} onDelete={onLogDelete} onNavigate={onNavigate}/>}
    </div>
  );
}
