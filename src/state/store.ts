/** Central application state (zustand). */
import { create } from 'zustand';
import { BLS_ALL_PARAMS, blsSweepableParams, type BlsMode } from '../models/bls';
import { blsDefaultSweepRange, buildBlsJob } from '../models/blsJob';
import { buildJob, describeGroup, describeParams, type ParamValues } from '../models/job';
import { MACROSPIN_PARAMS } from '../models/macrospin';
import { getModel, MODELS } from '../models/registry';
import { buildHystJob, buildSweepJob, defaultSweepRange, sweepableParams } from '../models/sweep';
import { singleLayerTensorDefaults } from '../models/tensors';
import type {
  BlsJob,
  BlsResult,
  BridgeResult,
  ComputeJob,
  HystResult,
  KRange,
  MaterialValues,
  ModelId,
  QuantityDef,
  SweepModelId,
  SweepResult,
} from '../models/types';
import { getMaterialPreset } from '../models/materials';
import type { KUnitId } from '../models/units';
import { SwtEngine } from '../pyodide/swtClient';
import type { EngineStage } from '../pyodide/protocol';
import { hydrateShareState } from '../share/urlState';
import type { ShareEnvelope } from '../share/urlState';

export const TRACE_PALETTE = [
  '#2563eb', // blue
  '#dc2626', // red
  '#16a34a', // green
  '#9333ea', // purple
  '#ea580c', // orange
  '#0891b2', // cyan
  '#db2777', // pink
  '#ca8a04', // yellow-dark
  '#4b5563', // gray
  '#7c3aed', // violet
];

export type DashStyle = 'solid' | 'dash' | 'dot' | 'dashdot';

export interface Provenance {
  model: ModelId;
  modelLabel: string;
  materialLabel: string;
  material2Label?: string;
  materialPresetId: string;
  materialPresetId2?: string;
  paramsDisplay: Record<string, string>;
  job: ComputeJob;
  timestamp: string;
}

export interface PlotTrace {
  id: string;
  runId: number;
  runLabel: string;
  quantityId: string;
  quantityLabel: string;
  axisLabel: string;
  unit: string;
  modeLabel: string;
  /** SI, rad/m */
  x: number[];
  /** display units (already scaled) */
  y: (number | null)[];
  visible: boolean;
  color: string;
  dash: DashStyle;
  width: number;
  provenance: Provenance;
}

/** A pinned single µBLS spectrum, overlaid on the µBLS plot (non-sweep mode). */
export interface BlsTrace {
  id: string;
  runId: number;
  runLabel: string;
  /** frequency (GHz) */
  x: number[];
  /** BLS intensity (arb. u.) */
  y: (number | null)[];
  visible: boolean;
  color: string;
  dash: DashStyle;
  paramsDisplay: Record<string, string>;
}

export interface GridResult {
  runId: number;
  runLabel: string;
  quantityId: string;
  quantityLabel: string;
  modeLabel: string;
  x: number[];
  /** display units (GHz) */
  y: number[];
  z: (number | null)[][];
  provenance: Provenance;
}

export interface ScalarResult {
  id: string;
  runId: number;
  runLabel: string;
  quantityId: string;
  label: string;
  value: number | null;
  unit: string;
}

export interface PlotSettings {
  title: string;
  xLabel: string;
  yLabel: string;
  xUnit: KUnitId;
  logX: boolean;
  logY: boolean;
  showLegend: boolean;
  showGrid: boolean;
  fontSize: number;
}

export type EngineStatus = 'boot' | 'loading' | 'ready' | 'computing' | 'error';

export type PageId = 'dispersion' | 'sweep' | 'hysteresis' | 'bls';

export interface BlsMeta {
  job: BlsJob;
  mode: BlsMode;
  sweepKey?: string;
  paramLabel?: string;
  paramUnit?: string;
  paramToSI?: number;
  materialPresetId: string;
  paramsDisplay: Record<string, string>;
  timestamp: string;
}

