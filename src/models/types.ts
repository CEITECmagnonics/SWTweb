/**
 * Core type definitions for the SWT model registry.
 *
 * The registry is the single source of truth describing the SpinWaveToolkit
 * API to the rest of the app: parameter forms, the Pyodide job spec, plot
 * axis labels, and the generated Jupyter notebooks are all derived from it.
 */

export type ModelId =
  | 'SingleLayer'
  | 'SingleLayerNumeric'
  | 'DoubleLayerNumeric'
  | 'SingleLayerSCcoupled'
  | 'BulkPolariton';

export type ParamKind = 'number' | 'int' | 'angle' | 'choice';

export type Matrix3 = [[number, number, number], [number, number, number], [number, number, number]];

export interface ParamChoice {
  value: number | string;
  label: string;
}

export interface ParamDef {
  /** Python keyword-argument name. */
  key: string;
  label: string;
  /** KaTeX source for the symbol, e.g. 'B_\\mathrm{ext}'. */
  symbol?: string;
  /** Display unit shown in the form, e.g. 'mT'. */
  unit: string;
  /** Multiply the display value by this factor to obtain the SI value passed to Python. */
  toSI: number;
  /** Default value in display units (null = leave unset / library default). */
  default: number | string | null;
  min?: number;
  max?: number;
  step?: number;
  kind: ParamKind;
  choices?: ParamChoice[];
  tooltip: string;
  /** Hidden behind the "Advanced" toggle. */
  advanced?: boolean;
  /** If true, the field may be left empty (null). */
  nullable?: boolean;
  /** For nullable params: placeholder text describing the null meaning, e.g. '∞'. */
  nullLabel?: string;
  /** What an empty nullable field means: omit the kwarg (library default) or pass infinity. */
  nullBehavior?: 'omit' | 'inf';
}

/**
 * How the Python method's return value must be interpreted by the bridge.
 *  - array:         1D ndarray over kxi (one trace, possibly per mode)
 *  - stacked:       2D ndarray (modes, k) → one trace per row
 *  - tuple_stacked: tuple whose first element is a stacked 2D ndarray
 *  - grid:          tuple (freq_axis, 2D array (Nf, k)) → heatmap
 *  - scalar:        single float
 *  - tuple_scalar:  sequence of floats → several labelled scalar results
 */
export type QuantityReturns =
  | 'array'
  | 'stacked'
  | 'tuple_stacked'
  | 'grid'
  | 'scalar'
  | 'tuple_scalar';

export interface QuantityDef {
  id: string;
  /** Python method name on the model instance. */
  method: string;
  label: string;
  /** Full axis label including the display unit, e.g. 'Frequency f (GHz)'. */
  axisLabel: string;
  unit: string;
  /** display value = SI value × scale */
  scale: number;
  returns: QuantityReturns;
  /** Which mode argument(s) the method takes, if any. */
  modeArg?: 'n' | 'n_nT';
  /** Names of per-method kwargs (from the model's methodParams) to forward. */
  kwargNames?: string[];
  /** Labels for tuple_scalar results (same order as returned values). */
  scalarLabels?: string[];
  /** Labels for stacked rows, e.g. ['acoustic', 'optic']. Falls back to 'mode i'. */
  stackedLabels?: string[];
  /** Suggest a logarithmic y axis for this quantity. */
  logY?: boolean;
  tooltip: string;
  /** Python snippet hint for the notebook: unit conversion, e.g. '*1e-9/(2*np.pi)  # GHz'. */
  nbConvert?: string;
}

export interface KRange {
  /** SI, rad/m */
  min: number;
  /** SI, rad/m */
  max: number;
  points: number;
  spacing: 'linear' | 'log';
}

export interface ModelInfo {
  /** Short human description shown under the model selector. */
  summary: string;
  /** Longer explanation paragraphs (plain text, no markdown). */
  details: string[];
  /** KaTeX display formulas central to the model. */
  formulas?: { latex: string; caption: string }[];
  /** Reference(s) implementing the model. */
  references: { label: string; url: string }[];
}

