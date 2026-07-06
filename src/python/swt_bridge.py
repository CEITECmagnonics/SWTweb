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


def get_version():
    return SWT.__version__
