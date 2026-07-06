/**
 * Declarative description of the SpinWaveToolkit 1.3.0 model classes.
 *
 * Parameter forms, Pyodide job specs, plot labels, and generated notebooks
 * are all derived from these definitions. Keys, defaults, and signatures
 * mirror the package source (core/_class_*.py).
 */
import type { ModelDef, ModelId, ParamDef, QuantityDef } from './types';
import { RADHZ_TO_GHZ } from './units';

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Shared parameter builders
// ---------------------------------------------------------------------------

const bext = (dflt = 50): ParamDef => ({
  key: 'Bext',
  label: 'External field',
  symbol: 'B_\\mathrm{ext}',
  unit: 'mT',
  toSI: 1e-3,
  default: dflt,
  step: 1,
  kind: 'number',
  tooltip: 'Static external magnetic field applied to the sample (mT).',
});

const thickness = (key = 'd', label = 'Film thickness', dflt = 30): ParamDef => ({
  key,
  label,
  symbol: key === 'd2' ? 'd_2' : 'd',
  unit: 'nm',
  toSI: 1e-9,
  default: dflt,
  min: 0.1,
  step: 1,
  kind: 'number',
  tooltip: 'Thickness of the magnetic layer (nm).',
});

const theta = (): ParamDef => ({
  key: 'theta',
  label: 'Magnetization polar angle',
  symbol: '\\theta',
  unit: '°',
  toSI: DEG,
  default: 90,
  min: 0,
  max: 180,
  step: 1,
  kind: 'angle',
  tooltip:
    'Out-of-plane angle θ of the (static) magnetization measured from the film normal. 90° = in-plane.',
});

const phi = (): ParamDef => ({
  key: 'phi',
  label: 'Magnetization azimuthal angle',
  symbol: '\\varphi',
  unit: '°',
  toSI: DEG,
  default: 90,
  min: -180,
  max: 360,
  step: 1,
  kind: 'angle',
  tooltip:
    'In-plane angle φ between the magnetization and the propagation direction (k). 90° = Damon–Eshbach, 0° = backward volume.',
});

const weff = (): ParamDef => ({
  key: 'weff',
  label: 'Effective waveguide width',
  symbol: 'w_\\mathrm{eff}',
  unit: 'µm',
  toSI: 1e-6,
  default: 3,
  min: 0.01,
  step: 0.1,
  kind: 'number',
  advanced: true,
  tooltip:
    'Effective width of the waveguide (µm); quantizes the transverse wavevector for nT > 0.',
});

const boundaryCond = (): ParamDef => ({
  key: 'boundary_cond',
  label: 'Boundary condition',
  unit: '',
  toSI: 1,
  default: 1,
  kind: 'choice',
  choices: [
    { value: 1, label: 'Totally unpinned (1)' },
    { value: 2, label: 'Totally pinned (2)' },
    { value: 3, label: 'Long-wave approximation (3)' },
    { value: 4, label: 'Partially pinned (4)' },
  ],
  tooltip:
    'Boundary condition for the dynamic magnetization at the film surfaces. Partial pinning uses the pinning parameter dp.',
});

const dp = (): ParamDef => ({
  key: 'dp',
  label: 'Pinning parameter',
  symbol: 'd_p',
  unit: 'rad/m',
  toSI: 1,
  default: 0,
  kind: 'number',
  advanced: true,
  tooltip: 'Pinning parameter used with the partially-pinned boundary condition (type 4).',
});

// ---------------------------------------------------------------------------
// Shared quantity builders
// ---------------------------------------------------------------------------

type QOverride = Partial<QuantityDef>;

const qDispersion = (o: QOverride = {}): QuantityDef => ({
  id: 'dispersion',
  method: 'GetDispersion',
  label: 'Dispersion f(k)',
  axisLabel: 'Frequency f (GHz)',
  unit: 'GHz',
  scale: RADHZ_TO_GHZ,
  returns: 'array',
  tooltip: 'Spin-wave frequency as a function of the wavenumber k.',
  nbConvert: ' * 1e-9 / (2 * np.pi)  # rad*Hz -> GHz',
  ...o,
});

