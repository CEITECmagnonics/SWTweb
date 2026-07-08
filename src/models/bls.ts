/**
 * Frontend definition of the µBLS (micro-focused Brillouin light scattering)
 * calculations backed by the SpinWaveToolkit.bls submodule.
 *
 * Model: J. Wojewoda, M. Hrtoň, M. Urbánek, Phys. Rev. B 110, 224428 (2024).
 */
import type { ParamDef } from './types';

export type BlsMode = 'thermal';

/** Spin-wave / sample parameters (bridge `config`, SI after conversion). */
export const BLS_SW_PARAMS: ParamDef[] = [
  {
    key: 'Bext',
    label: 'External field',
    symbol: 'B_\\mathrm{ext}',
    unit: 'mT',
    toSI: 1e-3,
    default: 50,
    step: 1,
    kind: 'number',
    tooltip: 'Static external magnetic field applied in the film plane (mT).',
  },
  {
    key: 'd',
    label: 'Magnetic layer thickness',
    symbol: 'd',
    unit: 'nm',
    toSI: 1e-9,
    default: 30,
    min: 1,
    step: 1,
    kind: 'number',
    tooltip: 'Thickness of the magnetic layer (nm).',
  },
  {
    key: 'temp',
    label: 'Temperature',
    symbol: 'T',
    unit: 'K',
    toSI: 1,
    default: 300,
    min: 1,
    kind: 'number',
    advanced: true,
    tooltip: 'Temperature of the Bose–Einstein magnon distribution (thermal spectra).',
  },
  {
    key: 'nModes',
    label: 'Thickness modes',
    symbol: 'N',
    unit: '',
    toSI: 1,
    default: 2,
    min: 1,
    max: 4,
    step: 1,
    kind: 'int',
    tooltip:
      'Number of thickness modes (n = 0 … N−1) included in the thermal Bloch function. Note: relative PSSW amplitudes may differ from experiment (see the SWT example notes).',
  },
  {
    key: 'kMax',
    label: 'Bloch grid k max',
    unit: 'rad/µm',
    toSI: 1e6,
    default: 15,
    min: 1,
    kind: 'number',
    advanced: true,
    tooltip: 'Half-width of the (kx, ky) grid used for the thermal Bloch function.',
  },
];

/** Optics parameters (bridge `optics`). */
export const BLS_OPTICS_PARAMS: ParamDef[] = [
  {
    key: 'NA',
    label: 'Numerical aperture',
    symbol: '\\mathrm{NA}',
    unit: '',
    toSI: 1,
    default: 0.75,
    min: 0.05,
    max: 1.3,
    step: 0.05,
    kind: 'number',
    tooltip:
      'Numerical aperture of the objective lens — sets both the focal spot size and the range of collectable wavevectors.',
  },
  {
    key: 'wavelength',
    label: 'Laser wavelength',
    symbol: '\\lambda',
    unit: 'nm',
    toSI: 1e-9,
    default: 532,
    min: 200,
    kind: 'number',
    tooltip: 'Vacuum wavelength of the probing laser (nm).',
  },
  {
    key: 'f0',
    label: 'Filling factor',
    symbol: 'f_0',
    unit: '',
    toSI: 1,
    default: 10,
    min: 0.1,
    kind: 'number',
    advanced: true,
    tooltip:
      'Filling factor of the objective back aperture (beam waist / pupil radius). Large values = fully filled pupil.',
  },
  {
    key: 'focalN',
    label: 'Focal field points',
    unit: '',
    toSI: 1,
    default: 201,
    min: 51,
    max: 801,
    step: 2,
    kind: 'int',
    advanced: true,
    tooltip: 'Real-space sampling of the focal field (Richards–Wolf integral).',
  },
  {
    key: 'rhoMax',
    label: 'Focal field extent',
    unit: 'µm',
    toSI: 1e-6,
    default: 10,
    min: 1,
    kind: 'number',
    advanced: true,
    tooltip: 'Real-space half-width of the computed focal field (µm).',
  },
  {
    key: 'analyzer',
    label: 'Output analyzer',
    unit: '',
    toSI: 1,
    default: 'none',
    kind: 'choice',
    choices: [
      { value: 'none', label: 'none (detect both polarizations)' },
      { value: 'linear', label: 'linear (at analyzer angle)' },
      { value: 'circular_r', label: 'circular, right' },
      { value: 'circular_l', label: 'circular, left' },
      { value: 'radial', label: 'radial' },
      { value: 'azimuthal', label: 'azimuthal' },
    ],
    tooltip:
      'Polarization analyzer in front of the detector. Typical µBLS uses a crossed linear analyzer (90°) to suppress elastically scattered light.',
  },
  {
    key: 'analyzerAngle',
    label: 'Analyzer angle',
    unit: '°',
    toSI: 1,
    default: 90,
    kind: 'angle',
    tooltip:
      'Angle of the linear analyzer, counter-clockwise from the incident x polarization (90° = crossed). Ignored for the other analyzer types.',
  },
  {
    key: 'collectionSpot',
    label: 'Collection spot',
    unit: 'µm',
    toSI: 1e-6,
    default: 1,
    min: 0.05,
    kind: 'number',
    advanced: true,
    tooltip: 'Detection beam waist on the sample (µm) — the real-space collection filter.',
  },
];

