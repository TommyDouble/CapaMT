import React, { useState } from 'react';
import { ALERT_CONFIG, DECISION_CONFIG, TYPE_COLORS, STATUS_COLORS,
         INJ_SOURCES, PREV_USAGES } from '../../constants/index.js';
import { f1, pct, statusLabel, fmtShortDate } from '../../utils/format.js';
import { getAlertLevel } from '../../engines/load.js';

/** Ligne de formulaire avec label, hint, message d'erreur. */
export function FormRow({label,children,error,hint}) {
  return (
    <div>
      {label && <label className="form-label">{label}</label>}
      {children}
      {hint && !error && <p className="form-hint">{hint}</p>}
      {error && <p className="form-error">⚠ {error}</p>}
    </div>
  );
}

/** Section accordéon avec titre et badge optionnel. */
export function Section({title, badge, color='var(--accent)', children, defaultOpen=true}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{border:'1px solid var(--border)',borderRadius:10,overflow:'hidden',marginBottom:12}}>
      <button type="button" onClick={()=>setOpen(o=>!o)}
        style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',
          padding:'10px 14px',background:open?'var(--slate)':'#fff',border:'none',cursor:'pointer',
          fontFamily:'inherit',transition:'background .15s'}}>
        <span style={{fontSize:11,fontWeight:800,textTransform:'uppercase',letterSpacing:'.07em',color}}>
          {title}
        </span>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          {badge && <span style={{fontSize:11,color:'var(--text-muted)',fontWeight:500}}>{badge}</span>}
          <span style={{color:'var(--text-muted)',fontSize:13,transform:open?'':'rotate(-90deg)',transition:'transform .15s'}}>▾</span>
        </div>
      </button>
      {open && <div style={{padding:14,background:'#fff'}}>{children}</div>}
    </div>
  );
}

/** Éditeur de lignes de détail injection (sources ENR, cogen…). */
export function DetailInjEditor({items, onChange}) {
  const add    = () => onChange([...items, {source:'PV', puissanceInstallee:'', puissanceContractuelle:''}]);
  const remove = i  => onChange(items.filter((_,j)=>j!==i));
  const set    = (i,k,v) => { const n=[...items]; n[i]={...n[i],[k]:v}; onChange(n); };
  return (
    <div className="space-y-2">
      {items.map((it,i)=>(
        <div key={i} style={{display:'flex',gap:8,alignItems:'flex-end'}}>
          <FormRow label="Source" style={{flex:'0 0 110px'}}>
            <select value={it.source} onChange={e=>set(i,'source',e.target.value)} className="input-field">
              {INJ_SOURCES.map(s=><option key={s}>{s}</option>)}
            </select>
          </FormRow>
          <FormRow label="P. installée (MVA)" style={{flex:1}}>
            <input type="number" step=".1" min="0" value={it.puissanceInstallee}
              onChange={e=>set(i,'puissanceInstallee',e.target.value)} className="input-field"/>
          </FormRow>
          <FormRow label="P. contractuelle (MVA)" style={{flex:1}}>
            <input type="number" step=".1" min="0" value={it.puissanceContractuelle}
              onChange={e=>set(i,'puissanceContractuelle',e.target.value)} className="input-field"/>
          </FormRow>
          <button type="button" onClick={()=>remove(i)} style={{marginBottom:1,color:'#ef4444',background:'none',border:'none',cursor:'pointer',fontSize:18,padding:'0 4px'}}>✕</button>
        </div>
      ))}
      <button type="button" onClick={add}
        style={{fontSize:12,color:'#059669',background:'none',border:'1.5px dashed #a7f3d0',borderRadius:8,padding:'5px 14px',cursor:'pointer',fontFamily:'inherit',fontWeight:600,width:'100%'}}>
        + Ajouter une source d'injection
      </button>
    </div>
  );
}