const qGroupVelocity = (o: QOverride = {}): QuantityDef => ({
  id: 'groupVelocity',
  method: 'GetGroupVelocity',
  label: 'Group velocity',
  axisLabel: 'Group velocity v_g (km/s)',
  unit: 'km/s',
  scale: 1e-3,
  returns: 'array',
  tooltip: 'Tangential group velocity v_g = dω/dk. Needs at least 2 k points.',
  nbConvert: ' * 1e-3  # m/s -> km/s',
  ...o,
});

const qLifetime = (o: QOverride = {}): QuantityDef => ({
  id: 'lifetime',
  method: 'GetLifetime',
  label: 'Lifetime',
  axisLabel: 'Lifetime τ (ns)',
  unit: 'ns',
  scale: 1e9,
  returns: 'array',
  tooltip: 'Spin-wave lifetime from Gilbert damping and inhomogeneous broadening.',
  nbConvert: ' * 1e9  # s -> ns',
  ...o,
});

const qDecLen = (o: QOverride = {}): QuantityDef => ({
  id: 'decayLength',
  method: 'GetDecLen',
  label: 'Decay length',
  axisLabel: 'Decay length Λ (µm)',
  unit: 'µm',
  scale: 1e6,
  returns: 'array',
  tooltip: 'Propagation decay length Λ = v_g·τ — how far the spin wave travels.',
  nbConvert: ' * 1e6  # m -> um',
  ...o,
});

const qDos = (o: QOverride = {}): QuantityDef => ({
  id: 'densityOfStates',
  method: 'GetDensityOfStates',
  label: 'Density of states',
  axisLabel: 'Density of states (s/m)',
  unit: 's/m',
  scale: 1,
  returns: 'array',
  logY: true,
  tooltip: 'Density of states for the 1D dispersion, computed as 1/v_g.',
  nbConvert: '  # s/m',
  ...o,
});

const qBloch = (o: QOverride = {}): QuantityDef => ({
  id: 'blochFunction',
  method: 'GetBlochFunction',
  label: 'Bloch function (2D map)',
  axisLabel: 'Frequency f (GHz)',
  unit: 'GHz',
  scale: RADHZ_TO_GHZ,
  returns: 'grid',
  tooltip:
    'Two-dimensional Bloch spectral function over frequency and wavenumber (thermal-spectroscopy weight). Rendered as a heatmap; computed for the first selected mode.',
  ...o,
});

const qExchangeLen = (o: QOverride = {}): QuantityDef => ({
  id: 'exchangeLength',
  method: 'GetExchangeLen',
  label: 'Exchange length',
  axisLabel: 'Exchange length (nm)',
  unit: 'nm',
  scale: 1e9,
  returns: 'scalar',
  tooltip: 'Exchange length λ_ex = √(2A_ex/μ₀M_s²).',
  nbConvert: ' * 1e9  # m -> nm',
  ...o,
});

// ---------------------------------------------------------------------------
// Model definitions
// ---------------------------------------------------------------------------

const FILM_K_DEFAULT = { min: 1, max: 25e6, points: 200, spacing: 'linear' as const };

