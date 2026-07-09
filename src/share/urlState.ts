import LZString from 'lz-string';
import { BLS_ALL_PARAMS, blsSweepableParams, type BlsMode } from '../models/bls';
import { MACROSPIN_PARAMS, MACROSPIN_QUANTITIES } from '../models/macrospin';
import { MATERIAL_PRESETS, getMaterialPreset } from '../models/materials';
import { getModel, MODELS } from '../models/registry';
import { defaultSweepRange, sweepableParams } from '../models/sweep';
import {
  NA_MODE_KEY,
  ND_MODE_KEY,
  TENSOR_AXES,
  singleLayerTensorDefaults,
  tensorKey,
} from '../models/tensors';
import { K_UNITS } from '../models/units';
import type { ParamValues } from '../models/job';
import type { KRange, MaterialValues, ModelId, ParamDef, SweepModelId } from '../models/types';
import type { KUnitId } from '../models/units';
import type { BlsState, HystState, PageId, PlotSettings, SweepState } from '../state/store';

export type ShareScope = 'page' | 'app';

export interface ShareEnvelope {
  v: 1;
  scope: ShareScope;
  page: PageId;
  data: PageShare | AppShare;
}

export interface PageShare {
  page: PageId;
  common: CommonShare;
  dispersion?: DispersionShare;
  sweep?: SweepShare;
  hyst?: HystShare;
  bls?: BlsShare;
}

export interface AppShare extends CommonShare {
  dispersion: DispersionShare;
  sweep: SweepShare;
  hyst: HystShare;
  bls: BlsShare;
}

export interface CommonShare {
  materialPresetId: string;
  material: MaterialValues;
  materialPresetId2: string;
  material2: MaterialValues;
}

export interface DispersionShare {
  modelId: ModelId;
  paramValues: Partial<Record<ModelId, ParamValues>>;
  kRanges: Partial<Record<ModelId, KRange>>;
  modes: Partial<Record<ModelId, number[]>>;
  nT: number;
  selectedQuantities: Partial<Record<ModelId, string[]>>;
  plotSettings: PlotSettings;
}

export type SweepShare = Pick<
  SweepState,
  'modelId' | 'key' | 'from' | 'to' | 'points' | 'mode' | 'kFixed' | 'quantityId' | 'relax'
> & {
  macrospinValues: ParamValues;
  paramValues: Partial<Record<ModelId, ParamValues>>;
  kRanges: Partial<Record<ModelId, KRange>>;
  modes: Partial<Record<ModelId, number[]>>;
  nT: number;
};

export type HystShare = Pick<HystState, 'type' | 'Bmax' | 'points' | 'view'> & {
  macrospinValues: ParamValues;
  doubleLayerValues: ParamValues;
};

export type BlsShare = Pick<
  BlsState,
  'mode' | 'values' | 'sweepEnabled' | 'sweepKey' | 'sweepFrom' | 'sweepTo' | 'sweepPoints'
>;

export interface ShareableState extends CommonShare {
  page: PageId;
  modelId: ModelId;
  macrospinValues: ParamValues;
  sweep: SweepState;
  hyst: HystState;
  bls: BlsState;
  paramValues: Record<ModelId, ParamValues>;
  kRanges: Record<ModelId, KRange>;
  modes: Record<ModelId, number[]>;
  nT: number;
  selectedQuantities: Record<ModelId, string[]>;
  plotSettings: PlotSettings;
}

export interface HydratedShareState {
  page?: PageId;
  modelId?: ModelId;
  materialPresetId?: string;
  material?: MaterialValues;
  materialPresetId2?: string;
  material2?: MaterialValues;
  macrospinValues?: ParamValues;
  sweep?: SweepState;
  hyst?: HystState;
  bls?: BlsState;
  paramValues?: Record<ModelId, ParamValues>;
  kRanges?: Record<ModelId, KRange>;
  modes?: Record<ModelId, number[]>;
  nT?: number;
  selectedQuantities?: Record<ModelId, string[]>;
  plotSettings?: PlotSettings;
  traces: [];
  grids: [];
  scalars: [];
  activeQuantity: null;
  computeError: null;
}

