"""
Bridge between the SWTweb frontend and SpinWaveToolkit, executed in Pyodide.

Receives a JSON job spec (all values SI), instantiates the requested model
class, calls the requested quantity methods, and returns normalized results:
1D traces, 2D grids (heatmaps), and scalar values. Non-finite numbers are
mapped to None so the payload is valid JSON.
"""

import json
import math

import numpy as np

# --- SciPy >= 1.14 compatibility shim -------------------------------------
# SpinWaveToolkit 1.3.0 calls scipy.integrate.simpson(y, x) positionally,
# which newer SciPy (as shipped by Pyodide) rejects (x became keyword-only).
# Patch before SWT imports `simpson` into its own namespace.
import scipy.integrate as _scipy_integrate

_orig_simpson = _scipy_integrate.simpson


def _simpson_compat(y, x=None, *args, **kwargs):
    if x is not None:
        kwargs.setdefault("x", x)
    return _orig_simpson(y, *args, **kwargs)


_scipy_integrate.simpson = _simpson_compat
# ---------------------------------------------------------------------------

import SpinWaveToolkit as SWT


def _clean_1d(arr):
    """ndarray -> list with non-finite values replaced by None."""
    out = []
    for x in np.real(np.asarray(arr, dtype=complex)).ravel():
        v = float(x)
        out.append(v if math.isfinite(v) else None)
    return out


def _make_material(values):
    return SWT.Material(
        Ms=values["Ms"],
        Aex=values["Aex"],
        alpha=values["alpha"],
        gamma=values["gamma"],
        mu0dH0=values.get("mu0dH0", 0),
        Ku=values.get("Ku", 0),
    )


def _make_kxi(k_range):
    if k_range["spacing"] == "log":
        kmin = max(k_range["min"], 1e-12)
        return np.geomspace(kmin, k_range["max"], int(k_range["points"]))
    return np.linspace(k_range["min"], k_range["max"], int(k_range["points"]))


def _resolve_kwargs(names, method_kwargs):
    """Pick the method kwargs listed in `names`, mapping 'inf' -> np.inf."""
    out = {}
    for name in names or []:
        if name not in method_kwargs:
            continue
        val = method_kwargs[name]
        if val == "inf":
            val = np.inf
        out[name] = val
    return out


def _build_model(job, kxi):
    params = dict(job["params"])
    material = _make_material(job["material"])
    cls = getattr(SWT, job["model"])
    if job["model"] == "DoubleLayerNumeric" and "material2" in job:
        params["material2"] = _make_material(job["material2"])
    return cls(material=material, kxi=kxi, **params)


