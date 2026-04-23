/**
 * engines/assumptions.js
 * Snapshot des hypothèses directionnelles — remplace le modèle scénario.
 * Délègue à buildDirectionalSnapshot du moteur directionnel.
 */

import { buildDirectionalSnapshot } from './directionalSubstation.js';

export function buildAssumptionsSnapshot(sub, year, activeView = 'withdrawal', projects = []) {
  return buildDirectionalSnapshot(sub, year, activeView, projects);
}