const MODEL_IDS = Object.keys(MODELS) as ModelId[];
const PAGE_IDS: PageId[] = ['dispersion', 'sweep', 'hysteresis', 'bls'];
const MATERIAL_IDS = new Set(MATERIAL_PRESETS.map((m) => m.id));
const K_UNIT_IDS = new Set(K_UNITS.map((u) => u.id));

export function createShareEnvelope(state: ShareableState, scope: ShareScope): ShareEnvelope {
  return {
    v: 1,
    scope,
    page: state.page,
    data: scope === 'app' ? selectAppShare(state) : selectPageShare(state.page, state),
  };
}

export function encodeShare(envelope: ShareEnvelope): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(envelope));
}

export function decodeShare(payload: string): ShareEnvelope | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(payload);
    if (!json) return null;
    const parsed = JSON.parse(json) as unknown;
    if (!isRecord(parsed) || parsed.v !== 1 || !isScope(parsed.scope) || !isPageId(parsed.page)) {
      return null;
    }
    return parsed as unknown as ShareEnvelope;
  } catch {
    return null;
  }
}

export function buildShareUrl(state: ShareableState, scope: ShareScope, href = window.location.href): string {
  const envelope = createShareEnvelope(state, scope);
  const url = new URL(href);
  url.hash = `${hashRoute(envelope.page)}?s=${encodeShare(envelope)}`;
  return url.toString();
}

export function parseShareFromHash(hash: string): ShareEnvelope | null {
  const queryStart = hash.indexOf('?');
  if (queryStart < 0) return null;
  const params = new URLSearchParams(hash.slice(queryStart + 1));
  const payload = params.get('s');
  return payload ? decodeShare(payload) : null;
}

export function stripSharePayloadFromHash(hash: string): string {
  const queryStart = hash.indexOf('?');
  if (queryStart < 0) return hash || '#/';
  return hash.slice(0, queryStart) || '#/';
}

export function hydrateShareState(current: ShareableState, envelope: ShareEnvelope): HydratedShareState | null {
  if (envelope.v !== 1 || !isScope(envelope.scope) || !isPageId(envelope.page) || !isRecord(envelope.data)) {
    return null;
  }

  const patch: HydratedShareState = {
    page: envelope.page,
    traces: [],
    grids: [],
    scalars: [],
    activeQuantity: null,
    computeError: null,
  };

  if (envelope.scope === 'app') {
    applyCommon(patch, envelope.data);
    const data = envelope.data as AppShare;
    applyDispersion(patch, current, data.dispersion);
    applySweep(patch, current, data.sweep);
    applyHyst(patch, current, data.hyst);
    applyBls(patch, current, data.bls);
    return patch;
  }

  const data = envelope.data as PageShare;
  // Defense in depth: a hand-crafted URL could carry mismatched pages, which
  // would navigate to one page while hydrating another's state.
  if (data.page !== envelope.page) return null;
  applyCommon(patch, data.common);
  if (data.page === 'dispersion') applyDispersion(patch, current, data.dispersion);
  if (data.page === 'sweep') applySweep(patch, current, data.sweep);
  if (data.page === 'hysteresis') applyHyst(patch, current, data.hyst);
  if (data.page === 'bls') applyBls(patch, current, data.bls);
  return patch;
}

function selectCommon(state: ShareableState): CommonShare {
  return {
    materialPresetId: state.materialPresetId,
    material: state.material,
    materialPresetId2: state.materialPresetId2,
    material2: state.material2,
  };
}

function selectDispersionShare(state: ShareableState, allModels: boolean): DispersionShare {
  const modelIds = allModels ? MODEL_IDS : [state.modelId];
  return {
    modelId: state.modelId,
    paramValues: pickModelRecord(state.paramValues, modelIds),
    kRanges: pickModelRecord(state.kRanges, modelIds),
    modes: pickModelRecord(state.modes, modelIds),
    nT: state.nT,
    selectedQuantities: pickModelRecord(state.selectedQuantities, modelIds),
    plotSettings: state.plotSettings,
  };
}

