/**
 * Typed, promise-based client for the Pyodide worker.
 *
 * Long-running jobs can be cancelled by terminating the worker; the engine
 * then boots a fresh worker so the app stays usable.
 */
import type {
  BlsJob,
  BlsResult,
  BridgeResult,
  ComputeJob,
  HystJob,
  HystResult,
  SweepJob,
  SweepResult,
} from '../models/types';
import type { BridgeFn, EngineStage, WorkerRequest, WorkerResponse } from './protocol';

export interface EngineCallbacks {
  onStage: (stage: EngineStage) => void;
  onReady: (info: { swtVersion: string; pyodideVersion: string }) => void;
  onInitError: (message: string) => void;
}

interface PendingJob {
  resolve: (r: never) => void;
  reject: (e: Error) => void;
}

export class SwtEngine {
  private worker: Worker | null = null;
  private callbacks: EngineCallbacks;
  private pending = new Map<number, PendingJob>();
  private nextId = 1;

  constructor(callbacks: EngineCallbacks) {
    this.callbacks = callbacks;
  }

  start(): void {
    if (this.worker) return;
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => this.handle(event.data);
    this.worker.onerror = (event) => {
      this.callbacks.onInitError(event.message || 'Worker failed to start.');
    };
    this.send({ type: 'init' });
  }

  run(job: ComputeJob): Promise<BridgeResult> {
    return this.call<BridgeResult>('run_job', job);
  }

  runSweep(job: SweepJob): Promise<SweepResult> {
    return this.call<SweepResult>('run_sweep', job);
  }

  runHysteresis(job: HystJob): Promise<HystResult> {
    return this.call<HystResult>('run_hysteresis', job);
  }

  runBls(job: BlsJob): Promise<BlsResult> {
    return this.call<BlsResult>('run_bls', job);
  }

  private call<T>(fn: BridgeFn, job: object): Promise<T> {
    if (!this.worker) return Promise.reject(new Error('Engine not started.'));
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (r: never) => void, reject });
      this.send({ type: 'run', id, fn, job });
    });
  }

  /** Terminate a running computation and boot a fresh worker. */
  cancel(): void {
    if (!this.worker) return;
    this.worker.terminate();
    this.worker = null;
    for (const { reject } of this.pending.values()) {
      reject(new Error('Computation cancelled.'));
    }
    this.pending.clear();
    this.start();
  }

  private send(msg: WorkerRequest): void {
    this.worker?.postMessage(msg);
  }

  private handle(msg: WorkerResponse): void {
    switch (msg.type) {
      case 'status':
        this.callbacks.onStage(msg.stage);
        break;
      case 'ready':
        this.callbacks.onReady({ swtVersion: msg.swtVersion, pyodideVersion: msg.pyodideVersion });
        break;
      case 'init-error':
        this.callbacks.onInitError(msg.message);
        break;
      case 'result': {
        this.pending.get(msg.id)?.resolve(msg.payload as never);
        this.pending.delete(msg.id);
        break;
      }
      case 'error': {
        this.pending.get(msg.id)?.reject(new Error(msg.message));
        this.pending.delete(msg.id);
        break;
      }
    }
  }
}
