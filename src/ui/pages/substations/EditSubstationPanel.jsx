import React, { useState, useMemo } from 'react';
import { FOISON_DEFAULTS } from '../../../constants/index.js';
import { safeNum } from '../../../utils/numbers.js';
import { f1 } from '../../../utils/format.js';
import { calcCapacityN1, calcCapacityN } from '../../../engines/capacity.js';
import { FormRow, Section } from '../../shared/forms.jsx';
import { ModalShell } from '../../shared/ModalShell.jsx';

const SUB_PAR_DEFAULTS = {
  withdrawalBaseMva:'', withdrawalGrowthPct:'2.00', notes:'',
  tfos:[{id:'T1',power:'',role:'normal'}],
  coeffN:'0.90', coeffN1:'1.00', mtBackupEnabled:false, mtBackupCapacity:'',
  reverseCapacityRatio:'1.00',
  foison: Object.fromEntries(Object.keys(FOISON_DEFAULTS).map(t=>[t,String(FOISON_DEFAULTS[t])])),
};

/** Éditeur inline des transformateurs d'une SS. */
function TfoEditorInline({ tfos, onChange }) {
  const addRow = () => {
    const nextId = `T${tfos.length + 1}`;
    onChange([...tfos, { id: nextId, power: '', role: 'normal' }]);
  };
  const removeRow = (i) => onChange(tfos.filter((_,j) => j !== i));
  const setField = (i, k, v) => {
    const next = [...tfos];
    next[i] = { ...next[i], [k]: v };
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {tfos.map((t, i) => (
        <div key={i} className="flex items-center gap-2 p-2.5 bg-white rounded-lg border border-light">
          <div style={{flex:'0 0 70px'}}>
            <label className="block text-xs text-muted mb-0.5">ID</label>
            <input value={t.id} onChange={e=>setField(i,'id',e.target.value)}
              className="input-field text-xs mono" placeholder="T1"/>
          </div>
          <div style={{flex:'0 0 90px'}}>
            <label className="block text-xs text-muted mb-0.5">Puissance (MVA)</label>
            <input type="number" step="0.5" min="0" value={t.power}
              onChange={e=>setField(i,'power',e.target.value)}
              className="input-field text-xs mono" placeholder="40"/>
          </div>
          <div style={{flex:1}}>
            <label className="block text-xs text-muted mb-0.5">Rôle</label>
            <select value={t.role} onChange={e=>setField(i,'role',e.target.value)} className="input-field text-xs">
              <option value="normal">Exploitation normale</option>
              <option value="secours">Secours uniquement</option>
            </select>
          </div>
          {tfos.length > 1 && (
            <button type="button" onClick={()=>removeRow(i)}
              style={{marginTop:16,color:'#ef4444',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:18,lineHeight:1,padding:'0 4px'}}
              title="Supprimer ce transformateur">✕</button>
          )}
        </div>
      ))}
      {tfos.length < 3 && (
        <button type="button" onClick={addRow}
          style={{fontSize:12,color:'#1d4ed8',background:'none',border:'1.5px dashed #bfdbfe',borderRadius:8,
            padding:'6px 14px',cursor:'pointer',fontFamily:'inherit',fontWeight:600,width:'100%'}}>
          + Ajouter un transformateur
        </button>
      )}
    </div>
  );
}

