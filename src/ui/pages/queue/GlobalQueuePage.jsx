/**
 * GlobalQueuePage.jsx — v2.0
 * Vue consolidée de toutes les demandes de raccordement.
 * Design "Technical Precision" — couleurs sémantiques prélèvement/injection.
 */
import React, { useState } from 'react';
import { DECISION_CONFIG } from '../../../constants/index.js';
import { f1, pct, fmtShortDate } from '../../../utils/format.js';
import { useProjects } from '../../App.jsx';
import {
  getQueueAnalysis, getGlobalQueueStats,
  getEffectiveRigidReservation,
  reqGrdPrelevFerme, reqGrdPrelevFlexible, reqGrdInjFerme, reqGrdInjFlexible,
} from '../../../engines/queue.js';
import { reqClientPrelevTotal, reqClientInjTotal } from '../../../engines/requests.js';
import { DecisionBadge, ExpiryChip, Tag } from '../../shared/badges.jsx';

// ── Barre de résiduel mini ────────────────────────────────────────────────────
function MiniBar({ value, capacity, color }) {
  const r = capacity > 0 ? Math.max(0, value) / capacity : 0;
  const c = value < 0 ? 'var(--red)' : value < 3 ? 'var(--amber)' : color || 'var(--green)';
  return (
    <div style={{ display:'flex',alignItems:'center',gap:4,minWidth:90 }}>
      <div style={{ flex:1,height:4,borderRadius:2,background:'var(--bg-muted)',overflow:'hidden' }}>
        <div style={{ width:`${Math.min(r*100,100)}%`,height:'100%',background:c,transition:'width .3s' }}/>
      </div>
      <span style={{ fontFamily:'var(--font-mono)',fontSize:9,fontWeight:700,color:c,minWidth:28,textAlign:'right' }}>
        {value != null ? f1(value) : '—'}
      </span>
    </div>
  );
}

