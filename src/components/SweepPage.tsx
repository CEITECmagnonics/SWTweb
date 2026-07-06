import { useMemo } from 'react';
import { simpleCsv } from '../export/csv';
import { MACROSPIN_ID, MACROSPIN_LABEL, MACROSPIN_QUANTITIES, MACROSPIN_SUMMARY } from '../models/macrospin';
import { getModel, MODEL_LIST } from '../models/registry';
import { sweepableParams } from '../models/sweep';
import type { SweepModelId } from '../models/types';
import { generateSweepNotebook } from '../notebook/generateSweepNotebook';
import { TRACE_PALETTE, useStore } from '../state/store';
import { MacrospinForm } from './MacrospinForm';
import { MaterialEditor } from './MaterialEditor';
import { ParamForm } from './ParamForm';
import { SimplePlot, type SimpleHeatmap, type SimpleSeries } from './SimplePlot';
import { Button, FieldRow, inputClass, NumberInput, Section } from './ui';

/** Display metadata for the plotted quantity (SWT registry or macrospin). */
function quantityInfo(modelId: SweepModelId, quantityId: string) {
  if (modelId === MACROSPIN_ID) {
    const q = MACROSPIN_QUANTITIES.find((x) => x.id === quantityId);
    return q
      ? { label: q.label, axisLabel: q.axisLabel, scale: q.scale, scalarLabels: undefined, stackedLabels: undefined }
      : null;
  }
  const q = getModel(modelId).quantities.find((x) => x.id === quantityId);
  return q
    ? {
        label: q.label,
        axisLabel: q.axisLabel,
        scale: q.scale,
        scalarLabels: q.scalarLabels,
        stackedLabels: q.stackedLabels,
      }
    : null;
}

function traceName(rawLabel: string, info: NonNullable<ReturnType<typeof quantityInfo>>): string {
  const idxMatch = rawLabel.match(/^\[(\d+)\]$/);
  if (idxMatch && info.scalarLabels) return info.scalarLabels[Number(idxMatch[1])] ?? rawLabel;
  const modeMatch = rawLabel.match(/^mode (\d+)$/);
  if (modeMatch && info.stackedLabels) return info.stackedLabels[Number(modeMatch[1])] ?? rawLabel;
  return rawLabel || info.label;
}

