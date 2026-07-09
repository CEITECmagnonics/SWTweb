import { describe, expect, it } from 'vitest';
import { getModel, MODEL_LIST } from '../registry';
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

  it('restricts SingleLayerNumeric to the only implemented boundary condition', () => {
    // SWT 1.3.0's Tacchi solver raises for BC 2-4 with N >= 2 modes.
    const numeric = getModel('SingleLayerNumeric');
    const bc = numeric.params.find((p) => p.key === 'boundary_cond');
    expect(bc?.choices?.map((c) => c.value)).toEqual([1]);
    expect(numeric.params.some((p) => p.key === 'dp')).toBe(false);
    // The analytical model keeps all four (they all work there).
    const analytic = getModel('SingleLayer');
    expect(analytic.params.find((p) => p.key === 'boundary_cond')?.choices).toHaveLength(4);
  });

  it('classifies parallel-pumping quantities as k-dependent arrays', () => {
    // GetCouplingParam/GetThresholdField return arrays over kxi; the former
    // 'scalar' classification crashed float() in the bridge.
    const q = getModel('SingleLayer').quantities;
    expect(q.find((x) => x.id === 'couplingParam')?.returns).toBe('array');
    expect(q.find((x) => x.id === 'thresholdField')?.returns).toBe('array');
  });

  it('exposes optional field angles and Bloch thermal weighting', () => {
    const sl = getModel('SingleLayer');
    for (const key of ['theta_H', 'phi_H']) {
      const p = sl.params.find((x) => x.key === key);
      expect(p?.nullable).toBe(true);
      expect(p?.nullBehavior).toBe('omit');
    }
    for (const id of ['SingleLayer', 'SingleLayerNumeric', 'DoubleLayerNumeric'] as const) {
      const m = getModel(id);
      expect(m.methodParams?.some((p) => p.key === 'temp')).toBe(true);
      expect(m.quantities.find((q2) => q2.id === 'blochFunction')?.kwargNames).toContain('temp');
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
