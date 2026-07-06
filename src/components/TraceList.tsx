import { useStore, type DashStyle } from '../state/store';
import { Button, inputClass } from './ui';

const DASHES: DashStyle[] = ['solid', 'dash', 'dot', 'dashdot'];

/** Manage computed traces: visibility, colors, styles, deletion. */
export function TraceList() {
  const traces = useStore((s) => s.traces);
  const updateTrace = useStore((s) => s.updateTrace);
  const removeTrace = useStore((s) => s.removeTrace);
  const clearResults = useStore((s) => s.clearResults);

  if (traces.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Traces</h3>
        <Button variant="danger" onClick={clearResults} title="Remove all computed results">
          Clear all
        </Button>
      </div>
      <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {traces.map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={t.visible}
              onChange={() => updateTrace(t.id, { visible: !t.visible })}
              className="accent-blue-600"
              title="Show/hide this trace"
            />
            <input
              type="color"
              value={t.color}
              onChange={(e) => updateTrace(t.id, { color: e.target.value })}
              className="h-6 w-6 cursor-pointer rounded border border-slate-300 bg-transparent dark:border-slate-700"
              title="Line color"
            />
            <select
              value={t.dash}
              onChange={(e) => updateTrace(t.id, { dash: e.target.value as DashStyle })}
              className={`${inputClass} !w-20 !px-1`}
              title="Line style"
            >
              {DASHES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <span
              className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300"
              title={`${t.runLabel} — ${t.quantityLabel}${t.modeLabel ? ` (${t.modeLabel})` : ''}\n${Object.entries(
                t.provenance.paramsDisplay,
              )
                .map(([k, v]) => `${k}: ${v}`)
                .join('\n')}`}
            >
              {t.runLabel} · {t.quantityLabel}
              {t.modeLabel ? ` · ${t.modeLabel}` : ''}
            </span>
            <button
              type="button"
              onClick={() => removeTrace(t.id)}
              className="text-slate-400 hover:text-red-500"
              title="Delete trace"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
