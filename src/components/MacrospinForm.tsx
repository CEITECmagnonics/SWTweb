import { useState } from 'react';
import { MACROSPIN_PARAMS } from '../models/macrospin';
import { useStore } from '../state/store';
import { GenericParamField } from './GenericParamField';

/** Parameter form for the MacrospinEquilibrium pseudo-model. */
export function MacrospinForm({ exclude = [] }: { exclude?: string[] }) {
  const values = useStore((s) => s.macrospinValues);
  const setValue = useStore((s) => s.setMacrospinValue);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const params = MACROSPIN_PARAMS.filter((p) => !exclude.includes(p.key));
  const basic = params.filter((p) => !p.advanced);
  const advanced = params.filter((p) => p.advanced);

  return (
    <div>
      <div className="grid grid-cols-2 gap-x-3">
        {basic.map((def) => (
          <GenericParamField
            key={def.key}
            def={def}
            value={values[def.key] ?? def.default}
            onChange={(v) => setValue(def.key, v)}
          />
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
              {advanced.map((def) => (
                <GenericParamField
                  key={def.key}
                  def={def}
                  value={values[def.key] ?? def.default}
                  onChange={(v) => setValue(def.key, v)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