/** Optical layer stack: superstrate (air) / [cover] / magnet / substrate. */
export const BLS_STACK_PARAMS: ParamDef[] = [
  {
    key: 'epsMagRe',
    label: 'Magnet ε′',
    unit: '',
    toSI: 1,
    default: -8.1653,
    kind: 'number',
    tooltip: 'Real part of the magnetic layer permittivity at the laser wavelength (NiFe @ 532 nm: −8.1653).',
  },
  {
    key: 'epsMagIm',
    label: 'Magnet ε″',
    unit: '',
    toSI: 1,
    default: 15.348,
    kind: 'number',
    tooltip: 'Imaginary part of the magnetic layer permittivity (NiFe @ 532 nm: 15.348).',
  },
  {
    key: 'epsSubRe',
    label: 'Substrate ε′',
    unit: '',
    toSI: 1,
    default: 17.237,
    kind: 'number',
    tooltip: 'Real part of the substrate permittivity (Si @ 532 nm: 17.237).',
  },
  {
    key: 'epsSubIm',
    label: 'Substrate ε″',
    unit: '',
    toSI: 1,
    default: 0.43004,
    kind: 'number',
    tooltip: 'Imaginary part of the substrate permittivity (Si @ 532 nm: 0.43).',
  },
  {
    key: 'coverEnabled',
    label: 'Cover layer',
    unit: '',
    toSI: 1,
    default: 0,
    kind: 'choice',
    choices: [
      { value: 0, label: 'none' },
      { value: 1, label: 'enabled (between air and magnet)' },
    ],
    tooltip:
      'Optional dielectric cover layer (e.g. SiO₂ anti-reflection coating or Pt capping) on top of the magnetic layer.',
  },
  {
    key: 'dCover',
    label: 'Cover thickness',
    unit: 'nm',
    toSI: 1e-9,
    default: 100,
    min: 0.1,
    kind: 'number',
    tooltip: 'Thickness of the cover layer (nm).',
  },
  {
    key: 'epsCoverRe',
    label: 'Cover ε′',
    unit: '',
    toSI: 1,
    default: 2.1316,
    kind: 'number',
    tooltip: 'Real part of the cover layer permittivity (SiO₂: 2.13).',
  },
  {
    key: 'epsCoverIm',
    label: 'Cover ε″',
    unit: '',
    toSI: 1,
    default: 0,
    kind: 'number',
    tooltip: 'Imaginary part of the cover layer permittivity.',
  },
];

/** Thermal-spectrum frequency window + accuracy. */
export const BLS_THERMAL_PARAMS: ParamDef[] = [
  {
    key: 'fAuto',
    label: 'Frequency window',
    unit: '',
    toSI: 1,
    default: 1,
    kind: 'choice',
    choices: [
      { value: 1, label: 'automatic (detectable modes)' },
      { value: 0, label: 'manual' },
    ],
    tooltip:
      'Automatic: covers all included thickness modes over the detectable k range (≈1.5·k₀·NA).',
  },
  {
    key: 'fMin',
    label: 'f min',
    unit: 'GHz',
    toSI: 1e9,
    default: 2,
    min: 0.1,
    kind: 'number',
    tooltip: 'Lower edge of the manual frequency window (GHz).',
  },
  {
    key: 'fMax',
    label: 'f max',
    unit: 'GHz',
    toSI: 1e9,
    default: 20,
    min: 0.2,
    kind: 'number',
    tooltip: 'Upper edge of the manual frequency window (GHz).',
  },
  {
    key: 'nF',
    label: 'Frequency points',
    unit: '',
    toSI: 1,
    default: 61,
    min: 11,
    max: 301,
    step: 2,
    kind: 'int',
    advanced: true,
    tooltip: 'Number of frequency bins of the spectrum. More = smoother but slower (cost ∝ N).',
  },
  {
    key: 'nK',
    label: 'Bloch grid points',
    unit: '',
    toSI: 1,
    default: 48,
    min: 16,
    max: 128,
    step: 2,
    kind: 'int',
    advanced: true,
    tooltip: 'Resolution of the (kx, ky) Bloch grid per axis.',
  },
  {
    key: 'nQ',
    label: 'q-space points',
    unit: '',
    toSI: 1,
    default: 28,
    min: 12,
    max: 60,
    step: 2,
    kind: 'int',
    advanced: true,
    tooltip:
      'Half-resolution of the polarization q-grid. Dominates the runtime (cost ∝ Nq⁴); raise for convergence checks.',
  },
];

/** Parameters sweepable in the thermal mode. */
export const BLS_SWEEPABLE_KEYS = ['Bext', 'd', 'NA', 'wavelength', 'dCover', 'temp'];

export function blsSweepableParams(): ParamDef[] {
  const all = [...BLS_SW_PARAMS, ...BLS_OPTICS_PARAMS, ...BLS_STACK_PARAMS];
  return BLS_SWEEPABLE_KEYS.map((k) => all.find((p) => p.key === k)!).filter(Boolean);
}

export const BLS_ALL_PARAMS: ParamDef[] = [
  ...BLS_SW_PARAMS,
  ...BLS_OPTICS_PARAMS,
  ...BLS_STACK_PARAMS,
  ...BLS_THERMAL_PARAMS,
];

export const BLS_INFO = {
  summary:
    'Semi-analytical model of micro-focused Brillouin light scattering: focal field of the objective (Richards–Wolf), thermal magnon Bloch function (Kalinikos–Slavin + Bose–Einstein), magneto-optical polarization, and Green-function propagation to the detector.',
  reference: {
    label: 'O. Wojewoda, M. Hrtoň, and M. Urbánek, Phys. Rev. B 110, 224428 (2024)',
    url: 'https://doi.org/10.1103/PhysRevB.110.224428',
  },
};
