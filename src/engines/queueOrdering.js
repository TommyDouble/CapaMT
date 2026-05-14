/**
 * engines/queueOrdering.js
 *
 * Tri FIFO cible: date du premier passage en ready_for_study.
 */

import { getCustomer } from './requestModel.js';

export function getReadyForStudyDate(req) {
  const customer = getCustomer(req);
  return customer.readyForStudyAt || customer.requestDate || customer.createdAt || '9999-12-31';
}

export function compareQueueRequests(a, b) {
  const da = new Date(getReadyForStudyDate(a));
  const db = new Date(getReadyForStudyDate(b));
  const yearA = getCustomer(a).requested?.year || 2026;
  const yearB = getCustomer(b).requested?.year || 2026;
  return da - db || yearA - yearB || String(a.id).localeCompare(String(b.id));
}

export function sortQueueRequests(requests = []) {
  return requests.slice().sort(compareQueueRequests);
}
