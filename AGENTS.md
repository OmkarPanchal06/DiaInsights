# DiaInsights

Repo: github.com/OmkarPanchal06/DiaInsights

## Purpose
Web app where each user enters their own health info and gets: risk score, influencing
factors (SHAP), plain-language explanation, and a personalised diet/exercise plan.
Decision-support only, NOT a diagnosis.

## Structure
- backend/  FastAPI + XGBoost + SHAP (existing, working).
  Run: `cd backend && venv\Scripts\Activate.ps1 && uvicorn api:app --reload --port 8000`
  Test: `cd backend && venv\Scripts\python -m pytest -q`  (61 tests; must stay green)
  Endpoints: `POST /predict` (?include_plot=true), `POST /predict/whatif`, `GET /health`.
  Env: `ALLOWED_ORIGINS` (comma-separated, default http://localhost:3000),
       `RATE_LIMIT_PER_MINUTE` (default 60, per-IP, /health exempt, 0 disables).
- frontend/ Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Recharts (to be created).
  Run: `cd frontend && npm run dev`

## Environment
- Windows + PowerShell. Use PowerShell syntax in commands (Remove-Item, not rmdir /S /Q).
- Python venv lives in backend/venv (never commit it).

## Hard rules
- NEVER change files in backend/model/ or the scoring maths in diabetes_pipeline.py.
  Only add code around it.
- Baseline scores that must never change:
  - Swagger default input (age 18, 120 cm, 25 kg, all other fields 0) = risk_score 0.0285
  - backend/example_request.json = risk_score 0.6590
- Input encoding: sex 1=male 0=female; all yes/no fields are 1/0.
- Call the score a "risk score" / "risk level". Never a probability or diagnosis.
- Every results screen shows: "Decision-support only, not medical advice."
- Do not present "Healthcare access = No" as a health benefit; word it neutrally or hide it.
- If a recommendation changes the score by less than 1 percentage point, describe it as
  a "small effect", not "3% -> 3%".
- Do not log or print patient health data. No third-party analytics.
- Frontend: mobile-first, WCAG AA contrast, keyboard accessible, labels on every input,
  never rely on colour alone. Plain language; explain medical terms in tooltips.

## Backend notes
- Never change `backend/model/` or the maths in `diabetes_pipeline.py` (`preprocess`,
  `score`, `recommend`, `tier`). Only additive changes: `explain`/`report` take
  `make_plot=True` and `report` now also returns `p_all`, `medical`, `displays`,
  `contrib`, `base_value`, `bmi`, `bmi_c`, `age_code` — all previously computed and discarded.
- **Band the clipped BMI (`bmi_c`), never the raw one.** `pd.cut(..., [0,18.5,25,30,35,100])`
  returns NaN above BMI 100, reachable for ~15% of legal (weight_kg, height_cm) pairs
  (e.g. 300 kg @ 120 cm). The scaler clip to [12, 98] is what prevents it. See
  `BMI_BINS` / `BMI_LABELS` / `bmi_band()`.
- Default `/predict` builds no matplotlib figure; only `?include_plot=true` does.
  A single `threading.Lock` still serialises all scoring work — keep it that way.
- 422 responses deliberately omit pydantic's `input` field so patient data never
  reaches client-side error logs. The frontend validates limits itself.
- `/predict/whatif` reports whatever the model says — it does not hide changes that
  *raise* the score. PhysActivity=1 raises the example patient's score (+0.0298),
  which is exactly why `recommend()` only offers candidates where `p1 < p0`.

## Quality bar
- Backend: pytest tests for /predict (valid, invalid, edge BMI). Run `pytest` before finishing.
- Frontend: `npm run lint && npm run build` must pass.
- After each task, run the app/tests and report what you verified.