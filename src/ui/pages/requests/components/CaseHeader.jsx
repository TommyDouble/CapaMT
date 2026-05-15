/**
 * CaseHeader — En-tête unifié d'un dossier de demande.
 * Affiche l'identité dossier, le statut principal et l'action client.
 */
import React from 'react';
import { f1 } from '../../../../utils/format.js';
import { getCustomer } from '../../../../engines/requestModel.js';
import { StatusPhaseBadge, Tag } from '../../../shared/badges.jsx';

export function CaseHeader({
  req,
  sub,
  queueItem,
  onEdit,
  onBack,
  prevViewLabel,
  editDisabled = false,
  editLabel = 'Modifier',
}) {
  const customer = getCustomer(req);
  const position = queueItem?.position ?? null;
  const resiAfter = queueItem?.withdrawalResidualAfter ?? null;

  return (
    <div>
      <button onClick={onBack} className="btn-back">
        ← Retour {prevViewLabel ? `à ${prevViewLabel}` : ''}
      </button>

      <div className="ss-header">
        <div className="flex items-start justify-between gap-6">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 6,
                flexWrap: 'wrap',
              }}
            >
              <h2 className="ss-header__name" style={{ fontSize: 20 }}>
                {customer.client?.name || '(sans titre)'}
              </h2>
              <StatusPhaseBadge req={req} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {customer.client?.reference && (
                <span className="ss-header__code">{customer.client.reference}</span>
              )}
              <Tag v={customer.client?.type} />
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                MES {customer.requested?.year || '—'}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>·</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                SS : <strong>{sub.name}</strong>
                {sub.code && (
                  <span
                    style={{
                      marginLeft: 4,
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: 'var(--text-muted)',
                    }}
                  >
                    {sub.code}
                  </span>
                )}
              </span>
            </div>
          </div>

          <div className="actions-col" style={{ flexShrink: 0 }}>
            <button
              onClick={onEdit}
              disabled={editDisabled}
              className="btn-primary"
              style={{
                fontSize: 12,
                opacity: editDisabled ? 0.55 : 1,
                cursor: editDisabled ? 'not-allowed' : 'pointer',
              }}
            >
              {editLabel}
            </button>
            {position != null && resiAfter != null && (
              <div
                className={`status-dot-badge ${resiAfter < 0 ? 'status-dot-badge--danger' : resiAfter < 3 ? 'status-dot-badge--warning' : 'status-dot-badge--success'}`}
              >
                <span className="status-dot-badge__dot" />
                Rés. après : {f1(resiAfter)} MVA
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
