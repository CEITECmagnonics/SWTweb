/** Builder for µBLS jobs (display units → SI), plus sweep range helpers. */
import {
  BLS_OPTICS_PARAMS,
  BLS_STACK_PARAMS,
  BLS_SW_PARAMS,
  BLS_THERMAL_PARAMS,
  blsSweepableParams,
  type BlsMode,
} from './bls';
import { convertGroup, type ParamValues } from './job';
import { sweepValuesSI } from './sweep';
import type { BlsJob, MaterialValues, ParamDef } from './types';

export interface BlsInput {
  mode: BlsMode;
  material: MaterialValues;
  values: ParamValues;
  sweepEnabled: boolean;
  sweepKey: string;
  sweepFrom: number;
  sweepTo: number;
  sweepPoints: number;
}

/** Default sweep range (display units) for a BLS-sweepable parameter. */
export function blsDefaultSweepRange(def: ParamDef): { from: number; to: number; points: number } {
  const points = 9; // each step is a full spectrum (~10 s) — keep sweeps short
  switch (def.key) {
    case 'Bext':
      return { from: 10, to: 250, points };
    case 'd':
      return { from: 10, to: 60, points };
    case 'NA':
      return { from: 0.2, to: 1.0, points };
    case 'wavelength':
      return { from: 450, to: 650, points };
    case 'dCover':
      return { from: 0, to: 200, points };
    case 'temp':
      return { from: 100, to: 400, points };
    default: {
      const base = typeof def.default === 'number' ? def.default : 1;
      return { from: base * 0.5, to: base * 1.5, points };
    }
  }
}

export function buildBlsJob(input: BlsInput): BlsJob {
  const config: BlsJob['config'] = {
    material: input.material,
    ...convertGroup(BLS_SW_PARAMS, input.values),
    ...convertGroup(BLS_STACK_PARAMS, input.values),
  };
  const optics = convertGroup(BLS_OPTICS_PARAMS, input.values) as Record<string, number>;

  // thermal
  const thermal = convertGroup(BLS_THERMAL_PARAMS, input.values);
  config.fAuto = Number(thermal.fAuto) === 1 ? 1 : 0;
  config.fMin = thermal.fMin;
  config.fMax = thermal.fMax;
  config.nF = thermal.nF;
  config.nK = thermal.nK;
  config.nQ = thermal.nQ;
  if (Number(config.fAuto) === 0 && Number(config.fMax) <= Number(config.fMin)) {
    throw new Error('f max must be larger than f min.');
  }

  const job: BlsJob = { task: 'thermal', config, optics };
  if (input.sweepEnabled) {
    const def = blsSweepableParams().find((p) => p.key === input.sweepKey);
    if (!def) throw new Error(`Parameter "${input.sweepKey}" cannot be swept here.`);
    if (input.sweepPoints > 51) throw new Error('BLS sweeps are limited to 51 steps (each step is a full spectrum).');
    job.sweep = {
      key: input.sweepKey,
      values: sweepValuesSI(def, input.sweepFrom, input.sweepTo, input.sweepPoints),
    };
  }
  return job;
}
