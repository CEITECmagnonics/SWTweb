/**
 * Generates a Jupyter notebook reproducing a parameter sweep from the web app:
 * either quantities at a fixed wavenumber versus the swept parameter, or a
 * full dispersion map over (k, parameter).
 */
import { getModel } from '../models/registry';
import { MACROSPIN_LABEL, MACROSPIN_SUMMARY } from '../models/macrospin';
import type { QuantityDef, SweepJob } from '../models/types';
import type { SweepMeta } from '../state/store';
import {
  citationMarkdown,
  IMPORTS_CELL,
  INSTALL_CELL,
  materialCode,
  NotebookBuilder,
  paramsTable,
  py,
} from './nbCommon';

export interface SweepNotebookInput {
  job: SweepJob;
  meta: SweepMeta;
  materialPresetId: string;
  materialPresetId2?: string;
  swtVersion: string | null;
}

const MACROSPIN_APPLY: Record<string, string> = {
  Bext: 'maceq.Bext["Bext"] = value',
  theta_H: 'maceq.Bext["theta_H"] = value',
  phi_H: 'maceq.Bext["phi_H"] = value',
};

function macrospinConstruction(job: SweepJob): string {
  const cfg = job.config!;
  const demag = {
    film: 'np.diag([0.0, 0.0, 1.0]),  # thin film',
    sphere: 'np.diag([1/3, 1/3, 1/3]),  # sphere',
    zero: 'np.zeros((3, 3)),  # no shape anisotropy',
  }[String(cfg.demag ?? 'film')];
  const lines = [
    `maceq = SWT.MacrospinEquilibrium(`,
    `    Ms=${py(cfg.Ms as number)},  # saturation magnetization (A/m)`,
    `    Bext=${py(cfg.Bext as number)},  # external field (T)`,
    `    theta_H=${py(cfg.theta_H as number)},  # field polar angle (rad)`,
    `    phi_H=${py(cfg.phi_H as number)},  # field azimuthal angle (rad)`,
    ...(cfg.theta0 !== undefined ? [`    theta=${py(cfg.theta0 as number)},`] : []),
    ...(cfg.phi0 !== undefined ? [`    phi=${py(cfg.phi0 as number)},`] : []),
    `    demag=${demag}`,
    `    verbose=False,`,
    `)`,
  ];
  for (const name of ['ani1', 'ani2']) {
    const ku = Number(cfg[`${name}_Ku`] ?? 0);
    if (ku !== 0) {
      lines.push(
        `maceq.add_uniaxial_anisotropy("${name}", Ku=${py(ku)}, ` +
          `theta=${py(Number(cfg[`${name}_theta`] ?? 0))}, phi=${py(Number(cfg[`${name}_phi`] ?? 0))})`,
      );
    }
  }
  return lines.join('\n');
}

function generateMacrospinSweep(nb: NotebookBuilder, input: SweepNotebookInput): void {
  const { job, meta } = input;
  const cfg = job.config!;
  const values = job.sweep.values;
  // Ku sweeps re-register the anisotropy with the configured axis angles
  // (same as the bridge) — never derive them from maceq.anis, which may not
  // exist yet when the sweep starts at Ku = 0.
  const aniBase = meta.key.replace(/_Ku$/, '');
  const apply =
    MACROSPIN_APPLY[meta.key] ??
    `maceq.add_uniaxial_anisotropy("${aniBase}", Ku=value, ` +
      `theta=${py(Number(cfg[`${aniBase}_theta`] ?? 0))}, phi=${py(Number(cfg[`${aniBase}_phi`] ?? 0))})`;

  nb.code(macrospinConstruction(job));
  nb.code(`# Swept parameter: ${meta.paramLabel} (SI values)
sweep_values = np.linspace(${py(values[0])}, ${py(values[values.length - 1])}, ${values.length})
sweep_display = sweep_values * ${py(1 / meta.paramToSI)}  # ${meta.paramUnit || 'SI'}

thetas, phis, projs = [], [], []
for value in sweep_values:
    ${apply}
    maceq.recalc_params()
    # minimize() warm-starts from the previous equilibrium -> adiabatic sweep
    maceq.minimize(verbose=False)
    thetas.append(maceq.M["theta"])
    phis.append(maceq.M["phi"])
    m_vec = SWT.sphr2cart(maceq.M["theta"], maceq.M["phi"])
    projs.append(float(np.dot(m_vec, maceq.b)))`);
  nb.code(`fig, ax = plt.subplots()
ax.plot(sweep_display, projs)
ax.set_xlabel("${meta.paramLabel}${meta.paramUnit ? ` (${meta.paramUnit})` : ''}")
ax.set_ylabel("M·B̂ / Ms (–)")
ax.set_title("Macrospin equilibrium projection")
plt.show()`);
  nb.code(`fig, ax = plt.subplots()
ax.plot(sweep_display, np.rad2deg(thetas), label="θ_M")
ax.plot(sweep_display, np.rad2deg(phis), label="φ_M")
ax.set_xlabel("${meta.paramLabel}${meta.paramUnit ? ` (${meta.paramUnit})` : ''}")
ax.set_ylabel("Equilibrium angles (°)")
ax.legend()
plt.show()`);
}

