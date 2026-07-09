import { describe, expect, it } from 'vitest';
import { BLS_ALL_PARAMS, blsSweepableParams, transposeSweepGrid } from '../bls';
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

  it('transposes a sweep grid from [param][freq] to [freq][param]', () => {
    // 2 sweep points × 3 frequencies: z[paramIndex][freqIndex].
    const stored = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    expect(transposeSweepGrid(stored, 3)).toEqual([
      [1, 4],
      [2, 5],
      [3, 6],
    ]);
    // Missing values become explicit nulls so the plot renders gaps.
    expect(transposeSweepGrid([[1, null, 3]], 3)).toEqual([[1], [null], [3]]);
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
    expect(job.optics.analyzer).toBe('none');
    expect(job.optics.analyzerAngle).toBe(90);
    expect(Number(job.optics.collectionSpot)).toBeCloseTo(1e-6);
    expect(job.sweep).toBeUndefined();
    expect((job.config.material as typeof material).Ms).toBeCloseTo(800e3);
  });

  it('threads the chemical potential to SI (µ/h in Hz) with the example default', () => {
    // Default µ/h = −1000 GHz reproduces the SpinWaveToolkit example (−1e12 Hz).
    expect(buildBlsJob(input()).config.mu).toBe(-1e12);
    const custom = buildBlsJob(input({ values: { ...defaults, mu: 3 } }));
    expect(custom.config.mu).toBeCloseTo(3e9);
  });

  it('drops the unused Ku from the BLS material', () => {
    const job = buildBlsJob(
      input({ material: { ...material, Ku: 1.5e-3 } }),
    );
    expect('Ku' in (job.config.material as object)).toBe(false);
    expect((job.config.material as typeof material).Ms).toBeCloseTo(800e3);
  });

  it('adds a sweep with SI values', () => {
    const job = buildBlsJob(input({ sweepEnabled: true, sweepPoints: 5 }));
    expect(job.sweep?.key).toBe('Bext');
    expect(job.sweep?.values).toHaveLength(5);
    expect(job.sweep?.values[0]).toBeCloseTo(0.01);
    expect(job.sweep?.values[4]).toBeCloseTo(0.25);
  });

  it('defaults to the Green-function method and carries RT when selected', () => {
    expect(buildBlsJob(input()).config.method).toBe('GF');
    const rt = buildBlsJob(input({ values: { ...defaults, method: 'RT' } }));
    expect(rt.config.method).toBe('RT');
  });

  it('rejects RT combined with the optical cover layer', () => {
    expect(() =>
      buildBlsJob(input({ values: { ...defaults, method: 'RT', coverEnabled: 1 } })),
    ).toThrow(/reciprocity-theorem method supports only/i);
  });

  it('rejects sweeping the cover thickness under RT', () => {
    expect(() =>
      buildBlsJob(
        input({
          values: { ...defaults, method: 'RT' },
          sweepEnabled: true,
          sweepKey: 'dCover',
          sweepFrom: 0,
          sweepTo: 200,
          sweepPoints: 3,
        }),
      ),
    ).toThrow(/cover thickness cannot be swept/i);
  });

  it('validates manual frequency window and sweep length', () => {
    expect(() =>
      buildBlsJob(input({ values: { ...defaults, fAuto: 0, fMin: 10, fMax: 5 } })),
    ).toThrow(/f max/i);
    expect(() => buildBlsJob(input({ sweepEnabled: true, sweepPoints: 60 }))).toThrow(/51/);
  });
});
