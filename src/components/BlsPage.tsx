import { useMemo } from 'react';
import { simpleCsv } from '../export/csv';
import {
  BLS_INFO,
  BLS_OPTICS_PARAMS,
  BLS_STACK_PARAMS,
  BLS_SW_PARAMS,
  BLS_THERMAL_PARAMS,
  blsSweepableParams,
} from '../models/bls';
import type { ParamDef } from '../models/types';
import { generateBlsNotebook } from '../notebook/generateBlsNotebook';
import { useStore } from '../state/store';
import { GenericParamField } from './GenericParamField';
import { MaterialEditor } from './MaterialEditor';
import { SimplePlot, type SimpleHeatmap, type SimpleSeries } from './SimplePlot';
import { Button, FieldRow, inputClass, NumberInput, Section } from './ui';

function BlsParamGroup({ defs, exclude = [] }: { defs: ParamDef[]; exclude?: string[] }) {
  const values = useStore((s) => s.bls.values);
  const setBlsValue = useStore((s) => s.setBlsValue);
  const shown = defs.filter((p) => !exclude.includes(p.key));
  const basic = shown.filter((p) => !p.advanced);
  const advanced = shown.filter((p) => p.advanced);
  return (
    <>
      <div className="grid grid-cols-2 gap-x-3">
        {basic.map((def) => (
          <GenericParamField
            key={def.key}
            def={def}
            value={values[def.key] ?? def.default}
            onChange={(v) => setBlsValue(def.key, v)}
          />
        ))}
      </div>
      {advanced.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3">
          {advanced.map((def) => (
            <GenericParamField
              key={def.key}
              def={def}
              value={values[def.key] ?? def.default}
              onChange={(v) => setBlsValue(def.key, v)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function StackSection() {
  const values = useStore((s) => s.bls.values);
  const coverOn = Number(values.coverEnabled ?? 0) === 1;
  return (
    <Section title="Optical layer stack" defaultOpen={false}>
      <p className="mb-2 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
        Complex permittivities at the laser wavelength. Defaults: NiFe and Si at 532 nm (from the
        SWT example); SiO₂ cover ε′ ≈ 2.13.
      </p>
      <BlsParamGroup
        defs={BLS_STACK_PARAMS}
        exclude={coverOn ? [] : ['dCover', 'epsCoverRe', 'epsCoverIm']}
      />
    </Section>
  );
}

function ThermalSweepSection() {
  const bls = useStore((s) => s.bls);
  const patchBls = useStore((s) => s.patchBls);
  const setBlsSweepKey = useStore((s) => s.setBlsSweepKey);
  const isRT = String(bls.values.method ?? 'GF') === 'RT';
  const sweepables = blsSweepableParams().filter((p) => !(isRT && p.key === 'dCover'));
  const def = sweepables.find((p) => p.key === bls.sweepKey);
  return (
    <Section title="Parameter sweep" defaultOpen={false}>
      <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="accent-blue-600"
          checked={bls.sweepEnabled}
          onChange={(e) => patchBls({ sweepEnabled: e.target.checked })}
        />
        Sweep a parameter (spectra → 2D map)
      </label>
      {bls.sweepEnabled && (
        <>
          <FieldRow label="Swept parameter">
            <select
              className={inputClass}
              value={bls.sweepKey}
              onChange={(e) => setBlsSweepKey(e.target.value)}
            >
              {sweepables.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                  {p.unit ? ` (${p.unit})` : ''}
                </option>
              ))}
            </select>
          </FieldRow>
          <div className="grid grid-cols-3 gap-x-2">
            <FieldRow label="From" unit={def?.unit || undefined}>
              <NumberInput
                value={bls.sweepFrom}
                onChange={(v) => v !== null && patchBls({ sweepFrom: v })}
              />
            </FieldRow>
            <FieldRow label="To" unit={def?.unit || undefined}>
              <NumberInput
                value={bls.sweepTo}
                onChange={(v) => v !== null && patchBls({ sweepTo: v })}
              />
            </FieldRow>
            <FieldRow label="Steps" tooltip="Each step computes a full spectrum (~10 s).">
              <NumberInput
                value={bls.sweepPoints}
                min={2}
                max={51}
                step={1}
                onChange={(v) => v !== null && patchBls({ sweepPoints: Math.round(v) })}
              />
            </FieldRow>
          </div>
        </>
      )}
    </Section>
  );
}

export function BlsPage() {
  const bls = useStore((s) => s.bls);
  const runBls = useStore((s) => s.runBls);
  const engineStatus = useStore((s) => s.engineStatus);
  const swtVersion = useStore((s) => s.swtVersion);
  const setBlsValue = useStore((s) => s.setBlsValue);
  const setBlsSweepKey = useStore((s) => s.setBlsSweepKey);
  const isRT = String(bls.values.method ?? 'GF') === 'RT';

  const running = bls.status === 'running';
  const meta = bls.meta;
  const result = bls.result;

  const { series, heatmap, xLabel, yLabel, title } = useMemo((): {
    series: SimpleSeries[];
    heatmap: SimpleHeatmap | null;
    xLabel: string;
    yLabel: string;
    title: string;
  } => {
    if (!result || !meta) return { series: [], heatmap: null, xLabel: '', yLabel: '', title: '' };
    const grid = result.grids[0];
    if (grid && meta.paramToSI) {
      return {
        series: [],
        heatmap: {
          x: grid.x.map((w) => w / (2 * Math.PI * 1e9)),
          y: grid.y.map((v) => v / meta.paramToSI!),
          z: grid.z,
          colorLabel: 'BLS intensity (arb. u.)',
        },
        xLabel: 'Frequency f (GHz)',
        yLabel: `${meta.paramLabel}${meta.paramUnit ? ` (${meta.paramUnit})` : ''}`,
        title: `Thermal µBLS spectra vs ${meta.paramLabel}`,
      };
    }
    const t = result.traces.find((x) => x.quantity === 'blsSpectrum');
    return {
      series: t
        ? [
            {
              name: 'BLS spectrum',
              x: t.x.map((w) => w / (2 * Math.PI * 1e9)),
              y: t.y,
              color: '#2563eb',
            },
          ]
        : [],
      heatmap: null,
      xLabel: 'Frequency f (GHz)',
      yLabel: 'BLS intensity (arb. u.)',
      title: 'Thermal µBLS spectrum',
    };
  }, [result, meta]);

  const makeCsv = () => {
    if (!meta) return null;
    const header = [
      'SpinWaveToolkit Web — µBLS thermal spectrum',
      ...Object.entries(meta.paramsDisplay).map(([k, v]) => `${k}: ${v}`),
    ];
    if (heatmap) {
      const lines = header.map((l) => `# ${l}`);
      lines.push(`f (GHz),${yLabel},BLS intensity`);
      for (let iy = 0; iy < heatmap.y.length; iy++) {
        for (let ix = 0; ix < heatmap.x.length; ix++) {
          const v = heatmap.z[iy]?.[ix];
          lines.push(`${heatmap.x[ix]},${heatmap.y[iy]},${v ?? ''}`);
        }
      }
      return lines.join('\n') + '\n';
    }
    return simpleCsv(header, xLabel, series);
  };

  const makeNotebook = () => {
    if (!meta) return null;
    return generateBlsNotebook({
      job: meta.job,
      meta,
      materialPresetId: meta.materialPresetId,
      swtVersion,
    });
  };

  const durationHint = isRT
    ? bls.sweepEnabled
      ? `≈ ${bls.sweepPoints} × 0.5 s`
      : '≈ 2 s'
    : bls.sweepEnabled
      ? `≈ ${bls.sweepPoints} × 10 s`
      : '≈ 10 s';

  const selectRT = () => {
    setBlsValue('method', 'RT');
    // The stack section is hidden under RT — clear incompatible settings so
    // the user never hits the fail-fast error without a visible control.
    if (Number(bls.values.coverEnabled) === 1) setBlsValue('coverEnabled', 0);
    if (bls.sweepKey === 'dCover') setBlsSweepKey('Bext');
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[340px_1fr]">
      <aside className="flex h-full w-full flex-col overflow-y-auto border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <Section title="µBLS calculation">
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {BLS_INFO.summary}{' '}
            <a
              href={BLS_INFO.reference.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {BLS_INFO.reference.label}
            </a>
          </p>
        </Section>
        <Section title="Method">
          <div className="flex gap-1.5">
            <Button
              variant={!isRT ? 'primary' : 'secondary'}
              className="flex-1 !py-1.5 text-xs"
              title="Green-function formalism with the full air / [cover] / magnet / substrate dielectric stack and the output analyzer. Slower (runtime ∝ Nq⁴)."
              onClick={() => setBlsValue('method', 'GF')}
            >
              Green function
            </Button>
            <Button
              variant={isRT ? 'primary' : 'secondary'}
              className="flex-1 !py-1.5 text-xs"
              title="Reciprocity theorem: ~10× faster. Ignores the entire dielectric stack (including the substrate) and the analyzer / collection optics; peak positions still match the Green-function result."
              onClick={selectRT}
            >
              Reciprocity theorem
            </Button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            {isRT
              ? 'Fast reciprocity-theorem model — no dielectric stack (substrate permittivity ignored) and no output analyzer.'
              : 'Full Green-function model with the dielectric stack and output analyzer (runtime ∝ Nq⁴).'}
          </p>
        </Section>
        <Section title="Material">
          <MaterialEditor which={1} />
        </Section>
        <Section title="Spin waves & sample">
          <BlsParamGroup defs={BLS_SW_PARAMS} exclude={['method']} />
        </Section>
        <Section title="Optics">
          <BlsParamGroup
            defs={BLS_OPTICS_PARAMS}
            exclude={isRT ? ['analyzer', 'analyzerAngle', 'collectionSpot'] : []}
          />
        </Section>
        {!isRT && <StackSection />}
        <Section title="Frequency window & accuracy" defaultOpen={false}>
          <BlsParamGroup
            defs={BLS_THERMAL_PARAMS}
            exclude={[
              ...(Number(bls.values.fAuto ?? 1) === 1 ? ['fMin', 'fMax'] : []),
              ...(isRT ? ['nQ'] : []),
            ]}
          />
        </Section>
        <ThermalSweepSection />
        <div className="border-t border-slate-200 p-3 dark:border-slate-800">
          {bls.error && (
            <p className="mb-2 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
              {bls.error}
            </p>
          )}
          <Button
            variant="primary"
            className="w-full !py-2"
            disabled={engineStatus !== 'ready' || running}
            onClick={() => void runBls()}
          >
            {running ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Computing µBLS…
              </span>
            ) : (
              `Compute (${durationHint})`
            )}
          </Button>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            {isRT
              ? 'The reciprocity-theorem method skips the dielectric stack and angular quadrature — much faster, with peak positions matching the Green-function model.'
              : 'µBLS involves 2D convolutions for every frequency bin — heavier than the other pages. The accuracy panel trades speed for convergence (runtime ∝ Nq⁴).'}
          </p>
        </div>
      </aside>
      <main className="min-h-0 overflow-y-auto p-4">
        <SimplePlot
          title={title}
          xLabel={xLabel}
          yLabel={yLabel}
          series={series}
          heatmap={heatmap}
          baseName="swtweb-bls-thermal"
          makeCsv={makeCsv}
          makeNotebook={makeNotebook}
          emptyHint="Configure the sample, optics, and layer stack, then press Compute to model the thermal µBLS spectrum — optionally swept over a parameter into a 2D map."
        />
        {meta && (
          <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
            µBLS thermal spectrum · {new Date(meta.timestamp).toLocaleString()}
          </p>
        )}
      </main>
    </div>
  );
}