function selectSweepShare(state: ShareableState, allModels: boolean): SweepShare {
  const modelIds = allModels ? MODEL_IDS : state.sweep.modelId === 'Macrospin' ? [] : [state.sweep.modelId];
  return {
    modelId: state.sweep.modelId,
    key: state.sweep.key,
    from: state.sweep.from,
    to: state.sweep.to,
    points: state.sweep.points,
    mode: state.sweep.mode,
    kFixed: state.sweep.kFixed,
    quantityId: state.sweep.quantityId,
    relax: state.sweep.relax,
    macrospinValues: state.macrospinValues,
    paramValues: pickModelRecord(state.paramValues, modelIds),
    kRanges: pickModelRecord(state.kRanges, modelIds),
    modes: pickModelRecord(state.modes, modelIds),
    nT: state.nT,
  };
}

function selectHystShare(state: ShareableState): HystShare {
  return {
    type: state.hyst.type,
    Bmax: state.hyst.Bmax,
    points: state.hyst.points,
    view: state.hyst.view,
    macrospinValues: state.macrospinValues,
    doubleLayerValues: state.paramValues.DoubleLayerNumeric,
  };
}

function selectBlsShare(state: ShareableState): BlsShare {
  return {
    mode: state.bls.mode,
    values: state.bls.values,
    sweepEnabled: state.bls.sweepEnabled,
    sweepKey: state.bls.sweepKey,
    sweepFrom: state.bls.sweepFrom,
    sweepTo: state.bls.sweepTo,
    sweepPoints: state.bls.sweepPoints,
  };
}

function selectPageShare(page: PageId, state: ShareableState): PageShare {
  return {
    page,
    common: selectCommon(state),
    ...(page === 'dispersion' ? { dispersion: selectDispersionShare(state, false) } : {}),
    ...(page === 'sweep' ? { sweep: selectSweepShare(state, false) } : {}),
    ...(page === 'hysteresis' ? { hyst: selectHystShare(state) } : {}),
    ...(page === 'bls' ? { bls: selectBlsShare(state) } : {}),
  };
}

function selectAppShare(state: ShareableState): AppShare {
  return {
    ...selectCommon(state),
    dispersion: selectDispersionShare(state, true),
    sweep: selectSweepShare(state, true),
    hyst: selectHystShare(state),
    bls: selectBlsShare(state),
  };
}

function applyCommon(patch: HydratedShareState, input: unknown): void {
  if (!isRecord(input)) return;
  patch.materialPresetId = cleanMaterialPreset(input.materialPresetId);
  patch.material = cleanMaterial(input.material, patch.materialPresetId);
  patch.materialPresetId2 = cleanMaterialPreset(input.materialPresetId2);
  patch.material2 = cleanMaterial(input.material2, patch.materialPresetId2);
}

function applyDispersion(
  patch: HydratedShareState,
  current: ShareableState,
  input: unknown,
): void {
  if (!isRecord(input)) return;
  const modelId = isModelId(input.modelId) ? input.modelId : current.modelId;
  patch.modelId = modelId;
  patch.paramValues = mergeModelParamValues(current.paramValues, input.paramValues);
  patch.kRanges = mergeModelKRanges(current.kRanges, input.kRanges);
  patch.modes = mergeModelModes(current.modes, input.modes);
  patch.nT = cleanInteger(input.nT, current.nT, 0, 50);
  patch.selectedQuantities = mergeSelectedQuantities(current.selectedQuantities, input.selectedQuantities);
  patch.plotSettings = cleanPlotSettings(input.plotSettings, current.plotSettings);
}

