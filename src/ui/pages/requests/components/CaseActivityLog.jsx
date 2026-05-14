/**
 * CaseActivityLog — Journal d'activité filtré sur cette demande.
 * V1 : filtre le log global sur (subId + req.id).
 * V2 : affiche aussi req.changeHistory si présent.
 */
import React, { useState } from 'react';
import { fmtDate, fmtShortDate } from '../../../../utils/format.js';
import { Tag } from '../../../shared/badges.jsx';
import { f1 } from '../../../../utils/format.js';
import { getCustomer, getRequestedInjection, getRequestedLoad } from '../../../../engines/requestModel.js';

function fmtPreciseTimestamp(value) {
  return value
    ? new Date(value).toLocaleString('fr-BE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    : '—';
}

function ChangeEntry({ entry }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)',
        marginTop: 5, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
            {entry.field}
          </span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--red)' }}>
            {typeof entry.oldValue === 'number' ? f1(entry.oldValue) : String(entry.oldValue ?? '—')}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>→</span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--green)' }}>
            {typeof entry.newValue === 'number' ? f1(entry.newValue) : String(entry.newValue ?? '—')}
          </span>
          <span style={{ marginLeft: 'auto', fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
            {fmtDate(entry.changedAt)}
          </span>
        </div>
        {entry.changedBy && (
          <p style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: 2 }}>{entry.changedBy}</p>
        )}
      </div>
    </div>
  );
}

function ActivityEntry({ entry, onDelete }) {
  const d = entry.data || {};
  const customer = d.customer ? getCustomer(d) : null;
  const isAudit = entry.entryType === 'request_activity';
  return (
    <div style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)',
      alignItems: 'flex-start' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--inj)',
        marginTop: 5, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)' }}>
            {entry.actionLabel || customer?.client?.name || entry.subName}
          </span>
          {customer?.client?.type && <Tag v={customer.client.type} />}
        </div>
        {entry.summary && (
          <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3 }}>
            {entry.summary}
          </p>
        )}
        {d.customer && (
          <p style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3 }}>
            Prél. : {f1(getRequestedLoad(d))} MVA · Inj. : {f1(getRequestedInjection(d))} MVA
          </p>
        )}
        <p style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginTop: 3 }} title={entry.timestamp}>
          {isAudit ? fmtPreciseTimestamp(entry.timestamp) : fmtDate(entry.timestamp)}
        </p>
      </div>
      {onDelete && !isAudit && (
        <button
          onClick={() => onDelete({ logId: entry.id, subId: entry.subId, dataId: d.id })}
          style={{ fontSize: 12, color: 'var(--red)', background: 'none', border: 'none',
            cursor: 'pointer', padding: '2px 4px', flexShrink: 0 }}
          title="Supprimer cette entrée"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function CaseActivityLog({ req, sub, activityLog, onLogDelete }) {
  const [tab, setTab] = useState('activity'); // 'activity' | 'history'

  // Filtre : entrées du log global liées à cette demande
  const entries = (activityLog || []).filter(e =>
    e.subId === sub.id && (e.reqId === req.id || e.data?.id === req.id)
  ).slice().sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));

  const changeHistory = req.changeHistory || [];
  const hasActivity   = entries.length > 0;
  const hasHistory    = changeHistory.length > 0;

  return (
    <div className="card" style={{ padding: '14px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--accent)' }}>
          Journal
        </p>
        <div style={{ display: 'flex', gap: 4 }}>
          <button type="button" onClick={() => setTab('activity')}
            style={{ fontSize: 11, padding: '2px 10px', borderRadius: 6, cursor: 'pointer',
              fontFamily: 'inherit', border: '1px solid var(--border)',
              background: tab === 'activity' ? 'var(--accent)' : 'none',
              color: tab === 'activity' ? '#fff' : 'var(--text-muted)' }}>
            Activité {entries.length > 0 && `(${entries.length})`}
          </button>
          {hasHistory && (
            <button type="button" onClick={() => setTab('history')}
              style={{ fontSize: 11, padding: '2px 10px', borderRadius: 6, cursor: 'pointer',
                fontFamily: 'inherit', border: '1px solid var(--border)',
                background: tab === 'history' ? 'var(--accent)' : 'none',
                color: tab === 'history' ? '#fff' : 'var(--text-muted)' }}>
              Historique ({changeHistory.length})
            </button>
          )}
        </div>
      </div>

      {tab === 'activity' && (
        hasActivity ? (
          <div>
            {entries.map(entry => (
              <ActivityEntry key={entry.id} entry={entry} onDelete={onLogDelete} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Aucune activité enregistrée pour ce dossier dans la session courante.
            </p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
              Les activités apparaissent ici lors de la création ou des modifications enregistrées du dossier.
            </p>
          </div>
        )
      )}

      {tab === 'history' && hasHistory && (
        <div>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10, fontStyle: 'italic' }}>
            Historique des modifications de valeurs enregistrées.
          </p>
          {[...changeHistory].reverse().map((entry, i) => (
            <ChangeEntry key={entry.id || i} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
