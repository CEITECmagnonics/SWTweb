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


def get_version():
    return SWT.__version__
