import React, { useMemo } from 'react';
import {
  CONNECTED_RETENTION_MAX_MONTHS,
  CONNECTED_RETENTION_MIN_MONTHS,
} from '../../../../constants/index.js';
import {
  computeCapacityImpact,
  getConnectedRetentionInfo,
  normalizeConnectedRetentionMonths,
} from '../../../../engines/capacityImpact.js';
import { normalizeRequest, getCustomer, getOffer } from '../../../../engines/requestModel.js';
import { f1, fmtShortDate } from '../../../../utils/format.js';
import { CapacityImpactChip, Tag } from '../../../shared/badges.jsx';

function isConnectedRequest(req) {
  const offer = getOffer(req);
  return offer.status === 'offer_connected';
}

function statusLabel(row) {
  if (row.impact.connectedReleaseMode === 'manual') return 'Libéré manuellement';
  if (row.retention.missingConnectedAt) return 'Date manquante';
  if (row.impact.status === 'CONNECTED_RESERVED')
    return row.retention.daysLeft === 0 ? 'Dernier jour' : 'Maintenu';
  return 'Expiré automatiquement';
}

function daysLabel(row) {
  const retention = row.retention;
  if (row.impact.connectedReleaseMode === 'manual') {
    return `Libéré le ${fmtShortDate(row.impact.connectedReleasedAt)}`;
  }
  if (retention.missingConnectedAt) return 'Date à renseigner';
  if (retention.daysLeft === 0) return 'Dernier jour';
  if (retention.daysLeft > 0) return `${retention.daysLeft} j restants`;
  return `Expiré depuis ${Math.abs(retention.daysLeft)} j`;
}

