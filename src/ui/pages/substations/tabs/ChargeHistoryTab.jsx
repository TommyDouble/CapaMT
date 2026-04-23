import React, { useEffect, useRef } from 'react';
import { f1 } from '../../../../utils/format.js';
import { useProjects } from '../../../App.jsx';
import { getWithdrawalBaseNet } from '../../../../engines/load.js';
import { getEffectiveRigidReservation } from '../../../../engines/requests.js';
import { getCapacityAtYear } from '../../../../engines/capacity.js';
import { YEARS } from '../../../../constants/index.js';
import { getChartTheme } from '../../../shared/chartTheme.js';

export function ChargeHistoryTab({sub, onUpdate}) {
  const projects  = useProjects();
  const chartRef  = useRef(null);
  const canvasRef = useRef(null);
  const history   = (sub.chargeHistory || []).slice().sort((a,b)=>a.date.localeCompare(b.date));

  // Calcul divergence : écart entre dernière valeur mesurée et organique calculée
  const lastEntry = history[history.length - 1];
  const lastYear  = lastEntry ? parseInt(lastEntry.date.slice(0,4)) : null;
  const organicAtLastYear = lastYear ? getWithdrawalBaseNet(sub, lastYear, projects) : null;
  const measuredLast = lastEntry ? (lastEntry.prelevMW - lastEntry.injMW) : null;
  const divergencePct = (organicAtLastYear && measuredLast !== null && organicAtLastYear > 0)
    ? Math.abs((measuredLast - organicAtLastYear) / organicAtLastYear * 100)
    : null;
  const hasDivergence = divergencePct !== null && divergencePct > 10;

  // Graphe Chart.js
  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    if (history.length === 0) return;
    const ctx = canvasRef.current.getContext('2d');
    const t = getChartTheme();

    const labels = history.map(e => e.date);
    const measured = history.map(e => +(e.prelevMW - e.injMW).toFixed(2));

    // Courbe organique aux mêmes dates
    const organic = history.map(e => {
      const yr = parseFloat(e.date);
      return +getOrganicLoad(sub, Math.floor(yr), 1.0, projects).toFixed(2);
    });

    chartRef.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Mesures (chargeHistory)',
            data: measured, borderColor: t.accent, backgroundColor: `${t.accent}18`,
            pointRadius:5, pointHoverRadius:7, fill:true, tension:.3, borderWidth:2 },
          { label: 'Organique calculée (scénario central)',
            data: organic, borderColor: t.red, borderDash:[6,3],
            pointRadius:3, fill:false, tension:.3, borderWidth:1.5 },
        ],
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins: {
          legend:{ position:'bottom', labels:{font:{size:11,family:'Outfit'},boxWidth:20,color:t.text} },
          tooltip:{
            backgroundColor:t.bgRaised, borderColor:t.border, borderWidth:1,
            titleColor:t.textPrimary, bodyColor:t.textPrimary,
            callbacks:{ label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)} MVA` },
          },
        },
        scales: {
          x:{ ticks:{font:{family:'JetBrains Mono',size:10},color:t.text}, grid:{color:t.grid} },
          y:{ title:{display:true,text:'MVA',font:{size:11},color:t.text},
              ticks:{font:{family:'JetBrains Mono',size:10},color:t.text}, grid:{color:t.grid} },
        },
      },
    });
    return () => { if(chartRef.current){chartRef.current.destroy();chartRef.current=null;} };
  }, [sub.id, history.length, scenario]);

  // Recalibration baseLoad sur dernière valeur mesurée
  const handleRecalibrate = () => {
    if (!lastEntry) return;
    const newBase = +(lastEntry.prelevMW - lastEntry.injMW).toFixed(2);
    const currentBase = sub.directionalModel?.withdrawalView?.maxHistoricLoadBT ?? sub.baseLoad2025;
    if (window.confirm(`Recalibrer la charge max BT (vue prélèvement) à ${newBase} MVA (mesure du ${lastEntry.date}) ?\nValeur actuelle : ${currentBase} MVA.`)) {
      const dm = sub.directionalModel || {};
      const wv = dm.withdrawalView || {};
      onUpdate({
        ...sub,
        baseLoad2025: newBase,
        directionalModel: { ...dm, withdrawalView: { ...wv, maxHistoricLoadBT: newBase } },
      });
    }
  };

  // Supprimer une entrée
  const handleDelete = (id) => {
    onUpdate({...sub, chargeHistory:(sub.chargeHistory||[]).filter(e=>e.id!==id)});
  };

  return (
    <div className="space-y-4 fade-in">

      {/* Alerte divergence */}
      {hasDivergence && (
        <div style={{background:'var(--pn-bg)',border:'1.5px solid var(--pn-border)',borderRadius:10,padding:'12px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
          <div>
            <p style={{fontSize:12,fontWeight:700,color:'var(--pn-text)',marginBottom:3}}>
              ⚠ Divergence modèle / mesures : {divergencePct.toFixed(1)}%
            </p>
            <p style={{fontSize:11,color:'var(--pn-text)'}}>
              La charge organique calculée ({f1(organicAtLastYear)} MVA) s'écarte de plus de 10%
              de la dernière mesure connue ({f1(measuredLast)} MVA · {lastEntry.date}).
              Une recalibration du directionalModel?.withdrawalView?.maxHistoricLoadBT ?? baseLoad2025 est recommandée.
            </p>
          </div>
          <button onClick={handleRecalibrate}
            style={{flexShrink:0,background:'var(--amber)',color:'#fff',border:'none',borderRadius:8,
              padding:'7px 14px',cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:700,whiteSpace:'nowrap'}}>
            Recalibrer →
          </button>
        </div>
      )}

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        {[
          {label:'Entrées historique', val:history.length, sub:'raccordements enregistrés', color:'var(--accent)'},
          {label:'Dernière mesure', val:lastEntry?`${f1(measuredLast)} MVA`:'—', sub:lastEntry?.date||'aucune mesure', color:hasDivergence?'var(--amber)':'var(--green)'},
          {label:'Organique calculée', val:organicAtLastYear?`${f1(organicAtLastYear)} MVA`:'—', sub:lastYear?`en ${lastYear} · scén. central`:'', color:'var(--text-secondary)'},
          {label:'Écart modèle/mesure', val:divergencePct!==null?`${divergencePct.toFixed(1)}%`:'—', sub:hasDivergence?'⚠ > 10% — recalibrer':'< 10% — cohérent', color:hasDivergence?'#dc2626':'#059669'},
        ].map(k=>(
          <div key={k.label} style={{background:'#fff',border:'1px solid var(--border)',borderRadius:12,padding:'12px 14px',boxShadow:'var(--shadow-sm)',position:'relative'}}>
            <p style={{fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'.07em',color:'var(--text-muted)',marginBottom:5}}>{k.label}</p>
            <p style={{fontSize:20,fontWeight:700,fontFamily:'var(--font-mono)',color:k.color,lineHeight:1}}>{k.val}</p>
            <p style={{fontSize:10,color:'var(--text-muted)',marginTop:3}}>{k.sub}</p>
            {k.spark && (()=>{
              // A3 — mini sparkline résiduel 2026-2035
              const sparkVals = YEARS.map(y => {
                const cap = getCapacityAtYear(sub,y,projects);
                const org = getOrganicLoad(sub,y,1.0,projects);
                const res = cap - org - queue.filter(i=>(i.req.yearSouhaitee||i.req.year||2026)<=y)
                  .reduce((s,i)=>s+getEffectiveRigidReservation(i.req),0);
                return +res.toFixed(1);
              });
              const min = Math.min(...sparkVals);
              const max = Math.max(...sparkVals, 0.1);
              const range = max - min || 1;
              const w=120, h=28;
              const pts = sparkVals.map((v,i)=>
                `${(i/(YEARS.length-1))*w},${h-(v-min)/range*(h-4)+2}`
              ).join(' ');
              const firstNeg = sparkVals.findIndex(v=>v<0);
              return (
                <div style={{marginTop:6}} title={YEARS.map((y,i)=>y+": "+sparkVals[i]+" MVA").join(" | ")}>

                  <svg width={w} height={h} style={{overflow:'visible'}}>
                    <polyline points={pts} fill="none" stroke={min<0?'#dc2626':'#0891b2'} strokeWidth="1.5"/>
                    {firstNeg>=0 && (
                      <circle cx={(firstNeg/(YEARS.length-1))*w} cy={h-(0-min)/range*(h-4)+2}
                        r="3" fill="#dc2626"/>
                    )}
                  </svg>
                  <p style={{fontSize:9,color:'var(--text-muted)',marginTop:1}}>
                    {YEARS[0]}→{YEARS[YEARS.length-1]} · min {f1(min)} MVA
                  </p>
                </div>
              );
            })()}
          </div>
        ))}
      </div>

      {/* Graphe */}
      {history.length > 0 ? (
        <div className="card" style={{padding:16}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
            <div>
              <h4 style={{fontSize:13,fontWeight:700,color:'var(--text-primary)'}}>Charge mesurée vs organique calculée</h4>
              <p style={{fontSize:11,color:'var(--text-muted)',marginTop:2}}>
                Points bleus = raccordements réels enregistrés · Ligne rouge = base nette prélèvement (modèle directionnel)
              </p>
            </div>
            <button onClick={handleRecalibrate}
              style={{background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,
                padding:'6px 14px',cursor:'pointer',fontFamily:'inherit',fontSize:12,fontWeight:600,whiteSpace:'nowrap'}}>
              ↺ Recalibrer baseLoad
            </button>
          </div>
          <div style={{height:260}}>
            <canvas ref={canvasRef}/>
          </div>
        </div>
      ) : (
        <div className="card" style={{padding:40,textAlign:'center'}}>
          <p style={{fontSize:32,marginBottom:12,opacity:.3}}>—</p>
          <p style={{fontSize:13,fontWeight:600,color:'var(--text-muted)'}}>Aucune mesure enregistrée</p>
          <p style={{fontSize:12,color:'var(--text-muted)',marginTop:6}}>
            Les contributions de charge sont enregistrées automatiquement lors du raccordement d'une demande.
          </p>
        </div>
      )}

      {/* Table des entrées */}
      {history.length > 0 && (
        <div className="card" style={{overflow:'hidden'}}>
          <div style={{padding:'12px 18px',borderBottom:'1px solid var(--border)'}}>
            <p style={{fontSize:12,fontWeight:700,color:'var(--text-primary)'}}>Détail des contributions enregistrées</p>
          </div>
          <table className="w-full">
            <thead>
              <tr className="thead-row">
                <th className="text-left">Date</th>
                <th className="text-left">Note / Origine</th>
                <th className="text-right" style={{width:110}}>Prélèvement</th>
                <th className="text-right" style={{width:110}}>Injection</th>
                <th className="text-right" style={{width:100}}>Impact net</th>
                <th style={{width:50}}></th>
              </tr>
            </thead>
            <tbody>
              {history.map(e=>(
                <tr key={e.id} className="data-row">
                  <td style={{fontFamily:'var(--font-mono)',fontSize:12,fontWeight:600}}>{e.date}</td>
                  <td style={{fontSize:12,color:'var(--text-secondary)'}}>{e.note||'—'}</td>
                  <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:12,color:'var(--red)',fontWeight:600}}>
                    {e.prelevMW>0?`+${f1(e.prelevMW)} MVA`:'—'}
                  </td>
                  <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:12,color:'var(--green)'}}>
                    {e.injMW>0?`+${f1(e.injMW)} MVA`:'—'}
                  </td>
                  <td style={{textAlign:'right',fontFamily:'var(--font-mono)',fontSize:12,fontWeight:700,
                    color:(e.prelevMW-e.injMW)>0?'#dc2626':'#059669'}}>
                    {(e.prelevMW-e.injMW)>=0?'+':''}{f1(e.prelevMW-e.injMW)} MVA
                  </td>
                  <td style={{textAlign:'center'}}>
                    <button onClick={()=>handleDelete(e.id)}
                      style={{color:'#ef4444',background:'none',border:'none',cursor:'pointer',fontSize:16,padding:'2px 6px'}}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

