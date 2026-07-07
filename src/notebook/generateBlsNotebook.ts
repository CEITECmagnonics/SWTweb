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

function sensitivityCells(nb: NotebookBuilder, input: BlsNotebookInput): void {
  const { job } = input;
  const c = job.config;
  nb.code(focalCell(job));
  nb.code(stackCells(job));
  nb.code(`# Detection sensitivity for coherently excited spin waves (Eq. (28)):
# a delta Bloch function propagating along the beam polarization axis,
# at its dispersion frequency, summed coherently (amplitudes first,
# intensity after).
# NOTE: the delta goes on the SECOND Bloch axis — get_signal_GF_focal
# interpolates the focal-field FFT with its axes transposed relative to
# the Bloch array (same convention as the original MATLAB reference,
# GetBLSsignalCoherent.m: M(Ind0, Ind)). The library q-grid spans
# ±1.1·k0, so k is capped there.
NA_current = ${py(job.optics.NA)}
wavelength_current = ${py(job.optics.wavelength)}
Nq = ${py(num(c.nQ, 28))}
k_max = min(${py(num(c.kMax, 20e6))}, 1.05 * 2 * np.pi / wavelength_current)  # rad/m
n_points = ${py(num(c.kPoints, 40))}
dk = k_max / n_points
half = int(np.ceil(n_points * 1.25))
kx_grid = np.arange(-half, half + 1) * dk
ky_grid = kx_grid.copy()
iy0 = int(np.argmin(np.abs(ky_grid)))

ks, sens = [], []
for ix, kv in enumerate(kx_grid):
    if kv < dk / 2 or kv > k_max + dk / 2:
        continue
    model = SWT.SingleLayer(Bext=${py(num(c.Bext))}, kxi=np.array([max(kv, 1e-6)]),
                            theta=np.pi / 2, phi=${py(num(c.phi, Math.PI / 2))}, d=${py(num(c.d))},
                            material=material)
    w0 = float(np.real(model.GetDispersion(n=0)[0]))
    B2 = np.zeros((1, len(kx_grid), len(ky_grid)), dtype=complex)
    B2[0, iy0, ix] = 1.0  # delta on the second axis (see note above)
    Bloch3 = np.array([B2, np.zeros_like(B2), -1j * B2])  # Mz = -i*Mx
    sigma = SWT.bls.get_signal_GF_focal(
        SweepBloch=np.array([w0]), KxKyBloch=[kx_grid, ky_grid], Bloch=Bloch3,
        Exy=Exy, E=E, DF=DF, PM=PM, d=thicknesses, NA=NA_current,
        Nq=Nq, source_layer_index=source_layer, wavelength=wavelength_current,
        coherent_exc=True,
    )
    ks.append(kv)
    sens.append(abs(np.ravel(sigma)[0]))
ks = np.array(ks)
sens = np.array(sens) / np.max(sens)`);
  nb.code(`fig, ax = plt.subplots()
ax.plot(ks * 1e-6, sens)
ax.set_xlabel("Wavenumber k (rad/µm)")
ax.set_ylabel("Detection sensitivity (norm.)")
ax.set_title("µBLS detection sensitivity, NA = ${py(job.optics.NA)}")
ax.grid(alpha=0.3)
plt.show()

for level in (0.1, 0.01):
    above = ks[sens >= level]
    if len(above):
        print(f"{level*100:.0f}% detection edge: {above.max()*1e-6:.1f} rad/um")`);
}

export function generateBlsNotebook(input: BlsNotebookInput): string {
  const nb = new NotebookBuilder();
  const thermal = input.job.task === 'thermal';

  nb.md(`# µBLS — ${thermal ? (input.job.sweep ? `thermal spectra vs ${input.meta.paramLabel ?? input.job.sweep.key}` : 'thermal spectrum') : 'detection sensitivity for coherent spin waves'}

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

  if (thermal) thermalCells(nb, input);
  else sensitivityCells(nb, input);

  nb.md(citationMarkdown());
  return nb.build();
}
