import React from 'react';
import { f1 } from '../../utils/format.js';
import {
  getCustomer,
  getRequestedInjection,
  getRequestedLoad,
} from '../../engines/requestModel.js';
import { Tag } from './badges.jsx';

function timeAgo(value) {
  const diff = Math.floor((new Date() - new Date(value)) / 1000);
  if (diff < 60) return 'À l’instant';
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`;
  return new Date(value).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
}

function entryTitle(entry) {
  if (entry.actionLabel) return entry.actionLabel;
  if (entry.summary) return entry.summary;
  const data = entry.data || {};
  const customer = data.customer ? getCustomer(data) : null;
  return customer?.client?.name || data.name || 'Activité dossier';
}

function EntryDetails({ entry }) {
  const data = entry.data || {};
  if (data.customer) {
    const customer = getCustomer(data);
    return (
      <>
        {customer.client?.type && <Tag v={customer.client.type} />}
        {customer.client?.reference && (
          <span className="mono text-xs text-muted">{customer.client.reference}</span>
        )}
        <span className="mono text-xs text-muted">
          Prél. {f1(getRequestedLoad(data))} MVA · Inj. {f1(getRequestedInjection(data))} MVA · MES{' '}
          {customer.requested?.year || '—'}
        </span>
      </>
    );
  }
  if (entry.summary) return <span className="text-xs text-muted">{entry.summary}</span>;
  return <span className="text-xs text-muted">{entry.entryType || 'activité'}</span>;
}

export function ActivityLogList({ log = [], onDelete, onNavigate }) {
  if (log.length === 0) return null;
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {log.map((entry, i) => (
        <div key={entry.id} className={`log-row ${i === 0 ? 'slide-down' : ''}`}>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent)' }}>DR</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="flex items-center gap-2 flex-wrap">
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: 11 }}>
                {entryTitle(entry)}
              </span>
              <EntryDetails entry={entry} />
            </div>
            <div className="text-xs text-muted mt-0.5">
              {entry.subName && (
                <button
                  onClick={() => onNavigate?.(entry.subId)}
                  style={{
                    color: 'var(--accent)',
                    fontWeight: 600,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {entry.subName}
                </button>
              )}
              {entry.subCode && (
                <>
                  <span className="mx-1">·</span>
                  <span className="mono">{entry.subCode}</span>
                </>
              )}
              <span className="mx-1">·</span>
              <span>{timeAgo(entry.timestamp)}</span>
            </div>
          </div>
          {entry.data?.id && (
            <button
              onClick={() =>
                onDelete?.({ logId: entry.id, subId: entry.subId, dataId: entry.data.id })
              }
              className="btn-danger-link flex-shrink-0"
            >
              Annuler
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
