import { describe, expect, it } from 'vitest';
import { buildJob, describeParams } from '../job';
import { getMaterialPreset } from '../materials';
import { getModel } from '../registry';

const base = {
  material: getMaterialPreset('NiFe').values,
  kRange: { min: 1, max: 25e6, points: 100, spacing: 'linear' as const },
  modes: [0, 1],
  nT: 0,
};

function defaults(modelId: Parameters<typeof getModel>[0]) {
  const model = getModel(modelId);
  return Object.fromEntries(
    [...model.params, ...(model.methodParams ?? [])].map((p) => [p.key, p.default]),
  );
}

describe('buildJob unit conversion', () => {
  it('converts display units to SI', () => {
    const job = buildJob({
      modelId: 'SingleLayer',
      paramValues: { ...defaults('SingleLayer'), Bext: 20, d: 30, theta: 90, phi: 90 },
      quantityIds: ['dispersion'],
      ...base,
    });
    expect(job.params.Bext).toBeCloseTo(0.02); // 20 mT → T
    expect(job.params.d).toBeCloseTo(30e-9); // 30 nm → m
    expect(job.params.theta).toBeCloseTo(Math.PI / 2); // 90° → rad
    expect(job.params.boundary_cond).toBe(1); // choice passes through
  });

  it('sorts and defaults the mode list', () => {
    const job = buildJob({
      modelId: 'SingleLayer',
      paramValues: defaults('SingleLayer'),
      quantityIds: ['dispersion'],
      ...base,
      modes: [2, 0],
    });
    expect(job.modes).toEqual([0, 2]);
  });

  it('maps empty nullable params: omit vs infinity', () => {
    const job = buildJob({
      modelId: 'SingleLayerSCcoupled',
      paramValues: { ...defaults('SingleLayerSCcoupled'), d_sc: null },
      quantityIds: ['dispersion'],
      ...base,
    });
    expect(job.methodKwargs?.d_sc).toBe('inf'); // null → np.inf on the Python side

    const job2 = buildJob({
      modelId: 'DoubleLayerNumeric',
      material2: getMaterialPreset('YIG').values,
      paramValues: { ...defaults('DoubleLayerNumeric'), Ku2: null },
      quantityIds: ['dispersion'],
      ...base,
    });
    expect('Ku2' in job2.params).toBe(false); // omitted → library default
    expect(job2.material2?.Ms).toBeCloseTo(140e3);
  });

  it('rejects invalid input', () => {
    expect(() =>
      buildJob({
        modelId: 'SingleLayer',
        paramValues: defaults('SingleLayer'),
        quantityIds: [],
        ...base,
      }),
    ).toThrow(/at least one quantity/i);
    expect(() =>
      buildJob({
        modelId: 'SingleLayer',
        paramValues: defaults('SingleLayer'),
        quantityIds: ['dispersion'],
        ...base,
        kRange: { min: 10, max: 5, points: 100, spacing: 'linear' },
      }),
    ).toThrow(/k max/i);
    expect(() =>
      buildJob({
        modelId: 'SingleLayer',
        paramValues: { ...defaults('SingleLayer'), Bext: null },
        quantityIds: ['dispersion'],
        ...base,
      }),
    ).toThrow(/required/i);
  });

  it('describes parameters in display units', () => {
    const desc = describeParams('SingleLayer', { ...defaults('SingleLayer'), Bext: 20 });
    expect(desc['External field']).toBe('20 mT');
    expect(desc['Boundary condition']).toMatch(/unpinned/i);
  });
});