/** Python loop body collecting the quantity into `results` (fixed-k mode). */
function fixedKCollector(q: QuantityDef, job: SweepJob, kwargs: string): string[] {
  const jq = job.quantities![0];
  const nT = job.nT ?? 0;
  switch (q.returns) {
    case 'array':
      if (jq.modeArg === 'n_nT') {
        return [
          `    for n in ${JSON.stringify(job.modes ?? [0])}:`,
          `        results.setdefault(f"n={n}", []).append(model.${q.method}(n=n, nT=${nT})[0])`,
        ];
      }
      if (jq.modeArg === 'n') {
        return [
          `    for n in ${JSON.stringify(job.modes ?? [0])}:`,
          `        results.setdefault(f"mode {n}", []).append(model.${q.method}(n=n)[0])`,
        ];
      }
      return [`    results.setdefault("", []).append(model.${q.method}(${kwargs})[0])`];
    case 'stacked':
    case 'tuple_stacked': {
      const call = q.returns === 'tuple_stacked' ? `model.${q.method}()[0]` : `model.${q.method}()`;
      return [
        `    rows = np.atleast_2d(${call})`,
        `    for i, row in enumerate(rows):`,
        `        results.setdefault(f"mode {i}", []).append(row[0])`,
      ];
    }
    case 'scalar':
      return [`    results.setdefault("", []).append(model.${q.method}(${kwargs}))`];
    case 'tuple_scalar':
      return [
        `    vals = np.ravel(model.${q.method}(${kwargs}))`,
        `    for i, v in enumerate(vals):`,
        `        results.setdefault(f"[{i}]", []).append(v)`,
      ];
    default:
      return [`    # quantity '${q.id}' is not sweepable`];
  }
}

