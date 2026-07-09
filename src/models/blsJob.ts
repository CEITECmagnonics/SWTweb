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
  // Ku (surface anisotropy) is unused by the BLS calculation — keep it off the
  // µBLS path so it is neither sent to the bridge nor written to the notebook.
  const material = { ...input.material };
  delete (material as Partial<MaterialValues>).Ku;
  const config: BlsJob['config'] = {
    material,
    ...convertGroup(BLS_SW_PARAMS, input.values),
    ...convertGroup(BLS_STACK_PARAMS, input.values),
  };
  const optics = convertGroup(BLS_OPTICS_PARAMS, input.values);

  const method = String(config.method ?? 'GF');
  if (method === 'RT' && Number(config.coverEnabled) === 1) {
    throw new Error(
      'The reciprocity-theorem method supports only air / magnetic layer / substrate — disable the cover layer or use the Green-function method.',
    );
  }

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
    if (method === 'RT' && input.sweepKey === 'dCover') {
      throw new Error(
        'The cover thickness cannot be swept under the reciprocity-theorem method.',
      );
    }
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
