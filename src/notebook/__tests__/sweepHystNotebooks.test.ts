import { describe, expect, it } from 'vitest';
import { getMaterialPreset } from '../../models/materials';
import { MACROSPIN_PARAMS } from '../../models/macrospin';
import { getModel } from '../../models/registry';
import { buildHystJob, buildSweepJob } from '../../models/sweep';
import type { HystMeta, SweepMeta } from '../../state/store';
import { generateHysteresisNotebook } from '../generateHysteresisNotebook';
import { generateSweepNotebook } from '../generateSweepNotebook';

const material = getMaterialPreset('NiFe').values;

function defaults(defs: { key: string; default: number | string | null }[]) {
  return Object.fromEntries(defs.map((p) => [p.key, p.default]));
}

function sweepMeta(job: ReturnType<typeof buildSweepJob>, extra: Partial<SweepMeta> = {}): SweepMeta {
  return {
    job,
    modelId: job.model,
    modelLabel: 'test',
    key: job.sweep.key,
    paramLabel: 'External field',
    paramUnit: 'mT',
    paramToSI: 1e-3,
    quantityId: 'dispersion',
    mode: job.mode,
    kFixed: 0,
    relax: Boolean(job.relax),
    materialPresetId: 'NiFe',
    paramsDisplay: { 'External field': 'swept' },
    timestamp: '2026-07-06T00:00:00Z',
    ...extra,
  };
}

describe('generateSweepNotebook', () => {
  const model = getModel('SingleLayer');
  const baseInput = {
    modelId: 'SingleLayer' as const,
    material,
    paramValues: defaults([...model.params, ...(model.methodParams ?? [])]),
    macrospinValues: defaults(MACROSPIN_PARAMS),
    sweepKey: 'Bext',
    from: 0,
    to: 200,
    points: 21,
    mode: 'fixedK' as const,
    kFixed: 0,
    kRange: model.kDefault,
    quantityId: 'dispersion',
    modes: [0, 1],
    nT: 0,
    relax: false,
  };

  it('produces a valid fixed-k sweep notebook', () => {
    const job = buildSweepJob(baseInput);
    const nb = generateSweepNotebook({
      job,
      meta: sweepMeta(job),
      materialPresetId: 'NiFe',
      swtVersion: '1.3.0',
    });
    const parsed = JSON.parse(nb);
    expect(parsed.nbformat).toBe(4);
    expect(nb).toContain('sweep_values = np.linspace(0, 0.2, 21)');
    expect(nb).toContain('Bext=value,  # swept');
    expect(nb).toContain('for n in [0,1]');
    expect(nb).toContain('10.1088/1361-648X/ae6430');
  });

  it('produces a dispersion-map notebook with pcolormesh', () => {
    const job = buildSweepJob({ ...baseInput, mode: 'map' });
    const nb = generateSweepNotebook({
      job,
      meta: sweepMeta(job, { mode: 'map' }),
      materialPresetId: 'NiFe',
      swtVersion: '1.3.0',
    });
    expect(() => JSON.parse(nb)).not.toThrow();
    expect(nb).toContain('pcolormesh');
    expect(nb).toContain('zmap');
  });

  it('produces a macrospin sweep notebook with warm-started minimization', () => {
    const job = buildSweepJob({ ...baseInput, modelId: 'Macrospin', from: -50, to: 50 });
    const nb = generateSweepNotebook({
      job,
      meta: sweepMeta(job, { modelId: 'Macrospin' }),
      materialPresetId: 'NiFe',
      swtVersion: '1.3.0',
    });
    expect(() => JSON.parse(nb)).not.toThrow();
    expect(nb).toContain('MacrospinEquilibrium');
    expect(nb).toContain('maceq.minimize(verbose=False)');
    expect(nb).toContain('maceq.Bext[\\"Bext\\"] = value');
  });

  it('adds warm-start relaxation for double-layer sweeps', () => {
    const dl = getModel('DoubleLayerNumeric');
    const job = buildSweepJob({
      ...baseInput,
      modelId: 'DoubleLayerNumeric',
      material2: material,
      paramValues: defaults(dl.params),
      kRange: dl.kDefault,
      relax: true,
    });
    const nb = generateSweepNotebook({
      job,
      meta: sweepMeta(job, { modelId: 'DoubleLayerNumeric', relax: true }),
      materialPresetId: 'NiFe',
      materialPresetId2: 'NiFe',
      swtVersion: '1.3.0',
    });
    expect(() => JSON.parse(nb)).not.toThrow();
    expect(nb).toContain('phi_init = (np.pi / 2, -np.pi / 2)');
    expect(nb).toContain('phis = model.GetPhis()');
  });
});

describe('generateHysteresisNotebook', () => {
  it('produces a single-layer loop notebook', () => {
    const job = buildHystJob({
      type: 'single',
      material,
      macrospinValues: { ...defaults(MACROSPIN_PARAMS), ani1_Ku: 20, ani1_phi: 90 },
      doubleLayerValues: {},
      Bmax: 100,
      points: 101,
    });
    const meta: HystMeta = {
      job,
      type: 'single',
      Bmax: 100,
      materialPresetId: 'NiFe',
      paramsDisplay: {},
      timestamp: '2026-07-06T00:00:00Z',
    };
    const nb = generateHysteresisNotebook({
      job,
      meta,
      materialPresetId: 'NiFe',
      swtVersion: '1.3.0',
    });
    expect(() => JSON.parse(nb)).not.toThrow();
    expect(nb).toContain('maceq.hysteresis(B_down, theta_H, phi_H)');
    expect(nb).toContain('add_uniaxial_anisotropy(\\"ani1\\"');
    expect(nb).toContain('10.1088/1361-648X/ae6430');
  });

  it('produces a double-layer loop notebook with warm-started branches', () => {
    const dl = getModel('DoubleLayerNumeric');
    const job = buildHystJob({
      type: 'double',
      material,
      material2: material,
      macrospinValues: defaults(MACROSPIN_PARAMS),
      doubleLayerValues: defaults(dl.params),
      Bmax: 150,
      points: 51,
    });
    const meta: HystMeta = {
      job,
      type: 'double',
      Bmax: 150,
      materialPresetId: 'NiFe',
      materialPresetId2: 'NiFe',
      paramsDisplay: {},
      timestamp: '2026-07-06T00:00:00Z',
    };
    const nb = generateHysteresisNotebook({
      job,
      meta,
      materialPresetId: 'NiFe',
      materialPresetId2: 'NiFe',
      swtVersion: '1.3.0',
    });
    expect(() => JSON.parse(nb)).not.toThrow();
    expect(nb).toContain('def run_branch');
    expect(nb).toContain('model.GetPhis()');
    expect(nb).toContain('run_branch(B_down, phi_sat)');
    expect(nb).toContain('run_branch(B_up, state)');
  });
});
