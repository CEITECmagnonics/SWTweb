import { roundDisplay } from '../models/units';
import { useStore } from '../state/store';
import { FieldRow, inputClass, NumberInput } from './ui';

/**
 * k-range editor. Film models are most naturally edited in rad/µm, the
 * bulk-polariton model in rad/m — the unit toggle converts on the fly
 * (values are stored in SI rad/m).
 */
export function KRangeInput() {
  const kRange = useStore((s) => s.kRanges[s.modelId]);
  const modelId = useStore((s) => s.modelId);
  const setKRange = useStore((s) => s.setKRange);

  // BulkPolariton lives at k ~ 1e3 rad/m; films at ~1e7 rad/m.
  const useRadPerUm = modelId !== 'BulkPolariton';
  const factor = useRadPerUm ? 1e-6 : 1;
  const unit = useRadPerUm ? 'rad/µm' : 'rad/m';

  return (
    <div>
      <div className="grid grid-cols-2 gap-x-3">
        <FieldRow label="k min" unit={unit} tooltip="Smallest wavenumber of the sweep.">
          <NumberInput
            value={roundDisplay(kRange.min * factor)}
            onChange={(v) => v !== null && setKRange({ min: v / factor })}
          />
        </FieldRow>
        <FieldRow label="k max" unit={unit} tooltip="Largest wavenumber of the sweep.">
          <NumberInput
            value={roundDisplay(kRange.max * factor)}
            onChange={(v) => v !== null && setKRange({ max: v / factor })}
          />
        </FieldRow>
        <FieldRow label="Points" tooltip="Number of k values. More points = smoother curves but slower computation.">
          <NumberInput
            value={kRange.points}
            min={2}
            max={2000}
            step={1}
            onChange={(v) => v !== null && setKRange({ points: Math.round(v) })}
          />
        </FieldRow>
        <FieldRow label="Spacing" tooltip="Linear or logarithmic distribution of k points.">
          <select
            className={inputClass}
            value={kRange.spacing}
            onChange={(e) => setKRange({ spacing: e.target.value as 'linear' | 'log' })}
          >
            <option value="linear">linear</option>
            <option value="log">logarithmic</option>
          </select>
        </FieldRow>
      </div>
    </div>
  );
}
