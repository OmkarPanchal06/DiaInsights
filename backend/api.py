"""DiaInsights HTTP layer.

All scoring lives in diabetes_pipeline.py and is never modified here -- this module
only shapes requests and serialises responses. Keep it that way.
"""
import os, io, base64, threading, time
from collections import defaultdict, deque
from typing import Literal

import matplotlib
matplotlib.use("Agg")

import matplotlib.pyplot as plt
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from diabetes_pipeline import (DiabetesAssistant, ADVICE, LABEL,
                               AGE_LABEL, bmi_band)

DISCLAIMER = "Decision-support only, not a diagnosis or medical advice."

# AGENTS.md: a change worth less than one percentage point must be presented as a
# "small effect", never as "3% -> 3%". Enforced here so the frontend cannot get it wrong.
SMALL_EFFECT_THRESHOLD = 0.01

bot = DiabetesAssistant()
lock = threading.Lock()          # matplotlib is not thread-safe; serialises all scoring work
app = FastAPI(title="Diabetes Risk Service", version="2.0")

# ---------------------------------------------------------------- CORS
_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
            if o.strip()]
app.add_middleware(CORSMiddleware, allow_origins=_origins, allow_credentials=False,
                   allow_methods=["GET", "POST"], allow_headers=["*"])

# ------------------------------------------------------- rate limiting
# Stores client IP and timestamps only. Never the request body -- AGENTS.md forbids
# logging patient health data.
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "60"))
_RATE_WINDOW = 60.0
_hits: dict[str, deque] = defaultdict(deque)
_rate_lock = threading.Lock()


def enforce_rate_limit(request: Request):
    if RATE_LIMIT_PER_MINUTE <= 0:
        return
    now = time.monotonic()
    ip = request.client.host if request.client else "unknown"
    with _rate_lock:
        bucket = _hits[ip]
        while bucket and now - bucket[0] > _RATE_WINDOW:
            bucket.popleft()
        if len(bucket) >= RATE_LIMIT_PER_MINUTE:
            retry_after = int(_RATE_WINDOW - (now - bucket[0])) + 1
            raise HTTPException(status_code=429,
                                detail="Too many requests. Please wait a moment before retrying.",
                                headers={"Retry-After": str(retry_after)})
        bucket.append(now)
        if len(_hits) > 1024:            # keep the map from growing without bound
            for key in list(_hits):
                if not _hits[key] or now - _hits[key][-1] > _RATE_WINDOW:
                    del _hits[key]


