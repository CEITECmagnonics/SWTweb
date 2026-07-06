/**
 * Generates a Jupyter notebook reproducing a hysteresis loop from the web app:
 * single layer via MacrospinEquilibrium.hysteresis(), double layer via a
 * warm-started free-energy minimization over the field sweep.
 */
import { getModel } from '../models/registry';
import type { HystJob } from '../models/types';
import type { HystMeta } from '../state/store';
import {
  citationMarkdown,
  IMPORTS_CELL,
  INSTALL_CELL,
  materialCode,
  NotebookBuilder,
  paramsTable,
  py,
} from './nbCommon';

export interface HystNotebookInput {
  job: HystJob;
  meta: HystMeta;
  materialPresetId: string;
  materialPresetId2?: string;
  swtVersion: string | null;
}

function singleLayerCells(nb: NotebookBuilder, input: HystNotebookInput): void {
  const cfg = input.job.config!;
  const demag = {
    film: 'np.diag([0.0, 0.0, 1.0]),  # thin film',
    sphere: 'np.diag([1/3, 1/3, 1/3]),  # sphere',
    zero: 'np.zeros((3, 3)),  # no shape anisotropy',
  }[String(cfg.demag ?? 'film')];

  const anis: string[] = [];
  for (const name of ['ani1', 'ani2']) {
    const ku = Number(cfg[`${name}_Ku`] ?? 0);
    if (ku !== 0) {
      anis.push(
        `maceq.add_uniaxial_anisotropy("${name}", Ku=${py(ku)}, ` +
          `theta=${py(Number(cfg[`${name}_theta`] ?? 0))}, phi=${py(Number(cfg[`${name}_phi`] ?? 0))})`,
      );
    }
  }

  nb.code(`B_max = ${py(input.job.Bmax)}  # T
theta_H = ${py(cfg.theta_H as number)}  # field polar angle (rad)
phi_H = ${py(cfg.phi_H as number)}  # field azimuthal angle (rad)

maceq = SWT.MacrospinEquilibrium(
    Ms=${py(cfg.Ms as number)},  # saturation magnetization (A/m)
    Bext=B_max,
    theta_H=theta_H,
    phi_H=phi_H,
    demag=${demag}
    verbose=False,
)
${anis.join('\n')}${anis.length ? '\n' : ''}maceq.minimize(verbose=False)  # saturate at +B_max before the loop`);

  nb.code(`# Full loop: +B_max -> -B_max -> +B_max.
# hysteresis() warm-starts every step from the previous equilibrium,
# which is what produces the hysteretic (history-dependent) branches.
N = ${input.job.points}
B_down = np.linspace(B_max, -B_max, N)
B_up = np.linspace(-B_max, B_max, N)

theta_d, phi_d = maceq.hysteresis(B_down, theta_H, phi_H)
theta_u, phi_u = maceq.hysteresis(B_up, theta_H, phi_H)

b_unit = np.array(SWT.sphr2cart(theta_H, phi_H))
proj_down = np.array([np.dot(SWT.sphr2cart(t, p), b_unit) for t, p in zip(theta_d, phi_d)])
proj_up = np.array([np.dot(SWT.sphr2cart(t, p), b_unit) for t, p in zip(theta_u, phi_u)])`);

  nb.code(`fig, ax = plt.subplots()
ax.plot(B_down * 1e3, proj_down, label="down sweep", color="tab:blue")
ax.plot(B_up * 1e3, proj_up, label="up sweep", color="tab:red")
ax.set_xlabel("μ₀H (mT)")
ax.set_ylabel("M·B̂ / Ms (–)")
ax.set_title("Macrospin hysteresis loop")
ax.legend()
ax.grid(alpha=0.3)
plt.show()`);
}