def run_job(job_json):
    job = json.loads(job_json)
    kxi = _make_kxi(job["kRange"])
    model = _build_model(job, kxi)
    method_kwargs = job.get("methodKwargs", {})
    modes = job.get("modes", [0]) or [0]
    n_transverse = int(job.get("nT", 0))

    result = {"traces": [], "scalars": [], "grids": []}
    x = _clean_1d(kxi)

    for q in job["quantities"]:
        fn = getattr(model, q["method"])
        kwargs = _resolve_kwargs(q.get("kwargNames"), method_kwargs)
        returns = q["returns"]
        mode_arg = q.get("modeArg")

        if returns == "array":
            if mode_arg == "n_nT":
                for n in modes:
                    y = fn(n=n, nT=n_transverse, **kwargs)
                    label = f"n={n}" if n_transverse == 0 else f"n={n}, nT={n_transverse}"
                    result["traces"].append(
                        {"quantity": q["id"], "label": label, "x": x, "y": _clean_1d(y)}
                    )
            elif mode_arg == "n":
                for n in modes:
                    y = fn(n=n, **kwargs)
                    result["traces"].append(
                        {"quantity": q["id"], "label": f"mode {n}", "x": x, "y": _clean_1d(y)}
                    )
            else:
                y = fn(**kwargs)
                result["traces"].append(
                    {"quantity": q["id"], "label": "", "x": x, "y": _clean_1d(y)}
                )

        elif returns in ("stacked", "tuple_stacked"):
            res = fn(**kwargs)
            stacked = res[0] if returns == "tuple_stacked" else res
            stacked = np.atleast_2d(np.asarray(stacked))
            for i in range(stacked.shape[0]):
                result["traces"].append(
                    {
                        "quantity": q["id"],
                        "label": f"mode {i}",
                        "x": x,
                        "y": _clean_1d(stacked[i]),
                    }
                )

        elif returns == "grid":
            grid_kwargs = dict(kwargs)
            if mode_arg == "n_nT":
                grid_kwargs.update(n=modes[0], nT=n_transverse)
            elif mode_arg == "n":
                grid_kwargs.update(n=modes[0])
            freq_axis, grid = fn(**grid_kwargs)
            grid = np.asarray(grid, dtype=float)
            peak = np.nanmax(np.abs(grid))
            if peak > 0 and math.isfinite(peak):
                grid = grid / peak
            result["grids"].append(
                {
                    "quantity": q["id"],
                    "label": f"mode {modes[0]}",
                    "x": x,
                    "y": _clean_1d(freq_axis),
                    "z": [_clean_1d(row) for row in grid],
                }
            )

        elif returns == "scalar":
            val = float(np.real(fn(**kwargs)))
            result["scalars"].append(
                {
                    "quantity": q["id"],
                    "index": 0,
                    "value": val if math.isfinite(val) else None,
                }
            )

        elif returns == "tuple_scalar":
            vals = np.asarray(fn(**kwargs), dtype=float).ravel()
            for i, v in enumerate(vals):
                v = float(v)
                result["scalars"].append(
                    {
                        "quantity": q["id"],
                        "index": i,
                        "value": v if math.isfinite(v) else None,
                    }
                )

        else:
            raise ValueError(f"Unknown returns kind: {returns}")

    return json.dumps(result)


# ---------------------------------------------------------------------------
# Macrospin equilibrium (static) support
# ---------------------------------------------------------------------------

_DEMAG_PRESETS = {
    "film": [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0], [0.0, 0.0, 1.0]],
    "sphere": [[1 / 3, 0.0, 0.0], [0.0, 1 / 3, 0.0], [0.0, 0.0, 1 / 3]],
    "zero": [[0.0, 0.0, 0.0], [0.0, 0.0, 0.0], [0.0, 0.0, 0.0]],
}


def _macrospin_build(cfg):
    """Create a MacrospinEquilibrium from an SI config dict."""
    demag = np.array(_DEMAG_PRESETS.get(cfg.get("demag", "film"), _DEMAG_PRESETS["film"]))
    m = SWT.MacrospinEquilibrium(
        Ms=cfg["Ms"],
        Bext=cfg["Bext"],
        theta_H=cfg["theta_H"],
        phi_H=cfg["phi_H"],
        theta=cfg.get("theta0"),
        phi=cfg.get("phi0"),
        demag=demag,
        verbose=False,
    )
    for name in ("ani1", "ani2"):
        ku = cfg.get(f"{name}_Ku") or 0
        if ku != 0:
            m.add_uniaxial_anisotropy(
                name,
                Ku=ku,
                theta=cfg.get(f"{name}_theta", 0),
                phi=cfg.get(f"{name}_phi", 0),
            )
    return m


def _macrospin_apply(m, cfg, key, value):
    """Apply one swept value to an existing MacrospinEquilibrium."""
    if key == "Bext":
        m.Bext["Bext"] = value
    elif key == "theta_H":
        m.Bext["theta_H"] = value
    elif key == "phi_H":
        m.Bext["phi_H"] = value
    elif key.endswith("_Ku"):
        base = key[: -len("_Ku")]
        m.add_uniaxial_anisotropy(
            base,
            Ku=value,
            theta=cfg.get(f"{base}_theta", 0),
            phi=cfg.get(f"{base}_phi", 0),
        )
    else:
        raise ValueError(f"Parameter '{key}' cannot be swept in the macrospin model.")
    m.recalc_params()


def _macrospin_state(m):
    """Collect the current equilibrium state as a quantity dict (SI)."""
    theta, phi = float(m.M["theta"]), float(m.M["phi"])
    mvec = np.asarray(SWT.sphr2cart(theta, phi), dtype=float)
    return {
        "thetaM": theta,
        "phiM": phi,
        "projection": float(np.dot(mvec, np.asarray(m.b, dtype=float))),
        "edenZeeman": float(m.eden_zeeman),
        "edenDemag": float(m.eden_demag),
        "edenAnis": float(m.eden_anis_uni),
    }


