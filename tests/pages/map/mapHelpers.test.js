import { describe, expect, it } from 'vitest';
import {
  hasCoords,
  alertForSub,
  applyRequestCoordinatesToSubstation,
  buildCapacityMapRows,
  buildCapacityMapStats,
} from '../../../src/ui/pages/map/mapHelpers.js';
import { INITIAL_SUBSTATIONS, INITIAL_NETWORK_PROJECTS } from '../../../src/data/initial.js';
import { normalizeSubstations, normalizeProjects } from '../../../src/utils/normalize.js';
import { getEffectiveSubstations } from '../../../src/engines/capacity.js';
import { computeEffectsFromBlocks } from '../../../src/engines/projectEffects.js';
import {
  canonicalRequest,
  canonicalSubstation,
  connectedRequest,
  studiedRequest,
} from '../../helpers/canonicalFixtures.js';

const SUBS = normalizeSubstations(INITIAL_SUBSTATIONS);
const PROJECTS = normalizeProjects(INITIAL_NETWORK_PROJECTS);

function withCoords(req, lat, lng = 5.55) {
  return {
    ...req,
    customer: {
      ...req.customer,
      site: {
        ...req.customer.site,
        coordinates: { lat, lng, source: 'manual' },
      },
    },
  };
}

describe('hasCoords', () => {
  it('retourne true pour lat/lng numériques valides', () => {
    expect(hasCoords({ lat: 50.6, lng: 5.5 })).toBe(true);
    expect(hasCoords({ lat: '50.6', lng: '5.5' })).toBe(true);
    expect(hasCoords({ lat: '50,6', lng: '5,5' })).toBe(true);
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

describe('données de carte', () => {
  it('positionne les sous-stations des fixtures fraîches', () => {
    expect(SUBS.filter((sub) => hasCoords(sub.coordinates))).toHaveLength(4);
  });

  it('conserve les coordonnées d’une sous-station créée par projet', () => {
    const [effect] = computeEffectsFromBlocks(
      [
        {
          blockType: 'création',
          _newSsId: 'ss-new-map',
          name: 'SS Carte',
          code: 'MAP',
          commune: 'Liege',
          coordinates: { lat: '50.61', lng: '5.56' },
          voltageUpstream: '36kV',
          tfos: [{ id: 't1', power: '25', role: 'normal' }],
          coeffN: '0.90',
          coeffN1: '1.00',
          initialLoadMva: '0',
          growthRatePct: '0',
        },
      ],
      [],
    );

    const effective = getEffectiveSubstations(
      [],
      [{ id: 'proj-map', status: 'validé', year: 2026, effects: [effect] }],
      2026,
    );
    const created = effective.find((sub) => sub.id === 'ss-new-map');

    expect(created.coordinates).toEqual({ lat: 50.61, lng: 5.56, source: 'project' });
    expect(hasCoords(created.coordinates)).toBe(true);
  });

  it('positionne une demande par clic carte sans toucher aux autres dossiers', () => {
    const req = canonicalRequest({ id: 'req-map' });
    const other = canonicalRequest({ id: 'req-other' });
    const sub = canonicalSubstation({ connectionRequests: [req, other] });

    const updated = applyRequestCoordinatesToSubstation(sub, 'req-map', {
      lat: 50.62,
      lng: 5.58,
      source: 'map_click',
    });

    expect(
      updated.connectionRequests.find((r) => r.id === 'req-map').customer.site.coordinates,
    ).toEqual({ lat: 50.62, lng: 5.58, source: 'map_click' });
    expect(
      updated.connectionRequests.find((r) => r.id === 'req-other').customer.site.coordinates,
    ).toEqual({ lat: null, lng: null, source: 'manual' });
  });

  it('liste toutes les demandes avec impact capacité actif, indépendamment de la file', () => {
    const sub = canonicalSubstation({
      connectionRequests: [
        withCoords(canonicalRequest({ id: 'queue', load: 2 }), 50.61),
        withCoords(studiedRequest({ id: 'study', load: 3 }), 50.62),
        withCoords(
          studiedRequest({
            id: 'accepted',
            offerStatus: 'offer_accepted',
            offerDates: { acceptedAt: '2026-03-01' },
            load: 4,
          }),
          50.63,
        ),
        withCoords(
          connectedRequest({ id: 'connected', offerDates: { connectedAt: '2026-04-01' }, load: 5 }),
          50.64,
        ),
        withCoords(
          connectedRequest({
            id: 'expired',
            offerDates: { connectedAt: '2025-01-01' },
            connectedRetentionMonths: 1,
            load: 6,
          }),
          50.65,
        ),
        withCoords(
          canonicalRequest({ id: 'cancelled', customerStatus: 'cancelled', load: 7 }),
          50.66,
        ),
      ],
    });

    const rows = buildCapacityMapRows([sub]);

    expect(rows.map((row) => row.req.id)).toEqual(['queue', 'study', 'accepted', 'connected']);
    expect(rows.map((row) => row.impactStatus)).toEqual([
      'QUEUE_RESERVED',
      'STUDY_RESERVED',
      'ACQUIRED',
      'CONNECTED_RESERVED',
    ]);
  });

  it('compte les demandes actives positionnées et non positionnées pour le diagnostic', () => {
    const sub = canonicalSubstation({
      coordinates: { lat: 50.6, lng: 5.5, source: 'manual' },
      connectionRequests: [
        withCoords(canonicalRequest({ id: 'positioned', load: 2 }), 50.61),
        canonicalRequest({ id: 'missing', load: 3 }),
      ],
    });
    const rows = buildCapacityMapRows([sub]);
    const stats = buildCapacityMapStats([sub], rows);

    expect(stats.substations).toEqual({ total: 1, positioned: 1 });
    expect(stats.activeRequests).toEqual({ total: 2, positioned: 1, unpositioned: 1 });
  });
});

describe('alertForSub', () => {
  const liegeNord = SUBS.find((s) => s.id === 'ss-ln');

  it('renvoie le niveau de prélèvement pour viewMode=withdrawal', () => {
    const { level, state } = alertForSub(liegeNord, 2026, 'withdrawal', PROJECTS);
    expect(level).toBe(state.worstWithdrawal);
    expect(typeof state.uWRvsN1).toBe('number');
  });

  it("renvoie le niveau d'injection pour viewMode=injection", () => {
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