export interface ModelDef {
  id: ModelId;
  label: string;
  params: ParamDef[];
  /** Extra kwargs passed to Get* methods rather than the constructor (SC-coupled model). */
  methodParams?: ParamDef[];
  quantities: QuantityDef[];
  kDefault: KRange;
  /** Per-mode computation config; null when the model has no mode selection. */
  modes: { max: number; label: string } | null;
  hasSecondMaterial?: boolean;
  /** Show Damon-Eshbach / backward-volume / forward-volume preset buttons. */
  geometryPresets?: ('DE' | 'BV' | 'FV')[];
  info: ModelInfo;
}

export interface MaterialValues {
  /** A/m */
  Ms: number;
  /** J/m */
  Aex: number;
  /** dimensionless */
  alpha: number;
  /** rad·Hz/T */
  gamma: number;
  /** T */
  mu0dH0: number;
  /** J/m² (surface anisotropy) */
  Ku: number;
}

/** Job spec sent to the Pyodide worker (all values SI). */
export interface ComputeJob {
  model: ModelId;
  material: MaterialValues;
  material2?: MaterialValues;
  params: Record<string, number | string | Matrix3>;
  methodKwargs?: Record<string, number | string | Matrix3>;
  kRange: KRange;
  modes: number[];
  nT: number;
  quantities: Array<{
    id: string;
    method: string;
    returns: QuantityReturns;
    modeArg?: 'n' | 'n_nT';
    kwargNames?: string[];
  }>;
}

export type SweepModelId = ModelId | 'Macrospin';

/** Job spec for run_sweep (all values SI). */
export interface SweepJob {
  model: SweepModelId;
  /** SWT models */
  material?: MaterialValues;
  material2?: MaterialValues;
  params?: Record<string, number | string | Matrix3>;
  methodKwargs?: Record<string, number | string | Matrix3>;
  quantities?: ComputeJob['quantities'];
  modes?: number[];
  nT?: number;
  /** Macrospin config (SI) */
  config?: Record<string, number | string>;
  sweep: { key: string; values: number[] };
  mode: 'fixedK' | 'map';
  /** SI rad/m, fixed-k mode */
  kFixed?: number;
  /** map mode */
  kRange?: KRange;
  /** DoubleLayerNumeric: warm-start phiInit from the previous sweep step */
  relax?: boolean;
}

/** run_sweep result (SI values; x = swept parameter for traces, k for grids). */
export interface SweepResult {
  traces: Array<{ quantity: string; label: string; x: number[]; y: (number | null)[] }>;
  grids: Array<{
    quantity: string;
    label: string;
    /** k (rad/m) */
    x: number[];
    /** swept parameter (SI) */
    y: number[];
    z: (number | null)[][];
  }>;
}

/** Job spec for run_hysteresis (SI). */
export interface HystJob {
  type: 'single' | 'double';
  /** Macrospin config for the single layer (SI, Bext overridden by the loop) */
  config?: Record<string, number | string>;
  /** DoubleLayerNumeric inputs */
  material?: MaterialValues;
  material2?: MaterialValues;
  params?: Record<string, number | string | Matrix3>;
  /** T */
  Bmax: number;
  /** points per branch */
  points: number;
}

/** run_hysteresis result: two branches (down: +B→−B, up: −B→+B), angles in rad. */
export interface HystResult {
  type: 'single' | 'double';
  branches: Array<{
    label: 'down' | 'up';
    B: number[];
    proj: (number | null)[];
    /** single: θ_M; double: φ₁ */
    a1: (number | null)[];
    /** single: φ_M; double: φ₂ */
    a2: (number | null)[];
  }>;
}

/** Normalized results returned by swt_bridge.py (values SI, NaN → null). */
export interface BridgeResult {
  traces: Array<{ quantity: string; label: string; x: number[]; y: (number | null)[] }>;
  scalars: Array<{ quantity: string; index: number; value: number | null }>;
  grids: Array<{
    quantity: string;
    label: string;
    x: number[];
    y: number[];
    z: (number | null)[][];
  }>;
}
