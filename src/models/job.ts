/**
 * Builds the SI job spec for the Pyodide worker from form state (display units),
 * using the model registry as the conversion table.
 */
import { getModel } from './registry';
import type { ComputeJob, KRange, MaterialValues, ModelId, ParamDef } from './types';

export type ParamValues = Record<string, number | string | null>;

function convertParam(def: ParamDef, value: number | string | null): number | string | null {
  if (value === null || value === '') {
    if (!def.nullable) throw new Error(`Parameter "${def.label}" is required.`);
    return def.nullBehavior === 'inf' ? 'inf' : null; // null → omitted
  }
  if (def.kind === 'choice') return value;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) throw new Error(`Parameter "${def.label}" is not a valid number.`);
  if (def.min !== undefined && num < def.min)
    throw new Error(`Parameter "${def.label}" must be ≥ ${def.min}.`);
  if (def.max !== undefined && num > def.max)
    throw new Error(`Parameter "${def.label}" must be ≤ ${def.max}.`);
  if (def.kind === 'int') return Math.round(num);
  return num * def.toSI;
}

function convertGroup(defs: ParamDef[], values: ParamValues): Record<string, number | string> {
  const out: Record<string, number | string> = {};
  for (const def of defs) {
    // A key that was never set falls back to the default; an explicitly
    // cleared (null) value must be validated, not silently replaced.
    const raw = def.key in values ? values[def.key] : def.default;
    const converted = convertParam(def, raw);
    if (converted !== null) out[def.key] = converted;
  }
  return out;
}

export interface JobInput {
  modelId: ModelId;
  material: MaterialValues;
  material2?: MaterialValues;
  paramValues: ParamValues;
  kRange: KRange;
  modes: number[];
  nT: number;
  quantityIds: string[];
}

export function buildJob(input: JobInput): ComputeJob {
  const model = getModel(input.modelId);
  const quantities = model.quantities.filter((q) => input.quantityIds.includes(q.id));
  if (quantities.length === 0) throw new Error('Select at least one quantity to compute.');
  if (input.kRange.points < 2) throw new Error('The k range needs at least 2 points.');
  if (input.kRange.max <= input.kRange.min) throw new Error('k max must be larger than k min.');

  const job: ComputeJob = {
    model: model.id,
    material: input.material,
    params: convertGroup(model.params, input.paramValues),
    kRange: input.kRange,
    modes: input.modes.length > 0 ? [...input.modes].sort((a, b) => a - b) : [0],
    nT: input.nT,
    quantities: quantities.map((q) => ({
      id: q.id,
      method: q.method,
      returns: q.returns,
      ...(q.modeArg ? { modeArg: q.modeArg } : {}),
      ...(q.kwargNames ? { kwargNames: q.kwargNames } : {}),
    })),
  };

  if (model.methodParams) {
    job.methodKwargs = convertGroup(model.methodParams, input.paramValues);
  }
  if (model.hasSecondMaterial && input.material2) {
    job.material2 = input.material2;
  }
  return job;
}

/** Human-readable parameter summary (display units) for provenance/exports. */
export function describeParams(modelId: ModelId, values: ParamValues): Record<string, string> {
  const model = getModel(modelId);
  const out: Record<string, string> = {};
  for (const def of [...model.params, ...(model.methodParams ?? [])]) {
    const v = values[def.key] ?? def.default;
    if (v === null || v === '') {
      out[def.label] = def.nullLabel ?? 'default';
    } else if (def.kind === 'choice') {
      out[def.label] = String(def.choices?.find((c) => c.value === v)?.label ?? v);
    } else {
      out[def.label] = `${v}${def.unit ? ` ${def.unit}` : ''}`;
    }
  }
  return out;
}
