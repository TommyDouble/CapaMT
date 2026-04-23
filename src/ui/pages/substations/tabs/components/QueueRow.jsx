/**
 * QueueRow.jsx — Single row in the FIFO queue table.
 * Extracted from DemandesQueueTab.
 */
import React from 'react';
import { DECISION_CONFIG, INJ_SOURCE_ICONS, PREV_USAGE_ICONS } from '../../../../../constants/index.js';
import { f1 } from '../../../../../utils/format.js';
import {
  reqClientPrelevTotal, reqClientInjTotal,
  reqGrdPrelevFerme, reqGrdPrelevFlexible, reqGrdInjFerme, reqGrdInjFlexible,
} from '../../../../../engines/queue.js';
import { DecisionBadge, ExpiryChip, Tag } from '../../../../shared/badges.jsx';

// ── Source tooltip ────────────────────────────────────────────────────────────
function SourceTooltip({ req }) {
  const inj = req.client?.detailInjection || [];
  const prev = req.client?.detailPrelevement || [];
  if (!inj.length && !prev.length) return null;
  return (
    <span style={{ position: 'relative', display: 'inline-block' }} className="source-tooltip-wrap">
      <span style={{ cursor: 'help', fontSize: 11, opacity: .5, marginLeft: 3 }}>ℹ</span>
      <span className="source-tooltip" style={{
        display: 'none', position: 'absolute', bottom: '130%', left: '50%',
        transform: 'translateX(-50%)', background: 'var(--bg-raised)', color: 'var(--text-primary)',
        border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px',
        fontSize: 11, lineHeight: 1.6, zIndex: 99, boxShadow: 'var(--shadow-lg)',
        minWidth: 180, whiteSpace: 'nowrap', pointerEvents: 'none',
      }}>
        {prev.map((d, i) => <div key={i}>{PREV_USAGE_ICONS[d.usage] || '•'} {d.usage} : {d.puissance} MVA{d.flexible ? ' ⚡' : ''}</div>)}
        {inj.map((d, i) => <div key={i}>{INJ_SOURCE_ICONS[d.source] || '•'} {d.source} : {d.puissanceContractuelle} MVA</div>)}
      </span>
    </span>
  );
}

// ── Residual pair bars ────────────────────────────────────────────────────────
function ResidualPair({ wBefore, wAfter, iBefore, iAfter, cap, capRev }) {
  const bar = (v, capVal, color) => {
    const r = capVal > 0 ? Math.max(0, v) / capVal : 0;
    const c = v < 0 ? 'var(--red)' : v < 3 ? 'var(--amber)' : color;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--bg-muted)', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(r * 100, 100)}%`, height: '100%', background: c, borderRadius: 3, transition: 'width .3s' }} />
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: c, minWidth: 32, textAlign: 'right' }}>
          {v != null ? (v > 0 ? '+' : '') + f1(v) : '—'}
        </span>
      </div>
    );
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 130 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--prelev)', textTransform: 'uppercase', letterSpacing: '.04em', width: 16 }}>⬆</span>
        <div style={{ flex: 1 }}>{bar(wBefore, cap, 'var(--prelev)')}</div>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: .5 }}>→</span>
        <div style={{ flex: 1 }}>{bar(wAfter, cap, 'var(--prelev)')}</div>
      </div>
      {iBefore != null && iBefore < (capRev || 99) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--inj)', textTransform: 'uppercase', letterSpacing: '.04em', width: 16 }}>⬇</span>
          <div style={{ flex: 1 }}>{bar(iBefore, capRev, 'var(--inj)')}</div>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', opacity: .5 }}>→</span>
          <div style={{ flex: 1 }}>{bar(iAfter, capRev, 'var(--inj)')}</div>
        </div>
      )}
    </div>
  );
}

