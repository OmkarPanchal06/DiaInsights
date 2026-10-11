import json, requests
patient = json.load(open('example_request.json'))
r = requests.post('http://localhost:8000/predict', json=patient, timeout=30)
r.raise_for_status()
res = r.json()
print(res['risk_score'], res['tier'])
print(res['report_markdown'])
