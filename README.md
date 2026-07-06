# SWTweb — SpinWaveToolkit in your browser

Web interface for [SpinWaveToolkit](https://github.com/CEITECmagnonics/SpinWaveToolkit), the Python package with analytical tools for spin-wave physics. All calculations run **locally in the browser** — the real, unmodified `SpinWaveToolkit` package executes on [Pyodide](https://pyodide.org) (Python compiled to WebAssembly), so results are identical to the library, and no data ever leaves your device.

## Features

- **All five SWT model classes**: `SingleLayer` (Kalinikos–Slavin), `SingleLayerNumeric` (Tacchi et al.), `DoubleLayerNumeric` (SAF, Gallardo et al.), `SingleLayerSCcoupled` (Zhou et al.), and `BulkPolariton` — plus `MacrospinEquilibrium` for static equilibria.
- **Parameter sweeps** (`#/sweep`): sweep field, thickness, angles, coupling… of any model — quantities at a fixed k (k = 0 / FMR limit by default) or full dispersion maps over (k, parameter); the SAF equilibrium can be relaxed adiabatically between steps.
- **Hysteresis loops** (`#/hysteresis`): full +B → −B → +B loops for a single layer (macrospin: Zeeman + demag + uniaxial anisotropies) or a SAF double layer (warm-started in-plane free-energy minimization); plots the M·B̂ projection or the equilibrium angles.
- **Quantities**: dispersion relations, group velocity, lifetime, decay length, density of states, ellipticity, Bloch-function heatmaps, exchange length, parallel-pumping thresholds, SAF equilibrium angles…
- **Materials**: NiFe, CoFeB, FeNi, YIG presets — every property editable, plus fully custom materials.
- **Interactive graphing** (Plotly): overlay runs to compare parameter sweeps, per-trace colors/styles, log axes, unit switching (rad/µm, rad/m, wavelength), custom titles and labels.
- **Export**: PNG/SVG download, copy-to-clipboard, CSV/JSON data with full parameter provenance.
- **Jupyter notebook generation**: one click produces a commented `.ipynb` that reproduces the calculation with `pip`-installable SpinWaveToolkit and matplotlib plots — ready to attach to a paper or use as teaching material.
- **Learn the physics**: every parameter has a tooltip; each model has an explanation panel with the key formulas (KaTeX) and literature references.

## Development

```bash
npm install
npm run dev        # dev server at http://localhost:5173
npm test           # unit tests (vitest)
npm run lint       # eslint
npm run build      # production build into dist/
npm run preview    # serve the production build
```

### Architecture

```
React + TypeScript + Vite + Tailwind (UI)
 ├─ src/models/registry.ts   ← single source of truth: all SWT classes,
 │                              parameters, units, quantities, docs
 ├─ src/pyodide/worker.ts    ← Web Worker: Pyodide + numpy/scipy +
 │                              vendored SWT wheel (public/wheels/)
 ├─ src/python/swt_bridge.py ← job spec (JSON, SI units) → normalized traces
 └─ src/notebook/…           ← nbformat-4 generator
```

The UI forms, the Python job, the plot labels, and the generated notebooks are all derived from the model registry, so adding a new SWT class or quantity is a single-file change.

SpinWaveToolkit is pinned (`public/wheels/spinwavetoolkit-1.3.0-py3-none-any.whl`, installed from same-origin at runtime) so the scientific results are reproducible and auditable. To upgrade: drop in the new wheel, update the filename in `src/pyodide/worker.ts`, and bump the version in `src/notebook/generateNotebook.ts` tests.

### Deployment

Pushing to `main` runs lint + tests + build and deploys `dist/` to GitHub Pages via `.github/workflows/deploy.yml` (enable **Settings → Pages → Source: GitHub Actions** once). The app is fully static — any static host works.

## Security

- No backend, no accounts, no analytics; computation is sandboxed WebAssembly.
- Content-Security-Policy limits scripts to same-origin plus the pinned Pyodide CDN (`cdn.jsdelivr.net`).
- User inputs are validated numbers/enums passed as JSON data to a static Python bridge — no code is generated from user input.

## Citing

If you use results from this tool, please cite the SpinWaveToolkit paper:

> J. Klíma, O. Wojewoda, J. Krčma, M. Hrtoň, D. Pavelka, J. Holobrádek, and M. Urbánek, "SpinWaveToolkit: Python package for (semi-)analytical calculations in the field of spin-wave physics", J. Phys.: Condens. Matter **38**, 175802 (2026). [doi:10.1088/1361-648X/ae6430](https://doi.org/10.1088/1361-648X/ae6430)

The web UI ("How to cite" panel) offers one-click BibTeX copy, and every generated notebook embeds this citation.

## License

MIT — same spirit as SpinWaveToolkit itself.
