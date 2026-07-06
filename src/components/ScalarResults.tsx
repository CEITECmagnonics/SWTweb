import { formatValue } from '../models/units';
import { useStore } from '../state/store';

/** Cards showing scalar results (exchange length, threshold fields, angles…). */
export function ScalarResults() {
  const scalars = useStore((s) => s.scalars);
  if (scalars.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 border-t border-slate-200 p-3 dark:border-slate-800">
      {scalars.map((sc) => (
        <div
          key={sc.id}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-800"
          title={sc.runLabel}
        >
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {sc.runLabel} · {sc.label}
          </div>
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            {formatValue(sc.value)} {sc.unit}
          </div>
        </div>
      ))}
    </div>
  );
}
