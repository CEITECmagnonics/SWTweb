/// <reference lib="webworker" />
/**
 * Web worker hosting the Pyodide runtime and SpinWaveToolkit.
 *
 * Pyodide is loaded from the pinned jsDelivr CDN; SpinWaveToolkit and tqdm
 * are installed from wheels vendored in public/wheels (same origin), so the
 * scientific results are pinned to an exact, auditable package version.
 */
import bridgeSource from '../python/swt_bridge.py?raw';
import type { WorkerRequest, WorkerResponse } from './protocol';

export const PYODIDE_VERSION = '0.28.2';
const PYODIDE_CDN = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

export const SWT_WHEEL = 'spinwavetoolkit-1.3.0-py3-none-any.whl';
export const TQDM_WHEEL = 'tqdm-4.68.3-py3-none-any.whl';

interface PyodideLike {
  loadPackage(pkgs: string[]): Promise<void>;
  runPython(code: string): unknown;
  runPythonAsync(code: string): Promise<unknown>;
  globals: { get(name: string): (...args: unknown[]) => unknown };
  version: string;
}

const post = (msg: WorkerResponse) => self.postMessage(msg);

let pyodide: PyodideLike | null = null;
let runJob: ((jobJson: string) => string) | null = null;

async function init(): Promise<void> {
  post({ type: 'status', stage: 'loading-pyodide' });
  const mod = (await import(/* @vite-ignore */ `${PYODIDE_CDN}pyodide.mjs`)) as {
    loadPyodide(opts: { indexURL: string }): Promise<PyodideLike>;
  };
  pyodide = await mod.loadPyodide({ indexURL: PYODIDE_CDN });

  post({ type: 'status', stage: 'loading-packages' });
  await pyodide.loadPackage(['numpy', 'scipy', 'micropip']);

  post({ type: 'status', stage: 'installing-swt' });
  const wheelBase = new URL(import.meta.env.BASE_URL + 'wheels/', self.location.origin).href;
  await pyodide.runPythonAsync(`
import micropip
await micropip.install(
    ["${wheelBase}${TQDM_WHEEL}", "${wheelBase}${SWT_WHEEL}"],
    deps=False,
)
`);

  pyodide.runPython(bridgeSource);
  runJob = pyodide.globals.get('run_job') as (jobJson: string) => string;
  const getVersion = pyodide.globals.get('get_version') as () => string;

  post({
    type: 'ready',
    swtVersion: String(getVersion()),
    pyodideVersion: pyodide.version,
  });
}

self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const msg = event.data;
  if (msg.type === 'init') {
    try {
      await init();
    } catch (err) {
      post({ type: 'init-error', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }
  if (msg.type === 'run') {
    if (!runJob) {
      post({ type: 'error', id: msg.id, message: 'Engine is not ready yet.' });
      return;
    }
    try {
      const resultJson = runJob(JSON.stringify(msg.job));
      post({ type: 'result', id: msg.id, payload: JSON.parse(resultJson) });
    } catch (err) {
      post({ type: 'error', id: msg.id, message: err instanceof Error ? err.message : String(err) });
    }
  }
};