const singleLayer: ModelDef = {
  id: 'SingleLayer',
  label: 'Single layer (analytical, Kalinikos–Slavin)',
  params: [bext(), thickness(), theta(), phi(), boundaryCond(), dp(), weff()],
  quantities: [
    qDispersion({ modeArg: 'n_nT' }),
    qGroupVelocity({ modeArg: 'n_nT' }),
    qLifetime({ modeArg: 'n_nT' }),
    qDecLen({ modeArg: 'n_nT' }),
    qDos({ modeArg: 'n_nT' }),
    {
      id: 'ellipticity',
      method: 'GetEllipticity',
      label: 'Ellipticity',
      axisLabel: 'Ellipticity (–)',
      unit: '–',
      scale: 1,
      returns: 'array',
      tooltip: 'Ellipticity of the magnetization precession ellipse (0 = circular, 1 = linear).',
    },
    qBloch({ modeArg: 'n_nT' }),
    qExchangeLen(),
    {
      id: 'couplingParam',
      method: 'GetCouplingParam',
      label: 'Parallel-pumping coupling V',
      axisLabel: 'V (GHz/T)',
      unit: 'GHz/T',
      scale: RADHZ_TO_GHZ,
      returns: 'scalar',
      tooltip: 'Coupling parameter for parallel pumping experiments.',
    },
    {
      id: 'thresholdField',
      method: 'GetThresholdField',
      label: 'Parallel-pumping threshold field',
      axisLabel: 'b_th (mT)',
      unit: 'mT',
      scale: 1e3,
      returns: 'scalar',
      tooltip: 'Threshold microwave field for the parallel-pumping instability.',
    },
  ],
  kDefault: FILM_K_DEFAULT,
  modes: { max: 4, label: 'Thickness mode n' },
  geometryPresets: ['DE', 'BV', 'FV'],
  info: {
    summary:
      'Analytical dispersion of dipole-exchange spin waves in a single magnetic thin film, after Kalinikos & Slavin (1986).',
    details: [
      'The film of thickness d is magnetized by an external field Bext. The spin-wave frequency is computed from the Kalinikos–Slavin perturbation theory including both dipolar and exchange interactions, for a chosen thickness mode n and transverse waveguide mode nT.',
      'The magnetization geometry is set by the angles θ (out-of-plane) and φ (in-plane, relative to the propagation direction k): Damon–Eshbach (θ=90°, φ=90°), backward volume (θ=90°, φ=0°), and forward volume (θ=0°).',
      'Derived quantities follow from the dispersion: group velocity v_g = dω/dk, lifetime τ from the Gilbert damping, decay length Λ = v_g·τ, and the 1D density of states 1/v_g.',
    ],
    formulas: [
      {
        latex:
          'f_{nn} = \\frac{1}{2\\pi}\\sqrt{\\left(\\omega_0 + \\omega_M \\lambda_{ex}^2 k^2\\right)\\left(\\omega_0 + \\omega_M \\lambda_{ex}^2 k^2 + \\omega_M F_{nn}\\right)}',
        caption: 'Kalinikos–Slavin dispersion with the dipolar matrix element F_nn.',
      },
      {
        latex: '\\tau = \\left(\\alpha\\,\\omega\\,\\frac{\\partial\\omega}{\\partial\\omega_0} + \\gamma \\mu_0 \\Delta H_0 /2 \\right)^{-1}',
        caption: 'Spin-wave lifetime from Gilbert damping and inhomogeneous broadening.',
      },
    ],
    references: [
      {
        label: 'B. A. Kalinikos and A. N. Slavin, J. Phys. C 19, 7013 (1986)',
        url: 'https://doi.org/10.1088/0022-3719/19/35/014',
      },
    ],
  },
};