function generateModelSweep(nb: NotebookBuilder, input: SweepNotebookInput): void {
  const { job, meta } = input;
  const model = getModel(job.model as Exclude<SweepJob['model'], 'Macrospin'>);
  const q = model.quantities.find((x) => x.id === meta.quantityId)!;
  const jq = job.quantities![0];
  const values = job.sweep.values;
  const relax = Boolean(job.relax);
  const isMap = job.mode === 'map';
  const conv = q.nbConvert ?? (q.scale !== 1 ? ` * ${q.scale}  # -> ${q.unit}` : '');
  // Swept method-only kwargs (e.g. SC-coupled tol/d_is) never appear in the
  // constructor — they must be substituted with `value` in each Get* call.
  const sweptInMethod = job.sweep.key in (job.methodKwargs ?? {});
  const kwargEntries = jq.kwargNames
    ? Object.entries(job.methodKwargs ?? {})
        .filter(([k]) => jq.kwargNames!.includes(k))
        .map(([k, v]) => `${k}=${sweptInMethod && k === job.sweep.key ? 'value' : py(v)}`)
    : [];
  if (
    sweptInMethod &&
    jq.kwargNames?.includes(job.sweep.key) &&
    !kwargEntries.some((e) => e.startsWith(`${job.sweep.key}=`))
  ) {
    kwargEntries.push(`${job.sweep.key}=value`);
  }
  const kwargs = kwargEntries.join(', ');

  // Constructor arguments: swept key -> `value`; phiInit handled by relaxation.
  const ctorArgs: string[] = ['material=material', 'kxi=kxi'];
  for (const [key, value] of Object.entries(job.params ?? {})) {
    if (relax && (key === 'phiInit1' || key === 'phiInit2')) continue;
    if (key === job.sweep.key) continue;
    ctorArgs.push(`${key}=${py(value)},`);
  }
  if (!sweptInMethod) {
    ctorArgs.push(`${job.sweep.key}=value,  # swept: ${meta.paramLabel}`);
  }
  if (job.material2) ctorArgs.push('material2=material2,');
  if (relax) {
    ctorArgs.push('phiInit1=phi_init[0],  # warm start from previous step (relaxation)');
    ctorArgs.push('phiInit2=phi_init[1],');
  }
  const ctor = `model = SWT.${job.model}(\n    ${ctorArgs
    .map((a) => (a.endsWith(',') ? a : a + ','))
    .join('\n    ')}\n)`;

  // k axis
  const kSetup = isMap
    ? `kxi = ${job.kRange!.spacing === 'log' ? 'np.geomspace' : 'np.linspace'}(${py(job.kRange!.min)}, ${py(job.kRange!.max)}, ${job.kRange!.points})`
    : `k0 = ${py(Math.max(job.kFixed ?? 0, 1e-9))}  # fixed wavenumber (rad/m)
kxi = np.array([k0, k0 + max(abs(k0) * 1e-3, 1.0)])  # 2 points so v_g etc. work`;

  const relaxSetup = relax ? `\nphi_init = (np.pi / 2, -np.pi / 2)` : '';
  const relaxStep = relax
    ? `\n    phis = model.GetPhis()\n    phi_init = (float(phis[0]), float(phis[1]))\n    model.phiInit1, model.phiInit2 = phi_init`
    : '';

  if (!isMap) {
    nb.code(`# Swept parameter: ${meta.paramLabel} (SI values)
sweep_values = np.linspace(${py(values[0])}, ${py(values[values.length - 1])}, ${values.length})
sweep_display = sweep_values * ${py(1 / meta.paramToSI)}  # ${meta.paramUnit || 'SI'}
${kSetup}${relaxSetup}

results = {}
for value in sweep_values:
    ${ctor.split('\n').join('\n    ')}${relaxStep}
${fixedKCollector(q, job, kwargs).join('\n')}`);
    nb.code(`fig, ax = plt.subplots()
for label, ys in results.items():
    ax.plot(sweep_display, np.real(np.array(ys))${conv.split('#')[0].trimEnd()}, label=label or None)
ax.set_xlabel("${meta.paramLabel}${meta.paramUnit ? ` (${meta.paramUnit})` : ''}")
ax.set_ylabel("${q.axisLabel}")
if any(results.keys()):
    ax.legend()
ax.set_title("${q.label} at k = ${((job.kFixed ?? 0) * 1e-6).toPrecision(3)} rad/µm")
plt.show()`);
    return;
  }

  // Full dispersion map — one heatmap per mode, matching the app: stacked
  // returns produce every row, per-mode methods loop the selected modes.
  const isStacked = q.returns === 'stacked' || q.returns === 'tuple_stacked';
  const stackedCall =
    q.returns === 'tuple_stacked'
      ? `np.atleast_2d(model.${q.method}()[0])`
      : `np.atleast_2d(model.${q.method}())`;
  const modeCall =
    jq.modeArg === 'n_nT'
      ? `model.${q.method}(n=m, nT=${job.nT ?? 0})`
      : jq.modeArg === 'n'
        ? `model.${q.method}(n=m)`
        : `model.${q.method}(${kwargs})`;
  const collect = isStacked
    ? `    rows = np.real(${stackedCall})
    for m in range(rows.shape[0]):
        zmaps.setdefault(m, []).append(rows[m])`
    : `    for m in modes:
        zmaps.setdefault(m, []).append(np.real(${modeCall}))`;
  nb.code(`# Swept parameter: ${meta.paramLabel} (SI values)
sweep_values = np.linspace(${py(values[0])}, ${py(values[values.length - 1])}, ${values.length})
sweep_display = sweep_values * ${py(1 / meta.paramToSI)}  # ${meta.paramUnit || 'SI'}
${kSetup}${relaxSetup}

modes = ${JSON.stringify(jq.modeArg ? (job.modes ?? [0]) : [0])}
zmaps = {}
for value in sweep_values:
    ${ctor.split('\n').join('\n    ')}${relaxStep}
${collect}`);
  nb.code(`for m, zrows in zmaps.items():
    zmap = np.array(zrows)${conv}
    fig, ax = plt.subplots()
    pcm = ax.pcolormesh(kxi * 1e-6, sweep_display, zmap, shading="auto", cmap="viridis")
    fig.colorbar(pcm, ax=ax, label="${q.axisLabel}")
    ax.set_xlabel("Wavenumber k (rad/µm)")
    ax.set_ylabel("${meta.paramLabel}${meta.paramUnit ? ` (${meta.paramUnit})` : ''}")
    ax.set_title(f"${q.label} — mode {m}")
    plt.show()`);
}

export function generateSweepNotebook(input: SweepNotebookInput): string {
  const { job, meta } = input;
  const nb = new NotebookBuilder();
  const isMacrospin = job.model === 'Macrospin';
  const modelLabel = isMacrospin ? MACROSPIN_LABEL : getModel(job.model as never).label;
  const summary = isMacrospin ? MACROSPIN_SUMMARY : getModel(job.model as never).info.summary;

  nb.md(`# Parameter sweep — ${modelLabel}

${summary}

This notebook was generated by SpinWaveToolkit Web and reproduces a sweep of
**${meta.paramLabel}** (${meta.paramsDisplay[meta.paramLabel] ?? ''} → swept)${
    meta.mode === 'map' ? ' as a full dispersion map over (k, parameter)' : ' at a fixed wavenumber'
  }${meta.relax ? ', with the equilibrium angles relaxed adiabatically between steps' : ''}.

**Fixed parameters**

| Parameter | Value |
|---|---|
${paramsTable(meta.paramsDisplay)}`);

  nb.code(INSTALL_CELL(input.swtVersion));
  nb.code(IMPORTS_CELL);

  if (!isMacrospin) {
    let mat = materialCode('material', input.materialPresetId, job.material!);
    if (job.material2 && input.materialPresetId2) {
      mat += '\n' + materialCode('material2', input.materialPresetId2, job.material2);
    }
    nb.code(mat);
    generateModelSweep(nb, input);
  } else {
    generateMacrospinSweep(nb, input);
  }

  nb.md(citationMarkdown());
  return nb.build();
}
