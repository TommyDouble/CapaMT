/**
 * engines/project.js
 * Effets des projets réseau sur la charge de base (load_transfer).
 * Les effets sur la capacité (modify_tfo, create_ss) vivent dans capacity.js.
 */

import { safeNum } from '../utils/numbers.js';

/**
 * Charge de base effective à une année donnée — valeur plate (sans compounding).
 * Utilisé pour les calculs de résiduel dans la file d'attente.
 * Pour les projections avec croissance, utiliser getOrganicLoad() (load.js).
 */
export function getEffectiveBaseLoad(sub, projects, year) {
  let base = safeNum(sub.baseLoad2025, 0);

  (projects || []).forEach(proj => {
    if (proj.status === 'annulé' || proj.year > year) return;
    (proj.effects || []).forEach(eff => {
      if (eff.ssId === sub.id && eff.action === 'load_transfer')
        base += safeNum(eff.loadDelta, 0);
    });
  });

  (sub.chargeHistory || []).forEach(entry => {
    if (!entry.includeInBase) return;
    const ey = entry.effectYear || parseInt((entry.date || '').slice(0, 4)) || 9999;
    if (ey <= year) base += safeNum(entry.prelevMW, 0) - safeNum(entry.injMW, 0);
  });

  return Math.max(0, base);
}