function applySweep(patch: HydratedShareState, current: ShareableState, input: unknown): void {
  if (!isRecord(input)) return;
  const modelId = isSweepModelId(input.modelId) ? input.modelId : current.sweep.modelId;
  const params = sweepableParams(modelId);
  const key = params.some((p) => p.key === input.key) ? String(input.key) : (params[0]?.key ?? 'Bext');
  const range = defaultSweepRange(params.find((p) => p.key === key) ?? params[0]);
  const quantityId = cleanSweepQuantity(modelId, input.quantityId, current.sweep.quantityId);
  const sweep: SweepState = {
    ...current.sweep,
    modelId,
    key,
    from: cleanFinite(input.from, range.from),
    to: cleanFinite(input.to, range.to),
    points: cleanInteger(input.points, range.points, 2, 1001),
    mode: input.mode === 'map' ? 'map' : 'fixedK',
    kFixed: Math.max(0, cleanFinite(input.kFixed, current.sweep.kFixed)),
    quantityId,
    relax: Boolean(input.relax) && modelId === 'DoubleLayerNumeric',
    status: 'idle',
    error: null,
    result: null,
    meta: null,
  };
  patch.sweep = sweep;
  patch.macrospinValues = cleanParamValues(MACROSPIN_PARAMS, input.macrospinValues, current.macrospinValues);
  patch.paramValues = mergeModelParamValues(patch.paramValues ?? current.paramValues, input.paramValues);
  patch.kRanges = mergeModelKRanges(patch.kRanges ?? current.kRanges, input.kRanges);
  patch.modes = mergeModelModes(patch.modes ?? current.modes, input.modes);
  patch.nT = cleanInteger(input.nT, patch.nT ?? current.nT, 0, 50);
  if (modelId !== 'Macrospin') patch.modelId = modelId;
}

function applyHyst(patch: HydratedShareState, current: ShareableState, input: unknown): void {
  if (!isRecord(input)) return;
  const type = input.type === 'double' ? 'double' : 'single';
  patch.hyst = {
    ...current.hyst,
    type,
    Bmax: cleanFinite(input.Bmax, current.hyst.Bmax, 0.1),
    points: cleanInteger(input.points, current.hyst.points, 3, 2001),
    view: input.view === 'angles' ? 'angles' : 'projection',
    status: 'idle',
    error: null,
    result: null,
    meta: null,
  };
  patch.macrospinValues = cleanParamValues(MACROSPIN_PARAMS, input.macrospinValues, current.macrospinValues);
  patch.paramValues = {
    ...(patch.paramValues ?? current.paramValues),
    DoubleLayerNumeric: cleanParamValues(
      getModel('DoubleLayerNumeric').params,
      input.doubleLayerValues,
      current.paramValues.DoubleLayerNumeric,
    ),
  };
  if (type === 'double') patch.modelId = 'DoubleLayerNumeric';
}

function applyBls(patch: HydratedShareState, current: ShareableState, input: unknown): void {
  if (!isRecord(input)) return;
  const sweepParams = blsSweepableParams();
  const sweepKey = sweepParams.some((p) => p.key === input.sweepKey)
    ? String(input.sweepKey)
    : current.bls.sweepKey;
  const def = sweepParams.find((p) => p.key === sweepKey) ?? sweepParams[0];
  const range = def ? defaultSweepRange(def) : { from: current.bls.sweepFrom, to: current.bls.sweepTo };
  patch.bls = {
    ...current.bls,
    mode: input.mode === 'thermal' ? (input.mode as BlsMode) : 'thermal',
    values: cleanParamValues(BLS_ALL_PARAMS, input.values, current.bls.values),
    sweepEnabled: Boolean(input.sweepEnabled),
    sweepKey,
    sweepFrom: cleanFinite(input.sweepFrom, range.from),
    sweepTo: cleanFinite(input.sweepTo, range.to),
    sweepPoints: cleanInteger(input.sweepPoints, current.bls.sweepPoints, 2, 51),
    status: 'idle',
    error: null,
    result: null,
    meta: null,
    // Computed traces are never shared (mirrors the dispersion page).
    traces: [],
    runCounter: 0,
  };
}

function mergeModelParamValues(
  current: Record<ModelId, ParamValues>,
  input: unknown,
): Record<ModelId, ParamValues> {
  const out = { ...current };
  if (!isRecord(input)) return out;
  for (const modelId of MODEL_IDS) {
    const model = getModel(modelId);
    out[modelId] = cleanParamValues([...model.params, ...(model.methodParams ?? [])], input[modelId], current[modelId]);
    if (modelId === 'SingleLayer') out[modelId] = cleanSingleLayerTensors(input[modelId], out[modelId]);
  }
  return out;
}

function mergeModelKRanges(current: Record<ModelId, KRange>, input: unknown): Record<ModelId, KRange> {
  const out = { ...current };
  if (!isRecord(input)) return out;
  for (const modelId of MODEL_IDS) {
    out[modelId] = cleanKRange(input[modelId], current[modelId]);
  }
  return out;
}

