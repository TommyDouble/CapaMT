/**
 * engines/recommendation.js
 * Logique métier de recommandation GRD — modèle directionnel v6.
 *
 * Calcule séparément :
 *   - Le résiduel prélèvement et la recommandation ferme/flexible
 *   - Le résiduel injection et la recommandation injection
 */

import { safeNum }                    from '../utils/numbers.js';
import { getFoisonnement }             from '../constants/index.js';
import { getCapacityAtYear }           from './capacity.js';
import {
  getWithdrawalBaseNet, getInjectionBaseNet,
  getDirectCapacityN1AtYear, getReverseCapacityN1AtYear,
} from './directionalSubstation.js';
import { getEffectiveRigidReservation, getEffectiveInjRigide } from './requests.js';

/**
 * @param {object}   sub      - Sous-station cible
 * @param {object}   form     - Formulaire de la demande en cours d'édition
 * @param {object[]} projects - Projets réseau actifs
 * @returns {RecommendationResult|null}
 */
export function computeRecommendation(sub, form, projects = []) {
  if (!sub || !form) return null;

  const year        = parseInt(form.yearSouhaitee || form.year) || 2026;
  const clientFerme  = safeNum(form.client?.prelevFerme, 0);
  const clientFlex   = safeNum(form.client?.prelevFlexible, 0);
  const totalPrelev  = clientFerme + clientFlex;
  const clientInjF   = safeNum(form.client?.injFerme, 0);
  const clientInjFl  = safeNum(form.client?.injFlexible, 0);
  const totalInj     = clientInjF + clientInjFl;

  if (totalPrelev === 0 && totalInj === 0) return null;

  // Capacités directionnelles
  const capDirN1 = getDirectCapacityN1AtYear(sub, year, projects);
  const capRevN1 = getReverseCapacityN1AtYear(sub, year, projects);

  // Bases nettes directionnelles
  const withdrawalBase = getWithdrawalBaseNet(sub, year, projects);
  const injectionBase  = getInjectionBaseNet(sub, year, projects);

  // Réservations engagées (hors demande en cours)
  const otherReqs = (sub.connectionRequests || []).filter(r =>
    r.id !== form.id
    && r.status !== 'annulée' && r.status !== 'annulé'
    && r.status !== 'conditionnel'
    && (r.yearSouhaitee || r.year || 2026) <= year
  );

  const committedWFirm = otherReqs.reduce(
    (s, r) => s + getEffectiveRigidReservation(r) * getFoisonnement(r, sub), 0
  );
  const committedIFirm = otherReqs.reduce(
    (s, r) => s + getEffectiveInjRigide(r) * getFoisonnement(r, sub), 0
  );

  // Résiduel prélèvement
  const residualWithdrawal = capDirN1 - withdrawalBase - committedWFirm;

  // Résiduel injection
  const injRigidCurrent = injectionBase - committedIFirm;
  const residualInjection = injRigidCurrent < 0
    ? capRevN1 - Math.abs(injRigidCurrent)
    : capRevN1;

  // Recommandation prélèvement
  const recFerme = +Math.max(0, Math.min(clientFerme, residualWithdrawal)).toFixed(1);
  const recFlex  = +Math.max(0, totalPrelev - recFerme).toFixed(1);

  // Recommandation injection — on conserve l'enveloppe client si la capacité inverse le permet
  const injAvailable = residualInjection;
  const recInjFerme  = +Math.min(clientInjF, Math.max(0, injAvailable)).toFixed(1);
  const recInjFlex   = +Math.min(clientInjFl, Math.max(0, injAvailable - recInjFerme)).toFixed(1);

  // Diagnostic prélèvement
  const canFullFerme = residualWithdrawal >= clientFerme;
  const canPartial   = residualWithdrawal > 0 && residualWithdrawal < clientFerme;
  const noRigid      = residualWithdrawal <= 0 && totalPrelev > 0;

  // Capacité sans projets (pour détecter les demandes conditionnelles)
  const capDirN1NoInv = getDirectCapacityN1AtYear(sub, year, []);
  const withdrawalBaseNoInv = getWithdrawalBaseNet(sub, year, []);
  const residualWithdrawalNoInv = capDirN1NoInv - withdrawalBaseNoInv - committedWFirm;

  return {
    year,
    // Capacités
    capDirN1, capRevN1,
    capAtYear: capDirN1,  // backward compat alias
    // Bases et résiduels
    withdrawalBase,
    injectionBase,
    committedWFirm, committedIFirm,
    residual: residualWithdrawal,           // backward compat alias
    residualWithdrawal,
    residualInjection,
    residualWithdrawalNoInv,
    // Demande client
    clientFerme, clientFlex, totalPrelev,
    clientInjF, clientInjFl, totalInj,
    // Recommandation GRD
    recFerme, recFlex,
    recInjFerme, recInjFlex,
    // Diagnostic
    canFullFerme, canPartial, noRigid,
  };
}
