import matplotlib
matplotlib.use("Agg")

import io, base64, threading
import matplotlib.pyplot as plt
from typing import Literal
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from diabetes_pipeline import DiabetesAssistant, ADVICE

bot = DiabetesAssistant()
lock = threading.Lock()                    # matplotlib is not thread-safe
app = FastAPI(title="Diabetes Risk Service", version="1.0")

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

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/predict")
def predict(patient: Patient, include_plot: bool = False):
    try:
        with lock:
            out = bot.report(patient.model_dump())
            plot_b64 = None
            if include_plot:
                buf = io.BytesIO()
                out["fig"].savefig(buf, format="png", bbox_inches="tight", dpi=110)
                plot_b64 = base64.b64encode(buf.getvalue()).decode()
            plt.close(out["fig"])
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {
        "risk_score": round(out["score"], 4),
        "tier": out["tier"],
        "notes": out["notes"],
        "factors": [{"name": n, "value": v, "impact": round(i, 3),
                     "direction": "raises" if i > 0 else "lowers"}
                    for n, v, i in out["factors"]],
        "recommendations": [{"factor": f, "title": ADVICE[f][0], "diet": ADVICE[f][1],
                             "exercise": ADVICE[f][2], "score_after": round(p1, 4)}
                            for f, _, p1 in out["recs"]],
        "report_markdown": out["markdown"],
        "shap_plot_png_base64": plot_b64,
        "disclaimer": "Decision-support only, not a diagnosis or medical advice.",
    }
