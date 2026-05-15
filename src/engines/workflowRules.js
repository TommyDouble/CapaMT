/**
 * engines/workflowRules.js
 *
 * Guards et transitions métier pour éviter les contournements UI.
 */

import { getAssessment, getCustomer, getOffer } from './requestModel.js';
import { readNextActions } from '../constants/workflowActions.js';

export function isOfferFinal(offerStatus) {
  return ['offer_cancelled', 'offer_connected'].includes(offerStatus);
}

export function canEditCustomer(req) {
  const customer = getCustomer(req);
  const assessment = getAssessment(req);
  const offer = getOffer(req);
  return (
    customer.status !== 'cancelled' &&
    assessment.status === 'not_started' &&
    !isOfferFinal(offer.status)
  );
}

export function canStartStudy(req) {
  const customer = getCustomer(req);
  const assessment = getAssessment(req);
  return customer.status === 'ready_for_study' && assessment.status === 'not_started';
}

export function canEditAssessment(req) {
  const assessment = getAssessment(req);
  return assessment.status === 'under_study';
}

export function canFinalizeAssessment(req) {
  const assessment = getAssessment(req);
  const loadPending = assessment.final?.load?.status === 'PENDING';
  const injectionPending = assessment.final?.injection?.status === 'PENDING';
  return assessment.status === 'under_study' && !loadPending && !injectionPending;
}

export function canEditOffer(req) {
  const assessment = getAssessment(req);
  const offer = getOffer(req);
  return assessment.status === 'studied' && !isOfferFinal(offer.status);
}

export function getAllowedOfferTransitions(req) {
  const offer = getOffer(req);
  if (!canEditOffer(req)) return [];
  if (offer.status === 'not_applicable') return ['offer_formulated'];
  if (offer.status === 'offer_formulated')
    return ['offer_expired', 'offer_cancelled', 'offer_accepted'];
  if (offer.status === 'offer_expired') return ['offer_cancelled', 'offer_accepted'];
  if (offer.status === 'offer_accepted') return ['offer_connected'];
  return [];
}

export function getPrimaryAction(req) {
  const customer = getCustomer(req);
  const assessment = getAssessment(req);
  const offer = getOffer(req);
  if (customer.status === 'incomplete')
    return { key: 'EDIT_CUSTOMER', label: 'Compléter la demande' };
  if (canStartStudy(req)) return { key: 'START_STUDY', label: 'Prendre en charge' };
  if (assessment.status === 'under_study') {
    const remaining = readNextActions(assessment);
    return {
      key: 'EDIT_ASSESSMENT',
      label: remaining.length > 0 ? 'Continuer l’étude' : 'Finaliser l’étude',
    };
  }
  if (assessment.status === 'studied' && offer.status === 'offer_expired') {
    return { key: 'EDIT_OFFER', label: 'Traiter l’offre expirée' };
  }
  if (canEditOffer(req)) return { key: 'EDIT_OFFER', label: 'Mettre à jour l’offre' };
  return { key: 'VIEW', label: 'Consulter' };
}

export function lockReason(block, req) {
  const assessment = getAssessment(req);
  const offer = getOffer(req);
  if (block === 'customer' && !canEditCustomer(req)) {
    return assessment.status === 'under_study'
      ? 'Données client verrouillées depuis la prise en charge.'
      : 'Données client verrouillées après étude ou clôture commerciale.';
  }
  if (block === 'assessment' && !canEditAssessment(req)) {
    return assessment.status === 'studied'
      ? 'Résultats d’étude figés après finalisation.'
      : 'L’étude technique s’ouvre après prise en charge.';
  }
  if (block === 'offer' && !canEditOffer(req)) {
    return isOfferFinal(offer.status)
      ? 'Cycle offre finalisé.'
      : 'L’offre est disponible après finalisation de l’étude.';
  }
  return null;
}