function PowerPill({ label, value, color }) {
  if (value <= 0) return null;
  return (
    <div
      style={{
        minWidth: 82,
        padding: '6px 9px',
        borderRadius: 8,
        border: '1px solid var(--border)',
        background: 'var(--bg-raised)',
        textAlign: 'right',
      }}
    >
      <div
        style={{
          fontSize: 8,
          fontWeight: 700,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}
      >
        {label}
      </div>
      <div className="mono" style={{ fontSize: 14, fontWeight: 800, color }}>
        {f1(value)}
      </div>
    </div>
  );
}

export function ConnectedCapacityTab({ sub, onUpdate, onNavigateToRequest }) {
  const rows = useMemo(
    () =>
      (sub.connectionRequests || [])
        .filter(isConnectedRequest)
        .map((rawReq) => {
          const req = rawReq;
          const offer = getOffer(req);
          const customer = getCustomer(req);
          const impact = computeCapacityImpact(req);
          const retention = impact.connectedRetention || getConnectedRetentionInfo(req);
          return {
            req,
            offer,
            customer,
            impact,
            retention,
            load: impact.reservedLoadPermanent + impact.reservedLoadFlexible,
            injection: impact.reservedInjectionPermanent + impact.reservedInjectionFlexible,
          };
        })
        .sort((a, b) =>
          String(b.retention.connectedAt || '').localeCompare(
            String(a.retention.connectedAt || ''),
          ),
        ),
    [sub.connectionRequests, sub.id],
  );

  const retainedRows = rows.filter((row) => row.impact.status === 'CONNECTED_RESERVED');
  const releasedRows = rows.filter((row) => row.impact.status !== 'CONNECTED_RESERVED');
  const expiringSoon = retainedRows.filter(
    (row) => row.retention.daysLeft != null && row.retention.daysLeft <= 60,
  );
  const retainedLoad = retainedRows.reduce((sum, row) => sum + row.load, 0);
  const retainedInjection = retainedRows.reduce((sum, row) => sum + row.injection, 0);

  const updateRequest = (reqId, transform) => {
    if (!onUpdate) return;
    const connectionRequests = (sub.connectionRequests || []).map((req) =>
      req.id === reqId ? normalizeRequest(transform(req), sub.id) : req,
    );
    onUpdate({ ...sub, connectionRequests });
  };

  const handleRetentionChange = (req, value) => {
    const months = normalizeConnectedRetentionMonths(value);
    updateRequest(req.id, (current) => {
      const offer = getOffer(current);
      return {
        ...current,
        offer: {
          ...offer,
          status: 'offer_connected',
          connectedRetentionMonths: months,
        },
      };
    });
  };

  const handleSetToday = (req) => {
    const today = new Date().toISOString().slice(0, 10);
    updateRequest(req.id, (current) => {
      const offer = getOffer(current);
      return {
        ...current,
        offer: {
          ...offer,
          status: 'offer_connected',
          connectedAt: today,
          connectedRetentionMonths: normalizeConnectedRetentionMonths(
            offer.connectedRetentionMonths,
          ),
        },
      };
    });
  };

  const handleReleaseNow = (req) => {
    if (!window.confirm('Libérer maintenant cette capacité raccordée ?')) return;
    const today = new Date().toISOString().slice(0, 10);
    updateRequest(req.id, (current) => {
      const offer = getOffer(current);
      return {
        ...current,
        offer: {
          ...offer,
          status: 'offer_connected',
          connectedReleasedAt: today,
          connectedReleaseComment:
            offer.connectedReleaseComment || 'Libération manuelle depuis l’onglet Raccordés.',
        },
      };
    });
  };

  const handleReactivate = (req) => {
    updateRequest(req.id, (current) => {
      const offer = getOffer(current);
      return {
        ...current,
        offer: {
          ...offer,
          status: 'offer_connected',
          connectedReleasedAt: '',
          connectedReleaseComment: '',
        },
      };
    });
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 8 }}>
        <div className="metric-box">
          <div className="metric-box__label">Raccordés</div>
          <div className="metric-box__value">{rows.length}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
            {retainedRows.length} maintenu(s)
          </div>
        </div>
        <div className="metric-box" style={{ borderLeft: '3px solid var(--prelev)' }}>
          <div className="metric-box__label">Prél. maintenu</div>
          <div className="metric-box__value" style={{ color: 'var(--prelev)' }}>
            {f1(retainedLoad)} MVA
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
            encore réservé
          </div>
        </div>
        <div className="metric-box" style={{ borderLeft: '3px solid var(--inj)' }}>
          <div className="metric-box__label">Inj. maintenue</div>
          <div className="metric-box__value" style={{ color: 'var(--inj)' }}>
            {f1(retainedInjection)} MVA
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>
            encore réservée
          </div>
        </div>
        <div
          className="metric-box"
          style={{
            borderLeft: expiringSoon.length ? '3px solid var(--amber)' : '3px solid var(--green)',
          }}
        >
          <div className="metric-box__label">Échéance &lt; 60j</div>
          <div
            className="metric-box__value"
            style={{ color: expiringSoon.length ? 'var(--amber)' : 'var(--green)' }}
          >
            {expiringSoon.length}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>à surveiller</div>
        </div>
        <div className="metric-box" style={{ borderLeft: '3px solid var(--accent)' }}>
          <div className="metric-box__label">Libérés</div>
          <div className="metric-box__value" style={{ color: 'var(--accent)' }}>
            {releasedRows.length}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>impact nul</div>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto', overflowY: 'hidden' }}>
        <div
          style={{
            padding: '11px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
              Dossiers raccordés
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Maintien temporaire de capacité après mise en service, sans recalage historique dans
              l’application.
            </p>
          </div>
        </div>

        <table style={{ width: '100%', minWidth: 1100, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg-muted)' }}>
              {[
                ['Dossier', 'left'],
                ['Raccordement', 'left'],
                ['Durée', 'center'],
                ['Fin maintien', 'left'],
                ['Impact compté', 'right'],
                ['Statut', 'center'],
                ['', 'right'],
              ].map(([label, align]) => (
                <th
                  key={label}
                  style={{
                    padding: '8px 10px',
                    textAlign: align,
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '.08em',
                    color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    textAlign: 'center',
                    padding: '38px 20px',
                    color: 'var(--text-muted)',
                    fontSize: 13,
                  }}
                >
                  Aucun dossier raccordé sur cette sous-station.
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const statusColor =
                row.impact.status === 'CONNECTED_RESERVED'
                  ? 'var(--green)'
                  : row.retention.missingConnectedAt
                    ? 'var(--amber)'
                    : 'var(--accent)';
              const statusBg =
                row.impact.status === 'CONNECTED_RESERVED'
                  ? 'var(--green-dim)'
                  : row.retention.missingConnectedAt
                    ? 'var(--amber-dim)'
                    : 'var(--accent-bg)';
              const statusBorder =
                row.impact.status === 'CONNECTED_RESERVED'
                  ? 'rgba(5,150,105,.25)'
                  : row.retention.missingConnectedAt
                    ? 'rgba(217,119,6,.25)'
                    : 'var(--border-accent)';
              return (
                <tr key={row.req.id} className="data-row">
                  <td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <strong style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                        {row.customer.client?.name || '(sans titre)'}
                      </strong>
                      <Tag v={row.customer.client?.type} />
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {row.customer.client?.reference || row.req.id}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: '11px 10px',
                      borderBottom: '1px solid var(--border)',
                      fontSize: 12,
                      color: 'var(--text-secondary)',
                    }}
                  >
                    {row.retention.connectedAt ? (
                      fmtShortDate(row.retention.connectedAt)
                    ) : (
                      <button
                        type="button"
                        className="btn-edit-link"
                        style={{ fontSize: 11, color: 'var(--amber)' }}
                        onClick={() => handleSetToday(row.req)}
                      >
                        Renseigner aujourd’hui
                      </button>
                    )}
                  </td>
                  <td
                    style={{
                      padding: '11px 10px',
                      borderBottom: '1px solid var(--border)',
                      textAlign: 'center',
                    }}
                  >
                    <input
                      aria-label={`Durée maintien ${row.customer.client?.name || row.req.id}`}
                      type="number"
                      min={CONNECTED_RETENTION_MIN_MONTHS}
                      max={CONNECTED_RETENTION_MAX_MONTHS}
                      step="1"
                      value={row.retention.months}
                      disabled={!onUpdate}
                      onChange={(e) => handleRetentionChange(row.req, e.target.value)}
                      className="input-field"
                      style={{ width: 76, textAlign: 'right' }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>
                      mois
                    </span>
                  </td>
                  <td
                    style={{
                      padding: '11px 10px',
                      borderBottom: '1px solid var(--border)',
                      fontSize: 12,
                    }}
                  >
                    <div
                      style={{
                        color: row.retention.expired ? 'var(--accent)' : 'var(--text-secondary)',
                        fontWeight: 600,
                      }}
                    >
                      {fmtShortDate(row.retention.retentionUntil)}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color:
                          row.retention.daysLeft != null &&
                          row.retention.daysLeft <= 60 &&
                          row.retention.daysLeft >= 0
                            ? 'var(--amber)'
                            : 'var(--text-muted)',
                      }}
                    >
                      {daysLabel(row)}
                    </div>
                    {row.impact.connectedReleaseMode === 'manual' &&
                      row.impact.connectedReleaseComment && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                          {row.impact.connectedReleaseComment}
                        </div>
                      )}
                  </td>
                  <td style={{ padding: '11px 10px', borderBottom: '1px solid var(--border)' }}>
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        justifyContent: 'flex-end',
                        flexWrap: 'wrap',
                      }}
                    >
                      <PowerPill label="Prél." value={row.load} color="var(--prelev)" />
                      <PowerPill label="Inj." value={row.injection} color="var(--inj)" />
                      {row.load <= 0 && row.injection <= 0 && (
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>0 MVA</span>
                      )}
                    </div>
                  </td>
                  <td
                    style={{
                      padding: '11px 10px',
                      borderBottom: '1px solid var(--border)',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '3px 8px',
                          borderRadius: 20,
                          background: statusBg,
                          color: statusColor,
                          border: `1px solid ${statusBorder}`,
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        {statusLabel(row)}
                      </span>
                      <CapacityImpactChip impact={row.impact.status} size="xs" />
                    </div>
                  </td>
                  <td
                    style={{
                      padding: '11px 10px',
                      borderBottom: '1px solid var(--border)',
                      textAlign: 'right',
                    }}
                  >
                    {onUpdate && row.impact.status === 'CONNECTED_RESERVED' && (
                      <button
                        type="button"
                        className="btn-edit-link"
                        style={{ fontSize: 11, color: 'var(--accent)', marginRight: 10 }}
                        onClick={() => handleReleaseNow(row.req)}
                      >
                        Libérer maintenant
                      </button>
                    )}
                    {onUpdate && row.impact.connectedReleaseMode === 'manual' && (
                      <button
                        type="button"
                        className="btn-edit-link"
                        style={{ fontSize: 11, color: 'var(--green)', marginRight: 10 }}
                        onClick={() => handleReactivate(row.req)}
                      >
                        Réactiver
                      </button>
                    )}
                    {onNavigateToRequest && (
                      <button
                        type="button"
                        className="btn-edit-link"
                        style={{ fontSize: 11 }}
                        onClick={() => onNavigateToRequest(sub.id, row.req.id)}
                      >
                        Dossier →
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