@app.exception_handler(RequestValidationError)
async def _validation_handler(request: Request, exc: RequestValidationError):
    """Return 422 without echoing the submitted values.

    Pydantic's default handler includes `input`, which puts the patient's rejected
    value back into the response body and from there into any client-side error log.
    The frontend does its own limit validation, so name + reason is enough.
    """
    cleaned = [{"loc": list(e.get("loc", ())), "msg": e.get("msg", ""), "type": e.get("type", "")}
               for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": cleaned})

# ---------------------------------------------------------------- schemas
YN = Literal[0, 1]

class Patient(BaseModel):
    age_years: float = Field(ge=18, le=120)
    sex: YN                                 # 1 = male, 0 = female
    height_cm: float = Field(ge=120, le=230)
    weight_kg: float = Field(ge=25, le=300)
    HighBP: YN
    HighChol: YN
    Smoker: YN
    Stroke: YN
    HeartDiseaseorAttack: YN
    PhysActivity: YN
    Fruits: YN
    Veggies: YN
    HvyAlcoholConsump: YN
    AnyHealthcare: YN

class PatientChanges(BaseModel):
    """Partial overlay applied to a Patient. Unknown keys are rejected outright."""
    model_config = ConfigDict(extra="forbid")
    age_years: float | None = Field(default=None, ge=18, le=120)
    sex: YN | None = None
    height_cm: float | None = Field(default=None, ge=120, le=230)
    weight_kg: float | None = Field(default=None, ge=25, le=300)
    HighBP: YN | None = None
    HighChol: YN | None = None
    Smoker: YN | None = None
    Stroke: YN | None = None
    HeartDiseaseorAttack: YN | None = None
    PhysActivity: YN | None = None
    Fruits: YN | None = None
    Veggies: YN | None = None
    HvyAlcoholConsump: YN | None = None
    AnyHealthcare: YN | None = None

class WhatIfRequest(BaseModel):
    patient: Patient
    changes: PatientChanges = Field(default_factory=PatientChanges)

# ---------------------------------------------------------------- helpers
def _shap_block(out) -> dict:
    contrib, displays = out["contrib"], out["displays"]
    features = [{"name": f, "label": LABEL.get(f, f), "value_display": displays[f],
                 "impact": round(float(contrib[f]), 4),
                 "direction": "raises" if contrib[f] > 0 else "lowers"}
                for f in bot.cols]
    features.sort(key=lambda d: abs(d["impact"]), reverse=True)
    return {"base_value": round(out["base_value"], 6), "features": features}


# ---------------------------------------------------------------- routes
@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/predict")
def predict(request: Request, patient: Patient, include_plot: bool = False):
    enforce_rate_limit(request)
    plot_b64 = None
    try:
        with lock:
            out = bot.report(patient.model_dump(), make_plot=include_plot)
            if include_plot and out["fig"] is not None:
                buf = io.BytesIO()
                out["fig"].savefig(buf, format="png", bbox_inches="tight", dpi=110)
                plot_b64 = base64.b64encode(buf.getvalue()).decode()
                plt.close(out["fig"])
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {
        "risk_score": round(out["score"], 4),
        "tier": out["tier"],
        "tier_thresholds": {"low": bot.cfg["tier_low"], "high": bot.cfg["tier_high"]},
        "notes": out["notes"],
        "bmi": round(out["bmi"], 1),
        "bmi_clipped": round(out["bmi_c"], 1),
        "bmi_category": bmi_band(out["bmi_c"])[1],
        "age_group": AGE_LABEL[out["age_code"]],
        "factors": [{"name": n, "value": v, "impact": round(i, 3),
                     "direction": "raises" if i > 0 else "lowers"}
                    for n, v, i in out["factors"]],
        "shap": _shap_block(out),
        "recommendations": [{"factor": f, "title": ADVICE[f][0], "diet": ADVICE[f][1],
                             "exercise": ADVICE[f][2], "score_after": round(p1, 4),
                             "current_score": round(out["score"], 4)}
                            for f, _, p1 in out["recs"]],
        "combined_score_after": round(out["p_all"], 4),
        "medical": [{"factor": k, "label": LABEL[k], "advice": txt}
                    for k, txt in out["medical"]],
        "report_markdown": out["markdown"],
        "shap_plot_png_base64": plot_b64,
        "disclaimer": DISCLAIMER,
    }

@app.post("/predict/whatif")
def whatif(request: Request, body: WhatIfRequest):
    enforce_rate_limit(request)
    current = body.patient.model_dump()
    merged = {**current, **body.changes.model_dump(exclude_none=True)}
    try:
        with lock:
            before = bot.score(current)
            after = bot.score(merged)
            _, ctx = bot.preprocess(merged)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    delta = after - before
    return {
        "current_score": round(before, 4),
        "current_tier": bot.tier(before),
        "new_score": round(after, 4),
        "new_tier": bot.tier(after),
        "delta": round(delta, 4),
        "direction": ("higher" if delta > 1e-9 else "lower" if delta < -1e-9 else "unchanged"),
        "effect": "small" if abs(delta) < SMALL_EFFECT_THRESHOLD else "meaningful",
        "changes": body.changes.model_dump(exclude_none=True),
        "notes": ctx["notes"],
        "disclaimer": DISCLAIMER,
    }