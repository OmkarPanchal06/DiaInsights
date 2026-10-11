# Diabetes Risk Service

## Run on your computer
1. Unzip this folder and open a terminal inside it.
2. `python -m venv venv` then activate it.
3. `pip install -r requirements.txt`
4. `uvicorn api:app --port 8000`
5. Open http://localhost:8000/docs to test, or run `python call_example.py`.

## Call it from your main project
POST http://localhost:8000/predict with the JSON in example_request.json (sex: 1=male, 0=female; yes/no fields as 1/0). Add `?include_plot=true` for the SHAP chart as base64 PNG.

## Docker
`docker build -t diabetes-service .` then `docker run -p 8000:8000 diabetes-service`

## Notes
- The score is a risk score on a balanced scale, not a real-world probability. Tiers 0.35/0.65 are placeholders until calibration.
- Decision support only, not a diagnosis.