// ── Direction chip ────────────────────────────────────────────────────────────
function DirChip({ hasPrelev, hasInj }) {
  return (
    <div style={{ display:'flex',gap:3,alignItems:'center' }}>
      {hasPrelev && <span style={{ fontSize:8,fontWeight:700,padding:'1px 5px',borderRadius:4,
        background:'var(--prelev-dim)',color:'var(--prelev)',border:'1px solid var(--prelev-border)' }}>⬆ PRÉL</span>}
      {hasInj    && <span style={{ fontSize:8,fontWeight:700,padding:'1px 5px',borderRadius:4,
        background:'var(--inj-dim)',   color:'var(--inj)',   border:'1px solid var(--inj-border)' }}>⬇ INJ</span>}
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────────────────
export function GlobalQueuePage({ substations, onNavigate }) {
  const projects = useProjects();
  const [filterSub,  setFilterSub]  = useState('all');
  const [filterDir,  setFilterDir]  = useState('all'); // all | prelev | inj | both
  const [filterDec,  setFilterDec]  = useState('all');
  const [filterExp,  setFilterExp]  = useState('all');

  const stats = getGlobalQueueStats(substations, projects);

  // Compute injection totals from queue (not in getGlobalQueueStats)
  let totalInjReserved = 0;
  substations.forEach(sub => {
    const { queue } = getQueueAnalysis(sub, projects);
    queue.forEach(item => { totalInjReserved += reqGrdInjFerme(item.req); });
  });

  // Aplatir toutes les demandes
  const allItems = substations.flatMap(sub => {
    const { queue, conditionals } = getQueueAnalysis(sub, projects);
    return [...queue, ...conditionals].map(item => ({ ...item, sub }));
  });

  const filtered = allItems.filter(item => {
    if (filterSub !== 'all' && item.sub.id !== filterSub) return false;
    if (filterDec !== 'all' && item.decision !== filterDec) return false;
    if (filterExp === 'urgent' && !['expiré','bientôt'].includes(item.expiry?.status)) return false;
    if (filterExp === 'expiré' && item.expiry?.status !== 'expiré') return false;
    const isPrelev = reqClientPrelevTotal(item.req) > 0;
    const isInj    = reqClientInjTotal(item.req) > 0;
    if (filterDir === 'prelev' && !isPrelev) return false;
    if (filterDir === 'inj'    && !isInj)    return false;
    if (filterDir === 'both'   && !(isPrelev && isInj)) return false;
    return true;
  });

  const urgCount = stats.expired + stats.expiringSoon;

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:16 }} className="fade-in">

      {/* ── Header ── */}
      <div>
        <h2 className="page-title">File d'attente réseau</h2>
        <p className="page-subtitle">
          Vue consolidée · Ordre chronologique par SS · {allItems.length} demande(s)
        </p>
      </div>

      {/* ── KPIs ── */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:8 }}>
        {/* Total */}
        <div className="metric-box">
          <div className="metric-box__label">Total en file</div>
          <div className="metric-box__value">{stats.total}</div>
        </div>

        {/* Acceptable */}
        <div className="metric-box" style={{ borderTop:`3px solid var(--green)`,paddingTop:7 }}>
          <div className="metric-box__label">Acceptables</div>
          <div className="metric-box__value" style={{ color:'var(--green)' }}>{stats.acceptable}</div>
        </div>

        {/* Conditionnel */}
        <div className="metric-box" style={{ borderTop:`3px solid var(--amber)`,paddingTop:7 }}>
          <div className="metric-box__label">Conditionnels</div>
          <div className="metric-box__value" style={{ color:'var(--amber)' }}>{stats.conditionnel}</div>
        </div>

        {/* Liste attente */}
        <div className="metric-box" style={{ borderTop:`3px solid var(--red)`,paddingTop:7 }}>
          <div className="metric-box__label">Liste d'attente</div>
          <div className="metric-box__value" style={{ color:'var(--red)' }}>{stats.liste_attente}</div>
        </div>

        {/* MVA prélèvement réservés */}
        <div className="metric-box" style={{ borderTop:'3px solid var(--prelev)',paddingTop:7 }}>
          <div className="metric-box__label">Prél. réservé</div>
          <div className="metric-box__value" style={{ color:'var(--prelev)',fontSize:15 }}>
            {f1(stats.totalMWReserved)}
            <span style={{ fontSize:10,fontWeight:500,color:'var(--text-muted)' }}> MVA</span>
          </div>
        </div>

        {/* MVA injection réservés */}
        <div className="metric-box" style={{ borderTop:'3px solid var(--inj)',paddingTop:7 }}>
          <div className="metric-box__label">Inj. réservée</div>
          <div className="metric-box__value" style={{ color:'var(--inj)',fontSize:15 }}>
            {f1(totalInjReserved)}
            <span style={{ fontSize:10,fontWeight:500,color:'var(--text-muted)' }}> MVA</span>
          </div>
        </div>

        {/* Péremptions */}
        <div className="metric-box" style={{
          borderTop:`3px solid ${urgCount > 0 ? 'var(--amber)' : 'var(--green)'}`, paddingTop:7 }}>
          <div className="metric-box__label">Péremptions</div>
          <div className="metric-box__value" style={{ color: urgCount > 0 ? 'var(--amber)' : 'var(--green)' }}>
            {urgCount}
          </div>
        </div>
      </div>

      {/* ── Filtres ── */}
      <div style={{ display:'flex',gap:8,flexWrap:'wrap',alignItems:'center' }}>
        <select value={filterSub} onChange={e => setFilterSub(e.target.value)}
          className="input-field" style={{ width:180 }}>
          <option value="all">Toutes les SS</option>
          {substations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        {/* Filtre direction */}
        <div className="seg-toggle">
          {[
            { v:'all',    l:'Tout' },
            { v:'prelev', l:'⬆ Prél.' },
            { v:'inj',    l:'⬇ Inj.' },
            { v:'both',   l:'Bidirectionnel' },
          ].map(f => (
            <button key={f.v} className={`seg-toggle__btn${filterDir===f.v
              ? f.v==='prelev' ? ' active-prelev' : f.v==='inj' ? ' active-inj' : ' active-prelev'
              : ''}`}
              onClick={() => setFilterDir(f.v)}
              style={{ padding:'5px 12px',fontSize:11 }}>{f.l}</button>
          ))}
        </div>

        <select value={filterDec} onChange={e => setFilterDec(e.target.value)}
          className="input-field" style={{ width:160 }}>
          <option value="all">Toutes décisions</option>
          {Object.entries(DECISION_CONFIG).map(([k, c]) => (
            <option key={k} value={k}>{c.icon} {c.label}</option>
          ))}
        </select>

        <select value={filterExp} onChange={e => setFilterExp(e.target.value)}
          className="input-field" style={{ width:170 }}>
          <option value="all">Toutes réservations</option>
          <option value="urgent">Urgentes (expirées + bientôt)</option>
          <option value="expiré">Expirées uniquement</option>
        </select>

        <span style={{ marginLeft:'auto',fontSize:11,color:'var(--text-muted)' }}>
          {filtered.length} demande(s) affichée(s)
        </span>
      </div>

      {/* ── Tableau ── */}
      <div className="card" style={{ overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%',borderCollapse:'collapse',minWidth:1000 }}>
            <thead>
              <tr style={{ background:'var(--bg-muted)' }}>
                {[
                  { l:'Sous-station',  al:'left',   w:null },
                  { l:'#',            al:'center', w:32 },
                  { l:'Demandeur',    al:'left',   w:null },
                  { l:'Dir.',         al:'center', w:80 },
                  { l:'Type',         al:'center', w:70 },
                  { l:'Dépôt',        al:'center', w:68 },
                  { l:'GRD ferme',    al:'right',  w:90 },
                  { l:'GRD flex.',    al:'right',  w:80 },
                  { l:'Rés. prél. →', al:'center', w:130 },
                  { l:'Rés. inj.',    al:'right',  w:70 },
                  { l:'Réservation',  al:'center', w:100 },
                  { l:'Décision',     al:'center', w:90 },
                  { l:'',             al:'right',  w:60 },
                ].map(h => (
                  <th key={h.l} style={{ padding:'8px 10px',textAlign:h.al,width:h.w||undefined,
                    fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',
                    color:'var(--text-muted)',borderBottom:'1px solid var(--border)',whiteSpace:'nowrap' }}>{h.l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={13} style={{ textAlign:'center',padding:'40px',color:'var(--text-muted)',fontSize:13 }}>
                  Aucune demande ne correspond aux filtres.
                </td></tr>
              )}

              {filtered.map((item, i) => {
                const req = item.req;
                const isPrelev = reqClientPrelevTotal(req) > 0;
                const isInj    = reqClientInjTotal(req) > 0;
                const grdPF  = reqGrdPrelevFerme(req);
                const grdPFl = reqGrdPrelevFlexible(req);
                const grdIF  = reqGrdInjFerme(req);
                const accentLeft = item.decision === 'acceptable' ? 'var(--green)'
                  : item.decision === 'liste_attente' ? 'var(--red)'
                  : item.decision === 'conditionnel'  ? 'var(--amber)'
                  : 'var(--border-strong)';

                return (
                  <tr key={`${item.sub.id}-${req.id}`} className="data-row stagger-item"
                    style={{ animationDelay:`${i*12}ms`, boxShadow:`inset 3px 0 0 ${accentLeft}` }}>

                    {/* SS */}
                    <td style={{ padding:'10px 10px' }}>
                      <button onClick={() => onNavigate(item.sub.id, 'demandes')} style={{
                        color:'var(--accent)',fontSize:12,fontWeight:700,background:'none',
                        border:'none',cursor:'pointer',fontFamily:'inherit',padding:0,textAlign:'left' }}>
                        {item.sub.name}
                      </button>
                      <div style={{ fontSize:9,fontFamily:'var(--font-mono)',color:'var(--text-muted)' }}>
                        {item.sub.code}
                      </div>
                    </td>

                    {/* # */}
                    <td style={{ textAlign:'center',padding:'10px 6px' }}>
                      <span style={{ fontFamily:'var(--font-mono)',fontSize:10,color:'var(--text-muted)' }}>
                        {item.position != null ? `#${item.position}` : '—'}
                      </span>
                    </td>

                    {/* Demandeur */}
                    <td style={{ padding:'10px 10px' }}>
                      <div style={{ fontWeight:500,fontSize:12,color:'var(--text-primary)' }}>{req.name}</div>
                      {req.refProjet && <div style={{ fontSize:9,fontFamily:'var(--font-mono)',color:'var(--text-muted)' }}>{req.refProjet}</div>}
                    </td>

                    {/* Direction */}
                    <td style={{ textAlign:'center',padding:'10px 6px' }}>
                      <DirChip hasPrelev={isPrelev} hasInj={isInj}/>
                    </td>

                    {/* Type */}
                    <td style={{ textAlign:'center',padding:'10px 6px' }}><Tag v={req.type}/></td>

                    {/* Dépôt */}
                    <td style={{ textAlign:'center',fontFamily:'var(--font-mono)',fontSize:10,
                      color:'var(--text-muted)',padding:'10px 6px' }}>
                      {fmtShortDate(req.dateDepot)}
                    </td>

                    {/* GRD ferme */}
                    <td style={{ textAlign:'right',padding:'10px 8px' }}>
                      {grdPF > 0 && <div style={{ fontFamily:'var(--font-mono)',fontSize:11,fontWeight:700,color:'var(--prelev)' }}>↓ {f1(grdPF)}</div>}
                      {grdIF > 0 && <div style={{ fontFamily:'var(--font-mono)',fontSize:10,color:'var(--inj)' }}>↑ {f1(grdIF)}</div>}
                      {grdPF === 0 && grdIF === 0 && <span style={{ color:'var(--border-strong)',fontSize:11 }}>—</span>}
                    </td>

                    {/* GRD flex */}
                    <td style={{ textAlign:'right',fontFamily:'var(--font-mono)',fontSize:10,
                      color:'var(--amber)',padding:'10px 8px' }}>
                      {grdPFl > 0 ? `+${f1(grdPFl)} ⚡` : <span style={{ color:'var(--border-strong)' }}>—</span>}
                    </td>

                    {/* Résiduel prél avant→après */}
                    <td style={{ padding:'10px 6px' }}>
                      {item.residualBefore != null ? (
                        <div style={{ display:'flex',alignItems:'center',gap:3 }}>
                          <MiniBar value={item.withdrawalResidualBefore ?? item.residualBefore}
                            capacity={item.capAtYear} color="var(--prelev)"/>
                          <span style={{ fontSize:9,color:'var(--text-muted)',opacity:.4 }}>→</span>
                          <MiniBar value={item.withdrawalResidualAfter ?? item.residualAfter}
                            capacity={item.capAtYear} color="var(--prelev)"/>
                        </div>
                      ) : (
                        <span style={{ fontSize:10,color:'var(--text-muted)',fontStyle:'italic' }}>conditionnel</span>
                      )}
                    </td>

                    {/* Résiduel injection */}
                    <td style={{ textAlign:'right',padding:'10px 6px' }}>
                      {item.injectionResidualBefore != null && item.capRevAtYear > 0 ? (
                        <span style={{ fontFamily:'var(--font-mono)',fontSize:9,fontWeight:600,
                          color: item.injectionResidualBefore < 0 ? 'var(--red)'
                               : item.injectionResidualBefore < 3 ? 'var(--amber)'
                               : 'var(--inj)' }}>
                          {f1(item.injectionResidualBefore)}
                        </span>
                      ) : <span style={{ color:'var(--border-strong)',fontSize:11 }}>—</span>}
                    </td>

                    {/* Réservation */}
                    <td style={{ textAlign:'center',padding:'10px 6px' }}>
                      <ExpiryChip expiry={item.expiry}/>
                    </td>

                    {/* Décision */}
                    <td style={{ textAlign:'center',padding:'10px 6px' }}>
                      <DecisionBadge decision={item.decision} size="xs"/>
                    </td>

                    {/* Voir */}
                    <td style={{ textAlign:'right',paddingRight:12 }}>
                      <button onClick={() => onNavigate(item.sub.id, 'demandes')} style={{
                        color:'var(--accent)',fontSize:11,fontWeight:600,background:'none',
                        border:'none',cursor:'pointer',fontFamily:'inherit',whiteSpace:'nowrap' }}>
                        Voir →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding:'8px 18px',background:'var(--bg-muted)',borderTop:'1px solid var(--border)',
          display:'flex',flexWrap:'wrap',gap:14,alignItems:'center' }}>
          {Object.entries(DECISION_CONFIG).map(([k, c]) => (
            <span key={k} style={{ display:'flex',alignItems:'center',gap:4,fontSize:10,color:'var(--text-muted)' }}>
              <span style={{ color:c.color,fontWeight:800 }}>{c.icon}</span> {c.label}
            </span>
          ))}
          <span style={{ marginLeft:'auto',fontSize:10,color:'var(--text-muted)',fontStyle:'italic' }}>
            Résiduel prél. · Conditionnels exclus du calcul
          </span>
        </div>
      </div>
    </div>
  );
}
