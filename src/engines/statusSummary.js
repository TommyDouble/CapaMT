import { computeCapacityImpact } from './capacityImpact.js';
import { getAssessment, getCustomer, getOffer } from './requestModel.js';

export const REQUEST_PHASES = {
  incomplete: {
    label: 'À compléter',
    color: '#d97706',
    bg: '#fffbeb',
    border: '#fde68a',
    order: 1,
  },
  deposee: { label: 'Déposée', color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', order: 2 },
  etude: { label: 'En étude', color: '#0369a1', bg: '#e0f2fe', border: '#7dd3fc', order: 3 },
  conditionnelle: {
    label: 'Conditionnelle',
    color: '#92400e',
    bg: '#fffbeb',
    border: '#fde68a',
    order: 4,
  },
  acceptable: { label: 'Acceptable', color: '#166534', bg: '#f0fdf4', border: '#bbf7d0', order: 5 },
  expiree: { label: 'Offre expirée', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', order: 6 },
  raccordee: {
    label: 'Raccordée maintenue',
    color: '#065f46',
    bg: '#ecfdf5',
    border: '#6ee7b7',
    order: 7,
  },
  liberee: {
    label: 'Libérée',
    color: '#6b7280',
    bg: '#f9fafb',
    border: '#e5e7eb',
    order: 0,
    strike: true,
  },
};

function finalStatuses(assessment) {
  return [assessment.final?.load?.status, assessment.final?.injection?.status].filter(Boolean);
}

function derivePhaseKey({ customer, assessment, offer, impact }) {
  const statuses = finalStatuses(assessment);
  if (
    customer.status === 'cancelled' ||
    offer.status === 'offer_cancelled' ||
    impact.status === 'RELEASED'
  )
    return 'liberee';
  if (impact.status === 'CONNECTED_RELEASED') return 'liberee';
  if (offer.status === 'offer_connected') return 'raccordee';
  if (offer.status === 'offer_expired') return 'expiree';
  if (offer.status === 'offer_accepted') return 'acceptable';
  if (statuses.includes('KO')) return 'liberee';
  if (statuses.includes('LIMIT') || statuses.includes('FULL_FLEX')) return 'conditionnelle';
  if (assessment.status === 'studied') return 'acceptable';
  if (assessment.status === 'under_study' || assessment.status === 'blocked') return 'etude';
  if (customer.status === 'ready_for_study') return 'deposee';
  return 'incomplete';
}

export function buildRequestStatusSummary(req) {
  if (!req) return null;
  const customer = getCustomer(req);
  const assessment = getAssessment(req);
  const offer = getOffer(req);
  const impact = computeCapacityImpact(req);
  const phaseKey = derivePhaseKey({ customer, assessment, offer, impact });
  const phase = REQUEST_PHASES[phaseKey];

  const descriptions = {
    incomplete: 'La demande client doit encore être complétée.',
    deposee: 'La demande est complète et positionnée pour étude.',
    etude: 'L’étude technique est en cours ou bloquée par une donnée manquante.',
    conditionnelle: 'Le raccordement dépend d’une limitation ou d’un projet réseau.',
    acceptable: 'La capacité est disponible selon la réponse technique ou l’offre acceptée.',
    expiree: 'L’offre est expirée et doit être traitée explicitement.',
    raccordee: 'Le client est raccordé et sa capacité reste maintenue temporairement.',
    liberee: 'Le dossier ne réserve plus de capacité.',
  };

  const nextSteps = {
    incomplete: 'Compléter la demande client.',
    deposee: 'Lancer l’étude de raccordement.',
    etude: 'Finaliser les réponses techniques attendues.',
    conditionnelle: 'Valider la condition réseau ou ajuster la réponse.',
    acceptable:
      offer.status === 'offer_accepted'
        ? 'Planifier le raccordement.'
        : 'Formuler ou suivre l’offre.',
    expiree: 'Annuler l’offre ou enregistrer une acceptation tardive.',
    raccordee: null,
    liberee: null,
  };

  return {
    phaseKey,
    phaseLabel: phase.label,
    phaseColor: phase.color,
    phaseBg: phase.bg,
    phaseBorder: phase.border,
    phaseOrder: phase.order,
    strike: Boolean(phase.strike),
    description: descriptions[phaseKey],
    nextStep: nextSteps[phaseKey] ?? null,
    requestDate: customer.requestDate || null,
    offerDate: offer.formulatedAt || null,
    desiredCommissioningDate: customer.requested?.desiredCommissioningDate || null,
    connectedAt: offer.connectedAt || null,
    capacityImpact: impact.status,
    customerStatus: customer.status,
    assessmentStatus: assessment.status,
    offerStatus: offer.status,
  };
}

export function buildQueuePhaseSummary(requests) {
  const byPhase = Object.fromEntries(Object.keys(REQUEST_PHASES).map((key) => [key, 0]));
  let total = 0;
  (requests || []).forEach((req) => {
    const summary = buildRequestStatusSummary(req);
    if (!summary) return;
    byPhase[summary.phaseKey] = (byPhase[summary.phaseKey] || 0) + 1;
    total += 1;
  });
  return { byPhase, total };
}
