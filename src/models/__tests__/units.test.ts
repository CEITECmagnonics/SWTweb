import { describe, expect, it } from 'vitest';
import { formatValue, getKUnit, K_UNITS, RADHZ_TO_GHZ } from '../units';

describe('unit conversions', () => {
  it('converts rad·Hz to GHz', () => {
    expect(2 * Math.PI * 5e9 * RADHZ_TO_GHZ).toBeCloseTo(5);
  });

  it('converts k between display units', () => {
    expect(getKUnit('rad/um').fromSI(5e6)).toBeCloseTo(5);
    expect(getKUnit('rad/m').fromSI(5e6)).toBeCloseTo(5e6);
    expect(getKUnit('um').fromSI(2 * Math.PI * 1e6)).toBeCloseTo(1); // k=2π rad/µm → λ=1 µm
    expect(getKUnit('nm').fromSI(2 * Math.PI * 1e9)).toBeCloseTo(1);
    expect(Number.isNaN(getKUnit('nm').fromSI(0))).toBe(true);
  });

  it('has unique unit ids', () => {
    expect(new Set(K_UNITS.map((u) => u.id)).size).toBe(K_UNITS.length);
  });
});

describe('formatValue', () => {
  it('formats typical scientific values', () => {
    expect(formatValue(null)).toBe('—');
    expect(formatValue(0)).toBe('0');
    expect(formatValue(5.2934)).toBe('5.293');
    expect(formatValue(5.29e-9)).toBe('5.290e-9');
    expect(formatValue(123456)).toBe('1.235e+5');
  });
});