export interface BlsState {
  mode: BlsMode;
  values: ParamValues;
  sweepEnabled: boolean;
  sweepKey: string;
  sweepFrom: number;
  sweepTo: number;
  sweepPoints: number;
  status: 'idle' | 'running';
  error: string | null;
  result: BlsResult | null;
  meta: BlsMeta | null;
  /** Pinned single spectra overlaid on the plot (non-sweep mode only). */
  traces: BlsTrace[];
  runCounter: number;
}

export interface SweepMeta {
  /** The exact job that produced the result (SI) — used for notebook export. */
  job: import('../models/types').SweepJob;
  modelId: SweepModelId;
  modelLabel: string;
  key: string;
  paramLabel: string;
  paramUnit: string;
  paramToSI: number;
  quantityId: string;
  mode: 'fixedK' | 'map';
  kFixed: number;
  relax: boolean;
  materialPresetId: string;
  materialPresetId2?: string;
  paramsDisplay: Record<string, string>;
  timestamp: string;
}

export interface SweepState {
  modelId: SweepModelId;
  key: string;
  from: number;
  to: number;
  points: number;
  mode: 'fixedK' | 'map';
  /** display, rad/µm */
  kFixed: number;
  quantityId: string;
  relax: boolean;
  status: 'idle' | 'running';
  error: string | null;
  result: SweepResult | null;
  meta: SweepMeta | null;
}

export interface HystMeta {
  /** The exact job that produced the result (SI) — used for notebook export. */
  job: import('../models/types').HystJob;
  type: 'single' | 'double';
  Bmax: number;
  materialPresetId: string;
  materialPresetId2?: string;
  paramsDisplay: Record<string, string>;
  timestamp: string;
}

export interface HystState {
  type: 'single' | 'double';
  /** display, mT */
  Bmax: number;
  /** points per branch */
  points: number;
  view: 'projection' | 'angles';
  status: 'idle' | 'running';
  error: string | null;
  result: HystResult | null;
  meta: HystMeta | null;
}

interface AppState {
  engineStatus: EngineStatus;
  engineStage: EngineStage | null;
  engineError: string | null;
  computeError: string | null;
  shareMessage: string | null;
  swtVersion: string | null;
  pyodideVersion: string | null;

  page: PageId;
  macrospinValues: ParamValues;
  sweep: SweepState;
  hyst: HystState;
  bls: BlsState;

  modelId: ModelId;
  materialPresetId: string;
  material: MaterialValues;
  materialPresetId2: string;
  material2: MaterialValues;
  paramValues: Record<ModelId, ParamValues>;
  kRanges: Record<ModelId, KRange>;
  modes: Record<ModelId, number[]>;
  nT: number;
  selectedQuantities: Record<ModelId, string[]>;

  traces: PlotTrace[];
  grids: GridResult[];
  scalars: ScalarResult[];
  runCounter: number;
  activeQuantity: string | null;
  plotSettings: PlotSettings;
  theme: 'light' | 'dark';

  initEngine: () => void;
  setModel: (id: ModelId) => void;
  setMaterialPreset: (id: string, which?: 1 | 2) => void;
  setMaterialValue: (key: keyof MaterialValues, siValue: number, which?: 1 | 2) => void;
  setParam: (key: string, value: number | string | null) => void;
  applyGeometry: (theta: number, phi: number) => void;
  setKRange: (patch: Partial<KRange>) => void;
  setModes: (modes: number[]) => void;
  setNT: (nT: number) => void;
  toggleQuantity: (id: string) => void;
  compute: () => Promise<void>;
  cancelCompute: () => void;
  setActiveQuantity: (id: string) => void;
  updateTrace: (id: string, patch: Partial<PlotTrace>) => void;
  removeTrace: (id: string) => void;
  removeRun: (runId: number) => void;
  clearResults: () => void;
  setPlotSettings: (patch: Partial<PlotSettings>) => void;
  toggleTheme: () => void;
  hydrateFromShare: (envelope: ShareEnvelope) => boolean;
  markShareError: () => void;
  clearShareMessage: () => void;