def _macrospin_sweep(job, values):
    cfg = job["config"]
    m = _macrospin_build(cfg)
    key = job["sweep"]["key"]
    collected = {qid: [] for qid in
                 ("thetaM", "phiM", "projection", "edenZeeman", "edenDemag", "edenAnis")}
    for v in values:
        _macrospin_apply(m, cfg, key, float(v))
        # minimize() warm-starts from the previous equilibrium -> adiabatic sweep
        m.minimize(verbose=False)
        state = _macrospin_state(m)
        for qid, val in state.items():
            collected[qid].append(val)
    x = [float(v) for v in values]
    traces = [
        {"quantity": qid, "label": "", "x": x, "y": _clean_1d(ys)}
        for qid, ys in collected.items()
    ]
    return json.dumps({"traces": traces, "grids": []})


# ---------------------------------------------------------------------------
# Parameter sweeps
# ---------------------------------------------------------------------------

def _sweep_series_value(fn, q, kwargs, modes, n_transverse, is_map):
    """Evaluate one quantity for the current model; yield (label, value) pairs.

    In fixed-k mode the value is the scalar at the first k point; in map mode
    it is the full row over the k grid.
    """
    returns = q["returns"]
    mode_arg = q.get("modeArg")

    def sample(arr):
        arr = np.real(np.asarray(arr, dtype=complex)).astype(float)
        return list(arr.ravel()) if is_map else float(arr.ravel()[0])

    if returns == "array":
        if mode_arg == "n_nT":
            for n in modes:
                yield (f"n={n}", sample(fn(n=n, nT=n_transverse, **kwargs)))
        elif mode_arg == "n":
            for n in modes:
                yield (f"mode {n}", sample(fn(n=n, **kwargs)))
        else:
            yield ("", sample(fn(**kwargs)))
    elif returns in ("stacked", "tuple_stacked"):
        res = fn(**kwargs)
        stacked = res[0] if returns == "tuple_stacked" else res
        stacked = np.atleast_2d(np.real(np.asarray(stacked)))
        for i in range(stacked.shape[0]):
            yield (f"mode {i}", sample(stacked[i]))
    elif returns == "scalar":
        yield ("", float(np.real(fn(**kwargs))))
    elif returns == "tuple_scalar":
        vals = np.asarray(fn(**kwargs), dtype=float).ravel()
        for i, v in enumerate(vals):
            yield (f"[{i}]", float(v))
    else:
        raise ValueError(f"Quantity kind '{returns}' cannot be swept.")


def run_sweep(job_json):
    """Sweep one model parameter; returns traces (fixed k) or heatmaps (map)."""
    job = json.loads(job_json)
    key = job["sweep"]["key"]
    values = [float(v) for v in job["sweep"]["values"]]

    if job["model"] == "Macrospin":
        return _macrospin_sweep(job, values)

    is_map = job.get("mode") == "map"
    if is_map:
        kxi = _make_kxi(job["kRange"])
    else:
        k0 = max(float(job.get("kFixed", 0)), 1e-9)
        # Two k points so that derivative-based quantities (v_g, ...) work.
        kxi = np.array([k0, k0 + max(abs(k0) * 1e-3, 1.0)])

    relax = bool(job.get("relax")) and job["model"] == "DoubleLayerNumeric"
    in_method = key in (job.get("methodKwargs") or {})
    modes = job.get("modes", [0]) or [0]
    n_transverse = int(job.get("nT", 0))

    series = {}
    order = []
    prev_phis = None

    for v in values:
        params = dict(job["params"])
        method_kwargs = dict(job.get("methodKwargs") or {})
        if in_method:
            method_kwargs[key] = v
        else:
            params[key] = v
        if relax and prev_phis is not None:
            # Warm-start the equilibrium search from the previous field step
            # (adiabatic relaxation -> captures hysteretic branches).
            params["phiInit1"], params["phiInit2"] = prev_phis
        sub = dict(job)
        sub["params"] = params
        model = _build_model(sub, kxi)
        if relax:
            phis = model.GetPhis()
            prev_phis = [float(phis[0]), float(phis[1])]
            model.phiInit1, model.phiInit2 = prev_phis

        for q in job["quantities"]:
            fn = getattr(model, q["method"])
            kwargs = _resolve_kwargs(q.get("kwargNames"), method_kwargs)
            for label, val in _sweep_series_value(fn, q, kwargs, modes, n_transverse, is_map):
                skey = (q["id"], label)
                if skey not in series:
                    series[skey] = []
                    order.append(skey)
                series[skey].append(val)

    if is_map:
        grids = [
            {
                "quantity": qid,
                "label": label,
                "x": _clean_1d(kxi),
                "y": values,
                "z": [_clean_1d(row) for row in series[(qid, label)]],
            }
            for qid, label in order
        ]
        return json.dumps({"traces": [], "grids": grids})

    traces = [
        {"quantity": qid, "label": label, "x": values, "y": _clean_1d(series[(qid, label)])}
        for qid, label in order
    ]
    return json.dumps({"traces": traces, "grids": []})


