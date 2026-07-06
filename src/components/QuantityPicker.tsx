import { getModel } from '../models/registry';
import { useStore } from '../state/store';
import { FieldRow, NumberInput } from './ui';

export function QuantityPicker() {
  const modelId = useStore((s) => s.modelId);
  const selected = useStore((s) => s.selectedQuantities[s.modelId]);
  const toggleQuantity = useStore((s) => s.toggleQuantity);
  const modes = useStore((s) => s.modes[s.modelId]);
  const setModes = useStore((s) => s.setModes);
  const nT = useStore((s) => s.nT);
  const setNT = useStore((s) => s.setNT);
  const nParam = useStore((s) => s.paramValues[s.modelId]['N']);
  const model = getModel(modelId);

  // For the numeric single-layer model, only the N lowest modes exist.
  const maxModes =
    model.id === 'SingleLayerNumeric'
      ? Math.max(1, Number(nParam ?? model.modes?.max ?? 1))
      : (model.modes?.max ?? 0);

  return (
    <div>
      <div className="space-y-1.5">
        {model.quantities.map((q) => (
          <label
            key={q.id}
            className="flex cursor-pointer items-start gap-2 text-sm"
            title={q.tooltip}
          >
            <input
              type="checkbox"
              className="mt-0.5 accent-blue-600"
              checked={selected.includes(q.id)}
              onChange={() => toggleQuantity(q.id)}
            />
            <span>
              {q.label}
              {q.unit && q.unit !== '–' && (
                <span className="ml-1 text-xs text-slate-400 dark:text-slate-500">({q.unit})</span>
              )}
            </span>
          </label>
        ))}
      </div>

      {model.modes && (
        <div className="mt-3">
          <span className="mb-1 block text-xs text-slate-600 dark:text-slate-400">
            {model.modes.label}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: maxModes }, (_, i) => i).map((n) => {
              const active = modes.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() =>
                    setModes(
                      active && modes.length > 1
                        ? modes.filter((m) => m !== n)
                        : active
                          ? modes
                          : [...modes, n],
                    )
                  }
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {model.id === 'SingleLayer' && (
        <div className="mt-2 w-1/2">
          <FieldRow
            label="Waveguide mode nT"
            tooltip="Transverse (waveguide-width) quantization number. 0 for plain films."
          >
            <NumberInput
              value={nT}
              min={0}
              max={5}
              step={1}
              onChange={(v) => v !== null && setNT(Math.round(v))}
            />
          </FieldRow>
        </div>
      )}
    </div>
  );
}
