import { describe, expect, it } from 'vitest';
import { BLS_ALL_PARAMS, blsSweepableParams } from '../bls';
import { blsDefaultSweepRange, buildBlsJob } from '../blsJob';
import { getMaterialPreset } from '../materials';
import type { ParamValues } from '../job';

const material = getMaterialPreset('NiFe').values;
const defaults = Object.fromEntries(BLS_ALL_PARAMS.map((p) => [p.key, p.default])) as ParamValues;

function input(overrides: Partial<Parameters<typeof buildBlsJob>[0]> = {}) {
  return {
    mode: 'thermal' as const,
    material,
    values: { ...defaults },
    sweepEnabled: false,
    sweepKey: 'Bext',
    sweepFrom: 10,
    sweepTo: 250,
    sweepPoints: 9,
    ...overrides,
  };
}

describe('BLS definitions', () => {
  it('has unique keys and complete tooltips', () => {
    const keys = new Set<string>();
    for (const p of BLS_ALL_PARAMS) {
      expect(keys.has(p.key), `duplicate ${p.key}`).toBe(false);
      keys.add(p.key);
      expect(p.tooltip.length).toBeGreaterThan(0);
    }
  });

  it('exposes the sweepable parameters with ranges', () => {
    const sweepables = blsSweepableParams();
    expect(sweepables.map((p) => p.key)).toEqual([
      'Bext',
      'd',
      'NA',
      'wavelength',
      'dCover',
      'temp',
    ]);
    for (const p of sweepables) {
      const r = blsDefaultSweepRange(p);
      expect(r.to).toBeGreaterThan(r.from);
    }
  });
});

describe('buildBlsJob', () => {
  it('builds a thermal job in SI with the example optical stack', () => {
    const job = buildBlsJob(input());
    expect(job.task).toBe('thermal');
    expect(job.config.Bext).toBeCloseTo(0.05);
    expect(job.config.d).toBeCloseTo(30e-9);
    expect(job.config.kMax).toBeCloseTo(15e6);
    expect(job.config.epsMagRe).toBeCloseTo(-8.1653);
    expect(job.config.epsSubIm).toBeCloseTo(0.43004);
    expect(job.optics.NA).toBeCloseTo(0.75);
    expect(job.optics.wavelength).toBeCloseTo(532e-9);
    expect(job.sweep).toBeUndefined();
    expect((job.config.material as typeof material).Ms).toBeCloseTo(800e3);
  });

  it('adds a sweep with SI values', () => {
    const job = buildBlsJob(input({ sweepEnabled: true, sweepPoints: 5 }));
    expect(job.sweep?.key).toBe('Bext');
    expect(job.sweep?.values).toHaveLength(5);
    expect(job.sweep?.values[0]).toBeCloseTo(0.01);
    expect(job.sweep?.values[4]).toBeCloseTo(0.25);
  });

  it('builds a sensitivity job with its own k range and angle', () => {
    const job = buildBlsJob(input({ mode: 'sensitivity' }));
    expect(job.task).toBe('sensitivity');
    expect(job.config.kMax).toBeCloseTo(20e6); // kMaxSens
    expect(job.config.kPoints).toBe(40);
    expect(job.config.phi).toBeCloseTo(Math.PI / 2);
    expect(job.sweep).toBeUndefined();
  });

  it('validates manual frequency window and sweep length', () => {
    expect(() =>
      buildBlsJob(input({ values: { ...defaults, fAuto: 0, fMin: 10, fMax: 5 } })),
    ).toThrow(/f max/i);
    expect(() => buildBlsJob(input({ sweepEnabled: true, sweepPoints: 60 }))).toThrow(/51/);
  });
});
