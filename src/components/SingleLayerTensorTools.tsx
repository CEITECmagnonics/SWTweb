import { useMemo, useState } from 'react';
import {
  addMatrices,
  DEG,
  matrixFromValues,
  NA_MODE_KEY,
  ND_MODE_KEY,
  sphereDemagTensor,
  tensorEntries,
  tensorKey,
  thinFilmDemagTensor,
  TENSOR_AXES,
  type Matrix3,
  uniaxialAnisotropyTensor,
  zeroTensor,
} from '../models/tensors';
import { useStore } from '../state/store';
import { Button, FieldRow, inputClass, NumberInput } from './ui';

function TensorEditor({
  label,
  prefix,
  matrix,
  enabled,
  onEnable,
  onSetEntry,
}: {
  label: string;
  prefix: 'Nd' | 'Na';
  matrix: Matrix3;
  enabled: boolean;
  onEnable: () => void;
  onSetEntry: (axis: (typeof TENSOR_AXES)[number], value: number) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
        {!enabled && (
          <button
            type="button"
            className="text-xs text-blue-600 hover:underline dark:text-blue-400"
            onClick={onEnable}
          >
            edit custom
          </button>
        )}
      </div>
      <div className={`grid grid-cols-3 gap-1 ${enabled ? '' : 'opacity-50'}`}>
        {TENSOR_AXES.map((axis, index) => {
          const row = Math.floor(index / 3);
          const col = index % 3;
          return (
            <input
              key={axis}
              type="number"
              className={`${inputClass} !px-1.5 !py-1 text-xs`}
              value={Number(matrix[row][col].toPrecision(8))}
              step="0.001"
              title={`${prefix}_${axis}`}
              disabled={!enabled}
              onChange={(e) => {
                const value = Number(e.target.value);
                if (Number.isFinite(value)) onSetEntry(axis, value);
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export function SingleLayerTensorTools() {
  const values = useStore((s) => s.paramValues.SingleLayer);
  const material = useStore((s) => s.material);
  const setParam = useStore((s) => s.setParam);
  const [ku, setKu] = useState(0);
  const [uniTheta, setUniTheta] = useState(90);
  const [uniPhi, setUniPhi] = useState(90);

  const ndEnabled = values[ND_MODE_KEY] === 'custom';
  const naEnabled = values[NA_MODE_KEY] === 'custom';
  const nd = useMemo(() => matrixFromValues(values, 'Nd', thinFilmDemagTensor()), [values]);
  const na = useMemo(() => matrixFromValues(values, 'Na', zeroTensor()), [values]);

  const setMode = (key: string, enabled: boolean) => setParam(key, enabled ? 'custom' : 'default');
  const setTensor = (prefix: 'Nd' | 'Na', matrix: Matrix3) => {
    setParam(prefix === 'Nd' ? ND_MODE_KEY : NA_MODE_KEY, 'custom');
    for (const [key, value] of Object.entries(tensorEntries(prefix, matrix))) {
      setParam(key, value);
    }
  };
  const setEntry = (prefix: 'Nd' | 'Na', axis: (typeof TENSOR_AXES)[number], value: number) => {
    setParam(prefix === 'Nd' ? ND_MODE_KEY : NA_MODE_KEY, 'custom');
    setParam(tensorKey(prefix, axis), value);
  };
  const applyUniaxial = (mode: 'replace' | 'add') => {
    const generated = uniaxialAnisotropyTensor(material, ku * 1e3, uniTheta * DEG, uniPhi * DEG);
    setTensor('Na', mode === 'add' ? addMatrices(na, generated) : generated);
  };

  return (
    <div className="col-span-2 mt-2 space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          SingleLayer tensors
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Tensors are dimensionless and defined in the lab frame: z is the film normal, x is the
          in-plane wavevector direction. Leaving them disabled uses SWT defaults.
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          <Button className="!px-2 !py-1 text-xs" onClick={() => setMode(ND_MODE_KEY, false)}>
            Default Nd
          </Button>
          <Button
            className="!px-2 !py-1 text-xs"
            onClick={() => setTensor('Nd', thinFilmDemagTensor())}
            title="Infinite thin film in the xy plane: diag(0, 0, 1)."
          >
            Thin film Nd
          </Button>
          <Button className="!px-2 !py-1 text-xs" onClick={() => setTensor('Nd', sphereDemagTensor())}>
            Sphere Nd
          </Button>
          <Button className="!px-2 !py-1 text-xs" onClick={() => setTensor('Nd', zeroTensor())}>
            Zero Nd
          </Button>
        </div>
        <TensorEditor
          label="Demagnetizing tensor Nd"
          prefix="Nd"
          matrix={nd}
          enabled={ndEnabled}
          onEnable={() => setMode(ND_MODE_KEY, true)}
          onSetEntry={(axis, value) => setEntry('Nd', axis, value)}
        />
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          <Button className="!px-2 !py-1 text-xs" onClick={() => setMode(NA_MODE_KEY, false)}>
            No Na
          </Button>
          <Button className="!px-2 !py-1 text-xs" onClick={() => setTensor('Na', zeroTensor())}>
            Zero Na
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-x-3 rounded-md border border-slate-200 p-2 dark:border-slate-800">
          <FieldRow
            label="Uniaxial Ku"
            unit="kJ/m3"
            tooltip="Positive Ku gives an easy axis along the selected anisotropy direction."
          >
            <NumberInput value={ku} onChange={(v) => v !== null && setKu(v)} step={0.1} />
          </FieldRow>
          <FieldRow label="Axis polar angle" unit="deg" tooltip="Polar angle of the uniaxial axis.">
            <NumberInput value={uniTheta} onChange={(v) => v !== null && setUniTheta(v)} step={1} />
          </FieldRow>
          <FieldRow
            label="Axis azimuth"
            unit="deg"
            tooltip="Azimuth of the uniaxial axis measured from the wavevector direction."
          >
            <NumberInput value={uniPhi} onChange={(v) => v !== null && setUniPhi(v)} step={1} />
          </FieldRow>
          <div className="mb-2 flex items-end gap-1.5">
            <Button className="!px-2 !py-1 text-xs" onClick={() => applyUniaxial('replace')}>
              Replace Na
            </Button>
            <Button className="!px-2 !py-1 text-xs" onClick={() => applyUniaxial('add')}>
              Add to Na
            </Button>
          </div>
        </div>

        <TensorEditor
          label="Anisotropy tensor Na"
          prefix="Na"
          matrix={na}
          enabled={naEnabled}
          onEnable={() => setMode(NA_MODE_KEY, true)}
          onSetEntry={(axis, value) => setEntry('Na', axis, value)}
        />
      </div>
    </div>
  );
}
