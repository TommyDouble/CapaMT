import { describe, expect, it } from 'vitest';
import { hasCoords, alertForSub } from '../../../src/ui/pages/map/mapHelpers.js';
import { INITIAL_SUBSTATIONS, INITIAL_NETWORK_PROJECTS } from '../../../src/data/initial.js';
import { normalizeSubstations, normalizeProjects } from '../../../src/utils/normalize.js';

const SUBS = normalizeSubstations(INITIAL_SUBSTATIONS);
const PROJECTS = normalizeProjects(INITIAL_NETWORK_PROJECTS);

describe('hasCoords', () => {
  it('retourne true pour lat/lng numériques valides', () => {
    expect(hasCoords({ lat: 50.6, lng: 5.5 })).toBe(true);
    expect(hasCoords({ lat: '50.6', lng: '5.5' })).toBe(true);
  });

  it('retourne false si null/undefined', () => {
    expect(hasCoords(null)).toBe(false);
    expect(hasCoords(undefined)).toBe(false);
    expect(hasCoords({})).toBe(false);
    expect(hasCoords({ lat: null, lng: null })).toBe(false);
  });

  it('retourne false pour chaînes vides ou zéro', () => {
    expect(hasCoords({ lat: '', lng: '' })).toBe(false);
    expect(hasCoords({ lat: 0, lng: 0 })).toBe(false);
    expect(hasCoords({ lat: 50.6, lng: 0 })).toBe(false);
  });

  it('retourne false pour valeurs non numériques', () => {
    expect(hasCoords({ lat: 'abc', lng: 'xyz' })).toBe(false);
    expect(hasCoords({ lat: NaN, lng: NaN })).toBe(false);
  });
});

describe('alertForSub', () => {
  const liegeNord = SUBS.find(s => s.id === 'ss-ln');

  it('renvoie le niveau de prélèvement pour viewMode=withdrawal', () => {
    const { level, state } = alertForSub(liegeNord, 2026, 'withdrawal', PROJECTS);
    expect(level).toBe(state.worstWithdrawal);
    expect(typeof state.uWRvsN1).toBe('number');
  });

  it('renvoie le niveau d\'injection pour viewMode=injection', () => {
    const { level, state } = alertForSub(liegeNord, 2026, 'injection', PROJECTS);
    expect(level).toBe(state.worstInjection);
  });

  it('renvoie le pire des deux pour viewMode=worst', () => {
    const { level, state } = alertForSub(liegeNord, 2026, 'worst', PROJECTS);
    expect(level).toBe(state.worstLevel);
  });

  it('détecte une saturation rigide (≥100%) sur Liege Nord en 2027', () => {
    const { level } = alertForSub(liegeNord, 2027, 'withdrawal', PROJECTS);
    expect(['critical', 'rigid_n']).toContain(level);
  });
});
