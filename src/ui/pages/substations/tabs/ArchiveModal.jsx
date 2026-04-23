/**
 * ArchiveModal.jsx — extrait de DemandesQueueTab pour contrôler la taille.
 * Gère la confirmation de raccordement et d'annulation d'une demande.
 */
import React, { useState } from 'react';
import { f1 } from '../../../../utils/format.js';
import { safeNum } from '../../../../utils/numbers.js';
import { reqGrdPrelevFerme, reqGrdPrelevFlexible, reqGrdInjFerme, reqGrdInjFlexible } from '../../../../engines/queue.js';
import { FormRow } from '../../../shared/forms.jsx';

export function ArchiveModal({ archiveModal, chargeContrib, setChargeContrib, sub, onConfirm, onCancel }) {
  if (!archiveModal) return null;
  const { req, targetStatus } = archiveModal;
  const isRacc = targetStatus === 'raccordée';
  const grdPF  = reqGrdPrelevFerme(req);
  const grdFl  = reqGrdPrelevFlexible(req);
  const grdIF  = reqGrdInjFerme(req);
  const grdIFl = reqGrdInjFlexible(req);
  const currentBase = sub.baseLoad2025;
  const _pMW = parseFloat(chargeContrib.prelevMW);
  const _iMW = parseFloat(chargeContrib.injMW);
  const contribNet = safeNum(isFinite(_pMW) ? _pMW : grdPF, grdPF) - safeNum(isFinite(_iMW) ? _iMW : 0, 0);
  const effectYear  = parseInt(chargeContrib.effectYear) || (req.yearSouhaitee || req.year || new Date().getFullYear());
  const newBase     = +(currentBase + contribNet).toFixed(2);

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(26,18,48,.55)',backdropFilter:'blur(8px)',
      zIndex:70,display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}
      onClick={onCancel}>
      <div style={{ background:'var(--bg-raised)',borderRadius:16,boxShadow:'var(--shadow-lg)',
        width:'100%',maxWidth:520,maxHeight:'90vh',overflow:'auto',
        animation:'v3-scaleIn .2s cubic-bezier(.16,1,.3,1)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding:'20px 24px',borderBottom:'1px solid var(--border)',
          background: isRacc ? 'var(--inj-dim)' : 'var(--red-dim)' }}>
          <h3 style={{ fontSize:16,fontWeight:800,color: isRacc ? 'var(--inj-text)' : 'var(--red)',marginBottom:4 }}>
            {isRacc ? '✓ Confirmer le raccordement' : '✕ Archiver comme annulée'}
          </h3>
          <p style={{ fontSize:13,color:'var(--text-secondary)',fontWeight:600 }}>{req.name}</p>
          {req.refProjet && <p style={{ fontSize:11,color:'var(--text-muted)',fontFamily:'var(--font-mono)',marginTop:2 }}>{req.refProjet}</p>}
        </div>

        <div style={{ padding:'20px 24px',display:'flex',flexDirection:'column',gap:14 }}>

          {isRacc ? (
            <>
              {/* Contrat GRD */}
              {(grdPF + grdFl + grdIF + grdIFl) > 0 && (
                <div style={{ background:'var(--accent-bg)',border:'1px solid var(--border-accent)',borderRadius:10,padding:14 }}>
                  <p style={{ fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'.07em',color:'var(--navy-60)',marginBottom:10 }}>Contrat GRD</p>
                  <div style={{ display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8 }}>
                    {grdPF > 0 && <PowerBox label="Prél. ferme" value={grdPF} color="var(--prelev)" dim="var(--prelev-dim)"/>}
                    {grdFl > 0 && <PowerBox label="Prél. flexible" value={grdFl} color="var(--amber)" dim="var(--amber-dim)"/>}
                    {grdIF > 0 && <PowerBox label="Inj. garantie" value={grdIF} color="var(--inj)" dim="var(--inj-dim)"/>}
                    {grdIFl > 0 && <PowerBox label="Inj. curtailable" value={grdIFl} color="var(--green)" dim="var(--green-dim)"/>}
                  </div>
                  {req.grd?.noteDecision && (
                    <p style={{ fontSize:11,color:'var(--text-secondary)',marginTop:8,fontStyle:'italic' }}>{req.grd.noteDecision}</p>
                  )}
                </div>
              )}

              {/* Impact charge */}
              <div style={{ background:'var(--amber-dim)',border:'1.5px solid rgba(217,119,6,.25)',borderRadius:10,padding:14 }}>
                <p style={{ fontSize:10,fontWeight:800,textTransform:'uppercase',letterSpacing:'.07em',color:'var(--amber)',marginBottom:10 }}>
                  Impact sur la charge de référence
                </p>
                <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:12 }}>
                  <FormRow label="À partir de l'année">
                    <select value={chargeContrib.effectYear || effectYear}
                      onChange={e => setChargeContrib(cc => ({...cc, effectYear:e.target.value}))}
                      className="input-field">
                      {Array.from({length:12},(_,i) => 2025+i).map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </FormRow>
                  <FormRow label="Prélèvement net (MVA)">
                    <input type="number" step=".1" className="input-field"
                      value={chargeContrib.prelevMW}
                      onChange={e => setChargeContrib(cc => ({...cc, prelevMW:e.target.value}))}/>
                  </FormRow>
                  <FormRow label="Injection nette (MVA)">
                    <input type="number" step=".1" className="input-field"
                      value={chargeContrib.injMW}
                      onChange={e => setChargeContrib(cc => ({...cc, injMW:e.target.value}))}/>
                  </FormRow>
                </div>
                <div style={{ background:'var(--bg-raised)',borderRadius:8,padding:'10px 14px',
                  border:'1px solid rgba(217,119,6,.25)',display:'flex',alignItems:'center',justifyContent:'space-between',gap:16 }}>
                  <div style={{ fontSize:12,color:'var(--amber)' }}>
                    Base 2025 : <strong style={{ fontFamily:'var(--font-mono)' }}>{f1(currentBase)} MVA</strong>
                    <span style={{ margin:'0 8px',opacity:.4 }}>→</span>
                    Δ : <strong style={{ fontFamily:'var(--font-mono)',color:contribNet >= 0 ? 'var(--prelev)' : 'var(--inj)' }}>
                      {contribNet >= 0 ? '+' : ''}{f1(contribNet)} MVA
                    </strong>
                  </div>
                  <div style={{ textAlign:'right',flexShrink:0 }}>
                    <p style={{ fontSize:10,color:'var(--amber)',marginBottom:1 }}>Charge effective dès {effectYear}</p>
                    <p style={{ fontSize:18,fontWeight:800,fontFamily:'var(--font-mono)',color:'var(--amber)' }}>{f1(newBase)} MVA</p>
                  </div>
                </div>
              </div>

              <FormRow label="Note (optionnel)">
                <input value={chargeContrib.note || ''}
                  onChange={e => setChargeContrib(cc => ({...cc, note:e.target.value}))}
                  className="input-field" placeholder={`Raccordement ${req.name}`}/>
              </FormRow>
            </>
          ) : (
            <p style={{ fontSize:13,color:'var(--text-secondary)' }}>
              La demande sera déplacée dans l'historique. La capacité réservée sera libérée immédiatement.
            </p>
          )}

          <div style={{ display:'flex',gap:10,justifyContent:'flex-end',paddingTop:4 }}>
            <button className="btn-secondary" onClick={onCancel}>Annuler</button>
            <button onClick={onConfirm} style={{
              background: isRacc ? 'var(--inj)' : 'var(--red)',
              color:'#fff',border:'none',borderRadius:8,padding:'9px 20px',
              cursor:'pointer',fontFamily:'inherit',fontSize:13,fontWeight:700,
            }}>
              {isRacc ? '✓ Confirmer le raccordement' : '✕ Archiver'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PowerBox({ label, value, color, dim }) {
  return (
    <div style={{ background:dim,borderRadius:8,padding:'8px 12px',
      border:`1.5px solid ${color}33` }}>
      <p style={{ fontSize:9,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:3 }}>{label}</p>
      <p style={{ fontSize:17,fontWeight:800,fontFamily:'var(--font-mono)',color }}>
        {f1(value)} <span style={{ fontSize:10,fontWeight:400 }}>MVA</span>
      </p>
    </div>
  );
}
