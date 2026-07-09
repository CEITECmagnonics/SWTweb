import { useStore, type DashStyle } from '../state/store';
import { Button, inputClass } from './ui';

const DASHES: DashStyle[] = ['solid', 'dash', 'dot', 'dashdot'];

/** One row in the trace list: a stable id, display label, tooltip, and style. */
export interface TraceRow {
  id: string;
  label: string;
  tooltip: string;
  color: string;
  dash: DashStyle;
  visible: boolean;
}

/**
 * Presentational trace manager: visibility, colors, styles, deletion. Shared by
 * the dispersion page (`TraceList`) and the µBLS page so both stay in sync.
 */
export function TraceListView({
  rows,
  onUpdate,
  onRemove,
  onClear,
}: {
  rows: TraceRow[];
  onUpdate: (id: string, patch: { color?: string; dash?: DashStyle; visible?: boolean }) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Traces</h3>
        <Button variant="danger" onClick={onClear} title="Remove all computed results">
          Clear all
        </Button>
      </div>
      <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {rows.map((t) => (
          <li key={t.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={t.visible}
              onChange={() => onUpdate(t.id, { visible: !t.visible })}
              className="accent-blue-600"
              title="Show/hide this trace"
            />
            <input
              type="color"
              value={t.color}
              onChange={(e) => onUpdate(t.id, { color: e.target.value })}
              className="h-6 w-6 cursor-pointer rounded border border-slate-300 bg-transparent dark:border-slate-700"
              title="Line color"
            />
            <select
              value={t.dash}
              onChange={(e) => onUpdate(t.id, { dash: e.target.value as DashStyle })}
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
              title={t.tooltip}
            >
              {t.label}
            </span>
            <button
              type="button"
              onClick={() => onRemove(t.id)}
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

/** Manage the dispersion page's computed traces (store-connected). */
export function TraceList() {
  const traces = useStore((s) => s.traces);
  const updateTrace = useStore((s) => s.updateTrace);
  const removeTrace = useStore((s) => s.removeTrace);
  const clearResults = useStore((s) => s.clearResults);

  const rows: TraceRow[] = traces.map((t) => ({
    id: t.id,
    label: `${t.runLabel} · ${t.quantityLabel}${t.modeLabel ? ` · ${t.modeLabel}` : ''}`,
    tooltip: `${t.runLabel} — ${t.quantityLabel}${t.modeLabel ? ` (${t.modeLabel})` : ''}\n${Object.entries(
      t.provenance.paramsDisplay,
    )
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')}`,
    color: t.color,
    dash: t.dash,
    visible: t.visible,
  }));

  return (
    <TraceListView rows={rows} onUpdate={updateTrace} onRemove={removeTrace} onClear={clearResults} />
  );
}
