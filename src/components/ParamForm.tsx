import { useState } from 'react';
import { GEOMETRY_PRESETS, getModel } from '../models/registry';
import type { ParamDef } from '../models/types';
import { useStore } from '../state/store';
import { SingleLayerTensorTools } from './SingleLayerTensorTools';
import { Button, FieldRow, inputClass, NumberInput } from './ui';

function ParamField({ def }: { def: ParamDef }) {
  const value = useStore((s) => s.paramValues[s.modelId][def.key]);
  const setParam = useStore((s) => s.setParam);

  if (def.kind === 'choice') {
    return (
      <FieldRow label={def.label} symbol={def.symbol} tooltip={def.tooltip}>
        <select
          className={inputClass}
          value={String(value ?? def.default ?? '')}
          onChange={(e) => {
            const raw = e.target.value;
            const choice = def.choices?.find((c) => String(c.value) === raw);
            setParam(def.key, choice ? choice.value : raw);
          }}
        >
          {def.choices?.map((c) => (
            <option key={String(c.value)} value={String(c.value)}>
              {c.label}
            </option>
          ))}
        </select>
      </FieldRow>
    );
  }

  return (
    <FieldRow label={def.label} symbol={def.symbol} unit={def.unit} tooltip={def.tooltip}>
      <NumberInput
        value={typeof value === 'number' ? value : value === null ? null : Number(value)}
        onChange={(v) => setParam(def.key, v)}
        placeholder={def.nullable ? def.nullLabel : undefined}
        min={def.min}
        max={def.max}
        step={def.step}
        nullable={def.nullable}
      />
    </FieldRow>
  );
}

export function ParamForm({ exclude = [] }: { exclude?: string[] }) {
  const modelId = useStore((s) => s.modelId);
  const applyGeometry = useStore((s) => s.applyGeometry);
  const theta = useStore((s) => s.paramValues[s.modelId]['theta']);
  const phi = useStore((s) => s.paramValues[s.modelId]['phi']);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const model = getModel(modelId);

  const allParams = [...model.params, ...(model.methodParams ?? [])].filter(
    (p) => !exclude.includes(p.key),
  );
  const basic = allParams.filter((p) => !p.advanced);
  const advanced = allParams.filter((p) => p.advanced);

  return (
    <div>
      {model.geometryPresets && (
        <div className="mb-3">
          <span className="mb-1 block text-xs text-slate-600 dark:text-slate-400">
            Geometry preset
          </span>
          <div className="flex flex-wrap gap-1.5">
            {model.geometryPresets.map((g) => {
              const preset = GEOMETRY_PRESETS[g];
              const active = theta === preset.theta && phi === preset.phi;
              return (
                <Button
                  key={g}
                  variant={active ? 'primary' : 'secondary'}
                  title={preset.tooltip}
                  onClick={() => applyGeometry(preset.theta, preset.phi)}
                  className="!px-2 !py-1 text-xs"
                >
                  {preset.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-3">
        {basic.map((p) => (
          <ParamField key={p.key} def={p} />
        ))}
      </div>
      {advanced.length > 0 && (
        <>
          <button
            type="button"
            className="mb-2 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '▾ Hide advanced parameters' : '▸ Show advanced parameters'}
          </button>
          {showAdvanced && (
            <div className="grid grid-cols-2 gap-x-3">
              {advanced.map((p) => (
                <ParamField key={p.key} def={p} />
              ))}
              {model.id === 'SingleLayer' && <SingleLayerTensorTools />}
            </div>
          )}
        </>
      )}
    </div>
  );
}
