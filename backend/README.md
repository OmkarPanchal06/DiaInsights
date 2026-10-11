# Diabetes Risk Service

## Run on your computer
1. Unzip this folder and open a terminal inside it.
2. `python -m venv venv` then activate it.
3. `pip install -r requirements.txt`
4. `uvicorn api:app --port 8000`
5. Open http://localhost:8000/docs to test, or run `python call_example.py`.

Run everything from inside `backend/`. The model files are loaded through relative paths,
so starting uvicorn from the repository root will fail.

## Tests
```
venv\Scripts\python -m pytest -q
```

## Call it from your main project

POST http://localhost:8000/predict with the JSON in example_request.json
(sex: 1=male, 0=female; yes/no fields as 1/0).

`/predict` returns the original fields (`risk_score`, `tier`, `notes`, `factors`,
`recommendations`, `report_markdown`, `shap_plot_png_base64`, `disclaimer`) plus:

| Field | Meaning |
|---|---|
| `bmi`, `bmi_clipped`, `bmi_category` | Raw BMI, the value the model actually used after clipping, and its band |
| `age_group` | e.g. `50-54` |
| `tier_thresholds` | `{low, high}` — the currently uncalibrated cut-offs |
| `shap` | `{base_value, features[]}` for **all 13** features, sorted by absolute impact, each with `label`, `value_display`, `direction` |
| `combined_score_after` | Score if every recommendation is achieved |
| `medical` | `[{factor, label, advice}]` — items to manage with a doctor |
| `recommendations[].current_score` | The score each recommendation starts from |

Add `?include_plot=true` for the SHAP chart as a base64 PNG. Without it no matplotlib
figure is built at all. The frontend should prefer `shap.features` over the image.

### POST /predict/whatif
Ask "what if I changed this?" without re-entering the whole form.

```json
{"patient": { ... }, "changes": {"PhysActivity": 1, "weight_kg": 78}}
```

`changes` accepts any subset of the patient fields; unknown keys are rejected with 422.
Returns `current_score`, `new_score`, `delta`, `direction`, `effect` (`small` when the
change is worth under one percentage point) and both tiers.

Note that the model does not always improve: some changes raise the score for a given
patient. The endpoint reports what the model says rather than hiding it.

## CORS
`ALLOWED_ORIGINS` — comma-separated list of allowed origins.
Default: `http://localhost:3000`. Example:
`ALLOWED_ORIGINS="https://app.example.com,http://localhost:5173" uvicorn api:app`

## Rate limiting
`RATE_LIMIT_PER_MINUTE` — requests per client IP per minute. Default `60`, `0` disables.
`/health` is exempt. Over the limit returns 429 with a `Retry-After` header.
The limiter stores only the IP and timestamps, never the request body.

## Validation errors
422 responses contain the field path and reason but deliberately omit the submitted
value, so rejected patient data is never echoed back into client-side error logs.
The frontend is responsible for validating limits before submitting.

## Docker
`docker build -t diabetes-service .` then `docker run -p 8000:8000 diabetes-service`

## Notes
- The score is a risk score on a balanced scale, not a real-world probability. Tiers 0.35/0.65 are placeholders until calibration.
- Decision support only, not a diagnosis.