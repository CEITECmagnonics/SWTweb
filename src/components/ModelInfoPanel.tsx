import { getModel } from '../models/registry';
import { useStore } from '../state/store';
import { Formula, Section } from './ui';

/** Explains the physics and reference of the selected model. */
export function ModelInfoPanel() {
  const modelId = useStore((s) => s.modelId);
  const model = getModel(modelId);

  return (
    <Section title="About this model" defaultOpen={false}>
      <div className="space-y-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
        {model.info.details.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
        {model.info.formulas?.map((f, i) => (
          <div key={i} className="rounded-md bg-slate-100 px-2 py-1 dark:bg-slate-800">
            <Formula latex={f.latex} display />
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{f.caption}</p>
          </div>
        ))}
        <div>
          <span className="font-semibold">References:</span>
          <ul className="mt-1 list-inside list-disc">
            {model.info.references.map((r) => (
              <li key={r.url}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-blue-600 hover:underline dark:text-blue-400"
                >
                  {r.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
