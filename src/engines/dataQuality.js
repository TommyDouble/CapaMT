/**
 * engines/dataQuality.js
 *
 * Warnings métier et niveau de confiance visible dans le bandeau décisionnel.
 */

import { getAssessment, getCustomer, getOffer } from './requestModel.js';

export function buildDataQualityWarnings(req, sub) {
  const customer = getCustomer(req);
  const assessment = getAssessment(req);
  const offer = getOffer(req);
  const warnings = [];

  if (!sub?.directionalModel)
    warnings.push({ code: 'NO_DIRECTIONAL_MODEL', label: 'Modèle directionnel poste absent' });
  if (
    assessment.upstream?.load?.status === 'PENDING' ||
    assessment.upstream?.injection?.status === 'PENDING'
  ) {
    warnings.push({ code: 'UPSTREAM_PENDING', label: 'CAPAC/amont à compléter' });
  }
  if (
    assessment.substation?.load?.status === 'PENDING' ||
    assessment.substation?.injection?.status === 'PENDING'
  ) {
    warnings.push({ code: 'SUBSTATION_PENDING', label: 'Réponse local/sous-station à compléter' });
  }
  if (
    assessment.network?.load?.status === 'PENDING' ||
    assessment.network?.injection?.status === 'PENDING'
  ) {
    warnings.push({ code: 'NETWORK_PENDING', label: 'Réponse réseau MT abstraite à compléter' });
  }
  if (!customer.readyForStudyAt && customer.status === 'ready_for_study') {
    warnings.push({ code: 'NO_READY_DATE', label: 'Date de priorité file absente' });
  }
  if (offer.status === 'offer_expired') {
    warnings.push({
      code: 'OFFER_EXPIRED',
      label: 'Offre expirée à traiter, réservation maintenue',
    });
  }
  return warnings;
}

export function deriveConfidence(req, sub) {
  const warnings = buildDataQualityWarnings(req, sub);
  if (
    warnings.some((w) =>
      [
        'NO_DIRECTIONAL_MODEL',
        'UPSTREAM_PENDING',
        'SUBSTATION_PENDING',
        'NETWORK_PENDING',
      ].includes(w.code),
    )
  )
    return 'LOW';
  if (warnings.length > 0) return 'MEDIUM';
  const assessment = getAssessment(req);
  const splits = [
    assessment.upstream?.load,
    assessment.upstream?.injection,
    assessment.substation?.load,
    assessment.substation?.injection,
    assessment.network?.load,
    assessment.network?.injection,
  ].filter(Boolean);
  if (splits.some((s) => s.confidence === 'LOW')) return 'LOW';
  if (splits.some((s) => s.confidence === 'MEDIUM')) return 'MEDIUM';
  return 'HIGH';
}
