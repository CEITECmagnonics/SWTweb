/** Message protocol between the UI thread and the Pyodide worker. */
import type { BridgeResult, ComputeJob } from '../models/types';

export type EngineStage =
  | 'loading-pyodide'
  | 'loading-packages'
  | 'installing-swt'
  | 'ready';

export const STAGE_LABELS: Record<EngineStage, string> = {
  'loading-pyodide': 'Loading Python runtime (Pyodide)…',
  'loading-packages': 'Loading NumPy and SciPy…',
  'installing-swt': 'Installing SpinWaveToolkit…',
  ready: 'Ready',
};

/** Bridge functions callable from the UI (whitelist). */
export type BridgeFn = 'run_job' | 'run_sweep' | 'run_hysteresis' | 'run_bls';

export type WorkerRequest =
  | { type: 'init' }
  | { type: 'run'; id: number; fn?: BridgeFn; job: object };

export type WorkerResponse =
  | { type: 'status'; stage: EngineStage }
  | { type: 'ready'; swtVersion: string; pyodideVersion: string }
  | { type: 'init-error'; message: string }
  | { type: 'result'; id: number; payload: unknown }
  | { type: 'error'; id: number; message: string };

// Re-export for convenience of protocol consumers.
export type { BridgeResult, ComputeJob };