function doubleLayerCells(nb: NotebookBuilder, input: HystNotebookInput): void {
  const { job } = input;
  const model = getModel('DoubleLayerNumeric');
  void model;
  const ctorArgs: string[] = ['material=material', 'kxi=np.array([1.0, 2.0])  # statics only'];
  for (const [key, value] of Object.entries(job.params ?? {})) {
    if (key === 'Bext' || key === 'phiInit1' || key === 'phiInit2') continue;
    ctorArgs.push(`${key}=${py(value)},`);
  }
  if (job.material2) ctorArgs.push('material2=material2,');

  nb.code(`B_max = ${py(job.Bmax)}  # T
N = ${job.points}

model = SWT.DoubleLayerNumeric(
    Bext=B_max,
    ${ctorArgs.map((a) => (a.endsWith(',') ? a : a + ',')).join('\n    ')}
)

# Thickness-weighted magnetization projection onto the field direction
# (the static field direction is the model's phi angle).
w1 = model.Ms * model.d
w2 = model.Ms2 * model.d2`);

  nb.code(`def run_branch(B_arr, phi_init):
    """Warm-started relaxation: each field step starts from the previous
    equilibrium angles, producing the hysteretic branches of the SAF."""
    proj, phi1s, phi2s = [], [], []
    for B in B_arr:
        model.Bext = float(B)
        model.phiInit1, model.phiInit2 = phi_init
        phis = model.GetPhis()
        phi_init = (float(phis[0]), float(phis[1]))
        p = (w1 * np.cos(phi_init[0] - model.phi) + w2 * np.cos(phi_init[1] - model.phi)) / (w1 + w2)
        proj.append(p)
        phi1s.append(phi_init[0])
        phi2s.append(phi_init[1])
    return np.array(proj), np.array(phi1s), np.array(phi2s), phi_init


B_down = np.linspace(B_max, -B_max, N)
B_up = np.linspace(-B_max, B_max, N)

# Start from positive saturation: both layers (nearly) along the field.
phi_sat = (model.phi + 1e-3, model.phi - 1e-3)
proj_down, phi1_d, phi2_d, state = run_branch(B_down, phi_sat)
proj_up, phi1_u, phi2_u, _ = run_branch(B_up, state)`);

  nb.code(`fig, ax = plt.subplots()
ax.plot(B_down * 1e3, proj_down, label="down sweep", color="tab:blue")
ax.plot(B_up * 1e3, proj_up, label="up sweep", color="tab:red")
ax.set_xlabel("μ₀H (mT)")
ax.set_ylabel("M·B̂ / (Ms·d) weighted (–)")
ax.set_title("SAF hysteresis loop (warm-started relaxation)")
ax.legend()
ax.grid(alpha=0.3)
plt.show()`);

  nb.code(`fig, ax = plt.subplots()
ax.plot(B_down * 1e3, np.rad2deg(phi1_d), label="φ₁ down", color="tab:blue")
ax.plot(B_down * 1e3, np.rad2deg(phi2_d), label="φ₂ down", color="tab:cyan")
ax.plot(B_up * 1e3, np.rad2deg(phi1_u), "--", label="φ₁ up", color="tab:red")
ax.plot(B_up * 1e3, np.rad2deg(phi2_u), "--", label="φ₂ up", color="tab:orange")
ax.set_xlabel("μ₀H (mT)")
ax.set_ylabel("Equilibrium angles (°)")
ax.legend()
ax.grid(alpha=0.3)
plt.show()`);
}

export function generateHysteresisNotebook(input: HystNotebookInput): string {
  const nb = new NotebookBuilder();
  const single = input.job.type === 'single';

  nb.md(`# Hysteresis loop — ${single ? 'single layer (macrospin)' : 'double layer / SAF'}

This notebook was generated by SpinWaveToolkit Web. It computes a full field
loop (+B → −B → +B) where every field step relaxes the magnetization starting
from the previous equilibrium — the history dependence that produces hysteresis.
${
  single
    ? 'The single layer uses `SWT.MacrospinEquilibrium` (Zeeman + demagnetizing + uniaxial anisotropy energy).'
    : 'The double layer minimizes the in-plane free energy of `SWT.DoubleLayerNumeric` (Zeeman + anisotropy + bilinear/biquadratic interlayer coupling).'
}

**Parameters**

| Parameter | Value |
|---|---|
| B max | ${input.meta.Bmax} mT |
${paramsTable(input.meta.paramsDisplay)}`);

  nb.code(INSTALL_CELL(input.swtVersion));
  nb.code(IMPORTS_CELL);

  if (single) {
    singleLayerCells(nb, input);
  } else {
    let mat = materialCode('material', input.materialPresetId, input.job.material!);
    if (input.job.material2 && input.materialPresetId2) {
      mat += '\n' + materialCode('material2', input.materialPresetId2, input.job.material2);
    }
    nb.code(mat);
    doubleLayerCells(nb, input);
  }

  nb.md(citationMarkdown());
  return nb.build();
}