export function EditSubstationPanel({item, subName, onSave, onClose}) {
  const isNew = !item;

  const initial = useMemo(() => {
    if (!item) return SUB_PAR_DEFAULTS;
    const tc = item.transformerConfig;
    const model = item.directionalModel || {};
    const withdrawalView = model.withdrawalView || {};
    const existingFoison = item.foisonnement || {};
    return {
      withdrawalBaseMva: safeNum(withdrawalView.maxHistoricLoadBT, 0),
      withdrawalGrowthPct: (safeNum(withdrawalView.growthLoadMaxBT, 0) * 100).toFixed(2),
      notes:             item.notes||'',
      tfos: tc?.transformers?.map(t=>({...t})) || [{id:'T1',power:'',role:'normal'}],
      coeffN:           String(tc?.coeffN   ?? 0.90),
      coeffN1:          String(tc?.coeffN1  ?? 1.00),
      mtBackupEnabled:  tc?.mtBackup?.enabled  || false,
      mtBackupCapacity: tc?.mtBackup?.capacity  || '',
      reverseCapacityRatio: String((tc?.reverseCapacityRatio ?? 1.0).toFixed(2)),
      foison: Object.fromEntries(
        Object.keys(FOISON_DEFAULTS).map(t => [t, String(existingFoison[t] ?? FOISON_DEFAULTS[t])])
      ),
    };
  }, [item]);

  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const set = (k,v) => setForm(f=>({...f,[k]:v}));

  const tc_preview = {
    transformers: (form.tfos||[]).map(t=>({...t,power:parseFloat(t.power)||0})).filter(t=>t.power>0),
    coeffN: parseFloat(form.coeffN)||0.9, coeffN1: parseFloat(form.coeffN1)||1.0,
    mtBackup:{ enabled:!!form.mtBackupEnabled, capacity:parseFloat(form.mtBackupCapacity)||0 },
  };
  const cN  = calcCapacityN(tc_preview);
  const cN1 = calcCapacityN1(tc_preview);

  const validate = () => {
    const e = {};
    if (form.withdrawalBaseMva === '' || parseFloat(form.withdrawalBaseMva)<0) e.load='Valeur ≥ 0 requise';
    const r=parseFloat(form.withdrawalGrowthPct);
    if(isNaN(r)||r<0||r>20) e.rate='Taux entre 0 et 20 %/an';
    const validTfos=(form.tfos||[]).filter(t=>parseFloat(t.power)>0);
    if(!validTfos.length) e.tfos='Au moins un transformateur avec puissance > 0 requis';
    const cN=parseFloat(form.coeffN),cN1=parseFloat(form.coeffN1);
    if(isNaN(cN)||cN<=0||cN>2) e.coeffN='Coefficient entre 0.01 et 2.00';
    if(isNaN(cN1)||cN1<=0||cN1>2) e.coeffN1='Coefficient entre 0.01 et 2.00';
    const rv=parseFloat(form.reverseCapacityRatio);
    if(isNaN(rv)||rv<0||rv>1) e.reverseCapacityRatio='Ratio entre 0 et 1';
    return e;
  };

  const handleSave = () => {
    const e = validate(); setErrors(e);
    if (Object.keys(e).length>0) return;
    const tfos=(form.tfos||[]).map(t=>({...t,power:parseFloat(t.power)})).filter(t=>t.power>0);
    const tc={transformers:tfos, coeffN:parseFloat(form.coeffN)||0.9,
      coeffN1:parseFloat(form.coeffN1)||1.0,
      reverseCapacityRatio:parseFloat(form.reverseCapacityRatio)||1.0,
      mtBackup:{enabled:!!form.mtBackupEnabled,capacity:parseFloat(form.mtBackupCapacity)||0}};
    const foison=Object.fromEntries(Object.keys(FOISON_DEFAULTS).map(t=>[t,parseFloat(form.foison?.[t])||FOISON_DEFAULTS[t]]));
    const previousModel = item?.directionalModel || {};
    const previousWithdrawal = previousModel.withdrawalView || {};
    const previousInjection = previousModel.injectionView || {};
    const growth = parseFloat(form.withdrawalGrowthPct) / 100;
    onSave({
      directionalModel: {
        referenceYear: safeNum(previousModel.referenceYear, 2025),
        withdrawalView: {
          ...previousWithdrawal,
          maxHistoricLoadBT: parseFloat(form.withdrawalBaseMva),
          growthLoadMaxBT: growth,
        },
        injectionView: previousInjection,
      },
      notes:form.notes||'', transformerConfig:tc, foisonnement:foison});
  };

  return (
    <ModalShell
      title="Paramètres de la sous-station"
      subtitle={subName}
      onClose={onClose}
      wide
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn-primary" onClick={handleSave}>{isNew ? '+ Créer' : '✓ Enregistrer'}</button>
        </>
      }
    >
            <Section title="Modèle directionnel" color="var(--accent)">
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <FormRow label="Base prélèvement BT 2025 (MVA)" error={errors.load}>
                  <input type="number" step=".1" value={form.withdrawalBaseMva||''}
                    onChange={e=>set('withdrawalBaseMva',e.target.value)} className="input-field"/>
                </FormRow>
                <FormRow label="Croissance prélèvement BT (%/an)" error={errors.rate}>
                  <input type="number" step=".1" value={form.withdrawalGrowthPct||''}
                    onChange={e=>set('withdrawalGrowthPct',e.target.value)} className="input-field"/>
                </FormRow>
              </div>
            </Section>
            <Section title="Transformateurs" color="#1e40af">
              <TfoEditorInline tfos={form.tfos||[]} onChange={v=>set('tfos',v)}/>
              {errors.tfos && <p className="form-error">{errors.tfos}</p>}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginTop:12}}>
                <FormRow label="Coeff. N" error={errors.coeffN}>
                  <input type="number" step=".01" value={form.coeffN||''} onChange={e=>set('coeffN',e.target.value)} className="input-field"/>
                </FormRow>
                <FormRow label="Coeff. N-1" error={errors.coeffN1}>
                  <input type="number" step=".01" value={form.coeffN1||''} onChange={e=>set('coeffN1',e.target.value)} className="input-field"/>
                </FormRow>
              </div>
            </Section>
            <Section title="Secours MT" color="#7c3aed">
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                <input type="checkbox" id="mtb" checked={!!form.mtBackupEnabled}
                  onChange={e=>set('mtBackupEnabled',e.target.checked)} style={{width:15,height:15,cursor:'pointer'}}/>
                <label htmlFor="mtb" style={{fontSize:13,fontWeight:600,color:'var(--text-primary)',cursor:'pointer'}}>
                  Secours réseau MT disponible
                </label>
              </div>
              {form.mtBackupEnabled && (
                <FormRow label="Capacité MT secours (MVA)">
                  <input type="number" step=".5" value={form.mtBackupCapacity||''}
                    onChange={e=>set('mtBackupCapacity',e.target.value)} className="input-field" placeholder="Ex: 10"/>
                </FormRow>
              )}
              {/* Preview capacités */}
              {(form.tfos||[]).filter(t=>parseFloat(t.power)>0).length>0 && (()=>{
                const tc={
                  transformers:(form.tfos||[]).map(t=>({...t,power:parseFloat(t.power)||0})).filter(t=>t.power>0),
                  coeffN:parseFloat(form.coeffN)||0.9, coeffN1:parseFloat(form.coeffN1)||1.0,
                  mtBackup:{enabled:!!form.mtBackupEnabled,capacity:parseFloat(form.mtBackupCapacity)||0},
                };
                return (
                  <div style={{marginTop:12,background:'var(--accent-soft)',border:'1px solid var(--accent-border)',borderRadius:8,padding:'8px 14px',display:'flex',gap:20}}>
                    <span style={{fontSize:12,fontWeight:700,color:'var(--accent)'}}>Résultant :</span>
                    <span style={{fontSize:12,fontFamily:'var(--font-mono)'}}>N = {f1(calcCapacityN(tc))} MVA</span>
                    <span style={{fontSize:12,fontFamily:'var(--font-mono)'}}>N-1 = {f1(calcCapacityN1(tc))} MVA</span>
                  </div>
                );
              })()}
            </Section>
            <Section title="Foisonnement" color="#0369a1" defaultOpen={false}>
              <p style={{fontSize:12,color:'var(--text-muted)',marginBottom:12,lineHeight:1.5}}>
                Coefficients de coïncidence des pointes par type de client.
                <strong> 1.0 = pire cas simultané.</strong> Les valeurs inférieures réduisent la charge réservée effective dans les calculs de résiduel.
              </p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                {Object.keys(FOISON_DEFAULTS).map(type => (
                  <div key={type} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:'var(--slate)',borderRadius:8}}>
                    <label style={{fontSize:12,fontWeight:600,flex:1,color:'var(--text-primary)'}}>
                      {type.charAt(0).toUpperCase()+type.slice(1)}
                      <span style={{display:'block',fontSize:10,fontWeight:400,color:'var(--text-muted)'}}>défaut : {FOISON_DEFAULTS[type]}</span>
                    </label>
                    <input type="number" step=".01" min="0.1" max="1.0"
                      value={form.foison?.[type] ?? FOISON_DEFAULTS[type]}
                      onChange={e=>set('foison',{...form.foison,[type]:e.target.value})}
                      style={{width:60,textAlign:'center',fontFamily:'var(--font-mono)',fontSize:13,fontWeight:700}}
                      className="input-field"/>
                  </div>
                ))}
              </div>
              <button type="button" onClick={()=>set('foison', Object.fromEntries(Object.keys(FOISON_DEFAULTS).map(t=>[t,String(FOISON_DEFAULTS[t])])))}
                style={{marginTop:10,fontSize:11,color:'var(--text-muted)',background:'none',border:'1px solid var(--border)',borderRadius:6,padding:'4px 10px',cursor:'pointer',fontFamily:'inherit'}}>
                ↺ Réinitialiser aux valeurs par défaut
              </button>
            </Section>
            <Section title="Notes" color="var(--text-muted)">
              <textarea value={form.notes||''} onChange={e=>set('notes',e.target.value)}
                rows={3} className="input-field" style={{resize:'vertical'}} placeholder="Notes libres sur la sous-station…"/>
            </Section>
    </ModalShell>
  );
}
