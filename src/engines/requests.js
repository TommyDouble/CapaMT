/**
 * engines/requests.js
 * Accesseurs et calcul de réservation pour les demandes de raccordement.
 *
 * Deux responsabilités :
 * 1. Accès unifié au modèle client/grd (compatibilité ascendante avec l'ancien format)
 * 2. Réservation effective par type de statut (logique de file d'attente)
 *
 * Ce module est importé à la fois par load.js (getLoadComponents) et queue.js.
 */

import { safeNum } from '../utils/numbers.js';

// ── Accesseurs modèle client ────────────────────────────────────────────────

export const reqClientPrelevFerme    = req => req.client ? safeNum(req.client.prelevFerme, 0)    : safeNum(req.powerRigid, 0) + safeNum(req.powerPilotable, 0);
export const reqClientPrelevFlexible = req => req.client ? safeNum(req.client.prelevFlexible, 0) : 0;
export const reqClientInjFerme       = req => req.client ? safeNum(req.client.injFerme, 0)       : safeNum(req.injectionRigide, 0);
export const reqClientInjFlexible    = req => req.client ? safeNum(req.client.injFlexible, 0)    : safeNum(req.injectionPilotable, 0);
export const reqClientPrelevTotal    = req => reqClientPrelevFerme(req) + reqClientPrelevFlexible(req);
export const reqClientInjTotal       = req => reqClientInjFerme(req) + reqClientInjFlexible(req);

// ── Accesseurs modèle GRD ───────────────────────────────────────────────────
// Si l'étude n'est pas encore faite (pas de grd), on utilise les totaux client (conservatif)

export const reqGrdPrelevFerme    = req => req.grd ? safeNum(req.grd.prelevFerme, 0)    : reqClientPrelevTotal(req);
export const reqGrdPrelevFlexible = req => req.grd ? safeNum(req.grd.prelevFlexible, 0) : 0;
export const reqGrdInjFerme       = req => req.grd ? safeNum(req.grd.injFerme, 0)       : reqClientInjFerme(req);
export const reqGrdInjFlexible    = req => req.grd ? safeNum(req.grd.injFlexible, 0)    : reqClientInjFlexible(req);

// ── Helpers d'affichage ────────────────────────────────────────────────────

export const reqNetRigid = req => reqGrdPrelevFerme(req) - reqGrdInjFerme(req);
export const reqNetTotal = req => (reqGrdPrelevFerme(req) + reqGrdPrelevFlexible(req)) - (reqGrdInjFerme(req) + reqGrdInjFlexible(req));
export const reqHasPilot = req => reqGrdPrelevFlexible(req) > 0 || reqGrdInjFlexible(req) > 0;

// ── Réservations effectives dans la file ────────────────────────────────────
//
// Règles :
//   - annulée / conditionnel → 0 (libéré / hors file)
//   - raccordée → 0 (intégrée dans chargeHistory → getOrganicLoad)
//   - en_étude sans grd → tout en ferme (conservatif)
//   - étudiée → valeurs GRD confirmées

const INACTIVE = new Set(['annulée', 'annulé', 'conditionnel', 'raccordée', 'raccordé']);

export function getEffectiveRigidReservation(req) {
  if (INACTIVE.has(req.status)) return 0;
  if (req.status === 'en_étude' || !req.grd) return reqClientPrelevTotal(req);
  return reqGrdPrelevFerme(req);
}

export function getEffectivePilotableReservation(req) {
  if (INACTIVE.has(req.status)) return 0;
  if (req.status === 'en_étude' || !req.grd) return 0;
  return reqGrdPrelevFlexible(req);
}

export function getEffectiveInjRigide(req) {
  if (INACTIVE.has(req.status)) return 0;
  return reqGrdInjFerme(req);
}

export function getEffectiveInjPilot(req) {
  if (INACTIVE.has(req.status)) return 0;
  return reqGrdInjFlexible(req);
}
