import { K_UNITS, type KUnitId } from '../models/units';
import { useStore } from '../state/store';
import { FieldRow, inputClass, NumberInput, Section } from './ui';

/** Graph appearance settings: titles, axes, units, legend, fonts. */
export function PlotCustomization() {
  const settings = useStore((s) => s.plotSettings);
  const setPlotSettings = useStore((s) => s.setPlotSettings);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <Section title="Graph customization" defaultOpen={false}>
        <FieldRow label="Title" tooltip="Custom plot title. Leave empty for the automatic title.">
          <input
            type="text"
            className={inputClass}
            value={settings.title}
            placeholder="automatic"
            onChange={(e) => setPlotSettings({ title: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="X axis label" tooltip="Custom x-axis label. Leave empty for the automatic label.">
          <input
            type="text"
            className={inputClass}
            value={settings.xLabel}
            placeholder="automatic"
            onChange={(e) => setPlotSettings({ xLabel: e.target.value })}
          />
        </FieldRow>
        <FieldRow label="Y axis label" tooltip="Custom y-axis label. Leave empty for the automatic label.">
          <input
            type="text"
            className={inputClass}
            value={settings.yLabel}
            placeholder="automatic"
            onChange={(e) => setPlotSettings({ yLabel: e.target.value })}
          />
        </FieldRow>
        <div className="grid grid-cols-2 gap-x-3">
          <FieldRow label="X axis unit" tooltip="Unit of the wavenumber/wavelength axis.">
            <select
              className={inputClass}
              value={settings.xUnit}
              onChange={(e) => setPlotSettings({ xUnit: e.target.value as KUnitId })}
            >
              {K_UNITS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Font size" tooltip="Base font size of the plot (px).">
            <NumberInput
              value={settings.fontSize}
              min={8}
              max={28}
              step={1}
              onChange={(v) => v !== null && setPlotSettings({ fontSize: v })}
            />
          </FieldRow>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1.5 text-sm">
          {(
            [
              ['logX', 'Logarithmic x axis'],
              ['logY', 'Logarithmic y axis'],
              ['showLegend', 'Show legend'],
              ['showGrid', 'Show grid'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                className="accent-blue-600"
                checked={settings[key]}
                onChange={(e) => setPlotSettings({ [key]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      </Section>
    </div>
  );
}
