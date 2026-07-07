/**
 * Jupyter notebooks reproducing the µBLS calculations, following the official
 * SpinWaveToolkit BLS example and Wojewoda et al., PRB 110, 224428 (2024).
 */
import { BLS_INFO } from '../models/bls';
import type { BlsJob } from '../models/types';
import type { BlsMeta } from '../state/store';
import {
  citationMarkdown,
  IMPORTS_CELL,
  INSTALL_CELL,
  materialCode,
  NotebookBuilder,
  paramsTable,
  py,
} from './nbCommon';

export interface BlsNotebookInput {
  job: BlsJob;
  meta: BlsMeta;
  materialPresetId: string;
  swtVersion: string | null;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' ? v : fallback;
}

function stackCells(job: BlsJob): string {
  const c = job.config;
  const cover = Number(c.coverEnabled) === 1;
  if (cover) {
    return `# Optical stack: air / cover / magnetic layer / substrate
DF = [1.0, ${py(num(c.epsCoverRe))} + 1j*${py(num(c.epsCoverIm))}, ${py(num(c.epsMagRe))} + 1j*${py(num(c.epsMagIm))}, ${py(num(c.epsSubRe))} + 1j*${py(num(c.epsSubIm))}]
PM = [1, 1, 1, 1]
thicknesses = [${py(num(c.dCover))}, ${py(num(c.d))}]  # cover, magnetic layer (m)
source_layer = 2  # index of the magnetic layer in the stack`;
  }
  return `# Optical stack: air / magnetic layer / substrate
DF = [1.0, ${py(num(c.epsMagRe))} + 1j*${py(num(c.epsMagIm))}, ${py(num(c.epsSubRe))} + 1j*${py(num(c.epsSubIm))}]
PM = [1, 1, 1]
thicknesses = [${py(num(c.d))}]  # magnetic layer (m)
source_layer = 1  # index of the magnetic layer in the stack`;
}

function focalCell(job: BlsJob): string {
  const o = job.optics;
  return `# Incident focal field of the objective lens (Richards-Wolf theory)
objective = SWT.bls.ObjectiveLens(NA=${py(o.NA)}, wavelength=${py(o.wavelength)}, f0=${py(o.f0 ?? 10)}, f=1e-3)
x, y, Ex, Ey, Ez = objective.getFocalField(z=0, rho_max=${py(o.rhoMax ?? 10e-6)}, N=${py(o.focalN ?? 201)})
E = [Ex, Ey, Ez]
Exy = [x, y]`;
}

function thermalBlochCell(job: BlsJob): string {
  const c = job.config;
  return `# Thermal Bloch function on a 2D (kx, ky) grid from the Kalinikos-Slavin
# model, with Bose-Einstein weighting. Composition [B, 0, iB] follows the
# official SpinWaveToolkit BLS example.
Nk = ${py(num(c.nK, 48))}
k_max = ${py(num(c.kMax, 15e6))}  # rad/m
Nf = ${py(num(c.nF, 61))}
kx_grid = np.linspace(-k_max, k_max, Nk)
ky_grid = np.linspace(-k_max, k_max, Nk)
kx_safe = kx_grid.copy()
kx_safe[np.abs(kx_safe) < 1e-6] = 1e-6
KX, KY = np.meshgrid(kx_safe, ky_grid, indexing="ij")
K = np.hypot(KX, KY)
PHI = np.arctan2(KY, KX)

model = SWT.SingleLayer(Bext=${py(num(c.Bext))}, kxi=K.flatten(), theta=np.pi / 2,
                        phi=PHI.flatten(), d=${py(num(c.d))}, material=material)

w_common = np.linspace(f_min, f_max, Nf) * 2 * np.pi  # (rad/s)
Bloch2D = np.zeros((Nf, Nk, Nk), dtype=complex)
for n in range(${py(num(c.nModes, 2))}):
    w, bf = model.GetBlochFunction(n=n, Nf=Nf, temp=${py(num(c.temp, 300))}, mu=-1e12 * SWT.H)
    bf = bf.reshape(Nf, Nk, Nk)
    for i in range(Nk):
        for j in range(Nk):
            Bloch2D[:, i, j] += np.interp(w_common, w, bf[:, i, j], left=0, right=0)
Bloch3 = np.array([Bloch2D, np.zeros_like(Bloch2D), 1j * Bloch2D])`;
}

const SIGMA_CALL = `sigma = SWT.bls.get_signal_GF_focal(
    SweepBloch=w_common, KxKyBloch=[kx_grid, ky_grid], Bloch=Bloch3,
    Exy=Exy, E=E, DF=DF, PM=PM, d=thicknesses, NA=NA_current,
    Nq=Nq, source_layer_index=source_layer, wavelength=wavelength_current,
)`;