function mergeModelModes(current: Record<ModelId, number[]>, input: unknown): Record<ModelId, number[]> {
  const out = { ...current };
  if (!isRecord(input)) return out;
  for (const modelId of MODEL_IDS) {
    out[modelId] = cleanModes(input[modelId], modelId, current[modelId]);
  }
  return out;
}

function mergeSelectedQuantities(
  current: Record<ModelId, string[]>,
  input: unknown,
): Record<ModelId, string[]> {
  const out = { ...current };
  if (!isRecord(input)) return out;
  for (const modelId of MODEL_IDS) {
    out[modelId] = cleanQuantityIds(modelId, input[modelId], current[modelId]);
  }
  return out;
}

function cleanParamValues(defs: ParamDef[], input: unknown, fallback: ParamValues): ParamValues {
  const source = isRecord(input) ? input : {};
  const out: ParamValues = {};
  for (const def of defs) {
    out[def.key] = cleanParamValue(def, source[def.key], fallback[def.key] ?? def.default);
  }
  return out;
}

function cleanParamValue(def: ParamDef, input: unknown, fallback: unknown): number | string | null {
  if ((input === null || input === '') && def.nullable) return null;
  if (def.kind === 'choice') {
    const choices = def.choices ?? [];
    const choice = choices.find((c) => String(c.value) === String(input));
    return choice ? choice.value : cleanChoiceFallback(def, fallback);
  }
  return cleanFinite(input, typeof fallback === 'number' ? fallback : numericDefault(def), def.min, def.max, def.kind === 'int');
}

function cleanChoiceFallback(def: ParamDef, fallback: unknown): number | string | null {
  const choices = def.choices ?? [];
  const fromFallback = choices.find((c) => String(c.value) === String(fallback));
  if (fromFallback) return fromFallback.value;
  const fromDefault = choices.find((c) => String(c.value) === String(def.default));
  return fromDefault?.value ?? choices[0]?.value ?? null;
}

function cleanSingleLayerTensors(input: unknown, values: ParamValues): ParamValues {
  const source = isRecord(input) ? input : {};
  const defaults = singleLayerTensorDefaults();
  const out = { ...values };
  out[ND_MODE_KEY] = source[ND_MODE_KEY] === 'custom' ? 'custom' : 'default';
  out[NA_MODE_KEY] = source[NA_MODE_KEY] === 'custom' ? 'custom' : 'default';
  for (const prefix of ['Nd', 'Na'] as const) {
    for (const axis of TENSOR_AXES) {
      const key = tensorKey(prefix, axis);
      out[key] = cleanFinite(source[key], Number(defaults[key]));
    }
  }
  return out;
}

function cleanMaterial(input: unknown, presetId: string): MaterialValues {
  const fallback = getMaterialPreset(presetId).values;
  const source = isRecord(input) ? input : {};
  return {
    Ms: cleanFinite(source.Ms, fallback.Ms, 0),
    Aex: cleanFinite(source.Aex, fallback.Aex, 0),
    alpha: cleanFinite(source.alpha, fallback.alpha, 0),
    gamma: cleanFinite(source.gamma, fallback.gamma, 0),
    mu0dH0: cleanFinite(source.mu0dH0, fallback.mu0dH0),
    Ku: cleanFinite(source.Ku, fallback.Ku),
  };
}

function cleanMaterialPreset(input: unknown): string {
  return typeof input === 'string' && MATERIAL_IDS.has(input) ? input : 'custom';
}

function cleanKRange(input: unknown, fallback: KRange): KRange {
  if (!isRecord(input)) return { ...fallback };
  let min = cleanFinite(input.min, fallback.min, 0);
  let max = cleanFinite(input.max, fallback.max, 0);
  // A hostile payload may combine a huge min with a rejected max — the
  // hydrated range must itself be valid, not merely fail at compute time.
  if (max <= min) {
    min = fallback.min;
    max = fallback.max > min ? fallback.max : min + 1;
  }
  return {
    min,
    max,
    points: cleanInteger(input.points, fallback.points, 2, 5000),
    spacing: input.spacing === 'log' ? 'log' : 'linear',
  };
}