export function QueueRow({ item, onEdit, onArchive, onDelete }) {
  const req = item.req;
  const isPrelev = reqClientPrelevTotal(req) > 0;
  const isInj = reqClientInjTotal(req) > 0;
  const grdPF = reqGrdPrelevFerme(req), grdPFl = reqGrdPrelevFlexible(req);
  const grdIF = reqGrdInjFerme(req), grdIFl = reqGrdInjFlexible(req);

  const accentLeft = item.decision === 'acceptable' ? 'var(--green)'
    : item.decision === 'liste_attente' ? 'var(--red)'
    : item.decision === 'conditionnel' ? 'var(--amber)'
    : 'var(--border-strong)';

  return (
    <tr className="data-row" style={{
      boxShadow: `inset 3px 0 0 ${accentLeft}`,
      background: item.hasFifoAlert ? 'var(--amber-dim)' : undefined,
    }}>
      {/* Position */}
      <td style={{ textAlign: 'center', padding: '10px 8px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 22, height: 22, borderRadius: '50%', fontSize: 10, fontWeight: 800,
          fontFamily: 'var(--font-mono)',
          background: item.hasFifoAlert ? 'var(--amber-dim)' : 'var(--accent-dim)',
          color: item.hasFifoAlert ? 'var(--amber)' : 'var(--accent)',
        }}>
          {item.position}
        </span>
      </td>

      {/* Requester */}
      <td style={{ padding: '10px 10px' }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', marginBottom: 3 }}>
          {req.name}
          {item.hasFifoAlert && <span style={{ marginLeft: 5, color: 'var(--amber)', fontSize: 11 }}>⚠</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
          {req.refProjet && <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{req.refProjet} ·</span>}
          <Tag v={req.type} />
          <SourceTooltip req={req} />
          <Tag v={req.status} />
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            MES {req.yearSouhaitee || req.year || '—'}
          </span>
        </div>
      </td>

      {/* Client */}
      <td style={{ textAlign: 'right', padding: '10px 8px' }}>
        {isPrelev && <div style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--prelev)' }}>↓ {f1(reqClientPrelevTotal(req))}</div>}
        {isInj && <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--inj)' }}>↑ {f1(reqClientInjTotal(req))}</div>}
        {!isPrelev && !isInj && <span style={{ color: 'var(--border-strong)' }}>—</span>}
      </td>

      {/* GRD */}
      <td style={{ textAlign: 'right', padding: '10px 8px' }}>
        {req.grd ? (
          <div style={{ lineHeight: 1.5 }}>
            {(grdPF + grdPFl) > 0 && (
              <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--prelev)', fontWeight: 700 }}>
                ↓ {f1(grdPF)}
                {grdPFl > 0 && <span style={{ color: 'var(--amber)', fontWeight: 500 }}> +{f1(grdPFl)}⚡</span>}
              </div>
            )}
            {(grdIF + grdIFl) > 0 && (
              <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--inj)' }}>
                ↑ {f1(grdIF)}{grdIFl > 0 ? `+${f1(grdIFl)}✂` : ''}
              </div>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--amber)', background: 'var(--amber-dim)', padding: '2px 6px', borderRadius: 4 }}>
            Pas étudiée
          </span>
        )}
      </td>

      {/* Residual */}
      <td style={{ padding: '10px 8px' }}>
        <ResidualPair
          wBefore={item.withdrawalResidualBefore ?? item.residualBefore}
          wAfter={item.withdrawalResidualAfter ?? item.residualAfter}
          iBefore={item.injectionResidualBefore}
          iAfter={item.injectionResidualAfter}
          cap={item.capAtYear}
          capRev={item.capRevAtYear}
        />
      </td>

      {/* Reservation */}
      <td style={{ textAlign: 'center', padding: '10px 8px' }}>
        <ExpiryChip expiry={item.expiry} />
      </td>

      {/* Decision */}
      <td style={{ textAlign: 'center', padding: '10px 8px' }}>
        <DecisionBadge decision={item.decision} size="xs" />
        {item.decision !== item.autoDecision && (
          <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 2 }}>
            auto: {DECISION_CONFIG[item.autoDecision]?.label}
          </div>
        )}
      </td>

      {/* Actions */}
      <td style={{ textAlign: 'right', paddingRight: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end' }}>
          <button className="btn-edit-link" style={{ fontSize: 11 }} onClick={() => onEdit(req)}>Modifier</button>
          {req.status === 'étudiée' && (
            <button onClick={() => onArchive(req, 'raccordée')} style={{
              fontSize: 10, color: 'var(--inj-text)', background: 'var(--inj-dim)',
              border: '1px solid var(--inj-border)', borderRadius: 4, cursor: 'pointer',
              fontFamily: 'inherit', padding: '1px 7px', whiteSpace: 'nowrap', fontWeight: 600,
            }}>✓ Raccorder</button>
          )}
          <button className="btn-danger-link" style={{ fontSize: 10 }} onClick={() => onDelete(req.id)}>Supprimer</button>
        </div>
      </td>
    </tr>
  );
}
