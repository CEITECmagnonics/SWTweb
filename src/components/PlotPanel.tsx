import { useMemo, useRef } from 'react';
import type Plotly from 'plotly.js-dist-min';
import { getKUnit } from '../models/units';
import { useStore, type GridResult, type PlotTrace } from '../state/store';
import { ExportBar } from './ExportBar';
import { PlotlyChart } from './PlotlyChart';
import { ScalarResults } from './ScalarResults';

function buildLayout(
  settings: ReturnType<typeof useStore.getState>['plotSettings'],
  dark: boolean,
  defaults: { xLabel: string; yLabel: string; title: string },
): Partial<Plotly.Layout> {
  const fg = dark ? '#cbd5e1' : '#334155';
  const grid = dark ? '#334155' : '#e2e8f0';
  const axis = {
    gridcolor: settings.showGrid ? grid : 'rgba(0,0,0,0)',
    zerolinecolor: grid,
    linecolor: fg,
    tickcolor: fg,
  };
  return {
    title: {
      text: settings.title || defaults.title,
      font: { size: settings.fontSize + 4 },
    },
    xaxis: {
      title: { text: settings.xLabel || defaults.xLabel },
      type: settings.logX ? 'log' : 'linear',
      ...axis,
    },
    yaxis: {
      title: { text: settings.yLabel || defaults.yLabel },
      type: settings.logY ? 'log' : 'linear',
      ...axis,
    },
    showlegend: settings.showLegend,
    legend: { orientation: 'h', y: -0.18 },
    font: { size: settings.fontSize, color: fg },
    paper_bgcolor: 'rgba(0,0,0,0)',
    plot_bgcolor: 'rgba(0,0,0,0)',
    margin: { t: 50, r: 20, b: 60, l: 70 },
  };
}

function traceToPlotly(t: PlotTrace, xConvert: (k: number) => number): Plotly.Data {
  return {
    type: 'scatter',
    mode: 'lines',
    name: `${t.runLabel}${t.modeLabel ? ` · ${t.modeLabel}` : ''}`,
    x: t.x.map(xConvert),
    y: t.y,
    line: { color: t.color, dash: t.dash, width: t.width },
    hovertemplate: `%{x:.4g}, %{y:.4g} ${t.unit}<extra>${t.runLabel} ${t.modeLabel}</extra>`,
  } as Plotly.Data;
}

function gridToPlotly(g: GridResult, xConvert: (k: number) => number): Plotly.Data {
  return {
    type: 'heatmap',
    x: g.x.map(xConvert),
    y: g.y,
    z: g.z,
    colorscale: 'Viridis',
    colorbar: { title: { text: 'norm.' } },
  } as unknown as Plotly.Data;
}

export function PlotPanel() {
  const traces = useStore((s) => s.traces);
  const grids = useStore((s) => s.grids);
  const activeQuantity = useStore((s) => s.activeQuantity);
  const setActiveQuantity = useStore((s) => s.setActiveQuantity);
  const plotSettings = useStore((s) => s.plotSettings);
  const theme = useStore((s) => s.theme);
  const plotDivRef = useRef<HTMLDivElement | null>(null);

  const tabs = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of traces) if (!seen.has(t.quantityId)) seen.set(t.quantityId, t.quantityLabel);
    for (const g of grids) if (!seen.has(g.quantityId)) seen.set(g.quantityId, g.quantityLabel);
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [traces, grids]);

  const active = activeQuantity && tabs.some((t) => t.id === activeQuantity)
    ? activeQuantity
    : (tabs[0]?.id ?? null);

  const kUnit = getKUnit(plotSettings.xUnit);
  const activeTraces = traces.filter((t) => t.quantityId === active && t.visible);
  const activeGrid = grids.find((g) => g.quantityId === active);

  const { data, layout } = useMemo(() => {
    const isGrid = activeTraces.length === 0 && activeGrid;
    const data: Plotly.Data[] = isGrid
      ? [gridToPlotly(activeGrid, kUnit.fromSI)]
      : activeTraces.map((t) => traceToPlotly(t, kUnit.fromSI));
    const yLabel = isGrid
      ? 'Frequency f (GHz)'
      : (activeTraces[0]?.axisLabel ?? '');
    const title = isGrid
      ? `${activeGrid.quantityLabel} (${activeGrid.modeLabel})`
      : (activeTraces[0]?.quantityLabel ?? '');
    return {
      data,
      layout: buildLayout(plotSettings, theme === 'dark', {
        xLabel: kUnit.axisLabel,
        yLabel,
        title,
      }),
    };
  }, [activeTraces, activeGrid, kUnit, plotSettings, theme]);

  if (tabs.length === 0) {
    return (
      <div className="flex h-full min-h-[480px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
        <svg className="mb-4 h-14 w-14 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
          <path d="M3 3v18h18" strokeLinecap="round" />
          <path d="M6 15c2-6 4-9 6-9s3 2.5 4.5 5S19.5 15 21 15" strokeLinecap="round" />
        </svg>
        <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
          Choose a model and parameters on the left, then press{' '}
          <span className="font-semibold text-slate-700 dark:text-slate-200">Compute</span> to plot
          spin-wave characteristics here.
        </p>
        <ScalarResults />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 px-3 pt-2 dark:border-slate-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveQuantity(tab.id)}
            className={`rounded-t-md px-3 py-1.5 text-sm font-medium ${
              tab.id === active
                ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="p-2">
        <PlotlyChart data={data} layout={layout} divRef={plotDivRef} />
      </div>
      <ExportBar getPlotDiv={() => plotDivRef.current} activeQuantity={active} />
      <ScalarResults />
    </div>
  );
}
