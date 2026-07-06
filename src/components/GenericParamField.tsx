import type { ParamDef } from '../models/types';
import { FieldRow, inputClass, NumberInput } from './ui';

/** Registry-driven form field decoupled from the model store binding. */
export function GenericParamField({
  def,
  value,
  onChange,
}: {
  def: ParamDef;
  value: number | string | null;
  onChange: (value: number | string | null) => void;
}) {
  if (def.kind === 'choice') {
    return (
      <FieldRow label={def.label} symbol={def.symbol} tooltip={def.tooltip}>
        <select
          className={inputClass}
          value={String(value ?? def.default ?? '')}
          onChange={(e) => {
            const raw = e.target.value;
            const choice = def.choices?.find((c) => String(c.value) === raw);
            onChange(choice ? choice.value : raw);
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
        onChange={onChange}
        placeholder={def.nullable ? def.nullLabel : undefined}
        min={def.min}
        max={def.max}
        step={def.step}
        nullable={def.nullable}
      />
    </FieldRow>
  );
}
