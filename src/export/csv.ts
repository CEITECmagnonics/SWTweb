/** CSV / JSON serialization of computed traces, with parameter provenance. */
import type { PlotTrace, ScalarResult } from '../state/store';

function provenanceHeader(traces: PlotTrace[], swtVersion: string | null): string[] {
  const lines: string[] = [
    '# SpinWaveToolkit Web export',
    `# generated: ${new Date().toISOString()}`,
    `# SpinWaveToolkit version: ${swtVersion ?? 'unknown'}`,
  ];
  const seenRuns = new Set<number>();
  for (const t of traces) {
    if (seenRuns.has(t.runId)) continue;
    seenRuns.add(t.runId);
    lines.push(`# --- ${t.runLabel} ---`);
    lines.push(`#   model: ${t.provenance.modelLabel}`);
    lines.push(`#   material: ${t.provenance.materialLabel}`);
    if (t.provenance.material2Label) lines.push(`#   material 2: ${t.provenance.material2Label}`);
    for (const [k, v] of Object.entries(t.provenance.paramsDisplay)) {
      lines.push(`#   ${k}: ${v}`);
    }
  }
  return lines;
}

function sameX(traces: PlotTrace[]): boolean {
  const first = traces[0].x;
  return traces.every(
    (t) => t.x.length === first.length && t.x.every((v, i) => v === first[i]),
  );
}

const num = (v: number | null) => (v === null ? '' : String(v));

/**
 * Wide format when all traces share the same k grid (one k column, one column
 * per trace); long format otherwise.
 */
export function tracesToCsv(traces: PlotTrace[], swtVersion: string | null): string {
  if (traces.length === 0) return '';
  const lines = provenanceHeader(traces, swtVersion);

  if (sameX(traces)) {
    const cols = traces.map((t) => `${t.runLabel} | ${t.quantityLabel}${t.modeLabel ? ` | ${t.modeLabel}` : ''} (${t.unit})`);
    lines.push(['k (rad/m)', ...cols].join(','));
    const x = traces[0].x;
    for (let i = 0; i < x.length; i++) {
      lines.push([String(x[i]), ...traces.map((t) => num(t.y[i]))].join(','));
    }
  } else {
    lines.push('run,quantity,mode,k (rad/m),value,unit');
    for (const t of traces) {
      for (let i = 0; i < t.x.length; i++) {
        lines.push(
          [t.runLabel, t.quantityLabel, t.modeLabel, String(t.x[i]), num(t.y[i]), t.unit].join(','),
        );
      }
    }
  }
  return lines.join('\n') + '\n';
}

export function resultsToJson(
  traces: PlotTrace[],
  scalars: ScalarResult[],
  swtVersion: string | null,
): string {
  const runs = new Map<number, { label: string; provenance: object; traces: object[] }>();
  for (const t of traces) {
    if (!runs.has(t.runId)) {
      runs.set(t.runId, {
        label: t.runLabel,
        provenance: {
          model: t.provenance.model,
          material: t.provenance.materialLabel,
          material2: t.provenance.material2Label,
          parameters: t.provenance.paramsDisplay,
          jobSI: t.provenance.job,
          timestamp: t.provenance.timestamp,
        },
        traces: [],
      });
    }
    runs.get(t.runId)!.traces.push({
      quantity: t.quantityLabel,
      mode: t.modeLabel,
      unit: t.unit,
      k_rad_per_m: t.x,
      values: t.y,
    });
  }
  return JSON.stringify(
    {
      generator: 'SpinWaveToolkit Web',
      generated: new Date().toISOString(),
      swtVersion,
      runs: [...runs.values()],
      scalarResults: scalars.map((s) => ({
        run: s.runLabel,
        label: s.label,
        value: s.value,
        unit: s.unit,
      })),
    },
    null,
    2,
  );
}
