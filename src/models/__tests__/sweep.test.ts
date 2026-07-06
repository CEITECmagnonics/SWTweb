import { describe, expect, it } from 'vitest';
import { getMaterialPreset } from '../materials';
import { MACROSPIN_PARAMS } from '../macrospin';
import { getModel } from '../registry';
import { buildHystJob, buildSweepJob, defaultSweepRange, sweepableParams } from '../sweep';

function defaults(defs: { key: string; default: number | string | null }[]) {
  return Object.fromEntries(defs.map((p) => [p.key, p.default]));
}

const material = getMaterialPreset('NiFe').values;

function sweepInput(overrides: Partial<Parameters<typeof buildSweepJob>[0]> = {}) {
  const model = getModel('SingleLayer');
  return {
    modelId: 'SingleLayer' as const,
    material,
    paramValues: defaults([...model.params, ...(model.methodParams ?? [])]),
    macrospinValues: defaults(MACROSPIN_PARAMS),
    sweepKey: 'Bext',
    from: 0,
    to: 200,
    points: 11,
    mode: 'fixedK' as const,
    kFixed: 0,
    kRange: model.kDefault,
    quantityId: 'dispersion',
    modes: [0],
    nT: 0,
    relax: false,
    ...overrides,
  };
}

describe('sweepableParams', () => {
  it('lists numeric parameters for SWT models and excludes choices/nullables', () => {
    const keys = sweepableParams('SingleLayer').map((p) => p.key);
    expect(keys).toContain('Bext');
    expect(keys).toContain('d');
    expect(keys).toContain('theta');
    expect(keys).not.toContain('boundary_cond'); // choice
    const sc = sweepableParams('SingleLayerSCcoupled').map((p) => p.key);
    expect(sc).toContain('lam');
    expect(sc).not.toContain('d_sc'); // nullable
    expect(sc).not.toContain('model'); // choice
  });

  it('lists the macrospin sweepables', () => {
    expect(sweepableParams('Macrospin').map((p) => p.key)).toEqual([
      'Bext',
      'theta_H',
      'phi_H',
      'ani1_Ku',
      'ani2_Ku',
    ]);
  });

  it('provides sane default ranges', () => {
    const bext = sweepableParams('SingleLayer').find((p) => p.key === 'Bext')!;
    expect(defaultSweepRange(bext)).toEqual({ from: 0, to: 200, points: 51 });
  });
});

describe('buildSweepJob', () => {
  it('converts the sweep range to SI and keeps two k points at fixed k', () => {
    const job = buildSweepJob(sweepInput());
    expect(job.sweep.values).toHaveLength(11);
    expect(job.sweep.values[0]).toBeCloseTo(0);
    expect(job.sweep.values[10]).toBeCloseTo(0.2); // 200 mT → T
    expect(job.kFixed).toBe(0); // clamped in the bridge to ~0
    expect(job.mode).toBe('fixedK');
    expect(job.quantities).toHaveLength(1);
  });

  it('builds a map job with the model k range', () => {
    const job = buildSweepJob(sweepInput({ mode: 'map' }));
    expect(job.kRange).toEqual(getModel('SingleLayer').kDefault);
    expect(job.kFixed).toBeUndefined();
  });

  it('rejects scalar quantities in map mode and grid quantities everywhere', () => {
    expect(() => buildSweepJob(sweepInput({ mode: 'map', quantityId: 'exchangeLength' }))).toThrow(
      /no k dependence/i,
    );
    expect(() => buildSweepJob(sweepInput({ quantityId: 'blochFunction' }))).toThrow(/2D/);
  });

  it('builds a macrospin config job with Ms from the material', () => {
    const job = buildSweepJob(
      sweepInput({ modelId: 'Macrospin', sweepKey: 'Bext', from: -50, to: 50 }),
    );
    expect(job.model).toBe('Macrospin');
    expect(job.config?.Ms).toBeCloseTo(800e3);
    expect(job.config?.theta_H).toBeCloseTo(Math.PI / 2);
    expect(job.config?.demag).toBe('film');
    expect(job.sweep.values[0]).toBeCloseTo(-0.05);
  });

  it('enables relaxation only for the double layer', () => {
    const model = getModel('DoubleLayerNumeric');
    const job = buildSweepJob(
      sweepInput({
        modelId: 'DoubleLayerNumeric',
        material2: getMaterialPreset('NiFe').values,
        paramValues: defaults(model.params),
        kRange: model.kDefault,
        relax: true,
      }),
    );
    expect(job.relax).toBe(true);
    const single = buildSweepJob(sweepInput({ relax: true }));
    expect(single.relax).toBe(false);
  });
});

describe('buildHystJob', () => {
  it('builds a single-layer macrospin loop', () => {
    const job = buildHystJob({
      type: 'single',
      material,
      macrospinValues: { ...defaults(MACROSPIN_PARAMS), ani1_Ku: 50 },
      doubleLayerValues: {},
      Bmax: 100,
      points: 101,
    });
    expect(job.type).toBe('single');
    expect(job.Bmax).toBeCloseTo(0.1);
    expect(job.config?.ani1_Ku).toBeCloseTo(50e3); // kJ/m³ → J/m³
    expect(job.points).toBe(101);
  });

  it('builds a double-layer loop from the DoubleLayerNumeric form', () => {
    const model = getModel('DoubleLayerNumeric');
    const job = buildHystJob({
      type: 'double',
      material,
      material2: getMaterialPreset('YIG').values,
      macrospinValues: defaults(MACROSPIN_PARAMS),
      doubleLayerValues: { ...defaults(model.params), Jbl: -0.5 },
      Bmax: 200,
      points: 51,
    });
    expect(job.type).toBe('double');
    expect(job.params?.Jbl).toBeCloseTo(-0.5e-3);
    expect(job.material2?.Ms).toBeCloseTo(140e3);
  });

  it('validates the loop inputs', () => {
    const base = {
      type: 'single' as const,
      material,
      macrospinValues: defaults(MACROSPIN_PARAMS),
      doubleLayerValues: {},
    };
    expect(() => buildHystJob({ ...base, Bmax: 0, points: 101 })).toThrow(/positive/i);
    expect(() => buildHystJob({ ...base, Bmax: 100, points: 2 })).toThrow(/points/i);
  });
});
