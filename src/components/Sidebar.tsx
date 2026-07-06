import { getModel } from '../models/registry';
import { useStore } from '../state/store';
import { CitationBox } from './CitationBox';
import { KRangeInput } from './KRangeInput';
import { MaterialEditor } from './MaterialEditor';
import { ModelInfoPanel } from './ModelInfoPanel';
import { ModelSelector } from './ModelSelector';
import { ParamForm } from './ParamForm';
import { QuantityPicker } from './QuantityPicker';
import { Button, Section } from './ui';

export function Sidebar() {
  const modelId = useStore((s) => s.modelId);
  const engineStatus = useStore((s) => s.engineStatus);
  const computeError = useStore((s) => s.computeError);
  const compute = useStore((s) => s.compute);
  const cancelCompute = useStore((s) => s.cancelCompute);
  const model = getModel(modelId);

  const computing = engineStatus === 'computing';
  const ready = engineStatus === 'ready';

  return (
    <aside className="flex h-full w-full flex-col overflow-hidden border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title="Model">
          <ModelSelector />
        </Section>
        <ModelInfoPanel />
        <Section title={model.hasSecondMaterial ? 'Material — layer 1' : 'Material'}>
          <MaterialEditor which={1} />
        </Section>
        {model.hasSecondMaterial && (
          <Section title="Material — layer 2">
            <MaterialEditor which={2} />
          </Section>
        )}
        <Section title="Parameters">
          <ParamForm />
        </Section>
        <Section title="Wavevector range">
          <KRangeInput />
        </Section>
        <Section title="Quantities to compute">
          <QuantityPicker />
        </Section>
        <CitationBox />
      </div>

      <div className="border-t border-slate-200 p-3 dark:border-slate-800">
        {computeError && (
          <p className="mb-2 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
            {computeError}
          </p>
        )}
        <div className="flex gap-2">
          <Button
            variant="primary"
            className="flex-1 !py-2"
            disabled={!ready}
            onClick={() => void compute()}
            title={ready ? 'Run the calculation' : 'The Python engine is still loading'}
          >
            {computing ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Computing…
              </span>
            ) : (
              'Compute'
            )}
          </Button>
          {computing && (
            <Button variant="danger" onClick={cancelCompute} title="Abort the running computation">
              Cancel
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
