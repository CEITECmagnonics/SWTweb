import { describe, expect, it } from 'vitest';
import { generateNotebook } from '../generateNotebook';
import { buildJob } from '../../models/job';
import { describeParams } from '../../models/job';
import { getMaterialPreset } from '../../models/materials';
import { getModel, MODEL_LIST } from '../../models/registry';
import {
  NA_MODE_KEY,
  ND_MODE_KEY,
  tensorEntries,
  thinFilmDemagTensor,
  uniaxialAnisotropyTensor,
} from '../../models/tensors';
import type { ModelId } from '../../models/types';

function makeInput(modelId: ModelId, quantityIds?: string[]) {
  const model = getModel(modelId);
  const paramValues = Object.fromEntries(
    [...model.params, ...(model.methodParams ?? [])].map((p) => [p.key, p.default]),
  );
  const job = buildJob({
    modelId,
    material: getMaterialPreset('NiFe').values,
    material2: model.hasSecondMaterial ? getMaterialPreset('NiFe').values : undefined,
    paramValues,
    kRange: model.kDefault,
    modes: [0, 1],
    nT: 0,
    quantityIds: quantityIds ?? model.quantities.map((q) => q.id),
  });
  return {
    modelId,
    materialPresetId: 'NiFe',
    material: getMaterialPreset('NiFe').values,
    materialPresetId2: model.hasSecondMaterial ? 'NiFe' : undefined,
    material2: model.hasSecondMaterial ? getMaterialPreset('NiFe').values : undefined,
    job,
    paramsDisplay: describeParams(modelId, paramValues),
    swtVersion: '1.3.0',
  };
}

describe('generateNotebook', () => {
  it('produces valid nbformat-4 JSON for every model with all quantities', () => {
    for (const model of MODEL_LIST) {
      const nb = JSON.parse(generateNotebook(makeInput(model.id)));
      expect(nb.nbformat).toBe(4);
      expect(nb.cells.length).toBeGreaterThan(4);
      for (const cell of nb.cells) {
        expect(['markdown', 'code']).toContain(cell.cell_type);
        expect(Array.isArray(cell.source)).toBe(true);
        if (cell.cell_type === 'code') {
          expect(cell.outputs).toEqual([]);
          expect(cell.execution_count).toBeNull();
        }
      }
      const all = nb.cells.map((c: { source: string[] }) => c.source.join('')).join('\n');
      expect(all).toContain('pip install --quiet SpinWaveToolkit==1.3.0');
      expect(all).toContain(`SWT.${model.id}(`);
      expect(all).toContain('import SpinWaveToolkit as SWT');
      // Package citation must be present in every notebook.
      expect(all).toContain('10.1088/1361-648X/ae6430');
      expect(all).toContain('@article{Klima2026SpinWaveToolkit');
    }
  });

  it('reproduces SI parameters and unit conversions in the code', () => {
    const nb = generateNotebook(makeInput('SingleLayer', ['dispersion']));
    expect(nb).toContain('Bext=0.05'); // 50 mT → SI
    expect(nb).toContain('* 1e-9 / (2 * np.pi)'); // rad·Hz → GHz
    expect(nb).toContain('GetDispersion(n=n, nT=0)');
    expect(nb).toContain('np.linspace(1, 25000000, 200)');
  });

  it('uses predefined material shorthand and SC method kwargs', () => {
    const nb = generateNotebook(makeInput('SingleLayerSCcoupled', ['dispersion']));
    expect(nb).toContain('SWT.NiFe');
    expect(nb).toContain('model=\\"original\\"');
    expect(nb).toContain('d_sc=np.inf');
  });

  it('reproduces custom SingleLayer tensors', () => {
    const material = getMaterialPreset('NiFe').values;
    const model = getModel('SingleLayer');
    const na = uniaxialAnisotropyTensor(material, 10e3, Math.PI / 2, 0);
    const paramValues = {
      ...Object.fromEntries(model.params.map((p) => [p.key, p.default])),
      [ND_MODE_KEY]: 'custom',
      [NA_MODE_KEY]: 'custom',
      ...tensorEntries('Nd', thinFilmDemagTensor()),
      ...tensorEntries('Na', na),
    };
    const job = buildJob({
      modelId: 'SingleLayer',
      material,
      paramValues,
      kRange: model.kDefault,
      modes: [0],
      nT: 0,
      quantityIds: ['dispersion'],
    });
    const nb = generateNotebook({
      modelId: 'SingleLayer',
      materialPresetId: 'NiFe',
      material,
      job,
      paramsDisplay: describeParams('SingleLayer', paramValues),
      swtVersion: '1.3.0',
    });
    expect(nb).toContain('Nd=[[0, 0, 0], [0, 0, 0], [0, 0, 1]]');
    expect(nb).toContain('Na=[[');
  });

  it('escapes to valid JSON', () => {
    for (const model of MODEL_LIST) {
      expect(() => JSON.parse(generateNotebook(makeInput(model.id)))).not.toThrow();
    }
  });
});
