/** Central application state (zustand). */
import { create } from 'zustand';
import { buildJob, describeParams, type ParamValues } from '../models/job';
import { getModel, MODELS } from '../models/registry';
import type {
  BridgeResult,
  ComputeJob,
  KRange,
  MaterialValues,
  ModelId,
  QuantityDef,
} from '../models/types';
import { getMaterialPreset } from '../models/materials';
import type { KUnitId } from '../models/units';
import { SwtEngine } from '../pyodide/swtClient';
import type { EngineStage } from '../pyodide/protocol';

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

interface AppState {
  engineStatus: EngineStatus;
  engineStage: EngineStage | null;
  engineError: string | null;
  computeError: string | null;
  swtVersion: string | null;
  pyodideVersion: string | null;

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
}

function defaultParamValues(modelId: ModelId): ParamValues {
  const model = getModel(modelId);
  const values: ParamValues = {};
  for (const def of [...model.params, ...(model.methodParams ?? [])]) {
    values[def.key] = def.default;
  }
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

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export const useStore = create<AppState>((set, get) => ({
  engineStatus: 'boot',
  engineStage: null,
  engineError: null,
  computeError: null,
  swtVersion: null,
  pyodideVersion: null,

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
