import { STAGE_LABELS } from '../pyodide/protocol';
import { useStore } from '../state/store';

/** Status banner shown while the Python engine boots (one-time ~15 MB download). */
export function EngineStatusBanner() {
  const status = useStore((s) => s.engineStatus);
  const stage = useStore((s) => s.engineStage);
  const error = useStore((s) => s.engineError);

  if (status === 'ready' || status === 'computing') return null;

  if (status === 'error') {
    return (
      <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
        Failed to start the Python engine: {error}{' '}
        <button className="underline" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      <span>
        {stage ? STAGE_LABELS[stage] : 'Starting…'}{' '}
        <span className="text-blue-500 dark:text-blue-400">
          (first visit downloads the Python runtime, ~15 MB)
        </span>
      </span>
    </div>
  );
}