const singleLayerNumeric: ModelDef = {
  id: 'SingleLayerNumeric',
  label: 'Single layer (numerical, Tacchi et al.)',
  params: [
    bext(),
    thickness(),
    theta(),
    phi(),
    boundaryCond(),
    dp(),
    weff(),
    {
      key: 'KuOOP',
      label: 'Out-of-plane anisotropy',
      symbol: 'K_\\mathrm{u}^\\mathrm{OOP}',
      unit: 'kJ/m³',
      toSI: 1e3,
      default: 0,
      kind: 'number',
      tooltip: 'Strength of the out-of-plane uniaxial anisotropy (kJ/m³).',
    },
    {
      key: 'N',
      label: 'Number of modes',
      symbol: 'N',
      unit: '',
      toSI: 1,
      default: 3,
      min: 1,
      max: 8,
      step: 1,
      kind: 'int',
      tooltip:
        'Number of lowest thickness modes included in the eigenvalue problem (matrix size 2N×2N).',
    },
  ],
  quantities: [
    qDispersion({
      returns: 'tuple_stacked',
      tooltip:
        'Frequencies of the N lowest spin-wave modes from numerical diagonalization of the system matrix.',
    }),
    qGroupVelocity({ modeArg: 'n' }),
    qLifetime({ modeArg: 'n' }),
    qDecLen({ modeArg: 'n' }),
    qDos({ modeArg: 'n' }),
    qBloch({ modeArg: 'n' }),
    qExchangeLen(),
  ],
  kDefault: FILM_K_DEFAULT,
  modes: { max: 3, label: 'Mode index n' },
  geometryPresets: ['DE', 'BV'],
  info: {
    summary:
      'Numerical dispersion of dipole-exchange spin waves in a single film, solving the eigenvalue problem of Tacchi et al. (2019). Handles mode hybridization.',
    details: [
      'Instead of perturbation theory, this model builds a 2N×2N system matrix over N thickness modes and diagonalizes it numerically for every k. Crossings and hybridizations (anticrossings) between thickness modes are therefore captured correctly.',
      'The eigenvalues give the mode frequencies; the eigenvectors give mode profiles. Out-of-plane uniaxial anisotropy KuOOP is included.',
      'Computation is heavier than the analytical model — expect a few seconds for large k grids and large N.',
    ],
    references: [
      {
        label: 'S. Tacchi et al., Phys. Rev. B 100, 104406 (2019)',
        url: 'https://doi.org/10.1103/PhysRevB.100.104406',
      },
    ],
  },
};

