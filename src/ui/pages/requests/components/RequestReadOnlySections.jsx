import React from 'react';
import { f1, fmtShortDate } from '../../../../utils/format.js';
import { computeCapacityImpact } from '../../../../engines/capacityImpact.js';
import {
  getAssessment,
  getCustomer,
  getOffer,
  getRequestedInjection,
  getRequestedLoad,
  isQualifiedLimitingConstraint,
} from '../../../../engines/requestModel.js';
import {
  AssessmentStatusBadge,
  CapacityImpactChip,
  CustomerStatusBadge,
  OfferStatusBadge,
} from '../../../shared/badges.jsx';

function finalStatusFromSplits(splits = []) {
  const statuses = splits.map(split => split?.status).filter(Boolean);
  if (!statuses.length || statuses.includes('PENDING')) return 'PENDING';
  if (statuses.includes('KO')) return 'KO';
  if (statuses.includes('LIMIT')) return 'LIMIT';
  if (statuses.includes('FULL_FLEX')) return 'FULL_FLEX';
  return 'OK';
}

function formatFinalResponse(load, injection) {
  const parts = [];
  if (load) parts.push(`Prél. ${f1(load.permanent)} permanent + ${f1(load.flexible)} flexible`);
  if (injection) parts.push(`Inj. ${f1(injection.permanent)} permanent + ${f1(injection.flexible)} flexible`);
  return parts.join(' · ') || 'Non applicable';
}

function constraintLabel(value) {
  const labels = {
    UPSTREAM: 'Amont / CAPAC',
    SUBSTATION: 'Local / sous-station',
    NETWORK: 'Réseau MT',
    UNKNOWN: 'À déterminer',
  };
  return labels[value] || labels.UNKNOWN;
}

function SummaryLine({ label, value, mono = false, muted = false }) {
  return (
    <p style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <strong className={mono ? 'mono' : undefined} style={{ color: muted ? 'var(--text-muted)' : 'var(--text-secondary)', textAlign: 'right' }}>
        {value || '—'}
      </strong>
    </p>
  );
}

function offerDateLine(offer) {
  if (offer.status === 'offer_connected') return ['Raccordement', offer.connectedAt];
  if (offer.status === 'offer_accepted') return ['Acceptation', offer.acceptedAt];
  if (offer.status === 'offer_expired') return ['Expiration', offer.expiredAt];
  if (offer.status === 'offer_cancelled') return ['Annulation', offer.cancelledAt];
  if (offer.status === 'offer_formulated') return ['Formulation', offer.formulatedAt];
  return ['Date offre', null];
}

function impactSourceLabel(source) {
  const labels = {
    CUSTOMER_REQUEST: 'Demande client complète',
    TECHNICAL_RESPONSE: 'Réponse technique finalisée',
    OFFER_ACCEPTED: 'Offre acceptée',
    CONNECTED_RETENTION: 'Maintien post-raccordement',
    CUSTOMER_CANCELLATION: 'Annulation ou refus',
    BASELINE_UPDATED: 'Baseline supposée mise à jour',
    BASELINE: 'Raccordement intégré',
    NONE: 'Aucun impact actif',
  };
  return labels[source] || source || 'Non renseignée';
}

function ImpactCapacityBanner({ impact }) {
  return (
    <div className="card" style={{ padding: 14, borderLeft: '4px solid var(--accent)', background: 'var(--bg-raised)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 180 }}>
          <p style={{ fontSize: 10, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 7 }}>
            Impact capacité calculé
          </p>
          <CapacityImpactChip impact={impact.status} size="xs" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(160px, 1fr))', gap: 12, flex: '1 1 560px' }}>
          <div>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>Prélèvement réservé</p>
            <p className="mono" style={{ fontSize: 13, fontWeight: 800, color: 'var(--prelev)', marginTop: 3 }}>
              {f1(impact.reservedLoadPermanent)} permanent + {f1(impact.reservedLoadFlexible)} flexible
            </p>
          </div>
          <div>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>Injection réservée</p>
            <p className="mono" style={{ fontSize: 13, fontWeight: 800, color: 'var(--inj)', marginTop: 3 }}>
              {f1(impact.reservedInjectionPermanent)} permanent + {f1(impact.reservedInjectionFlexible)} flexible
            </p>
          </div>
          <div>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.05em' }}>Source</p>
            <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginTop: 3 }}>
              {impactSourceLabel(impact.source)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, badge, children }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{title}</p>
        {badge}
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

export function RequestReadOnlySections({ req, queueItem }) {
  const customer = getCustomer(req);
  const assessment = getAssessment(req);
  const offer = getOffer(req);
  const impact = computeCapacityImpact(req);
  const finalReady = assessment.status === 'studied'
    && finalStatusFromSplits([assessment.final?.load, assessment.final?.injection]) !== 'PENDING';
  const qualifiedConstraint = finalReady && isQualifiedLimitingConstraint(assessment);
  const [offerDateLabel, offerDate] = offerDateLine(offer);
  const requestDate = customer.requestDate || null;
  const readyForStudyAt = customer.readyForStudyAt || null;
  const fifoRank = queueItem?.position ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        <InfoCard title="Demande client" badge={<CustomerStatusBadge status={customer.status} size="xs" />}>
          <SummaryLine label="Puissance demandée" value={`Prél. ${f1(getRequestedLoad(req))} MVA · Inj. ${f1(getRequestedInjection(req))} MVA`} mono />
          <SummaryLine label="Date de demande" value={requestDate ? fmtShortDate(requestDate) : '—'} mono />
          <SummaryLine label="Priorité FIFO" value={readyForStudyAt ? fmtShortDate(readyForStudyAt) : '—'} mono />
          <SummaryLine label="Rang FIFO" value={fifoRank != null ? `#${fifoRank}` : 'hors file'} mono muted={fifoRank == null} />
        </InfoCard>
        <InfoCard title="Étude technique" badge={<AssessmentStatusBadge status={assessment.status} size="xs" />}>
          <SummaryLine label="Date d'étude" value={assessment.assessedAt ? fmtShortDate(assessment.assessedAt) : '—'} mono />
          <SummaryLine
            label="Réponse finale"
            value={finalReady ? formatFinalResponse(assessment.final?.load, assessment.final?.injection) : 'À compléter'}
          />
          <SummaryLine
            label="Contrainte"
            value={qualifiedConstraint ? constraintLabel(assessment.final?.limitingConstraint) : 'À déterminer'}
          />
          {assessment.final?.load?.reason && (
            <p style={{ marginTop: 5 }}>
              <span style={{ color: 'var(--text-muted)' }}>Note d'étude: </span>
              <span>{assessment.final.load.reason}</span>
            </p>
          )}
        </InfoCard>
        <InfoCard title="Offre / raccordement" badge={<OfferStatusBadge status={offer.status} size="xs" />}>
          <SummaryLine label={offerDateLabel} value={offerDate ? fmtShortDate(offerDate) : '—'} mono />
          {offer.status === 'offer_connected' && (
            <SummaryLine label="Maintien capacité" value={`${impact.retentionMonths || offer.connectedRetentionMonths || '—'} mois`} mono />
          )}
          <p>{offer.status === 'not_applicable' ? 'Aucune offre formulée.' : 'Suivi commercial actif.'}</p>
          {offer.comment && (
            <p style={{ marginTop: 5 }}>
              <span style={{ color: 'var(--text-muted)' }}>Commentaire offre: </span>
              <span>{offer.comment}</span>
            </p>
          )}
        </InfoCard>
      </div>
      <ImpactCapacityBanner impact={impact} />
    </div>
  );
}
