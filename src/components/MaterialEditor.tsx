import { MATERIAL_FIELDS, MATERIAL_PRESETS } from '../models/materials';
import type { MaterialValues } from '../models/types';
import { roundDisplay } from '../models/units';
import { useStore } from '../state/store';
import { FieldRow, inputClass, NumberInput } from './ui';

export function MaterialEditor({
  which = 1,
  excludeFields = [],
}: {
  which?: 1 | 2;
  /** Material fields to hide (e.g. Ku on the µBLS page, where it is unused). */
  excludeFields?: (keyof MaterialValues)[];
}) {
  const presetId = useStore((s) => (which === 1 ? s.materialPresetId : s.materialPresetId2));
  const material = useStore((s) => (which === 1 ? s.material : s.material2));
  const setMaterialPreset = useStore((s) => s.setMaterialPreset);
  const setMaterialValue = useStore((s) => s.setMaterialValue);
  const fields = MATERIAL_FIELDS.filter((f) => !excludeFields.includes(f.key));

  return (
    <div>
      <select
        className={`${inputClass} mb-3`}
        value={presetId}
        onChange={(e) => setMaterialPreset(e.target.value, which)}
        aria-label={which === 1 ? 'Material' : 'Material of layer 2'}
      >
        {MATERIAL_PRESETS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-x-3">
        {fields.map((f) => (
          <FieldRow key={f.key} label="" symbol={f.symbol} unit={f.unit} tooltip={f.tooltip}>
            <NumberInput
              value={roundDisplay(material[f.key] / f.toSI)}
              onChange={(v) => {
                if (v !== null) setMaterialValue(f.key, v * f.toSI, which);
              }}
            />
          </FieldRow>
        ))}
      </div>
    </div>
  );
}