/** Éditeur de lignes de détail prélèvement (usages, process, VE…). */
export function DetailPrevEditor({items, onChange}) {
  const add    = () => onChange([...items, {usage:'process', puissance:'', flexible:false}]);
  const remove = i  => onChange(items.filter((_,j)=>j!==i));
  const set    = (i,k,v) => { const n=[...items]; n[i]={...n[i],[k]:v}; onChange(n); };
  return (
    <div className="space-y-2">
      {items.map((it,i)=>(
        <div key={i} style={{display:'flex',gap:8,alignItems:'flex-end'}}>
          <FormRow label="Usage" style={{flex:'0 0 130px'}}>
            <select value={it.usage} onChange={e=>set(i,'usage',e.target.value)} className="input-field">
              {PREV_USAGES.map(u=><option key={u}>{u}</option>)}
            </select>
          </FormRow>
          <FormRow label="Puissance (MVA)" style={{flex:1}}>
            <input type="number" step=".1" min="0" value={it.puissance}
              onChange={e=>set(i,'puissance',e.target.value)} className="input-field"/>
          </FormRow>
          <div style={{flex:'0 0 100px',paddingBottom:2}}>
            <label className="form-label" style={{display:'block',marginBottom:6}}>Flexible</label>
            <div style={{display:'flex',alignItems:'center',gap:6,height:34}}>
              <input type="checkbox" checked={!!it.flexible} onChange={e=>set(i,'flexible',e.target.checked)}
                style={{width:15,height:15,cursor:'pointer'}}/>
              <span style={{fontSize:12,color:'var(--text-secondary)'}}>pilotable</span>
            </div>
          </div>
          <button type="button" onClick={()=>remove(i)} style={{marginBottom:1,color:'#ef4444',background:'none',border:'none',cursor:'pointer',fontSize:18,padding:'0 4px'}}>✕</button>
        </div>
      ))}
      <button type="button" onClick={add}
        style={{fontSize:12,color:'var(--accent)',background:'none',border:'1.5px dashed var(--navy-20)',borderRadius:8,padding:'5px 14px',cursor:'pointer',fontFamily:'inherit',fontWeight:600,width:'100%'}}>
        + Ajouter un type de prélèvement
      </button>
    </div>
  );
}

/** 4 champs puissance en grille 2×2 (prél. rigide/pilotable, inj. garantie/pilotable). */
export function PowerFields({form, setField, errors}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="power-box rigid">
          <p className="power-label-rigid mb-2">⬇ Prélèvement rigide</p>
          <FormRow label="" error={errors?.powerRigid}>
            <input type="number" step=".1" min="0" value={form.powerRigid}
              onChange={e=>setField('powerRigid',e.target.value)}
              placeholder="0.0" className="input-field"/>
          </FormRow>
          <p className="form-hint">MVA · permanent, non pilotable</p>
        </div>
        <div className="power-box pilot">
          <p className="power-label-pilot mb-2">⬇ Prélèvement pilotable</p>
          <FormRow label="" error={errors?.powerPilotable}>
            <input type="number" step=".1" min="0" value={form.powerPilotable}
              onChange={e=>setField('powerPilotable',e.target.value)}
              placeholder="0.0" className="input-field"/>
          </FormRow>
          <p className="form-hint">MVA · effaçable / modulable</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="power-box inj-rigid">
          <p className="power-label-inj-r mb-2">⬆ Injection garantie</p>
          <FormRow label="" error={errors?.injectionRigide}>
            <input type="number" step=".1" min="0" value={form.injectionRigide}
              onChange={e=>setField('injectionRigide',e.target.value)}
              placeholder="0.0" className="input-field"/>
          </FormRow>
          <p className="form-hint">MVA · base ENR firm / garantie</p>
        </div>
        <div className="power-box inj-pilot">
          <p className="power-label-inj-p mb-2">⬆ Injection pilotable</p>
          <FormRow label="" error={errors?.injectionPilotable}>
            <input type="number" step=".1" min="0" value={form.injectionPilotable}
              onChange={e=>setField('injectionPilotable',e.target.value)}
              placeholder="0.0" className="input-field"/>
          </FormRow>
          <p className="form-hint">MVA · curtailable / interruptible</p>
        </div>
      </div>
      {(()=>{
        const pR=parseFloat(form.powerRigid)||0,pP=parseFloat(form.powerPilotable)||0;
        const iR=parseFloat(form.injectionRigide)||0,iP=parseFloat(form.injectionPilotable)||0;
        const netR=pR-iR, netT=pR+pP-iR-iP;
        if(pR+pP+iR+iP===0) return null;
        return (
          <div className="rounded-lg px-4 py-3 flex items-center gap-6 text-xs"
            style={{background:'#f8fafc',border:'1.5px solid #e2e8f0'}}>
            <span className="text-muted">Bilan net calculé :</span>
            <span>Rigide : <strong className={`mono ${netR>0?'text-red-700':netR<0?'text-emerald-700':'text-gray-500'}`}>{netR>0?'+':''}{f1(netR)} MVA</strong></span>
            <span>Total (enveloppe) : <strong className={`mono ${netT>0?'text-orange-700':netT<0?'text-emerald-700':'text-gray-500'}`}>{netT>0?'+':''}{f1(netT)} MVA</strong></span>
          </div>
        );
      })()}
    </div>
  );
}