function SweepConfig() {
  const sweep = useStore((s) => s.sweep);
  const setSweepKey = useStore((s) => s.setSweepKey);
  const patchSweep = useStore((s) => s.patchSweep);
  const runSweep = useStore((s) => s.runSweep);
  const engineStatus = useStore((s) => s.engineStatus);

  const isMacrospin = sweep.modelId === MACROSPIN_ID;
  const model = sweep.modelId === MACROSPIN_ID ? null : getModel(sweep.modelId);
  const params = sweepableParams(sweep.modelId);
  const def = params.find((p) => p.key === sweep.key);
  const quantities = isMacrospin
    ? MACROSPIN_QUANTITIES.map((q) => ({ id: q.id, label: q.label }))
    : model!.quantities
        .filter(
          (q) =>
            q.returns !== 'grid' &&
            (sweep.mode === 'fixedK' || (q.returns !== 'scalar' && q.returns !== 'tuple_scalar')),
        )
        .map((q) => ({ id: q.id, label: q.label }));

  const running = sweep.status === 'running';

  return (
    <Section title="Sweep configuration">
      <FieldRow
        label="Swept parameter"
        tooltip="The model parameter varied along the x axis of the sweep."
      >
        <select className={inputClass} value={sweep.key} onChange={(e) => setSweepKey(e.target.value)}>
          {params.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
              {p.unit ? ` (${p.unit})` : ''}
            </option>
          ))}
        </select>
      </FieldRow>
      <div className="grid grid-cols-3 gap-x-2">
        <FieldRow label="From" unit={def?.unit || undefined}>
          <NumberInput value={sweep.from} onChange={(v) => v !== null && patchSweep({ from: v })} />
        </FieldRow>
        <FieldRow label="To" unit={def?.unit || undefined}>
          <NumberInput value={sweep.to} onChange={(v) => v !== null && patchSweep({ to: v })} />
        </FieldRow>
        <FieldRow label="Steps" tooltip="Number of sweep points (2–1001).">
          <NumberInput
            value={sweep.points}
            min={2}
            max={1001}
            step={1}
            onChange={(v) => v !== null && patchSweep({ points: Math.round(v) })}
          />
        </FieldRow>
      </div>

      {!isMacrospin && (
        <>
          <div className="mb-2">
            <span className="mb-1 block text-xs text-slate-600 dark:text-slate-400">Output</span>
            <div className="flex gap-1.5">
              <Button
                variant={sweep.mode === 'fixedK' ? 'primary' : 'secondary'}
                className="!px-2 !py-1 text-xs"
                title="Quantity vs the swept parameter at one fixed wavenumber (default k = 0, i.e. the FMR limit)."
                onClick={() => patchSweep({ mode: 'fixedK' })}
              >
                At fixed k
              </Button>
              <Button
                variant={sweep.mode === 'map' ? 'primary' : 'secondary'}
                className="!px-2 !py-1 text-xs"
                title="Full dispersion for every sweep step, shown as a 2D heatmap over (k, parameter)."
                onClick={() => patchSweep({ mode: 'map' })}
              >
                Full dispersion map
              </Button>
            </div>
          </div>
          {sweep.mode === 'fixedK' && (
            <FieldRow
              label="Fixed wavenumber k"
              unit="rad/µm"
              tooltip="Wavenumber at which the characteristics are evaluated. 0 = the k→0 (FMR-like) limit."
            >
              <NumberInput
                value={sweep.kFixed}
                min={0}
                onChange={(v) => v !== null && patchSweep({ kFixed: v })}
              />
            </FieldRow>
          )}
        </>
      )}

      <FieldRow label="Quantity" tooltip="Quantity plotted against the swept parameter.">
        <select
          className={inputClass}
          value={sweep.quantityId}
          onChange={(e) => patchSweep({ quantityId: e.target.value })}
        >
          {quantities.map((q) => (
            <option key={q.id} value={q.id}>
              {q.label}
            </option>
          ))}
        </select>
      </FieldRow>

      {sweep.modelId === 'DoubleLayerNumeric' && (
        <label
          className="mb-2 flex cursor-pointer items-start gap-2 text-sm"
          title="Warm-start the equilibrium angles φ₁, φ₂ of each sweep step from the previous step (adiabatic relaxation). Captures hysteretic branches of the SAF."
        >
          <input
            type="checkbox"
            className="mt-0.5 accent-blue-600"
            checked={sweep.relax}
            onChange={(e) => patchSweep({ relax: e.target.checked })}
          />
          <span>Relax equilibrium between steps (recommended)</span>
        </label>
      )}

      {sweep.error && (
        <p className="mb-2 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
          {sweep.error}
        </p>
      )}
      <Button
        variant="primary"
        className="w-full !py-2"
        disabled={engineStatus !== 'ready' || running}
        onClick={() => void runSweep()}
      >
        {running ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Sweeping…
          </span>
        ) : (
          'Run sweep'
        )}
      </Button>
      {sweep.mode === 'map' && (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
          A map computes the full dispersion for every step — with numeric models this can take a
          while. Reduce steps or k points if it feels slow.
        </p>
      )}
    </Section>
  );
}

