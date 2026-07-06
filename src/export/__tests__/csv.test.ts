import { describe, expect, it } from 'vitest';
import { tracesToCsv, resultsToJson } from '../csv';
import type { PlotTrace } from '../../state/store';

function makeTrace(overrides: Partial<PlotTrace> = {}): PlotTrace {
  return {
    id: 't1',
    runId: 1,
    runLabel: 'Run 1 · NiFe',
    quantityId: 'dispersion',
    quantityLabel: 'Dispersion f(k)',
    axisLabel: 'Frequency f (GHz)',
    unit: 'GHz',
    modeLabel: 'n=0',
    x: [0, 1e6, 2e6],
    y: [3.1, 4.2, null],
    visible: true,
    color: '#2563eb',
    dash: 'solid',
    width: 2,
    provenance: {
      model: 'SingleLayer',
      modelLabel: 'Single layer (analytical, Kalinikos–Slavin)',
      materialLabel: 'NiFe (permalloy)',
      materialPresetId: 'NiFe',
      paramsDisplay: { 'External field': '20 mT' },
      job: {} as PlotTrace['provenance']['job'],
      timestamp: '2026-07-06T00:00:00Z',
    },
    ...overrides,
  };
}

describe('tracesToCsv', () => {
  it('writes wide format with provenance for shared k grids', () => {
    const csv = tracesToCsv([makeTrace(), makeTrace({ id: 't2', modeLabel: 'n=1' })], '1.3.0');
    expect(csv).toContain('# SpinWaveToolkit version: 1.3.0');
    expect(csv).toContain('#   External field: 20 mT');
    const header = csv.split('\n').find((l) => l.startsWith('k (rad/m)'))!;
    expect(header.split(',').length).toBe(3);
    expect(csv).toContain('0,3.1,3.1');
    // null (NaN in Python) becomes an empty cell
    expect(csv).toContain('2000000,,');
  });

  it('falls back to long format for differing k grids', () => {
    const csv = tracesToCsv(
      [makeTrace(), makeTrace({ id: 't2', x: [0, 5e6], y: [1, 2] })],
      '1.3.0',
    );
    expect(csv).toContain('run,quantity,mode,k (rad/m),value,unit');
    expect(csv).toContain('Run 1 · NiFe,Dispersion f(k),n=0,0,3.1,GHz');
  });
});

describe('resultsToJson', () => {
  it('groups traces by run with provenance', () => {
    const parsed = JSON.parse(tracesToJsonHelper());
    expect(parsed.generator).toBe('SpinWaveToolkit Web');
    expect(parsed.runs).toHaveLength(1);
    expect(parsed.runs[0].traces).toHaveLength(2);
    expect(parsed.runs[0].provenance.parameters['External field']).toBe('20 mT');
    expect(parsed.scalarResults).toHaveLength(1);
  });
});

function tracesToJsonHelper(): string {
  return resultsToJson(
    [makeTrace(), makeTrace({ id: 't2', modeLabel: 'n=1' })],
    [
      {
        id: 's1',
        runId: 1,
        runLabel: 'Run 1 · NiFe',
        quantityId: 'exchangeLength',
        label: 'Exchange length',
        value: 5.29,
        unit: 'nm',
      },
    ],
    '1.3.0',
  );
}