  setPage: (page: PageId) => void;
  setMacrospinValue: (key: string, value: number | string | null) => void;
  setSweepModel: (id: SweepModelId) => void;
  setSweepKey: (key: string) => void;
  patchSweep: (patch: Partial<SweepState>) => void;
  runSweep: () => Promise<void>;
  patchHyst: (patch: Partial<HystState>) => void;
  setHystType: (type: 'single' | 'double') => void;
  runHysteresis: () => Promise<void>;
  patchBls: (patch: Partial<BlsState>) => void;
  setBlsValue: (key: string, value: number | string | null) => void;
  setBlsSweepKey: (key: string) => void;
  runBls: () => Promise<void>;
  updateBlsTrace: (id: string, patch: Partial<BlsTrace>) => void;
  removeBlsTrace: (id: string) => void;
  clearBlsTraces: () => void;
}

function defaultParamValues(modelId: ModelId): ParamValues {
  const model = getModel(modelId);
  const values: ParamValues = {};
  for (const def of [...model.params, ...(model.methodParams ?? [])]) {
    values[def.key] = def.default;
  }
  if (modelId === 'SingleLayer') Object.assign(values, singleLayerTensorDefaults());
  return values;
}

function defaultSelectedQuantities(modelId: ModelId): string[] {
  return [getModel(modelId).quantities[0].id];
}

const initialParamValues = Object.fromEntries(
  Object.keys(MODELS).map((id) => [id, defaultParamValues(id as ModelId)]),
) as Record<ModelId, ParamValues>;

const initialKRanges = Object.fromEntries(
  Object.keys(MODELS).map((id) => [id, { ...getModel(id as ModelId).kDefault }]),
) as Record<ModelId, KRange>;

const initialModes = Object.fromEntries(Object.keys(MODELS).map((id) => [id, [0]])) as Record<
  ModelId,
  number[]
>;

const initialQuantities = Object.fromEntries(
  Object.keys(MODELS).map((id) => [id, defaultSelectedQuantities(id as ModelId)]),
) as Record<ModelId, string[]>;

let engine: SwtEngine | null = null;
let traceIdCounter = 1;
let blsTraceIdCounter = 1;

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function pageFromHash(): PageId {
  if (typeof window === 'undefined') return 'dispersion';
  const h = window.location.hash;
  if (h.startsWith('#/sweep')) return 'sweep';
  if (h.startsWith('#/hysteresis')) return 'hysteresis';
  if (h.startsWith('#/bls')) return 'bls';
  return 'dispersion';
}

function initialBlsState(): BlsState {
  const bext = blsSweepableParams().find((p) => p.key === 'Bext')!;
  const range = blsDefaultSweepRange(bext);
  return {
    mode: 'thermal',
    values: Object.fromEntries(BLS_ALL_PARAMS.map((p) => [p.key, p.default])) as ParamValues,
    sweepEnabled: false,
    sweepKey: 'Bext',
    sweepFrom: range.from,
    sweepTo: range.to,
    sweepPoints: range.points,
    status: 'idle',
    error: null,
    result: null,
    meta: null,
    traces: [],
    runCounter: 0,
  };
}

const initialMacrospinValues = Object.fromEntries(
  MACROSPIN_PARAMS.map((p) => [p.key, p.default]),
) as ParamValues;