export function SweepPage() {
  const sweep = useStore((s) => s.sweep);
  const swtVersion = useStore((s) => s.swtVersion);
  const isMacrospin = sweep.modelId === MACROSPIN_ID;
  const model = sweep.modelId === MACROSPIN_ID ? null : getModel(sweep.modelId);
  const setSweepModel = useStore((s) => s.setSweepModel);

  const meta = sweep.meta;
  const result = sweep.result;
  // For the macrospin model all quantities are computed at once, so the
  // quantity selector switches the plot without recomputing.
  const shownQuantityId = meta
    ? meta.modelId === MACROSPIN_ID
      ? sweep.quantityId
      : meta.quantityId
    : sweep.quantityId;
  const info = meta ? quantityInfo(meta.modelId, shownQuantityId) : null;

  const { series, heatmap } = useMemo((): {
    series: SimpleSeries[];
    heatmap: SimpleHeatmap | null;
  } => {
    if (!result || !meta || !info) return { series: [], heatmap: null };
    if (meta.mode === 'map' && result.grids.length > 0) {
      const g = result.grids[0];
      return {
        series: [],
        heatmap: {
          x: g.x.map((k) => k * 1e-6),
          y: g.y.map((v) => v / meta.paramToSI),
          z: g.z.map((row) => row.map((v) => (v === null ? null : v * info.scale))),
          colorLabel: info.axisLabel,
        },
      };
    }
    const traces = result.traces.filter((t) => t.quantity === shownQuantityId);
    return {
      series: traces.map((t, i) => ({
        name: traceName(t.label, info),
        x: t.x.map((v) => v / meta.paramToSI),
        y: t.y.map((v) => (v === null ? null : v * info.scale)),
        color: TRACE_PALETTE[i % TRACE_PALETTE.length],
      })),
      heatmap: null,
    };
  }, [result, meta, info, shownQuantityId]);

  const xLabel = meta ? `${meta.paramLabel}${meta.paramUnit ? ` (${meta.paramUnit})` : ''}` : '';

  const makeCsv = () => {
    if (!meta || !info) return null;
    const header = [
      'SpinWaveToolkit Web — parameter sweep',
      `model: ${meta.modelLabel}`,
      `swept parameter: ${meta.paramLabel}`,
      ...Object.entries(meta.paramsDisplay).map(([k, v]) => `${k}: ${v}`),
    ];
    if (heatmap) {
      const lines = header.map((l) => `# ${l}`);
      lines.push(`k (rad/um),${xLabel},${info.axisLabel}`);
      for (let iy = 0; iy < heatmap.y.length; iy++) {
        for (let ix = 0; ix < heatmap.x.length; ix++) {
          const v = heatmap.z[iy]?.[ix];
          lines.push(`${heatmap.x[ix]},${heatmap.y[iy]},${v === null || v === undefined ? '' : v}`);
        }
      }
      return lines.join('\n') + '\n';
    }
    return simpleCsv(header, xLabel, series);
  };

  const makeNotebook = () => {
    if (!meta) return null;
    return generateSweepNotebook({
      job: meta.job,
      meta,
      materialPresetId: meta.materialPresetId,
      materialPresetId2: meta.materialPresetId2,
      swtVersion,
    });
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[340px_1fr]">
      <aside className="flex h-full w-full flex-col overflow-y-auto border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <Section title="Model">
          <select
            className={inputClass}
            value={sweep.modelId}
            onChange={(e) => setSweepModel(e.target.value as SweepModelId)}
            aria-label="Sweep model"
          >
            {MODEL_LIST.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
            <option value={MACROSPIN_ID}>{MACROSPIN_LABEL}</option>
          </select>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {isMacrospin ? MACROSPIN_SUMMARY : model!.info.summary}
          </p>
        </Section>
        <Section title={model?.hasSecondMaterial ? 'Material — layer 1' : 'Material'}>
          <MaterialEditor which={1} />
        </Section>
        {model?.hasSecondMaterial && (
          <Section title="Material — layer 2">
            <MaterialEditor which={2} />
          </Section>
        )}
        <Section title="Parameters">
          {isMacrospin ? <MacrospinForm exclude={['Bext']} /> : <ParamForm />}
          {isMacrospin && (
            <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
              Only Ms of the selected material is used by the macrospin model.
            </p>
          )}
        </Section>
        <SweepConfig />
      </aside>
      <main className="min-h-0 overflow-y-auto p-4">
        <SimplePlot
          title={
            meta && info
              ? `${info.label} vs ${meta.paramLabel}${meta.mode === 'fixedK' && meta.modelId !== MACROSPIN_ID ? ` (k = ${meta.kFixed} rad/µm)` : ''}`
              : ''
          }
          xLabel={heatmap ? 'Wavenumber k (rad/µm)' : xLabel}
          yLabel={heatmap ? xLabel : (info?.axisLabel ?? '')}
          series={series}
          heatmap={heatmap}
          baseName={`swtweb-sweep-${meta?.key ?? 'param'}`}
          makeCsv={makeCsv}
          makeNotebook={makeNotebook}
          emptyHint="Choose a model and a parameter to sweep on the left, then press Run sweep. By default quantities are evaluated at k = 0; switch to the full dispersion map for a 2D (k, parameter) view."
        />
        {meta && (
          <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
            {meta.modelLabel} · swept {meta.paramLabel} · {new Date(meta.timestamp).toLocaleString()}
            {meta.relax ? ' · equilibrium relaxed between steps' : ''}
          </p>
        )}
      </main>
    </div>
  );
}
