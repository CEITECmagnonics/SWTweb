import { describe, expect, it } from 'vitest';
import { BLS_ALL_PARAMS } from '../../models/bls';
import { buildBlsJob } from '../../models/blsJob';
import type { ParamValues } from '../../models/job';
import { getMaterialPreset } from '../../models/materials';
import type { BlsMeta } from '../../state/store';
import { generateBlsNotebook } from '../generateBlsNotebook';

const material = getMaterialPreset('NiFe').values;
const defaults = Object.fromEntries(BLS_ALL_PARAMS.map((p) => [p.key, p.default])) as ParamValues;

function makeMeta(job: ReturnType<typeof buildBlsJob>, extra: Partial<BlsMeta> = {}): BlsMeta {
  return {
    job,
    mode: job.task,
    materialPresetId: 'NiFe',
    paramsDisplay: { 'External field': '50 mT' },
    timestamp: '2026-07-07T00:00:00Z',
    ...extra,
  };
}

describe('generateBlsNotebook', () => {
  it('produces a valid thermal notebook with the GF call and citation', () => {
    const job = buildBlsJob({
      mode: 'thermal',
      material,
      values: defaults,
      sweepEnabled: false,
      sweepKey: 'Bext',
      sweepFrom: 0,
      sweepTo: 0,
      sweepPoints: 2,
    });
    const nb = generateBlsNotebook({
      job,
      meta: makeMeta(job),
      materialPresetId: 'NiFe',
      swtVersion: '1.3.0',
    });
    const parsed = JSON.parse(nb);
    expect(parsed.nbformat).toBe(4);
    expect(nb).toContain('get_signal_GF_focal');
    expect(nb).toContain('ObjectiveLens');
    expect(nb).toContain('GetBlochFunction');
    expect(nb).toContain('10.1103/PhysRevB.110.224428');
    expect(nb).toContain('10.1088/1361-648X/ae6430');
    // detection optics mirror the bridge call (quotes JSON-escaped in .ipynb)
    expect(nb).toContain('output_analyzer=\\"none\\"');
    expect(nb).toContain('collectionSpot=0.000001');
  });

  it('produces a swept thermal notebook with pcolormesh', () => {
    const job = buildBlsJob({
      mode: 'thermal',
      material,
      values: defaults,
      sweepEnabled: true,
      sweepKey: 'Bext',
      sweepFrom: 10,
      sweepTo: 100,
      sweepPoints: 4,
    });
    const nb = generateBlsNotebook({
      job,
      meta: makeMeta(job, { sweepKey: 'Bext', paramLabel: 'External field', paramUnit: 'mT', paramToSI: 1e-3 }),
      materialPresetId: 'NiFe',
      swtVersion: '1.3.0',
    });
    expect(() => JSON.parse(nb)).not.toThrow();
    expect(nb).toContain('sweep_values');
    expect(nb).toContain('Bext=value');
    expect(nb).toContain('pcolormesh');
  });

  it('produces an RT notebook without the dielectric stack or analyzer', () => {
    const job = buildBlsJob({
      mode: 'thermal',
      material,
      values: { ...defaults, method: 'RT' },
      sweepEnabled: false,
      sweepKey: 'Bext',
      sweepFrom: 0,
      sweepTo: 0,
      sweepPoints: 2,
    });
    const nb = generateBlsNotebook({
      job,
      meta: makeMeta(job),
      materialPresetId: 'NiFe',
      swtVersion: '1.3.0',
    });
    expect(() => JSON.parse(nb)).not.toThrow();
    expect(nb).toContain('get_signal_RT_focal');
    expect(nb).toContain('mo_linear');
    expect(nb).toContain('rotate_field');
    expect(nb).not.toContain('DF = [');
    expect(nb).not.toContain('output_analyzer');
    expect(nb).not.toContain('get_signal_GF_focal');
  });

  it('produces a swept RT notebook that is valid JSON', () => {
    const job = buildBlsJob({
      mode: 'thermal',
      material,
      values: { ...defaults, method: 'RT' },
      sweepEnabled: true,
      sweepKey: 'Bext',
      sweepFrom: 10,
      sweepTo: 100,
      sweepPoints: 4,
    });
    const nb = generateBlsNotebook({
      job,
      meta: makeMeta(job, {
        sweepKey: 'Bext',
        paramLabel: 'External field',
        paramUnit: 'mT',
        paramToSI: 1e-3,
      }),
      materialPresetId: 'NiFe',
      swtVersion: '1.3.0',
    });
    expect(() => JSON.parse(nb)).not.toThrow();
    expect(nb).toContain('get_signal_RT_focal');
    expect(nb).toContain('mo_linear');
    expect(nb).toContain('pcolormesh');
    expect(nb).not.toContain('DF = [');
  });

  it('includes the cover layer stack when enabled', () => {
    const job = buildBlsJob({
      mode: 'thermal',
      material,
      values: { ...defaults, coverEnabled: 1, dCover: 80 },
      sweepEnabled: false,
      sweepKey: 'Bext',
      sweepFrom: 0,
      sweepTo: 0,
      sweepPoints: 2,
    });
    const nb = generateBlsNotebook({
      job,
      meta: makeMeta(job),
      materialPresetId: 'NiFe',
      swtVersion: '1.3.0',
    });
    expect(nb).toContain('air / cover / magnetic layer / substrate');
    expect(nb).toContain('source_layer = 2');
    expect(nb).toContain('thicknesses = [8e-8, 3e-8]');
  });
});
