import { useMemo, useRef, useState } from 'react';
import type Plotly from 'plotly.js-dist-min';
import { useStore } from '../state/store';
import { downloadImage, copyImageToClipboard } from '../export/image';
import { downloadText, timestampSlug } from '../export/download';
import { Button } from './ui';
import { PlotlyChart } from './PlotlyChart';

export interface SimpleSeries {
  name: string;
  x: number[];
  y: (number | null)[];
  color?: string;
  dash?: 'solid' | 'dash' | 'dot' | 'dashdot';
}

export interface SimpleHeatmap {
  x: number[];
  y: number[];
  z: (number | null)[][];
  colorLabel: string;
}

/**
 * Generic plot card for the sweep and hysteresis pages: line series or a
 * heatmap, log toggles, and a PNG/SVG/clipboard/CSV/notebook export bar.
 */
export function SimplePlot({
  title,
  xLabel,
  yLabel,
  series,
  heatmap,
  baseName,
  makeCsv,
  makeNotebook,
  emptyHint,
}: {
  title: string;
  xLabel: string;
  yLabel: string;
  series?: SimpleSeries[];
  heatmap?: SimpleHeatmap | null;
  baseName: string;
  makeCsv?: () => string | null;
  makeNotebook?: () => string | null;
  emptyHint: string;
}) {
  const theme = useStore((s) => s.theme);
  const divRef = useRef<HTMLDivElement | null>(null);
  const [logX, setLogX] = useState(false);
  const [logY, setLogY] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const hasData = (series && series.length > 0) || heatmap;

  const { data, layout } = useMemo(() => {
    const dark = theme === 'dark';
    const fg = dark ? '#cbd5e1' : '#334155';
    const grid = dark ? '#334155' : '#e2e8f0';
    const axis = { gridcolor: grid, zerolinecolor: grid, linecolor: fg, tickcolor: fg };
    const data: Plotly.Data[] = heatmap
      ? [
          {
            type: 'heatmap',
            x: heatmap.x,
            y: heatmap.y,
            z: heatmap.z,
            colorscale: 'Viridis',
            colorbar: { title: { text: heatmap.colorLabel } },
          } as unknown as Plotly.Data,
        ]
      : (series ?? []).map(
          (s) =>
            ({
              type: 'scatter',
              mode: 'lines',
              name: s.name,
              x: s.x,
              y: s.y,
              line: { color: s.color, dash: s.dash ?? 'solid', width: 2 },
            }) as Plotly.Data,
        );
    const layout: Partial<Plotly.Layout> = {
      title: { text: title, font: { size: 17 } },
      xaxis: { title: { text: xLabel }, type: logX ? 'log' : 'linear', ...axis },
      yaxis: { title: { text: yLabel }, type: logY ? 'log' : 'linear', ...axis },
      showlegend: !heatmap && (series?.length ?? 0) > 1,
      legend: { orientation: 'h', y: -0.18 },
      font: { size: 13, color: fg },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      margin: { t: 45, r: 20, b: 55, l: 70 },
    };
    return { data, layout };
  }, [series, heatmap, title, xLabel, yLabel, logX, logY, theme]);

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

  if (!hasData) {
    return (
      <div className="flex h-full min-h-[420px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-4 px-4 pt-3 text-sm">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" className="accent-blue-600" checked={logX} onChange={(e) => setLogX(e.target.checked)} />
          log x
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" className="accent-blue-600" checked={logY} onChange={(e) => setLogY(e.target.checked)} />
          log y
        </label>
      </div>
      <div className="p-2">
        <PlotlyChart data={data} layout={layout} divRef={divRef} />
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-3 py-2.5 dark:border-slate-800">
        <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Export
        </span>
        <Button
          onClick={() =>
            guard(async () => {
              if (divRef.current)
                await downloadImage(divRef.current, 'png', `${baseName}-${timestampSlug()}.png`);
            })
          }
        >
          PNG
        </Button>
        <Button
          onClick={() =>
            guard(async () => {
              if (divRef.current)
                await downloadImage(divRef.current, 'svg', `${baseName}-${timestampSlug()}.svg`);
            })
          }
        >
          SVG
        </Button>
        <Button
          onClick={() =>
            guard(async () => {
              if (divRef.current) {
                await copyImageToClipboard(divRef.current);
                flash('Plot copied to clipboard ✓');
              }
            })
          }
        >
          Copy image
        </Button>
        {makeCsv && (
          <Button
            onClick={() =>
              guard(() => {
                const csv = makeCsv();
                if (csv) downloadText(`${baseName}-${timestampSlug()}.csv`, csv, 'text/csv');
              })
            }
          >
            CSV
          </Button>
        )}
        {makeNotebook && (
          <Button
            title="Generate a Jupyter notebook that reproduces this calculation"
            onClick={() =>
              guard(() => {
                const nb = makeNotebook();
                if (nb) {
                  downloadText(`${baseName}-${timestampSlug()}.ipynb`, nb, 'application/x-ipynb+json');
                  flash('Notebook generated ✓');
                }
              })
            }
          >
            Jupyter notebook
          </Button>
        )}
        {message && <span className="text-xs text-emerald-600 dark:text-emerald-400">{message}</span>}
      </div>
    </div>
  );
}