# ---------------------------------------------------------------------------
# Hysteresis loops
# ---------------------------------------------------------------------------

def run_hysteresis(job_json):
    """Full hysteresis loop: +Bmax -> -Bmax -> +Bmax with warm-started minima."""
    job = json.loads(job_json)
    n = int(job["points"])
    b0 = float(job["Bmax"])
    b_down = np.linspace(b0, -b0, n)
    b_up = np.linspace(-b0, b0, n)

    if job["type"] == "single":
        cfg = dict(job["config"])
        cfg["Bext"] = b0
        m = _macrospin_build(cfg)
        m.minimize(verbose=False)  # saturate at +Bmax before the loop
        b_unit = np.asarray(SWT.sphr2cart(cfg["theta_H"], cfg["phi_H"]), dtype=float)
        branches = []
        for label, b_arr in (("down", b_down), ("up", b_up)):
            theta, phi = m.hysteresis(b_arr, cfg["theta_H"], cfg["phi_H"])
            proj = [
                float(np.dot(np.asarray(SWT.sphr2cart(t, p), dtype=float), b_unit))
                for t, p in zip(theta, phi)
            ]
            branches.append(
                {
                    "label": label,
                    "B": [float(b) for b in b_arr],
                    "proj": _clean_1d(proj),
                    "a1": _clean_1d(theta),
                    "a2": _clean_1d(phi),
                }
            )
        return json.dumps({"type": "single", "branches": branches})

    # Double layer (SAF): warm-started in-plane free-energy minimization.
    params = dict(job["params"])
    params["Bext"] = b0
    sub = {"model": "DoubleLayerNumeric", "material": job["material"], "params": params}
    if "material2" in job:
        sub["material2"] = job["material2"]
    model = _build_model(sub, np.array([1.0, 2.0]))  # kxi is irrelevant for statics
    phi_field = float(params.get("phi", np.pi / 2))
    w1 = float(model.Ms) * float(model.d)
    w2 = float(model.Ms2) * float(model.d2)
    # Start the loop from positive saturation: both layers (nearly) along the
    # field. The default antiparallel guess is a local minimum at +Bmax.
    prev = [phi_field + 1e-3, phi_field - 1e-3]
    branches = []
    for label, b_arr in (("down", b_down), ("up", b_up)):
        projs, phi1s, phi2s = [], [], []
        for b in b_arr:
            model.Bext = float(b)
            if prev is not None:
                model.phiInit1, model.phiInit2 = prev
            phis = model.GetPhis()
            prev = [float(phis[0]), float(phis[1])]
            proj = (
                w1 * math.cos(prev[0] - phi_field) + w2 * math.cos(prev[1] - phi_field)
            ) / (w1 + w2)
            projs.append(proj)
            phi1s.append(prev[0])
            phi2s.append(prev[1])
        branches.append(
            {
                "label": label,
                "B": [float(b) for b in b_arr],
                "proj": _clean_1d(projs),
                "a1": _clean_1d(phi1s),
                "a2": _clean_1d(phi2s),
            }
        )
    return json.dumps({"type": "double", "branches": branches})


