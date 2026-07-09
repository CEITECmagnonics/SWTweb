import { describe, expect, it } from 'vitest';
import { getMaterialPreset } from '../../models/materials';
import { ND_MODE_KEY, tensorKey } from '../../models/tensors';
import { useStore } from '../../state/store';
import {
  buildShareUrl,
  createShareEnvelope,
  decodeShare,
  encodeShare,
  hydrateShareState,
  parseShareFromHash,
  stripSharePayloadFromHash,
  type ShareEnvelope,
} from '../urlState';

function baseState() {
  return useStore.getState();
}

describe('share URL state', () => {
  it('round-trips a dispersion page share with custom values', () => {
    const base = baseState();
    const state = {
      ...base,
      page: 'dispersion' as const,
      modelId: 'SingleLayer' as const,
      materialPresetId: 'custom',
      material: { ...getMaterialPreset('NiFe').values, Ms: 777e3 },
      paramValues: {
        ...base.paramValues,
        SingleLayer: {
          ...base.paramValues.SingleLayer,
          Bext: 123,
          [ND_MODE_KEY]: 'custom',
          [tensorKey('Nd', 'xx')]: 0.25,
        },
      },
      kRanges: {
        ...base.kRanges,
        SingleLayer: { min: 2, max: 42e6, points: 321, spacing: 'log' as const },
      },
      modes: { ...base.modes, SingleLayer: [0, 2] },
      selectedQuantities: { ...base.selectedQuantities, SingleLayer: ['dispersion', 'lifetime'] },
      plotSettings: { ...base.plotSettings, title: 'Shared dispersion', xUnit: 'rad/m' as const },
    };

    const decoded = decodeShare(encodeShare(createShareEnvelope(state, 'page')));
    expect(decoded?.scope).toBe('page');

    const patch = hydrateShareState(base, decoded!);
    expect(patch?.page).toBe('dispersion');
    expect(patch?.modelId).toBe('SingleLayer');
    expect(patch?.material?.Ms).toBe(777e3);
    expect(patch?.paramValues?.SingleLayer.Bext).toBe(123);
    expect(patch?.paramValues?.SingleLayer[ND_MODE_KEY]).toBe('custom');
    expect(patch?.paramValues?.SingleLayer[tensorKey('Nd', 'xx')]).toBe(0.25);
    expect(patch?.kRanges?.SingleLayer).toEqual({ min: 2, max: 42e6, points: 321, spacing: 'log' });
    expect(patch?.modes?.SingleLayer).toEqual([0, 2]);
    expect(patch?.selectedQuantities?.SingleLayer).toEqual(['dispersion', 'lifetime']);
    expect(patch?.plotSettings?.title).toBe('Shared dispersion');
    expect(patch?.traces).toEqual([]);
    expect(patch?.activeQuantity).toBeNull();
  });

  it('round-trips app scope and keeps non-active page configuration', () => {
    const base = baseState();
    const state = {
      ...base,
      page: 'sweep' as const,
      modelId: 'BulkPolariton' as const,
      paramValues: {
        ...base.paramValues,
        BulkPolariton: { ...base.paramValues.BulkPolariton, epsilon: 18 },
      },
      sweep: {
        ...base.sweep,
        modelId: 'Macrospin' as const,
        key: 'theta_H',
        from: 5,
        to: 175,
        points: 17,
        quantityId: 'thetaM',
      },
      macrospinValues: { ...base.macrospinValues, theta_H: 35 },
      bls: {
        ...base.bls,
        values: { ...base.bls.values, method: 'RT' },
        sweepEnabled: true,
        sweepKey: 'NA',
        sweepFrom: 0.2,
        sweepTo: 0.9,
        sweepPoints: 5,
      },
    };

    const decoded = decodeShare(encodeShare(createShareEnvelope(state, 'app')));
    const patch = hydrateShareState(base, decoded!);

    expect(patch?.page).toBe('sweep');
    expect(patch?.modelId).toBe('BulkPolariton');
    expect(patch?.paramValues?.BulkPolariton.epsilon).toBe(18);
    expect(patch?.sweep?.modelId).toBe('Macrospin');
    expect(patch?.sweep?.key).toBe('theta_H');
    expect(patch?.macrospinValues?.theta_H).toBe(35);
    expect(patch?.bls?.sweepEnabled).toBe(true);
    expect(patch?.bls?.sweepKey).toBe('NA');
    // string choice values survive the share cleaner
    expect(patch?.bls?.values.method).toBe('RT');
  });

  it('loads a µBLS page share, dropping a stray Ku and resetting traces', () => {
    const base = baseState();
    const envelope = {
      v: 1,
      scope: 'page',
      page: 'bls',
      data: {
        page: 'bls',
        common: {
          materialPresetId: 'NiFe',
          material: getMaterialPreset('NiFe').values,
          materialPresetId2: 'NiFe',
          material2: getMaterialPreset('NiFe').values,
        },
        bls: {
          mode: 'thermal',
          // Ku is no longer a µBLS parameter; an old link may still carry it.
          values: { ...base.bls.values, Bext: 75, mu: -500, Ku: 999 },
          sweepEnabled: false,
          sweepKey: 'Bext',
          sweepFrom: 10,
          sweepTo: 250,
          sweepPoints: 9,
        },
      },
    } as unknown as ShareEnvelope;

    const patch = hydrateShareState(base, envelope);
    expect(patch?.page).toBe('bls');
    expect(patch?.bls?.values.Bext).toBe(75);
    // The chemical potential survives; the stray Ku is silently ignored.
    expect(patch?.bls?.values.mu).toBe(-500);
    expect('Ku' in (patch?.bls?.values ?? {})).toBe(false);
    // Computed traces are never shared.
    expect(patch?.bls?.traces).toEqual([]);
  });

  it('builds, parses, and strips hash-local share URLs', () => {
    const url = buildShareUrl(baseState(), 'page', 'https://example.test/SWTweb/#/bls');
    const parsed = new URL(url);

    expect(parsed.origin).toBe('https://example.test');
    expect(parsed.pathname).toBe('/SWTweb/');
    expect(parsed.hash).toMatch(/^#\/\?s=/);
    expect(parseShareFromHash(parsed.hash)?.scope).toBe('page');
    expect(stripSharePayloadFromHash(parsed.hash)).toBe('#/');
  });

  it('rejects malformed payloads and clamps hostile values', () => {
    expect(decodeShare('not-lz-data')).toBeNull();

    const hostile = {
      v: 1,
      scope: 'page',
      page: 'dispersion',
      data: {
        page: 'dispersion',
        common: {
          materialPresetId: 'NiFe',
          material: { Ms: -1, Aex: Number.POSITIVE_INFINITY, alpha: 'bad', gamma: 0, mu0dH0: 1, Ku: 2 },
          materialPresetId2: 'missing',
          material2: {},
        },
        dispersion: {
          modelId: 'SingleLayer',
          paramValues: {
            SingleLayer: {
              Bext: 'nope',
              theta: 999,
              boundary_cond: '2',
              unknown: 1,
            },
          },
          kRanges: { SingleLayer: { min: 9, max: 1, points: 99_999, spacing: 'banana' } },
          modes: { SingleLayer: [-1, 999, 2] },
          nT: 99_999,
          selectedQuantities: { SingleLayer: ['dispersion', 'bogus'] },
          plotSettings: { title: 'x'.repeat(200), xUnit: 'bad', fontSize: 100 },
        },
      },
    } as unknown as ShareEnvelope;

    const base = baseState();
    const patch = hydrateShareState(base, hostile);

    expect(patch?.material?.Ms).toBe(0);
    expect(patch?.material?.Aex).toBe(getMaterialPreset('NiFe').values.Aex);
    expect(patch?.materialPresetId2).toBe('custom');
    expect(patch?.paramValues?.SingleLayer.Bext).toBe(base.paramValues.SingleLayer.Bext);
    expect(patch?.paramValues?.SingleLayer.theta).toBe(180);
    expect(patch?.paramValues?.SingleLayer.boundary_cond).toBe(2);
    expect(patch?.kRanges?.SingleLayer.points).toBe(5000);
    expect(patch?.modes?.SingleLayer).toEqual([0, 2, 4]);
    expect(patch?.nT).toBe(50);
    expect(patch?.selectedQuantities?.SingleLayer).toEqual(['dispersion']);
    expect(patch?.plotSettings?.title).toHaveLength(140);
    expect(patch?.plotSettings?.fontSize).toBe(28);
  });
});
