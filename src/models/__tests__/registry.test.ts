import { describe, expect, it } from 'vitest';
import { MODEL_LIST } from '../registry';
import { buildJob } from '../job';
import { getMaterialPreset } from '../materials';

describe('model registry', () => {
  it('defines all five SWT model classes', () => {
    expect(MODEL_LIST.map((m) => m.id).sort()).toEqual([
      'BulkPolariton',
      'DoubleLayerNumeric',
      'SingleLayer',
      'SingleLayerNumeric',
      'SingleLayerSCcoupled',
    ]);
  });

  it.each(MODEL_LIST.map((m) => [m.id, m] as const))('%s is complete', (_id, model) => {
    expect(model.label.length).toBeGreaterThan(0);
    expect(model.info.summary.length).toBeGreaterThan(0);
    expect(model.info.details.length).toBeGreaterThan(0);
    expect(model.info.references.length).toBeGreaterThan(0);
    expect(model.quantities.length).toBeGreaterThan(0);
    expect(model.kDefault.max).toBeGreaterThan(model.kDefault.min);
    expect(model.kDefault.points).toBeGreaterThanOrEqual(2);

    const paramKeys = new Set<string>();
    for (const p of [...model.params, ...(model.methodParams ?? [])]) {
      expect(paramKeys.has(p.key), `duplicate param ${p.key}`).toBe(false);
      paramKeys.add(p.key);
      expect(p.tooltip.length, `${p.key} tooltip`).toBeGreaterThan(0);
      expect(Number.isFinite(p.toSI)).toBe(true);
      if (p.kind === 'choice') {
        expect(p.choices && p.choices.length > 0).toBe(true);
      }
      if (!p.nullable) {
        expect(p.default, `${p.key} default`).not.toBeNull();
      }
    }

    const qIds = new Set<string>();
    for (const q of model.quantities) {
      expect(qIds.has(q.id), `duplicate quantity ${q.id}`).toBe(false);
      qIds.add(q.id);
      expect(q.tooltip.length, `${q.id} tooltip`).toBeGreaterThan(0);
      expect(q.axisLabel.length).toBeGreaterThan(0);
      expect(Number.isFinite(q.scale) && q.scale > 0).toBe(true);
      // kwargNames must reference declared methodParams
      for (const name of q.kwargNames ?? []) {
        expect(
          model.methodParams?.some((p) => p.key === name),
          `${model.id}.${q.id} kwarg ${name}`,
        ).toBe(true);
      }
    }
  });

  it('builds a valid job for every model with defaults', () => {
    for (const model of MODEL_LIST) {
      const job = buildJob({
        modelId: model.id,
        material: getMaterialPreset('NiFe').values,
        material2: model.hasSecondMaterial ? getMaterialPreset('NiFe').values : undefined,
        paramValues: Object.fromEntries(
          [...model.params, ...(model.methodParams ?? [])].map((p) => [p.key, p.default]),
        ),
        kRange: model.kDefault,
        modes: [0],
        nT: 0,
        quantityIds: model.quantities.map((q) => q.id),
      });
      expect(job.model).toBe(model.id);
      expect(job.quantities.length).toBe(model.quantities.length);
      expect(job.material.Ms).toBeCloseTo(800e3);
    }
  });
});
