import React, { useState } from 'react';

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