function initialSweepState(): SweepState {
  const def = sweepableParams('SingleLayer').find((p) => p.key === 'Bext')!;
  const range = defaultSweepRange(def);
  return {
    modelId: 'SingleLayer',
    key: 'Bext',
    ...range,
    mode: 'fixedK',
    kFixed: 0,
    quantityId: 'dispersion',
    relax: false,
    status: 'idle',
    error: null,
    result: null,
    meta: null,
  };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export const useStore = create<AppState>((set, get) => ({
  engineStatus: 'boot',
  engineStage: null,
  engineError: null,
  computeError: null,
  shareMessage: null,
  swtVersion: null,
  pyodideVersion: null,

  page: pageFromHash(),
  macrospinValues: { ...initialMacrospinValues },
  sweep: initialSweepState(),
  hyst: {
    type: 'single',
    Bmax: 100,
    points: 101,
    view: 'projection',
    status: 'idle',
    error: null,
    result: null,
    meta: null,
  },
  bls: initialBlsState(),

  modelId: 'SingleLayer',
  materialPresetId: 'NiFe',
  material: { ...getMaterialPreset('NiFe').values },
  materialPresetId2: 'NiFe',
  material2: { ...getMaterialPreset('NiFe').values },
  paramValues: initialParamValues,
  kRanges: initialKRanges,
  modes: initialModes,
  nT: 0,
  selectedQuantities: initialQuantities,

  traces: [],
  grids: [],
  scalars: [],
  runCounter: 0,
  activeQuantity: null,
  plotSettings: {
    title: '',
    xLabel: '',
    yLabel: '',
    xUnit: 'rad/um',
    logX: false,
    logY: false,
    showLegend: true,
    showGrid: true,
    fontSize: 14,
  },
  theme: prefersDark() ? 'dark' : 'light',

  initEngine: () => {
    if (engine) return;
    set({ engineStatus: 'loading' });
    engine = new SwtEngine({
      onStage: (stage) => set({ engineStage: stage }),
      onReady: ({ swtVersion, pyodideVersion }) =>
        set({ engineStatus: 'ready', engineStage: 'ready', swtVersion, pyodideVersion }),
      onInitError: (message) => set({ engineStatus: 'error', engineError: message }),
    });
    engine.start();
  },

  setModel: (id) => set({ modelId: id, computeError: null }),

  setMaterialPreset: (id, which = 1) => {
    const preset = getMaterialPreset(id);
    if (which === 1) set({ materialPresetId: id, material: { ...preset.values } });
    else set({ materialPresetId2: id, material2: { ...preset.values } });
  },

  setMaterialValue: (key, siValue, which = 1) => {
    if (which === 1) {
      set((s) => ({ materialPresetId: 'custom', material: { ...s.material, [key]: siValue } }));
    } else {
      set((s) => ({ materialPresetId2: 'custom', material2: { ...s.material2, [key]: siValue } }));
    }
  },

  setParam: (key, value) =>
    set((s) => ({
      paramValues: {
        ...s.paramValues,
        [s.modelId]: { ...s.paramValues[s.modelId], [key]: value },
      },
    })),

  applyGeometry: (theta, phi) =>
    set((s) => ({
      paramValues: {
        ...s.paramValues,
        [s.modelId]: { ...s.paramValues[s.modelId], theta, phi },
      },
    })),

  setKRange: (patch) =>
    set((s) => ({
      kRanges: { ...s.kRanges, [s.modelId]: { ...s.kRanges[s.modelId], ...patch } },
    })),

  setModes: (modes) => set((s) => ({ modes: { ...s.modes, [s.modelId]: modes } })),
  setNT: (nT) => set({ nT }),

  toggleQuantity: (id) =>
    set((s) => {
      const current = s.selectedQuantities[s.modelId];
      const next = current.includes(id) ? current.filter((q) => q !== id) : [...current, id];
      return { selectedQuantities: { ...s.selectedQuantities, [s.modelId]: next } };
    }),

  compute: async () => {
    const s = get();
    if (!engine || s.engineStatus !== 'ready') return;
    const model = getModel(s.modelId);

    let job: ComputeJob;
    try {
      job = buildJob({
        modelId: s.modelId,
        material: s.material,
        material2: model.hasSecondMaterial ? s.material2 : undefined,
        paramValues: s.paramValues[s.modelId],
        kRange: s.kRanges[s.modelId],
        modes: s.modes[s.modelId],
        nT: s.nT,
        quantityIds: s.selectedQuantities[s.modelId],
      });
    } catch (err) {
      set({ computeError: err instanceof Error ? err.message : String(err) });
      return;
    }

    set({ engineStatus: 'computing', computeError: null });
    const runId = s.runCounter + 1;

    try {
      const result = await engine.run(job);
      const state = get();
      const preset1 = getMaterialPreset(state.materialPresetId);
      const preset2 = getMaterialPreset(state.materialPresetId2);
      const runLabel = `Run ${runId} · ${preset1.label.split(' ')[0]}`;
      const provenance: Provenance = {
        model: model.id,
        modelLabel: model.label,
        materialLabel: preset1.label,
        material2Label: model.hasSecondMaterial ? preset2.label : undefined,
        materialPresetId: state.materialPresetId,
        materialPresetId2: model.hasSecondMaterial ? state.materialPresetId2 : undefined,
        paramsDisplay: describeParams(model.id, state.paramValues[model.id]),
        job,
        timestamp: new Date().toISOString(),
      };
      const { traces, grids, scalars } = normalizeResult(
        result,
        model.quantities,
        runId,
        runLabel,
        provenance,
        state.traces.length,
      );
      const firstQuantity =
        traces[0]?.quantityId ?? grids[0]?.quantityId ?? state.activeQuantity ?? null;
      set((prev) => ({
        engineStatus: 'ready',
        runCounter: runId,
        traces: [...prev.traces, ...traces],
        grids: [...prev.grids.filter((g) => !grids.some((n) => n.quantityId === g.quantityId)), ...grids],
        scalars: [...prev.scalars, ...scalars],
        activeQuantity: firstQuantity,
      }));
    } catch (err) {
      set({
        engineStatus: 'ready',
        computeError: err instanceof Error ? err.message : String(err),
      });
    }
  },

  cancelCompute: () => {
    engine?.cancel();
    set({ engineStatus: 'loading', engineStage: 'loading-pyodide', computeError: 'Computation cancelled.' });
  },

  setActiveQuantity: (id) => set({ activeQuantity: id }),

  updateTrace: (id, patch) =>
    set((s) => ({ traces: s.traces.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),

  removeTrace: (id) => set((s) => ({ traces: s.traces.filter((t) => t.id !== id) })),

  removeRun: (runId) =>
    set((s) => ({
      traces: s.traces.filter((t) => t.runId !== runId),
      grids: s.grids.filter((g) => g.runId !== runId),
      scalars: s.scalars.filter((sc) => sc.runId !== runId),
    })),

  clearResults: () => set({ traces: [], grids: [], scalars: [], activeQuantity: null }),

  setPlotSettings: (patch) => set((s) => ({ plotSettings: { ...s.plotSettings, ...patch } })),

  toggleTheme: () => set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),

  hydrateFromShare: (envelope) => {
    const patch = hydrateShareState(get(), envelope);
    if (!patch) {
      set({ shareMessage: 'Could not read shared link.' });
      return false;
    }
    set({ ...patch, shareMessage: 'Parameters loaded from shared link.' });
    return true;
  },

  markShareError: () => set({ shareMessage: 'Could not read shared link.' }),

  clearShareMessage: () => set({ shareMessage: null }),

  setPage: (page) => {
    if (typeof window !== 'undefined') {
      const hash = page === 'dispersion' ? '#/' : `#/${page}`;
      if (window.location.hash !== hash) window.history.replaceState(null, '', hash);
    }
    set({ page });
  },

  setMacrospinValue: (key, value) =>
    set((s) => ({ macrospinValues: { ...s.macrospinValues, [key]: value } })),

  setSweepModel: (id) =>
    set((s) => {
      const params = sweepableParams(id);
      const def = params.find((p) => p.key === 'Bext') ?? params[0];
      const range = defaultSweepRange(def);
      const quantityId = id === 'Macrospin' ? 'projection' : getModel(id).quantities[0].id;
      return {
        // Keep the shared model forms in sync so the sweep uses the same
        // parameters the user configured on the dispersion page.
        ...(id !== 'Macrospin' ? { modelId: id } : {}),
        sweep: {
          ...s.sweep,
          modelId: id,
          key: def.key,
          ...range,
          quantityId,
          relax: id === 'DoubleLayerNumeric',
          result: null,
          meta: null,
          error: null,
        },
      };
    }),

  setSweepKey: (key) =>
    set((s) => {
      const def = sweepableParams(s.sweep.modelId).find((p) => p.key === key);
      const range = def ? defaultSweepRange(def) : {};
      return { sweep: { ...s.sweep, key, ...range } };
    }),

  patchSweep: (patch) => set((s) => ({ sweep: { ...s.sweep, ...patch } })),

  runSweep: async () => {
    const s = get();
    if (!engine || s.engineStatus !== 'ready' || s.sweep.status === 'running') return;
    const sw = s.sweep;
    const def = sweepableParams(sw.modelId).find((p) => p.key === sw.key);
    let job;
    try {
      job = buildSweepJob({
        modelId: sw.modelId,
        material: s.material,
        material2: s.material2,
        paramValues: sw.modelId !== 'Macrospin' ? s.paramValues[sw.modelId] : {},
        macrospinValues: s.macrospinValues,
        sweepKey: sw.key,
        from: sw.from,
        to: sw.to,
        points: sw.points,
        mode: sw.mode,
        kFixed: sw.kFixed,
        kRange:
          sw.modelId !== 'Macrospin'
            ? s.kRanges[sw.modelId]
            : { min: 1, max: 2, points: 2, spacing: 'linear' },
        quantityId: sw.quantityId,
        modes: sw.modelId !== 'Macrospin' ? s.modes[sw.modelId] : [0],
        nT: s.nT,
        relax: sw.relax,
      });
    } catch (err) {
      set((s2) => ({ sweep: { ...s2.sweep, error: errorMessage(err) } }));
      return;
    }
    set((s2) => ({ sweep: { ...s2.sweep, status: 'running', error: null } }));
    try {
      const result = await engine.runSweep(job);
      const meta: SweepMeta = {
        job,
        modelId: sw.modelId,
        modelLabel: sw.modelId === 'Macrospin' ? 'Macrospin equilibrium' : getModel(sw.modelId).label,
        key: sw.key,
        paramLabel: def?.label ?? sw.key,
        paramUnit: def?.unit ?? '',
        paramToSI: def?.toSI ?? 1,
        quantityId: sw.quantityId,
        mode: sw.mode,
        kFixed: sw.kFixed,
        relax: sw.relax,
        materialPresetId: get().materialPresetId,
        materialPresetId2: job.material2 ? get().materialPresetId2 : undefined,
        paramsDisplay:
          sw.modelId === 'Macrospin'
            ? describeGroup(MACROSPIN_PARAMS, get().macrospinValues)
            : describeParams(sw.modelId, get().paramValues[sw.modelId]),
        timestamp: new Date().toISOString(),
      };
      set((s2) => ({ sweep: { ...s2.sweep, status: 'idle', result, meta } }));
    } catch (err) {
      set((s2) => ({ sweep: { ...s2.sweep, status: 'idle', error: errorMessage(err) } }));
    }
  },

  patchHyst: (patch) => set((s) => ({ hyst: { ...s.hyst, ...patch } })),

  setHystType: (type) =>
    set((s) => ({
      hyst: { ...s.hyst, type, result: null, meta: null, error: null },
      ...(type === 'double' ? { modelId: 'DoubleLayerNumeric' as ModelId } : {}),
    })),

  runHysteresis: async () => {
    const s = get();
    if (!engine || s.engineStatus !== 'ready' || s.hyst.status === 'running') return;
    const h = s.hyst;
    let job;
    try {
      job = buildHystJob({
        type: h.type,
        material: s.material,
        material2: h.type === 'double' ? s.material2 : undefined,
        macrospinValues: s.macrospinValues,
        doubleLayerValues: s.paramValues.DoubleLayerNumeric,
        Bmax: h.Bmax,
        points: h.points,
      });
    } catch (err) {
      set((s2) => ({ hyst: { ...s2.hyst, error: errorMessage(err) } }));
      return;
    }
    set((s2) => ({ hyst: { ...s2.hyst, status: 'running', error: null } }));
    try {
      const result = await engine.runHysteresis(job);
      const meta: HystMeta = {
        job,
        type: h.type,
        Bmax: h.Bmax,
        materialPresetId: get().materialPresetId,
        materialPresetId2: h.type === 'double' ? get().materialPresetId2 : undefined,
        paramsDisplay:
          h.type === 'single'
            ? describeGroup(MACROSPIN_PARAMS, get().macrospinValues)
            : describeParams('DoubleLayerNumeric', get().paramValues.DoubleLayerNumeric),
        timestamp: new Date().toISOString(),
      };
      set((s2) => ({ hyst: { ...s2.hyst, status: 'idle', result, meta } }));
    } catch (err) {
      set((s2) => ({ hyst: { ...s2.hyst, status: 'idle', error: errorMessage(err) } }));
    }
  },

  patchBls: (patch) => set((s) => ({ bls: { ...s.bls, ...patch } })),

  setBlsValue: (key, value) =>
    set((s) => ({ bls: { ...s.bls, values: { ...s.bls.values, [key]: value } } })),

  setBlsSweepKey: (key) =>
    set((s) => {
      const def = blsSweepableParams().find((p) => p.key === key);
      const range = def ? blsDefaultSweepRange(def) : {};
      return {
        bls: {
          ...s.bls,
          sweepKey: key,
          ...(def
            ? {
                sweepFrom: (range as { from: number }).from,
                sweepTo: (range as { to: number }).to,
                sweepPoints: (range as { points: number }).points,
              }
            : {}),
        },
      };
    }),

  runBls: async () => {
    const s = get();
    if (!engine || s.engineStatus !== 'ready' || s.bls.status === 'running') return;
    const b = s.bls;
    let job: BlsJob;
    try {
      job = buildBlsJob({
        mode: b.mode,
        material: s.material,
        values: b.values,
        sweepEnabled: b.sweepEnabled,
        sweepKey: b.sweepKey,
        sweepFrom: b.sweepFrom,
        sweepTo: b.sweepTo,
        sweepPoints: b.sweepPoints,
      });
    } catch (err) {
      set((s2) => ({ bls: { ...s2.bls, error: errorMessage(err) } }));
      return;
    }
    set((s2) => ({ bls: { ...s2.bls, status: 'running', error: null } }));
    try {
      const result = await engine.runBls(job);
      const sweepDef = job.sweep
        ? blsSweepableParams().find((p) => p.key === job.sweep!.key)
        : undefined;
      const meta: BlsMeta = {
        job,
        mode: b.mode,
        sweepKey: job.sweep?.key,
        paramLabel: sweepDef?.label,
        paramUnit: sweepDef?.unit,
        paramToSI: sweepDef?.toSI,
        materialPresetId: get().materialPresetId,
        paramsDisplay: describeGroup(BLS_ALL_PARAMS, get().bls.values),
        timestamp: new Date().toISOString(),
      };
      set((s2) => {
        // A single spectrum is pinned as an overlaid trace (like the dispersion
        // page). A parameter sweep produces a 2D map, which traces don't apply
        // to, so leave the trace list (and run counter) untouched.
        if (job.sweep) {
          return { bls: { ...s2.bls, status: 'idle', result, meta } };
        }
        const spectrum = result.traces.find((t) => t.quantity === 'blsSpectrum');
        if (!spectrum) {
          return { bls: { ...s2.bls, status: 'idle', result, meta } };
        }
        const runId = s2.bls.runCounter + 1;
        const preset = getMaterialPreset(get().materialPresetId);
        const trace: BlsTrace = {
          id: `b${blsTraceIdCounter++}`,
          runId,
          runLabel: `Run ${runId} · ${preset.label.split(' ')[0]}`,
          x: spectrum.x.map((w) => w / (2 * Math.PI * 1e9)),
          y: spectrum.y,
          visible: true,
          color: TRACE_PALETTE[s2.bls.traces.length % TRACE_PALETTE.length],
          dash: 'solid',
          paramsDisplay: meta.paramsDisplay,
        };
        return {
          bls: {
            ...s2.bls,
            status: 'idle',
            result,
            meta,
            traces: [...s2.bls.traces, trace],
            runCounter: runId,
          },
        };
      });
    } catch (err) {
      set((s2) => ({ bls: { ...s2.bls, status: 'idle', error: errorMessage(err) } }));
    }
  },

  updateBlsTrace: (id, patch) =>
    set((s) => ({
      bls: { ...s.bls, traces: s.bls.traces.map((t) => (t.id === id ? { ...t, ...patch } : t)) },
    })),

  removeBlsTrace: (id) =>
    set((s) => ({ bls: { ...s.bls, traces: s.bls.traces.filter((t) => t.id !== id) } })),

  clearBlsTraces: () =>
    set((s) => ({ bls: { ...s.bls, traces: [], result: null, meta: null } })),
}));

function normalizeResult(
  result: BridgeResult,
  quantities: QuantityDef[],
  runId: number,
  runLabel: string,
  provenance: Provenance,
  existingTraceCount: number,
): { traces: PlotTrace[]; grids: GridResult[]; scalars: ScalarResult[] } {
  const qById = new Map(quantities.map((q) => [q.id, q]));
  const traces: PlotTrace[] = [];
  const grids: GridResult[] = [];
  const scalars: ScalarResult[] = [];

  for (const t of result.traces) {
    const q = qById.get(t.quantity);
    if (!q) continue;
    const colorIndex = (existingTraceCount + traces.length) % TRACE_PALETTE.length;
    // Stacked results may carry nicer labels from the registry.
    let modeLabel = t.label;
    if (q.stackedLabels && /^mode \d+$/.test(t.label)) {
      const i = Number(t.label.replace('mode ', ''));
      modeLabel = q.stackedLabels[i] ?? t.label;
    }
    traces.push({
      id: `t${traceIdCounter++}`,
      runId,
      runLabel,
      quantityId: q.id,
      quantityLabel: q.label,
      axisLabel: q.axisLabel,
      unit: q.unit,
      modeLabel,
      x: t.x,
      y: t.y.map((v) => (v === null ? null : v * q.scale)),
      visible: true,
      color: TRACE_PALETTE[colorIndex],
      dash: 'solid',
      width: 2,
      provenance,
    });
  }

  for (const g of result.grids) {
    const q = qById.get(g.quantity);
    if (!q) continue;
    grids.push({
      runId,
      runLabel,
      quantityId: q.id,
      quantityLabel: q.label,
      modeLabel: g.label,
      x: g.x,
      y: g.y.map((v) => (v === null ? NaN : v * q.scale)),
      z: g.z,
      provenance,
    });
  }

  for (const sc of result.scalars) {
    const q = qById.get(sc.quantity);
    if (!q) continue;
    const label = q.scalarLabels?.[sc.index] ?? q.label;
    scalars.push({
      id: `s${runId}-${sc.quantity}-${sc.index}`,
      runId,
      runLabel,
      quantityId: sc.quantity,
      label,
      value: sc.value === null ? null : sc.value * q.scale,
      unit: q.unit,
    });
  }

  return { traces, grids, scalars };
}
