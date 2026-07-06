import { useMemo } from 'react';
import { simpleCsv } from '../export/csv';
import { generateHysteresisNotebook } from '../notebook/generateHysteresisNotebook';
import { useStore } from '../state/store';
import { MacrospinForm } from './MacrospinForm';
import { MaterialEditor } from './MaterialEditor';
import { ParamForm } from './ParamForm';
import { SimplePlot, type SimpleSeries } from './SimplePlot';
import { Button, FieldRow, NumberInput, Section } from './ui';

const RAD2DEG = 180 / Math.PI;

export function HysteresisPage() {
  const hyst = useStore((s) => s.hyst);
  const setHystType = useStore((s) => s.setHystType);
  const patchHyst = useStore((s) => s.patchHyst);
  const runHysteresis = useStore((s) => s.runHysteresis);
  const engineStatus = useStore((s) => s.engineStatus);
  const swtVersion = useStore((s) => s.swtVersion);

  const running = hyst.status === 'running';
  const meta = hyst.meta;
  const result = hyst.result;

  const series = useMemo((): SimpleSeries[] => {
    if (!result) return [];
    const single = result.type === 'single';
    if (hyst.view === 'projection') {
      return result.branches.map((b) => ({
        name: b.label === 'down' ? '↓ down sweep' : '↑ up sweep',
        x: b.B.map((v) => v * 1e3),
        y: b.proj,
        color: b.label === 'down' ? '#2563eb' : '#dc2626',
      }));
    }
    const names: [string, string] = single ? ['θ_M', 'φ_M'] : ['φ₁', 'φ₂'];
    const out: SimpleSeries[] = [];
    for (const b of result.branches) {
      const dash = b.label === 'up' ? 'dash' : 'solid';
      out.push({
        name: `${names[0]} ${b.label}`,
        x: b.B.map((v) => v * 1e3),
        y: b.a1.map((v) => (v === null ? null : v * RAD2DEG)),
        color: b.label === 'down' ? '#2563eb' : '#dc2626',
        dash,
      });
      out.push({
        name: `${names[1]} ${b.label}`,
        x: b.B.map((v) => v * 1e3),
        y: b.a2.map((v) => (v === null ? null : v * RAD2DEG)),
        color: b.label === 'down' ? '#0891b2' : '#ea580c',
        dash,
      });
    }
    return out;
  }, [result, hyst.view]);

  const yLabel = hyst.view === 'projection' ? 'M·B̂ / Ms (–)' : 'Equilibrium angles (°)';

  const makeCsv = () => {
    if (!meta) return null;
    const header = [
      'SpinWaveToolkit Web — hysteresis loop',
      `type: ${meta.type === 'single' ? 'single layer (macrospin)' : 'double layer / SAF'}`,
      `B max: ${meta.Bmax} mT`,
      ...Object.entries(meta.paramsDisplay).map(([k, v]) => `${k}: ${v}`),
    ];
    return simpleCsv(header, 'mu0*H (mT)', series);
  };

  const makeNotebook = () => {
    if (!meta) return null;
    return generateHysteresisNotebook({
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
        <Section title="System">
          <div className="flex gap-1.5">
            <Button
              variant={hyst.type === 'single' ? 'primary' : 'secondary'}
              className="flex-1 !py-1.5 text-xs"
              title="Macrospin model of a single layer: Zeeman + demagnetizing + uniaxial anisotropies."
              onClick={() => setHystType('single')}
            >
              Single layer
            </Button>
            <Button
              variant={hyst.type === 'double' ? 'primary' : 'secondary'}
              className="flex-1 !py-1.5 text-xs"
              title="Coupled double layer (SAF): in-plane free-energy minimization with RKKY coupling."
              onClick={() => setHystType('double')}
            >
              Double layer (SAF)
            </Button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            Full loop +B → −B → +B. Every field step relaxes the magnetization starting from the
            previous equilibrium — this history dependence produces the hysteresis.
          </p>
        </Section>
        <Section title={hyst.type === 'double' ? 'Material — layer 1' : 'Material'}>
          <MaterialEditor which={1} />
        </Section>
        {hyst.type === 'double' && (
          <Section title="Material — layer 2">
            <MaterialEditor which={2} />
          </Section>
        )}
        <Section title="Parameters">
          {hyst.type === 'single' ? (
            <MacrospinForm exclude={['Bext']} />
          ) : (
            <>
              <ParamForm exclude={['Bext']} />
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
                The field is applied in-plane along the magnetization azimuth φ. The projection is
                thickness-weighted over both layers.
              </p>
            </>
          )}
        </Section>
        <Section title="Field loop">
          <div className="grid grid-cols-2 gap-x-3">
            <FieldRow
              label="B max"
              unit="mT"
              tooltip="Loop amplitude: the field sweeps +Bmax → −Bmax → +Bmax."
            >
              <NumberInput
                value={hyst.Bmax}
                min={0.1}
                onChange={(v) => v !== null && patchHyst({ Bmax: v })}
              />
            </FieldRow>
            <FieldRow
              label="Points / branch"
              tooltip="Field steps per branch. More points resolve switching fields better but take longer (one energy minimization per step)."
            >
              <NumberInput
                value={hyst.points}
                min={3}
                max={2001}
                step={1}
                onChange={(v) => v !== null && patchHyst({ points: Math.round(v) })}
              />
            </FieldRow>
          </div>
          {hyst.error && (
            <p className="mb-2 max-h-24 overflow-y-auto whitespace-pre-wrap rounded-md bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300">
              {hyst.error}
            </p>
          )}
          <Button
            variant="primary"
            className="w-full !py-2"
            disabled={engineStatus !== 'ready' || running}
            onClick={() => void runHysteresis()}
          >
            {running ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Computing loop…
              </span>
            ) : (
              'Compute hysteresis'
            )}
          </Button>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400 dark:text-slate-500">
            Each point runs a Nelder–Mead energy minimization; 2×{hyst.points} points typically take
            a few seconds.
          </p>
        </Section>
        {result && (
          <Section title="Plot">
            <div className="flex gap-1.5">
              <Button
                variant={hyst.view === 'projection' ? 'primary' : 'secondary'}
                className="flex-1 !py-1 text-xs"
                onClick={() => patchHyst({ view: 'projection' })}
              >
                M·B̂ / Ms
              </Button>
              <Button
                variant={hyst.view === 'angles' ? 'primary' : 'secondary'}
                className="flex-1 !py-1 text-xs"
                onClick={() => patchHyst({ view: 'angles' })}
              >
                Angles
              </Button>
            </div>
          </Section>
        )}
      </aside>
      <main className="min-h-0 overflow-y-auto p-4">
        <SimplePlot
          title={
            meta
              ? `Hysteresis loop — ${meta.type === 'single' ? 'single layer (macrospin)' : 'double layer (SAF)'}`
              : ''
          }
          xLabel="μ₀H (mT)"
          yLabel={yLabel}
          series={series}
          baseName={`swtweb-hysteresis-${hyst.type}`}
          makeCsv={makeCsv}
          makeNotebook={makeNotebook}
          emptyHint="Configure the layer (or SAF) and the field loop on the left, then press Compute hysteresis. The blue branch sweeps the field down, the red branch sweeps back up."
        />
        {meta && (
          <p className="mt-3 text-center text-xs text-slate-400 dark:text-slate-500">
            B max {meta.Bmax} mT · {new Date(meta.timestamp).toLocaleString()}
          </p>
        )}
      </main>
    </div>
  );
}