function thermalCells(nb: NotebookBuilder, input: BlsNotebookInput): void {
  const { job } = input;
  const c = job.config;
  const auto = Number(c.fAuto ?? 1) === 1;

  nb.code(focalCell(job));
  nb.code(stackCells(job));
  nb.code(`NA_current = ${py(job.optics.NA)}
wavelength_current = ${py(job.optics.wavelength)}
Nq = ${py(num(c.nQ, 28))}  # q-space half-resolution (runtime ∝ Nq^4)
${
  auto
    ? `# Automatic frequency window covering the detectable modes
f_min, f_max = ${py(num(c.fMin, 2e9))}, ${py(num(c.fMax, 20e9))}  # replaced below
k_det = 1.5 * (2 * np.pi / wavelength_current) * NA_current
probe = SWT.SingleLayer(Bext=${py(num(c.Bext))}, kxi=np.linspace(1.0, min(${py(num(c.kMax, 15e6))}, k_det), 40),
                        theta=np.pi / 2, phi=np.pi / 2, d=${py(num(c.d))}, material=material)
fmins, fmaxs = [], []
for n in range(${py(num(c.nModes, 2))}):
    for phi in (0.0, np.pi / 2):
        probe.phi = phi
        w = np.real(probe.GetDispersion(n=n))
        fmins.append(np.nanmin(w)); fmaxs.append(np.nanmax(w))
f_min = 0.85 * min(fmins) / (2 * np.pi)
f_max = 1.1 * max(fmaxs) / (2 * np.pi)`
    : `f_min, f_max = ${py(num(c.fMin, 2e9))}, ${py(num(c.fMax, 20e9))}  # Hz`
}`);

  if (!job.sweep) {
    nb.code(thermalBlochCell(job));
    nb.code(`# BLS spectrum via the Green-function formalism (Eq. (27), thermal magnons)
${SIGMA_CALL}`);
    nb.code(`fig, ax = plt.subplots()
ax.plot(w_common / 2 / np.pi / 1e9, np.abs(sigma))
ax.set_xlabel("Frequency (GHz)")
ax.set_ylabel("BLS intensity (arb. u.)")
ax.set_title("Thermal µBLS spectrum")
plt.show()`);
    return;
  }

  // swept thermal spectra
  const key = job.sweep.key;
  const opticsSwept = key === 'NA' || key === 'wavelength';
  const applyLine = opticsSwept
    ? key === 'NA'
      ? 'NA_current = value'
      : 'wavelength_current = value'
    : `# swept parameter is used inside the loop below`;
  const modelBext = key === 'Bext' ? 'value' : py(num(c.Bext));
  const modelD = key === 'd' ? 'value' : py(num(c.d));
  const tempExpr = key === 'temp' ? 'value' : py(num(c.temp, 300));
  const coverLine =
    key === 'dCover' ? `    thicknesses[0] = value  # swept cover thickness\n` : '';

  nb.code(`sweep_values = np.array(${JSON.stringify(job.sweep.values)})  # SI
spectra = []
for value in sweep_values:
    ${applyLine}
${
  opticsSwept
    ? `    objective = SWT.bls.ObjectiveLens(NA=NA_current, wavelength=wavelength_current, f0=${py(job.optics.f0 ?? 10)}, f=1e-3)
    x, y, Ex, Ey, Ez = objective.getFocalField(z=0, rho_max=${py(job.optics.rhoMax ?? 10e-6)}, N=${py(job.optics.focalN ?? 201)})
    E = [Ex, Ey, Ez]; Exy = [x, y]
`
    : ''
}${coverLine}    Nk = ${py(num(c.nK, 48))}; Nf = ${py(num(c.nF, 61))}; k_max = ${py(num(c.kMax, 15e6))}
    kx_grid = np.linspace(-k_max, k_max, Nk); ky_grid = kx_grid.copy()
    kx_safe = kx_grid.copy(); kx_safe[np.abs(kx_safe) < 1e-6] = 1e-6
    KX, KY = np.meshgrid(kx_safe, ky_grid, indexing="ij")
    model = SWT.SingleLayer(Bext=${modelBext}, kxi=np.hypot(KX, KY).flatten(), theta=np.pi / 2,
                            phi=np.arctan2(KY, KX).flatten(), d=${modelD}, material=material)
    w_common = np.linspace(f_min, f_max, Nf) * 2 * np.pi
    Bloch2D = np.zeros((Nf, Nk, Nk), dtype=complex)
    for n in range(${py(num(c.nModes, 2))}):
        w, bf = model.GetBlochFunction(n=n, Nf=Nf, temp=${tempExpr}, mu=-1e12 * SWT.H)
        bf = bf.reshape(Nf, Nk, Nk)
        for i in range(Nk):
            for j in range(Nk):
                Bloch2D[:, i, j] += np.interp(w_common, w, bf[:, i, j], left=0, right=0)
    Bloch3 = np.array([Bloch2D, np.zeros_like(Bloch2D), 1j * Bloch2D])
    ${SIGMA_CALL.split('\n').join('\n    ')}
    spectra.append(np.abs(sigma))
spectra = np.array(spectra)`);
  nb.code(`fig, ax = plt.subplots()
pcm = ax.pcolormesh(w_common / 2 / np.pi / 1e9, sweep_values, spectra, shading="auto", cmap="viridis")
fig.colorbar(pcm, ax=ax, label="BLS intensity (arb. u.)")
ax.set_xlabel("Frequency (GHz)")
ax.set_ylabel("${input.meta.paramLabel ?? key} (SI)")
ax.set_title("Thermal µBLS spectra vs ${input.meta.paramLabel ?? key}")
plt.show()`);
}

export function generateBlsNotebook(input: BlsNotebookInput): string {
  const nb = new NotebookBuilder();

  nb.md(`# µBLS — ${input.job.sweep ? `thermal spectra vs ${input.meta.paramLabel ?? input.job.sweep.key}` : 'thermal spectrum'}

${BLS_INFO.summary}

This notebook was generated by SpinWaveToolkit Web and reproduces the browser calculation. Model reference: [${BLS_INFO.reference.label}](${BLS_INFO.reference.url}).

**Parameters**

| Parameter | Value |
|---|---|
${paramsTable(input.meta.paramsDisplay)}`);

  nb.code(INSTALL_CELL(input.swtVersion));
  nb.code(IMPORTS_CELL);
  nb.code(
    materialCode(
      'material',
      input.materialPresetId,
      input.job.config.material as never,
    ),
  );

  thermalCells(nb, input);

  nb.md(citationMarkdown());
  return nb.build();
}
