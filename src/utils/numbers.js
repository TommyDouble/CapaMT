/**
 * utils/numbers.js
 * Opérations numériques sécurisées — aucune dépendance.
 */

/** Parse n'importe quelle valeur en nombre fini, ou retourne fallback. */
export const safeNum = (v, fallback = 0) => {
  const n = parseFloat(v);
  return isFinite(n) ? n : fallback;
};

/** Division sécurisée contre /0 et NaN. */
export const safeDiv = (num, den, fallback = 0) =>
  (isFinite(den) && Math.abs(den) > 1e-9) ? num / den : fallback;
