import { describe, it, expect } from 'vitest';
import { getConditioningProjects } from '../../src/engines/requests.js';

const mockProjects = [
  { id: 'proj-001', name: 'Renforcement A', status: 'planifié', year: 2027 },
  { id: 'proj-002', name: 'Création B',     status: 'validé',   year: 2028 },
  { id: 'proj-003', name: 'Extension C',    status: 'annulé',   year: 2026 },
];

describe('getConditioningProjects', () => {
  it('retourne un tableau vide si conditionedOnProjectIds absent', () => {
    const req = { id: 'req-1', status: 'conditionnel' };
    expect(getConditioningProjects(req, mockProjects)).toEqual([]);
  });

  it('retourne un tableau vide si conditionedOnProjectIds vide', () => {
    const req = { id: 'req-1', conditionedOnProjectIds: [] };
    expect(getConditioningProjects(req, mockProjects)).toEqual([]);
  });

  it('retourne les projets correspondants', () => {
    const req = { id: 'req-1', conditionedOnProjectIds: ['proj-001', 'proj-003'] };
    const result = getConditioningProjects(req, mockProjects);
    expect(result).toHaveLength(2);
    expect(result.map(p => p.id)).toContain('proj-001');
    expect(result.map(p => p.id)).toContain('proj-003');
  });

  it('retourne les projets conditionnants encodés au niveau local et réseau', () => {
    const req = {
      id: 'req-1',
      assessment: {
        substation: { conditionedOnProjectIds: ['proj-001'] },
        network: { conditionedOnProjectIds: ['proj-002'] },
      },
    };
    const result = getConditioningProjects(req, mockProjects);
    expect(result.map(p => p.id)).toEqual(['proj-001', 'proj-002']);
  });

  it('ignore les ids inexistants', () => {
    const req = { id: 'req-1', conditionedOnProjectIds: ['proj-999', 'proj-001'] };
    const result = getConditioningProjects(req, mockProjects);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('proj-001');
  });

  it('retourne un tableau vide si projects est null/undefined', () => {
    const req = { id: 'req-1', conditionedOnProjectIds: ['proj-001'] };
    expect(getConditioningProjects(req, null)).toEqual([]);
    expect(getConditioningProjects(req, undefined)).toEqual([]);
  });
});
