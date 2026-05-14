/**
 * engines/requests.js
 * Accesseurs et calcul de réservation pour les demandes de raccordement.
 */

import { safeNum } from '../utils/numbers.js';
import { computeCapacityImpact } from './capacityImpact.js';
import {
  getAssessment,
  getRequestedInjection,
  getRequestedLoad,
} from './requestModel.js';

// ── Accesseurs modèle client ────────────────────────────────────────────────

export const reqClientPrelevFerme    = req => getRequestedLoad(req);
export const reqClientPrelevFlexible = () => 0;
export const reqClientInjFerme       = req => getRequestedInjection(req);
export const reqClientInjFlexible    = () => 0;
export const reqClientPrelevTotal    = req => reqClientPrelevFerme(req) + reqClientPrelevFlexible(req);
export const reqClientInjTotal       = req => reqClientInjFerme(req) + reqClientInjFlexible(req);

// ── Accesseurs modèle GRD ───────────────────────────────────────────────────
// Si l'étude n'est pas encore faite, on utilise les totaux client (conservatif)

export const reqGrdPrelevFerme    = req => {
  const final = getAssessment(req).final?.load;
  if (final && final.status !== 'PENDING') return safeNum(final.permanent, 0);
  return reqClientPrelevTotal(req);
};
export const reqGrdPrelevFlexible = req => {
  const final = getAssessment(req).final?.load;
  if (final && final.status !== 'PENDING') return safeNum(final.flexible, 0);
  return 0;
};
export const reqGrdInjFerme       = req => {
  const final = getAssessment(req).final?.injection;
  if (final && final.status !== 'PENDING') return safeNum(final.permanent, 0);
  return reqClientInjFerme(req);
};
export const reqGrdInjFlexible    = req => {
  const final = getAssessment(req).final?.injection;
  if (final && final.status !== 'PENDING') return safeNum(final.flexible, 0);
  return reqClientInjFlexible(req);
};

// ── Helpers d'affichage ────────────────────────────────────────────────────

export const reqNetRigid = req => reqGrdPrelevFerme(req) - reqGrdInjFerme(req);
export const reqNetTotal = req => (reqGrdPrelevFerme(req) + reqGrdPrelevFlexible(req)) - (reqGrdInjFerme(req) + reqGrdInjFlexible(req));
export const reqHasPilot = req => reqGrdPrelevFlexible(req) > 0 || reqGrdInjFlexible(req) > 0;

// ── Impact capacitaire — source unique de vérité ────────────────────────────

export function getCapacityImpact(req) {
  return computeCapacityImpact(req).status;
}

// ── Réservations effectives dans la file ────────────────────────────────────

export function getEffectiveRigidReservation(req) {
  const impact = computeCapacityImpact(req);
  if (impact.status === 'NONE' || impact.status === 'RELEASED' || impact.status === 'CONNECTED_RELEASED') return 0;
  return safeNum(impact.reservedLoadPermanent, 0);
}

export function getEffectivePilotableReservation(req) {
  const impact = computeCapacityImpact(req);
  if (impact.status === 'NONE' || impact.status === 'RELEASED' || impact.status === 'CONNECTED_RELEASED') return 0;
  return safeNum(impact.reservedLoadFlexible, 0);
}

export function getEffectiveInjRigide(req) {
  const impact = computeCapacityImpact(req);
  if (impact.status === 'NONE' || impact.status === 'RELEASED' || impact.status === 'CONNECTED_RELEASED') return 0;
  return safeNum(impact.reservedInjectionPermanent, 0);
}

export function getEffectiveInjPilot(req) {
  const impact = computeCapacityImpact(req);
  if (impact.status === 'NONE' || impact.status === 'RELEASED' || impact.status === 'CONNECTED_RELEASED') return 0;
  return safeNum(impact.reservedInjectionFlexible, 0);
}

// ── Projets conditionnants ──────────────────────────────────────────────────

export function getConditioningProjects(req, projects) {
  const ids = [
    ...(req.conditionedOnProjectIds || []),
    ...(req.assessment?.substation?.conditionedOnProjectIds || []),
    ...(req.assessment?.network?.conditionedOnProjectIds || []),
  ].filter((id, index, arr) => id && arr.indexOf(id) === index);
  if (!ids.length) return [];
  return (projects || []).filter(p => ids.includes(p.id));
}

function formatConditionProject(project) {
  return [
    project.name || project.id || 'Projet réseau',
    project.status || null,
    project.year ? `MES ${project.year}` : null,
  ].filter(Boolean).join(' · ');
}

export function buildConditionSummary(req, projects = [], isConditionDecision = false) {
  const ids = [
    ...(Array.isArray(req.conditionedOnProjectIds) ? req.conditionedOnProjectIds : []),
    ...(Array.isArray(req.assessment?.substation?.conditionedOnProjectIds) ? req.assessment.substation.conditionedOnProjectIds : []),
    ...(Array.isArray(req.assessment?.network?.conditionedOnProjectIds) ? req.assessment.network.conditionedOnProjectIds : []),
  ].filter((id, index, arr) => id && arr.indexOf(id) === index);
  const linkedProjects = getConditioningProjects(req, projects);
  const linkedIds = new Set(linkedProjects.map(project => project.id));
  const missingIds = ids.filter(id => !linkedIds.has(id));
  const finalStatuses = [
    req.assessment?.final?.load?.status,
    req.assessment?.final?.injection?.status,
  ].filter(Boolean);
  const conditionLike = isConditionDecision
    || finalStatuses.includes('LIMIT')
    || finalStatuses.includes('FULL_FLEX');

  if (!conditionLike && ids.length === 0) return null;

  if (linkedProjects.length === 0) {
    return {
      status: 'missing',
      label: 'Condition à compléter',
      projects: [],
      missingIds,
      warning: true,
    };
  }

  const [firstProject] = linkedProjects;
  return {
    status: missingIds.length ? 'partial' : 'linked',
    label: linkedProjects.length === 1
      ? formatConditionProject(firstProject)
      : `${formatConditionProject(firstProject)} +${linkedProjects.length - 1}`,
    projects: linkedProjects.map(project => ({
      id: project.id,
      name: project.name || project.id || 'Projet réseau',
      status: project.status || null,
      year: project.year || null,
      label: formatConditionProject(project),
    })),
    missingIds,
    warning: missingIds.length > 0,
  };
}
