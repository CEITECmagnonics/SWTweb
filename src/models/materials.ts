import type { MaterialValues } from './types';

export interface MaterialPreset {
  id: string;
  label: string;
  /** Name of the predefined SWT constant (used in the generated notebook), or null for custom. */
  swtName: string | null;
  values: MaterialValues;
}

const GHZ_PER_T = 2 * Math.PI * 1e9; // gamma display: GHz/T → rad·Hz/T

/**
 * Values mirror the predefined materials in SpinWaveToolkit 1.3.0
 * (SpinWaveToolkit/core/_class_Material.py).
 */
export const MATERIAL_PRESETS: MaterialPreset[] = [
  {
    id: 'NiFe',
    label: 'NiFe (permalloy)',
    swtName: 'NiFe',
    values: {
      Ms: 800e3,
      Aex: 16e-12,
      alpha: 70e-4,
      gamma: 28.8 * GHZ_PER_T,
      mu0dH0: 0,
      Ku: 0,
    },
  },
  {
    id: 'CoFeB',
    label: 'CoFeB',
    swtName: 'CoFeB',
    values: {
      Ms: 1250e3,
      Aex: 15e-12,
      alpha: 40e-4,
      gamma: 30 * GHZ_PER_T,
      mu0dH0: 0,
      Ku: 0,
    },
  },
  {
    id: 'FeNi',
    label: 'FeNi (metastable iron)',
    swtName: 'FeNi',
    values: {
      Ms: 1410e3,
      Aex: 11e-12,
      alpha: 80e-4,
      gamma: 28.1 * GHZ_PER_T,
      mu0dH0: 0,
      Ku: 0,
    },
  },
  {
    id: 'YIG',
    label: 'YIG',
    swtName: 'YIG',
    values: {
      Ms: 140e3,
      Aex: 3.6e-12,
      alpha: 1.5e-4,
      gamma: 28 * GHZ_PER_T,
      mu0dH0: 0.18e-3,
      Ku: 0,
    },
  },
  {
    id: 'custom',
    label: 'Custom material…',
    swtName: null,
    values: {
      Ms: 800e3,
      Aex: 16e-12,
      alpha: 70e-4,
      gamma: 28.1 * GHZ_PER_T,
      mu0dH0: 0,
      Ku: 0,
    },
  },
];

/** Field definitions for the material editor form (display units ↔ SI). */
export interface MaterialFieldDef {
  key: keyof MaterialValues;
  label: string;
  symbol: string;
  unit: string;
  toSI: number;
  step?: number;
  tooltip: string;
}

export const MATERIAL_FIELDS: MaterialFieldDef[] = [
  {
    key: 'Ms',
    label: 'Saturation magnetization',
    symbol: 'M_\\mathrm{s}',
    unit: 'kA/m',
    toSI: 1e3,
    tooltip: 'Saturation magnetization of the material (kA/m).',
  },
  {
    key: 'Aex',
    label: 'Exchange stiffness',
    symbol: 'A_\\mathrm{ex}',
    unit: 'pJ/m',
    toSI: 1e-12,
    tooltip: 'Exchange stiffness constant (pJ/m).',
  },
  {
    key: 'alpha',
    label: 'Gilbert damping',
    symbol: '\\alpha',
    unit: '×10⁻⁴',
    toSI: 1e-4,
    tooltip: 'Dimensionless Gilbert damping parameter (entered in units of 10⁻⁴).',
  },
  {
    key: 'gamma',
    label: 'Gyromagnetic ratio',
    symbol: '\\gamma/2\\pi',
    unit: 'GHz/T',
    toSI: GHZ_PER_T,
    tooltip: 'Gyromagnetic ratio γ/2π (GHz/T).',
  },
  {
    key: 'mu0dH0',
    label: 'Inhomogeneous broadening',
    symbol: '\\mu_0 \\Delta H_0',
    unit: 'mT',
    toSI: 1e-3,
    tooltip: 'Inhomogeneous line broadening μ₀ΔH₀ (mT); contributes to the linewidth.',
  },
  {
    key: 'Ku',
    label: 'Surface anisotropy',
    symbol: 'K_\\mathrm{u}',
    unit: 'mJ/m²',
    toSI: 1e-3,
    tooltip:
      'Surface anisotropy strength (mJ/m²). Note: unused by SWT 1.3.0 dispersion calculations — set the pinning parameter dp directly (boundary condition 4) instead.',
  },
];

export function getMaterialPreset(id: string): MaterialPreset {
  const m = MATERIAL_PRESETS.find((m) => m.id === id);
  if (!m) throw new Error(`Unknown material preset: ${id}`);
  return m;
}