# ---------------------------------------------------------------------------
# Micro-focused BLS (SpinWaveToolkit.bls submodule)
# Model: Wojewoda et al., Phys. Rev. B 110, 224428 (2024).
# ---------------------------------------------------------------------------

def _bls_focal(optics):
    """Incident focal field of the objective lens (Richards-Wolf)."""
    lens = SWT.bls.ObjectiveLens(
        NA=optics["NA"],
        wavelength=optics["wavelength"],
        f0=optics.get("f0", 10),
        f=optics.get("focalLength", 1e-3),
    )
    x, y, ex, ey, ez = lens.getFocalField(
        z=0, rho_max=optics.get("rhoMax", 10e-6), N=int(optics.get("focalN", 201))
    )
    return [x, y], [ex, ey, ez]


def _bls_stack(cfg):
    """Dielectric stack: superstrate / [cover] / magnetic layer / substrate.

    Returns (DF, PM, thicknesses, source_layer_index).
    """
    eps_mag = complex(cfg["epsMagRe"], cfg["epsMagIm"])
    eps_sub = complex(cfg["epsSubRe"], cfg["epsSubIm"])
    if cfg.get("coverEnabled"):
        eps_cov = complex(cfg["epsCoverRe"], cfg["epsCoverIm"])
        df = [1.0, eps_cov, eps_mag, eps_sub]
        thicknesses = [cfg["dCover"], cfg["d"]]
        source = 2
    else:
        df = [1.0, eps_mag, eps_sub]
        thicknesses = [cfg["d"]]
        source = 1
    return df, [1.0] * len(df), thicknesses, source


def _bls_thermal_bloch(cfg, w_common, kx, ky):
    """Vectorial thermal Bloch function (3, Nf, Nkx, Nky) from SingleLayer.

    Composition [B, 0, iB] follows the official SWT BLS example.
    """
    nf = len(w_common)
    nk = len(kx)
    kx_safe = kx.copy()
    kx_safe[np.abs(kx_safe) < 1e-6] = 1e-6
    KX, KY = np.meshgrid(kx_safe, ky, indexing="ij")
    K = np.hypot(KX, KY)
    PHI = np.arctan2(KY, KX)
    model = SWT.SingleLayer(
        Bext=cfg["Bext"],
        kxi=K.flatten(),
        theta=cfg.get("theta", np.pi / 2),
        phi=PHI.flatten(),
        d=cfg["d"],
        material=_make_material(cfg["material"]),
    )
    b2 = np.zeros((nf, nk, nk), dtype=complex)
    for n in range(int(cfg.get("nModes", 2))):
        w, bf = model.GetBlochFunction(
            n=n, Nf=nf, temp=cfg.get("temp", 300), mu=-1e12 * SWT.H
        )
        bf = bf.reshape(nf, nk, nk)
        for i in range(nk):
            for j in range(nk):
                b2[:, i, j] += np.interp(w_common, w, bf[:, i, j], left=0, right=0)
    return np.array([b2, np.zeros_like(b2), 1j * b2])


def _bls_auto_frange(cfg, kmax, optics):
    """Frequency window covering modes n = 0..nModes-1 over the *detectable*
    k range (~1.5 k0 NA). Magnons far beyond the NA edge are invisible to
    µBLS and extending the window to them only amplifies numerical leakage."""
    k_det = 1.5 * (2 * np.pi / optics["wavelength"]) * optics["NA"]
    model = SWT.SingleLayer(
        Bext=cfg["Bext"],
        kxi=np.linspace(1.0, min(kmax, k_det), 40),
        theta=cfg.get("theta", np.pi / 2),
        phi=np.pi / 2,
        d=cfg["d"],
        material=_make_material(cfg["material"]),
    )
    fmin, fmax = np.inf, 0.0
    for n in range(int(cfg.get("nModes", 2))):
        for phi in (0.0, np.pi / 2):
            model.phi = phi
            w = np.real(model.GetDispersion(n=n))
            fmin = min(fmin, float(np.nanmin(w)))
            fmax = max(fmax, float(np.nanmax(w)))
    return 0.85 * fmin, 1.1 * fmax


