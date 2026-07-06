/**
 * Frontend definition of the MacrospinEquilibrium pseudo-model (static
 * equilibrium of a macrospin — no wavevector dependence). Used on the
 * parameter-sweep page and as the engine of single-layer hysteresis loops.
 */
import type { ParamDef } from './types';

const DEG = Math.PI / 180;

export const MACROSPIN_ID = 'Macrospin' as const;

export const MACROSPIN_LABEL = 'Macrospin equilibrium (static)';

export const MACROSPIN_SUMMARY =
  'Static equilibrium direction of the magnetization in the macrospin approximation: ' +
  'Zeeman + demagnetizing + uniaxial anisotropy energy, minimized numerically. ' +
  'Useful before dispersion calculations and for hysteresis loops.';

export const MACROSPIN_PARAMS: ParamDef[] = [
  {
    key: 'Bext',
    label: 'External field',
    symbol: 'B_\\mathrm{ext}',
    unit: 'mT',
    toSI: 1e-3,
    default: 50,
    step: 1,
    kind: 'number',
    tooltip: 'Magnitude of the external magnetic field (mT). Can be negative.',
  },
  {
    key: 'theta_H',
    label: 'Field polar angle',
    symbol: '\\theta_H',
    unit: '°',
    toSI: DEG,
    default: 90,
    min: 0,
    max: 180,
    step: 1,
    kind: 'angle',
    tooltip: 'Polar angle of the field from the film normal (z). 90° = in-plane.',
  },
  {
    key: 'phi_H',
    label: 'Field azimuthal angle',
    symbol: '\\varphi_H',
    unit: '°',
    toSI: DEG,
    default: 90,
    step: 1,
    kind: 'angle',
    tooltip: 'Azimuthal angle of the field in the film plane (from x).',
  },
  {
    key: 'demag',
    label: 'Demagnetizing tensor',
    unit: '',
    toSI: 1,
    default: 'film',
    kind: 'choice',
    choices: [
      { value: 'film', label: 'Thin film — diag(0, 0, 1)' },
      { value: 'sphere', label: 'Sphere — diag(⅓, ⅓, ⅓)' },
      { value: 'zero', label: 'None (bulk, no shape)' },
    ],
    tooltip: 'Shape demagnetizing tensor in the lab frame (z = film normal).',
  },
  {
    key: 'theta0',
    label: 'Initial guess θ₀',
    unit: '°',
    toSI: DEG,
    default: null,
    nullable: true,
    nullBehavior: 'omit',
    nullLabel: 'along field',
    kind: 'angle',
    advanced: true,
    tooltip:
      'Starting polar angle of the magnetization for the energy minimization. Empty = field direction.',
  },
  {
    key: 'phi0',
    label: 'Initial guess φ₀',
    unit: '°',
    toSI: DEG,
    default: null,
    nullable: true,
    nullBehavior: 'omit',
    nullLabel: 'along field',
    kind: 'angle',
    advanced: true,
    tooltip:
      'Starting azimuthal angle of the magnetization for the energy minimization. Empty = field direction.',
  },
  {
    key: 'ani1_Ku',
    label: 'Anisotropy 1 — Ku',
    symbol: 'K_\\mathrm{u,1}',
    unit: 'kJ/m³',
    toSI: 1e3,
    default: 0,
    step: 1,
    kind: 'number',
    tooltip:
      'First uniaxial anisotropy constant. Positive = easy axis along its direction; 0 disables it.',
  },
  {
    key: 'ani1_theta',
    label: 'Anisotropy 1 — axis θ',
    unit: '°',
    toSI: DEG,
    default: 90,
    step: 1,
    kind: 'angle',
    tooltip: 'Polar angle of the first anisotropy axis.',
  },
  {
    key: 'ani1_phi',
    label: 'Anisotropy 1 — axis φ',
    unit: '°',
    toSI: DEG,
    default: 0,
    step: 1,
    kind: 'angle',
    tooltip: 'Azimuthal angle of the first anisotropy axis.',
  },
  {
    key: 'ani2_Ku',
    label: 'Anisotropy 2 — Ku',
    symbol: 'K_\\mathrm{u,2}',
    unit: 'kJ/m³',
    toSI: 1e3,
    default: 0,
    step: 1,
    kind: 'number',
    advanced: true,
    tooltip: 'Second uniaxial anisotropy constant (0 disables it).',
  },
  {
    key: 'ani2_theta',
    label: 'Anisotropy 2 — axis θ',
    unit: '°',
    toSI: DEG,
    default: 0,
    step: 1,
    kind: 'angle',
    advanced: true,
    tooltip: 'Polar angle of the second anisotropy axis (0 = out of plane, e.g. PMA).',
  },
  {
    key: 'ani2_phi',
    label: 'Anisotropy 2 — axis φ',
    unit: '°',
    toSI: DEG,
    default: 0,
    step: 1,
    kind: 'angle',
    advanced: true,
    tooltip: 'Azimuthal angle of the second anisotropy axis.',
  },
];

/** Parameters that make sense to sweep in the macrospin model. */
export const MACROSPIN_SWEEPABLE = ['Bext', 'theta_H', 'phi_H', 'ani1_Ku', 'ani2_Ku'];

export interface MacrospinQuantityDef {
  id: string;
  label: string;
  axisLabel: string;
  unit: string;
  /** display = SI × scale */
  scale: number;
}

export const MACROSPIN_QUANTITIES: MacrospinQuantityDef[] = [
  {
    id: 'projection',
    label: 'Projection M·B̂ / Ms',
    axisLabel: 'M·B̂ / Ms (–)',
    unit: '–',
    scale: 1,
  },
  { id: 'thetaM', label: 'Equilibrium θ_M', axisLabel: 'θ_M (°)', unit: '°', scale: 180 / Math.PI },
  { id: 'phiM', label: 'Equilibrium φ_M', axisLabel: 'φ_M (°)', unit: '°', scale: 180 / Math.PI },
  {
    id: 'edenZeeman',
    label: 'Zeeman energy density',
    axisLabel: 'E (kJ/m³)',
    unit: 'kJ/m³',
    scale: 1e-3,
  },
  {
    id: 'edenDemag',
    label: 'Demag energy density',
    axisLabel: 'E (kJ/m³)',
    unit: 'kJ/m³',
    scale: 1e-3,
  },
  {
    id: 'edenAnis',
    label: 'Anisotropy energy density',
    axisLabel: 'E (kJ/m³)',
    unit: 'kJ/m³',
    scale: 1e-3,
  },
];