function cleanModes(input: unknown, modelId: ModelId, fallback: number[]): number[] {
  const config = getModel(modelId).modes;
  if (!config) return [0];
  if (!Array.isArray(input)) return fallback.length ? [...fallback] : [0];
  const max = Math.max(0, config.max);
  const seen = new Set<number>();
  for (const raw of input.slice(0, 16)) {
    const value = cleanInteger(raw, 0, 0, max);
    seen.add(value);
  }
  return seen.size ? [...seen].sort((a, b) => a - b) : [0];
}

function cleanQuantityIds(modelId: ModelId, input: unknown, fallback: string[]): string[] {
  const allowed = new Set(getModel(modelId).quantities.map((q) => q.id));
  const picked = Array.isArray(input) ? input.filter((q): q is string => typeof q === 'string' && allowed.has(q)) : [];
  if (picked.length > 0) return [...new Set(picked)].slice(0, 16);
  return fallback.filter((q) => allowed.has(q)).slice(0, 16);
}

function cleanSweepQuantity(modelId: SweepModelId, input: unknown, fallback: string): string {
  const allowed =
    modelId === 'Macrospin'
      ? MACROSPIN_QUANTITIES.map((q) => q.id)
      : getModel(modelId).quantities
          .filter((q) => q.returns !== 'grid')
          .map((q) => q.id);
  return typeof input === 'string' && allowed.includes(input)
    ? input
    : allowed.includes(fallback)
      ? fallback
      : (allowed[0] ?? 'dispersion');
}

function cleanPlotSettings(input: unknown, fallback: PlotSettings): PlotSettings {
  if (!isRecord(input)) return { ...fallback };
  return {
    title: cleanString(input.title, fallback.title, 140),
    xLabel: cleanString(input.xLabel, fallback.xLabel, 100),
    yLabel: cleanString(input.yLabel, fallback.yLabel, 100),
    xUnit: isKUnitId(input.xUnit) ? input.xUnit : fallback.xUnit,
    logX: Boolean(input.logX),
    logY: Boolean(input.logY),
    showLegend: input.showLegend !== false,
    showGrid: input.showGrid !== false,
    fontSize: cleanInteger(input.fontSize, fallback.fontSize, 8, 28),
  };
}

function cleanString(input: unknown, fallback: string, maxLength: number): string {
  return typeof input === 'string' ? input.slice(0, maxLength) : fallback;
}

function cleanFinite(
  input: unknown,
  fallback: number,
  min?: number,
  max?: number,
  integer = false,
): number {
  const raw = typeof input === 'number' ? input : typeof input === 'string' ? Number(input) : NaN;
  let value = Number.isFinite(raw) ? raw : fallback;
  if (integer) value = Math.round(value);
  if (min !== undefined) value = Math.max(min, value);
  if (max !== undefined) value = Math.min(max, value);
  return value;
}

function cleanInteger(input: unknown, fallback: number, min: number, max: number): number {
  return cleanFinite(input, fallback, min, max, true);
}

function numericDefault(def: ParamDef): number {
  return typeof def.default === 'number' ? def.default : 0;
}

function pickModelRecord<T>(record: Record<ModelId, T>, ids: ModelId[]): Partial<Record<ModelId, T>> {
  return Object.fromEntries(ids.map((id) => [id, record[id]])) as Partial<Record<ModelId, T>>;
}

function hashRoute(page: PageId): string {
  return page === 'dispersion' ? '#/' : `#/${page}`;
}

function isScope(input: unknown): input is ShareScope {
  return input === 'page' || input === 'app';
}

function isPageId(input: unknown): input is PageId {
  return typeof input === 'string' && PAGE_IDS.includes(input as PageId);
}

function isModelId(input: unknown): input is ModelId {
  return typeof input === 'string' && MODEL_IDS.includes(input as ModelId);
}

function isSweepModelId(input: unknown): input is SweepModelId {
  return input === 'Macrospin' || isModelId(input);
}

function isKUnitId(input: unknown): input is KUnitId {
  return typeof input === 'string' && K_UNIT_IDS.has(input as KUnitId);
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
}
