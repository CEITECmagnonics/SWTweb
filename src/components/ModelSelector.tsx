import { MODEL_LIST } from '../models/registry';
import type { ModelId } from '../models/types';
import { useStore } from '../state/store';
import { inputClass } from './ui';

export function ModelSelector() {
  const modelId = useStore((s) => s.modelId);
  const setModel = useStore((s) => s.setModel);
  const model = MODEL_LIST.find((m) => m.id === modelId)!;

  return (
    <div>
      <select
        className={inputClass}
        value={modelId}
        onChange={(e) => setModel(e.target.value as ModelId)}
        aria-label="Model"
      >
        {MODEL_LIST.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {model.info.summary}
      </p>
    </div>
  );
}
