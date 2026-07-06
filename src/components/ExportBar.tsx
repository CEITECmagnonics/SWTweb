import { useState } from 'react';
import { tracesToCsv, resultsToJson } from '../export/csv';
import { downloadImage, copyImageToClipboard } from '../export/image';
import { downloadText, timestampSlug } from '../export/download';
import { generateNotebook } from '../notebook/generateNotebook';
import { buildJob, describeParams } from '../models/job';
import { getModel } from '../models/registry';
import { useStore } from '../state/store';
import { Button } from './ui';

export function ExportBar({
  getPlotDiv,
  activeQuantity,
}: {
  getPlotDiv: () => HTMLElement | null;
  activeQuantity: string | null;
}) {
  const [message, setMessage] = useState<string | null>(null);

  const flash = (text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage(null), 2500);
  };

  const guard = async (fn: () => Promise<void> | void) => {
    try {
      await fn();
    } catch (err) {
      flash(err instanceof Error ? err.message : String(err));
    }
  };

  const exportImage = (format: 'png' | 'svg') =>
    guard(async () => {
      const gd = getPlotDiv();
      if (!gd) return;
      await downloadImage(gd, format, `swtweb-${activeQuantity ?? 'plot'}-${timestampSlug()}.${format}`);
    });

  const copyToClipboard = () =>
    guard(async () => {
      const gd = getPlotDiv();
      if (!gd) return;
      await copyImageToClipboard(gd);
      flash('Plot copied to clipboard ✓');
    });

  const exportCsv = () =>
    guard(() => {
      const { traces, swtVersion } = useStore.getState();
      const visible = traces.filter((t) => t.visible && t.quantityId === activeQuantity);
      const target = visible.length > 0 ? visible : traces.filter((t) => t.visible);
      if (target.length === 0) {
        flash('No visible traces to export.');
        return;
      }
      downloadText(`swtweb-data-${timestampSlug()}.csv`, tracesToCsv(target, swtVersion), 'text/csv');
    });

  const exportJson = () =>
    guard(() => {
      const { traces, scalars, swtVersion } = useStore.getState();
      const visible = traces.filter((t) => t.visible);
      if (visible.length === 0 && scalars.length === 0) {
        flash('Nothing to export yet.');
        return;
      }
      downloadText(
        `swtweb-data-${timestampSlug()}.json`,
        resultsToJson(visible, scalars, swtVersion),
        'application/json',
      );
    });

  const exportNotebook = () =>
    guard(() => {
      const s = useStore.getState();
      const model = getModel(s.modelId);
      const job = buildJob({
        modelId: s.modelId,
        material: s.material,
        material2: model.hasSecondMaterial ? s.material2 : undefined,
        paramValues: s.paramValues[s.modelId],
        kRange: s.kRanges[s.modelId],
        modes: s.modes[s.modelId],
        nT: s.nT,
        quantityIds: s.selectedQuantities[s.modelId],
      });
      const ipynb = generateNotebook({
        modelId: s.modelId,
        materialPresetId: s.materialPresetId,
        material: s.material,
        materialPresetId2: model.hasSecondMaterial ? s.materialPresetId2 : undefined,
        material2: model.hasSecondMaterial ? s.material2 : undefined,
        job,
        paramsDisplay: describeParams(s.modelId, s.paramValues[s.modelId]),
        swtVersion: s.swtVersion,
      });
      downloadText(`swtweb-${s.modelId}-${timestampSlug()}.ipynb`, ipynb, 'application/x-ipynb+json');
      flash('Notebook generated ✓ — it reproduces the current setup.');
    });

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-3 py-2.5 dark:border-slate-800">
      <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Export
      </span>
      <Button onClick={() => exportImage('png')} title="Download the plot as a PNG image">
        PNG
      </Button>
      <Button onClick={() => exportImage('svg')} title="Download the plot as an SVG vector image">
        SVG
      </Button>
      <Button onClick={copyToClipboard} title="Copy the plot image to the clipboard">
        Copy image
      </Button>
      <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
      <Button onClick={exportCsv} title="Download the visible traces of this tab as CSV (with parameters)">
        CSV
      </Button>
      <Button onClick={exportJson} title="Download all results incl. full provenance as JSON">
        JSON
      </Button>
      <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />
      <Button
        onClick={exportNotebook}
        title="Generate a Jupyter notebook that reproduces the current calculation with explanations"
      >
        Jupyter notebook
      </Button>
      {message && <span className="text-xs text-emerald-600 dark:text-emerald-400">{message}</span>}
    </div>
  );
}
