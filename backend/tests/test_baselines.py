"""The two scores pinned in AGENTS.md. These are the tripwires for any change to
diabetes_pipeline.py -- if these move, the model behaviour changed."""


def test_swagger_default_score_unchanged(client, swagger_default):
    r = client.post("/predict", json=swagger_default)
    assert r.status_code == 200
    assert round(r.json()["risk_score"], 4) == 0.0285


def test_swagger_default_score_is_tight():
    """6dp canary against the pipeline directly.

    The HTTP layer rounds risk_score to 4dp, so a 6dp assertion on the response
    would be meaningless -- this has to bypass the API to be a real tripwire.
    """
    from diabetes_pipeline import DiabetesAssistant
    patient = {"age_years": 18, "sex": 0, "height_cm": 120, "weight_kg": 25}
    for key in ["HighBP", "HighChol", "Smoker", "Stroke", "HeartDiseaseorAttack",
                "PhysActivity", "Fruits", "Veggies", "HvyAlcoholConsump", "AnyHealthcare"]:
        patient[key] = 0
    assert round(DiabetesAssistant().score(patient), 6) == 0.028453


def test_example_request_score_unchanged(client, example_patient):
    r = client.post("/predict", json=example_patient)
    assert r.status_code == 200
    assert round(r.json()["risk_score"], 4) == 0.6590


def test_example_request_tier_unchanged(client, example_patient):
    r = client.post("/predict", json=example_patient)
    assert r.json()["tier"] == "HIGH"


def test_baseline_tier_thresholds_exposed(client, swagger_default):
    r = client.post("/predict", json=swagger_default)
    assert r.json()["tier_thresholds"] == {"low": 0.35, "high": 0.65}