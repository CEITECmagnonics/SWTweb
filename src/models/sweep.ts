/**
 * Builders for parameter-sweep and hysteresis jobs (display units → SI),
 * driven by the model registry and the macrospin definition.
 */
import { buildJob, convertGroup, type ParamValues } from './job';
import { MACROSPIN_PARAMS, MACROSPIN_SWEEPABLE } from './macrospin';
import { getModel } from './registry';
import type {
  HystJob,
  KRange,
  MaterialValues,
  ModelId,
  ParamDef,
  SweepJob,
  SweepModelId,
} from './types';

/** Numeric, non-nullable parameters that can be swept for a given model. */
export function sweepableParams(modelId: SweepModelId): ParamDef[] {
  if (modelId === 'Macrospin') {
    return MACROSPIN_PARAMS.filter((p) => MACROSPIN_SWEEPABLE.includes(p.key));
  }
  const model = getModel(modelId);
  return [...model.params, ...(model.methodParams ?? [])].filter(
    (p) => (p.kind === 'number' || p.kind === 'angle') && !p.nullable,
  );
}

/** Sensible default sweep range (display units) for a parameter. */
export function defaultSweepRange(def: ParamDef): { from: number; to: number; points: number } {
  const points = 51;
  if (def.key === 'Bext') return { from: 0, to: 200, points };
  if (def.kind === 'angle') {
    return { from: def.min ?? 0, to: def.max ?? 180, points };
  }
  const base = typeof def.default === 'number' ? def.default : 1;
  if (base === 0) return { from: 0, to: 1, points };
  return { from: Math.min(base * 0.2, base * 2), to: Math.max(base * 0.2, base * 2), points };
}

export function sweepValuesSI(def: ParamDef, from: number, to: number, points: number): number[] {
  if (!Number.isFinite(from) || !Number.isFinite(to)) throw new Error('Invalid sweep range.');
  if (points < 2 || points > 1001) throw new Error('Sweep needs between 2 and 1001 points.');
  const n = Math.round(points);
  const values: number[] = [];
  for (let i = 0; i < n; i++) {
    values.push((from + ((to - from) * i) / (n - 1)) * def.toSI);
  }
  return values;
}

export interface SweepInput {
  modelId: SweepModelId;
  material: MaterialValues;
  material2?: MaterialValues;
  /** SWT-model form values (display units) */
  paramValues: ParamValues;
  /** Macrospin form values (display units) */
  macrospinValues: ParamValues;
  sweepKey: string;
  from: number;
  to: number;
  points: number;
  mode: 'fixedK' | 'map';
  /** display, rad/µm */
  kFixed: number;
  kRange: KRange;
  quantityId: string;
  modes: number[];
  nT: number;
  relax: boolean;
}

export function buildSweepJob(input: SweepInput): SweepJob {
  const def = sweepableParams(input.modelId).find((p) => p.key === input.sweepKey);
  if (!def) throw new Error(`Parameter "${input.sweepKey}" is not sweepable for this model.`);
  const values = sweepValuesSI(def, input.from, input.to, input.points);

  if (input.modelId === 'Macrospin') {
    return {
      model: 'Macrospin',
      config: {
        Ms: input.material.Ms,
        ...convertGroup(MACROSPIN_PARAMS, input.macrospinValues),
      },
      sweep: { key: input.sweepKey, values },
      mode: 'fixedK',
    };
  }

  const model = getModel(input.modelId);
  const quantity = model.quantities.find((q) => q.id === input.quantityId);
  if (!quantity) throw new Error('Select a quantity to sweep.');
  if (quantity.returns === 'grid') throw new Error('2D quantities cannot be swept.');
  if (input.mode === 'map' && (quantity.returns === 'scalar' || quantity.returns === 'tuple_scalar')) {
    throw new Error('Scalar quantities have no k dependence — use the fixed-k mode.');
  }

  const base = buildJob({
    modelId: input.modelId,
    material: input.material,
    material2: model.hasSecondMaterial ? input.material2 : undefined,
    paramValues: input.paramValues,
    kRange: input.kRange,
    modes: input.modes,
    nT: input.nT,
    quantityIds: [input.quantityId],
  });

  return {
    model: input.modelId,
    material: base.material,
    ...(base.material2 ? { material2: base.material2 } : {}),
    params: base.params,
    ...(base.methodKwargs ? { methodKwargs: base.methodKwargs } : {}),
    quantities: base.quantities,
    modes: base.modes,
    nT: base.nT,
    sweep: { key: input.sweepKey, values },
    mode: input.mode,
    ...(input.mode === 'fixedK'
      ? { kFixed: Math.max(input.kFixed, 0) * 1e6 }
      : { kRange: input.kRange }),
    relax: input.relax && input.modelId === 'DoubleLayerNumeric',
  };
}

export interface HystInput {
  type: 'single' | 'double';
  material: MaterialValues;
  material2?: MaterialValues;
  macrospinValues: ParamValues;
  /** DoubleLayerNumeric form values (display units) */
  doubleLayerValues: ParamValues;
  /** display, mT */
  Bmax: number;
  points: number;
}

export function buildHystJob(input: HystInput): HystJob {
  if (!(input.Bmax > 0)) throw new Error('B max must be positive.');
  if (input.points < 3 || input.points > 2001) {
    throw new Error('Hysteresis needs between 3 and 2001 points per branch.');
  }
  const BmaxSI = input.Bmax * 1e-3;

  if (input.type === 'single') {
    return {
      type: 'single',
      config: {
        Ms: input.material.Ms,
        ...convertGroup(MACROSPIN_PARAMS, input.macrospinValues),
      },
      Bmax: BmaxSI,
      points: Math.round(input.points),
    };
  }

  const model = getModel('DoubleLayerNumeric' as ModelId);
  return {
    type: 'double',
    material: input.material,
    ...(input.material2 ? { material2: input.material2 } : {}),
    params: convertGroup(model.params, input.doubleLayerValues),
    Bmax: BmaxSI,
    points: Math.round(input.points),
  };
}