const doubleLayerNumeric: ModelDef = {
  id: 'DoubleLayerNumeric',
  label: 'Double layer / SAF (numerical, Gallardo et al.)',
  params: [
    bext(),
    thickness('d', 'Layer 1 thickness', 30),
    thickness('d2', 'Layer 2 thickness', 30),
    theta(),
    phi(),
    {
      key: 's',
      label: 'Interlayer spacer',
      symbol: 's',
      unit: 'nm',
      toSI: 1e-9,
      default: 1,
      min: 0,
      step: 0.1,
      kind: 'number',
      tooltip: 'Thickness of the non-magnetic spacer between the two layers (nm).',
    },
    {
      key: 'Jbl',
      label: 'Bilinear coupling',
      symbol: 'J_\\mathrm{bl}',
      unit: 'mJ/m²',
      toSI: 1e-3,
      default: -0.1,
      step: 0.01,
      kind: 'number',
      tooltip:
        'Bilinear RKKY interlayer exchange coupling (mJ/m²). Negative values favour antiparallel alignment (SAF).',
    },
    {
      key: 'Jbq',
      label: 'Biquadratic coupling',
      symbol: 'J_\\mathrm{bq}',
      unit: 'mJ/m²',
      toSI: 1e-3,
      default: 0,
      step: 0.01,
      kind: 'number',
      tooltip: 'Biquadratic interlayer exchange coupling (mJ/m²); favours 90° alignment.',
    },
    {
      key: 'Ku',
      label: 'Layer 1 uniaxial anisotropy',
      symbol: 'K_\\mathrm{u,1}',
      unit: 'kJ/m³',
      toSI: 1e3,
      default: 0,
      kind: 'number',
      advanced: true,
      tooltip: 'In-plane uniaxial anisotropy of layer 1 (kJ/m³).',
    },
    {
      key: 'Ku2',
      label: 'Layer 2 uniaxial anisotropy',
      symbol: 'K_\\mathrm{u,2}',
      unit: 'kJ/m³',
      toSI: 1e3,
      default: null,
      nullable: true,
      nullLabel: 'same as layer 1',
      nullBehavior: 'omit',
      kind: 'number',
      advanced: true,
      tooltip: 'In-plane uniaxial anisotropy of layer 2 (kJ/m³). Empty = same as layer 1.',
    },
    {
      key: 'phiAnis1',
      label: 'Anisotropy axis angle, layer 1',
      symbol: '\\varphi_\\mathrm{anis,1}',
      unit: '°',
      toSI: DEG,
      default: 90,
      kind: 'angle',
      advanced: true,
      tooltip: 'In-plane angle of the easy axis of layer 1 with respect to k (°).',
    },
    {
      key: 'phiAnis2',
      label: 'Anisotropy axis angle, layer 2',
      symbol: '\\varphi_\\mathrm{anis,2}',
      unit: '°',
      toSI: DEG,
      default: 90,
      kind: 'angle',
      advanced: true,
      tooltip: 'In-plane angle of the easy axis of layer 2 with respect to k (°).',
    },
    {
      key: 'phiInit1',
      label: 'Initial guess φ₁',
      symbol: '\\varphi_\\mathrm{init,1}',
      unit: '°',
      toSI: DEG,
      default: 90,
      kind: 'angle',
      advanced: true,
      tooltip:
        'Initial guess of the equilibrium magnetization angle of layer 1 for the energy minimization (°).',
    },
    {
      key: 'phiInit2',
      label: 'Initial guess φ₂',
      symbol: '\\varphi_\\mathrm{init,2}',
      unit: '°',
      toSI: DEG,
      default: -90,
      kind: 'angle',
      advanced: true,
      tooltip:
        'Initial guess of the equilibrium magnetization angle of layer 2 for the energy minimization (°).',
    },
  ],
  quantities: [
    qDispersion({
      returns: 'tuple_stacked',
      stackedLabels: ['acoustic', 'optic'],
      tooltip:
        'Frequencies of the acoustic (in-phase) and optic (out-of-phase) modes of the coupled bilayer.',
    }),
    {
      id: 'phis',
      method: 'GetPhis',
      label: 'Equilibrium angles φ₁, φ₂',
      axisLabel: 'φ (°)',
      unit: '°',
      scale: 180 / Math.PI,
      returns: 'tuple_scalar',
      scalarLabels: ['φ₁ (layer 1)', 'φ₂ (layer 2)'],
      tooltip:
        'Static equilibrium in-plane magnetization angles of the two layers, from free-energy minimization.',
    },
    qGroupVelocity({ modeArg: 'n', stackedLabels: ['acoustic', 'optic'] }),
    qLifetime({ modeArg: 'n', stackedLabels: ['acoustic', 'optic'] }),
    qDecLen({ modeArg: 'n', stackedLabels: ['acoustic', 'optic'] }),
    qDos({ modeArg: 'n', stackedLabels: ['acoustic', 'optic'] }),
    qBloch({ modeArg: 'n' }),
    qExchangeLen(),
  ],
  kDefault: FILM_K_DEFAULT,
  modes: { max: 2, label: 'Mode (0 = acoustic, 1 = optic)' },
  hasSecondMaterial: true,
  info: {
    summary:
      'Numerical model of two dipolarly- and exchange-coupled magnetic layers (e.g. a synthetic antiferromagnet), after Gallardo et al. (2019).',
    details: [
      'The two layers can differ in material, thickness, and anisotropy, and are coupled through dipolar fields and interlayer (RKKY) exchange with bilinear (Jbl) and biquadratic (Jbq) terms across a spacer of thickness s.',
      'The static equilibrium angles φ₁, φ₂ are found by minimizing the free energy; the dynamic problem is then solved as a 4×4 eigenvalue problem giving the acoustic and optic spin-wave branches.',
      'For antiparallel (SAF) states the model captures the characteristic non-reciprocity of the dispersion.',
    ],
    references: [
      {
        label: 'R. A. Gallardo et al., Phys. Rev. Applied 12, 034012 (2019)',
        url: 'https://doi.org/10.1103/PhysRevApplied.12.034012',
      },
    ],
  },
};