def _bls_thermal_sigma(cfg, optics, exy, e_field):
    """One thermal µBLS spectrum; returns (w_common, |sigma|)."""
    kmax = cfg["kMax"]
    nk = int(cfg.get("nK", 64))
    nf = int(cfg.get("nF", 61))
    if cfg.get("fAuto", True):
        wmin, wmax = _bls_auto_frange(cfg, kmax, optics)
    else:
        wmin = cfg["fMin"] * 2 * np.pi
        wmax = cfg["fMax"] * 2 * np.pi
    w_common = np.linspace(wmin, wmax, nf)
    kx = np.linspace(-kmax, kmax, nk)
    ky = kx.copy()
    bloch = _bls_thermal_bloch(cfg, w_common, kx, ky)
    df, pm, thicknesses, source = _bls_stack(cfg)
    sigma = SWT.bls.get_signal_GF_focal(
        SweepBloch=w_common,
        KxKyBloch=[kx, ky],
        Bloch=bloch,
        Exy=exy,
        E=e_field,
        DF=df,
        PM=pm,
        d=thicknesses,
        NA=optics["NA"],
        Nq=int(cfg.get("nQ", 30)),
        source_layer_index=source,
        wavelength=optics["wavelength"],
    )
    return w_common, np.abs(np.asarray(sigma, dtype=complex))


def _bls_apply_sweep(cfg, optics, key, value):
    """Apply one swept value to the BLS config/optics dicts."""
    if key in ("NA", "wavelength"):
        optics[key] = value
    else:
        cfg[key] = value


def run_bls(job_json):
    """Micro-focused BLS calculations: thermal spectra (optionally swept)."""
    job = json.loads(job_json)
    task = job["task"]
    cfg = dict(job["config"])
    optics = dict(job["optics"])

    if task == "thermal":
        sweep = job.get("sweep")
        if not sweep:
            exy, e_field = _bls_focal(optics)
            w, sig = _bls_thermal_sigma(cfg, optics, exy, e_field)
            return json.dumps(
                {
                    "traces": [
                        {
                            "quantity": "blsSpectrum",
                            "label": "",
                            "x": _clean_1d(w),
                            "y": _clean_1d(sig),
                        }
                    ],
                    "grids": [],
                }
            )
        # Swept thermal spectra -> heatmap over (frequency, parameter).
        key = sweep["key"]
        values = [float(v) for v in sweep["values"]]
        optics_swept = key in ("NA", "wavelength")
        exy, e_field = (None, None)
        if not optics_swept:
            exy, e_field = _bls_focal(optics)
        # Common frequency axis across the sweep: fix the window from the
        # extreme parameter values so all spectra share one grid.
        rows = []
        w_axis = None
        for v in values:
            c = dict(cfg)
            o = dict(optics)
            _bls_apply_sweep(c, o, key, v)
            if w_axis is None:
                if c.get("fAuto", True):
                    # widest window over the sweep: probe both ends
                    c_lo, o_lo = dict(cfg), dict(optics)
                    _bls_apply_sweep(c_lo, o_lo, key, values[0])
                    c_hi, o_hi = dict(cfg), dict(optics)
                    _bls_apply_sweep(c_hi, o_hi, key, values[-1])
                    lo1, hi1 = _bls_auto_frange(c_lo, c_lo["kMax"], o_lo)
                    lo2, hi2 = _bls_auto_frange(c_hi, c_hi["kMax"], o_hi)
                    w_axis = (min(lo1, lo2), max(hi1, hi2))
                else:
                    w_axis = (c["fMin"] * 2 * np.pi, c["fMax"] * 2 * np.pi)
            c["fAuto"] = False
            c["fMin"] = w_axis[0] / (2 * np.pi)
            c["fMax"] = w_axis[1] / (2 * np.pi)
            if optics_swept:
                exy, e_field = _bls_focal(o)
            w, sig = _bls_thermal_sigma(c, o, exy, e_field)
            rows.append(_clean_1d(sig))
        w = np.linspace(w_axis[0], w_axis[1], int(cfg.get("nF", 61)))
        return json.dumps(
            {
                "traces": [],
                "grids": [
                    {
                        "quantity": "blsSpectrum",
                        "label": "",
                        "x": _clean_1d(w),
                        "y": values,
                        "z": rows,
                    }
                ],
            }
        )

    raise ValueError(f"Unknown BLS task: {task}")


def get_version():
    return SWT.__version__
