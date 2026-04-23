/**
 * utils/dates.js
 * Date de référence — toujours la date système réelle.
 * Pour simuler une date : remplacer `new Date()` par `new Date('YYYY-MM-DD')`.
 */

export const getToday = () => new Date();

/** Singleton calculé à l'init du module — réel, jamais hardcodé. */
export const TODAY = getToday();