const singleLayerSCcoupled: ModelDef = {
  id: 'SingleLayerSCcoupled',
  label: 'Layer on superconductor (Zhou et al.)',
  params: [
    bext(),
    thickness(),
    {
      key: 'lam',
      label: 'London penetration depth',
      symbol: '\\lambda_\\mathrm{L}',
      unit: 'nm',
      toSI: 1e-9,
      default: 100,
      min: 1,
      step: 10,
      kind: 'number',
      tooltip: 'London penetration depth of the superconductor (nm).',
    },
  ],
  methodParams: [
    {
      key: 'model',
      label: 'Dispersion model',
      unit: '',
      toSI: 1,
      default: 'original',
      kind: 'choice',
      choices: [
        { value: 'original', label: 'Original (Zhou et al.)' },
        { value: 'approx0', label: 'Approximation 0 (finite SC)' },
        { value: 'approx1', label: 'Approximation 1 (finite SC)' },
      ],
      tooltip:
        'Original Zhou et al. model assumes a semi-infinite superconductor; the approximations include finite SC and spacer thicknesses via a modified reflection factor.',
    },
    {
      key: 'd_sc',
      label: 'Superconductor thickness',
      symbol: 'd_\\mathrm{SC}',
      unit: 'nm',
      toSI: 1e-9,
      default: null,
      nullable: true,
      nullLabel: '∞ (semi-infinite)',
      nullBehavior: 'inf',
      kind: 'number',
      tooltip:
        'Thickness of the superconducting layer (nm); leave empty for semi-infinite. Used only by the approximate models.',
    },
    {
      key: 'd_is',
      label: 'Insulating spacer thickness',
      symbol: 'd_\\mathrm{IS}',
      unit: 'nm',
      toSI: 1e-9,
      default: 0,
      min: 0,
      kind: 'number',
      tooltip:
        'Thickness of the insulating spacer between film and superconductor (nm). Used only by the approximate models.',
    },
    {
      key: 'tol',
      label: 'Ellipticity tolerance',
      unit: '',
      toSI: 1,
      default: 1e-5,
      kind: 'number',
      advanced: true,
      tooltip: 'Convergence tolerance of the iterative spin-wave ellipticity solver.',
    },
  ],
  quantities: [
    qDispersion({ kwargNames: ['model', 'tol', 'd_sc', 'd_is'] }),
    qGroupVelocity({ kwargNames: ['model', 'tol', 'd_sc', 'd_is'] }),
    qLifetime({ kwargNames: ['model', 'tol', 'd_sc', 'd_is'] }),
    qDecLen({ kwargNames: ['model', 'tol', 'd_sc', 'd_is'] }),
    qDos({ kwargNames: ['model', 'tol', 'd_sc', 'd_is'] }),
    {
      id: 'ellipticity',
      method: 'GetEllipticityIter',
      label: 'Ellipticity a_ky',
      axisLabel: 'Ellipticity a_ky (–)',
      unit: '–',
      scale: 1,
      returns: 'array',
      kwargNames: ['tol', 'd_sc', 'd_is'],
      tooltip: 'Spin-wave ellipticity obtained iteratively (0 < a_ky ≤ 1).',
    },
    qBloch({ kwargNames: ['model', 'tol', 'd_sc', 'd_is'] }),
  ],
  kDefault: FILM_K_DEFAULT,
  modes: null,
  info: {
    summary:
      'Semi-analytical model of a ferromagnetic film inductively coupled to a superconductor, after Zhou et al. The SC acts as a magnetic mirror, upshifting the Damon–Eshbach dispersion.',
    details: [
      'Meissner screening in the superconductor (London penetration depth λ_L) images the dynamic stray field of the spin wave, stiffening the dispersion in the Damon–Eshbach geometry.',
      'The original model treats a semi-infinite superconductor; the approximate variants account for a finite superconductor thickness d_SC and an insulating spacer d_IS through a modified reflection factor.',
      'The spin-wave ellipticity is solved self-consistently by iteration; its convergence tolerance can be adjusted.',
    ],
    references: [
      {
        label: 'X. Zhou et al. (superconductor–magnon coupling model)',
        url: 'https://ceitecmagnonics.github.io/SpinWaveToolkit/stable/api_reference/classes/SingleLayerSCcoupled.html',
      },
      {
        label: 'M. Mruczkiewicz & M. Krawczyk, J. Appl. Phys. 115, 113909 (2014)',
        url: 'https://doi.org/10.1063/1.4868905',
      },
    ],
  },
};

