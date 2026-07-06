/** Unit conversion helpers shared by the plot, exports, and notebook generator. */

export const TWO_PI = 2 * Math.PI;

/** rad·Hz → GHz */
export const RADHZ_TO_GHZ = 1 / (TWO_PI * 1e9);

export type KUnitId = 'rad/um' | 'rad/m' | 'um' | 'nm';

export interface KUnit {
  id: KUnitId;
  label: string;
  axisLabel: string;
  /** Convert k in SI (rad/m) to this display unit. */
  fromSI: (kSI: number) => number;
}

export const K_UNITS: KUnit[] = [
  {
    id: 'rad/um',
    label: 'k (rad/µm)',
    axisLabel: 'Wavenumber k (rad/µm)',
    fromSI: (k) => k * 1e-6,
  },
  {
    id: 'rad/m',
    label: 'k (rad/m)',
    axisLabel: 'Wavenumber k (rad/m)',
    fromSI: (k) => k,
  },
  {
    id: 'um',
    label: 'λ (µm)',
    axisLabel: 'Wavelength λ (µm)',
    fromSI: (k) => (k > 0 ? (TWO_PI / k) * 1e6 : NaN),
  },
  {
    id: 'nm',
    label: 'λ (nm)',
    axisLabel: 'Wavelength λ (nm)',
    fromSI: (k) => (k > 0 ? (TWO_PI / k) * 1e9 : NaN),
  },
];

export function getKUnit(id: KUnitId): KUnit {
  const u = K_UNITS.find((u) => u.id === id);
  if (!u) throw new Error(`Unknown k unit: ${id}`);
  return u;
}

/**
 * Round to 8 significant digits for form display — removes IEEE noise from
 * unit conversions (e.g. 0.007/0.0001 → 70.00000000000001).
 */
export function roundDisplay(v: number): number {
  return v === 0 ? 0 : Number(v.toPrecision(8));
}

/** Format a number for compact display (results cards, tooltips). */
export function formatValue(v: number | null | undefined, digits = 4): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e4 || a < 1e-3) return v.toExponential(digits - 1);
  return Number(v.toPrecision(digits)).toString();
}