const bulkPolariton: ModelDef = {
  id: 'BulkPolariton',
  label: 'Bulk magnon-polariton',
  params: [
    bext(100),
    {
      key: 'epsilon',
      label: 'Relative permittivity',
      symbol: '\\varepsilon_\\mathrm{r}',
      unit: '',
      toSI: 1,
      default: 15,
      min: 1,
      step: 0.5,
      kind: 'number',
      tooltip: 'Relative permittivity of the medium hosting the electromagnetic wave.',
    },
    {
      key: 'iota',
      label: 'Propagation angle ι',
      symbol: '\\iota',
      unit: '°',
      toSI: DEG,
      default: 90,
      min: 0,
      max: 90,
      step: 1,
      kind: 'angle',
      tooltip: 'Angle between the wavevector and the static magnetization (°).',
    },
  ],
  quantities: [
    qDispersion({
      returns: 'stacked',
      stackedLabels: ['lower branch', 'upper branch'],
      tooltip: 'Frequencies of the two hybridized magnon-photon (polariton) branches.',
    }),
    qGroupVelocity({
      returns: 'stacked',
      stackedLabels: ['lower branch', 'upper branch'],
      tooltip: 'Group velocities of the two polariton branches. Needs at least 2 k points.',
    }),
  ],
  kDefault: { min: 1e-6, max: 1e3, points: 200, spacing: 'linear' },
  modes: null,
  info: {
    summary:
      'Hybridization of the uniform magnon mode with the electromagnetic wave in a bulk ferromagnet — the magnon-polariton, relevant at very small wavenumbers (k ~ 10³ rad/m).',
    details: [
      'When the photon dispersion ω = ck/√ε crosses the ferromagnetic resonance, the two excitations hybridize and form an anticrossing: the upper and lower polariton branches.',
      'Note the very different k scale from the film models — the crossover happens at wavenumbers around 10²–10³ rad/m (millimetre wavelengths).',
    ],
    references: [
      {
        label: 'SpinWaveToolkit documentation — BulkPolariton',
        url: 'https://ceitecmagnonics.github.io/SpinWaveToolkit/stable/api_reference/classes/BulkPolariton.html',
      },
    ],
  },
};

export const MODELS: Record<ModelId, ModelDef> = {
  SingleLayer: singleLayer,
  SingleLayerNumeric: singleLayerNumeric,
  DoubleLayerNumeric: doubleLayerNumeric,
  SingleLayerSCcoupled: singleLayerSCcoupled,
  BulkPolariton: bulkPolariton,
};

export const MODEL_LIST: ModelDef[] = Object.values(MODELS);

export function getModel(id: ModelId): ModelDef {
  return MODELS[id];
}

/** Geometry presets: values match SingleLayer.set_DE / set_BV / set_FV. */
export const GEOMETRY_PRESETS: Record<'DE' | 'BV' | 'FV', { theta: number; phi: number; label: string; tooltip: string }> = {
  DE: {
    theta: 90,
    phi: 90,
    label: 'Damon–Eshbach',
    tooltip: 'In-plane magnetization perpendicular to k (θ=90°, φ=90°): surface waves.',
  },
  BV: {
    theta: 90,
    phi: 0,
    label: 'Backward volume',
    tooltip: 'In-plane magnetization parallel to k (θ=90°, φ=0°): negative group velocity.',
  },
  FV: {
    theta: 0,
    phi: 90,
    label: 'Forward volume',
    tooltip: 'Out-of-plane magnetization (θ=0°): isotropic in-plane propagation.',
  },
};
