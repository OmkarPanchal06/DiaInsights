"""Response contract for /predict: new structured fields plus every legacy field."""

LEGACY_FIELDS = {"risk_score", "tier", "notes", "factors", "recommendations",
                 "report_markdown", "shap_plot_png_base64", "disclaimer"}


def test_legacy_fields_still_present(client, example_patient):
    body = client.post("/predict", json=example_patient).json()
    assert LEGACY_FIELDS <= set(body), LEGACY_FIELDS - set(body)


def test_structured_patient_fields(client, example_patient):
    body = client.post("/predict", json=example_patient).json()
    assert body["bmi"] == 30.5
    assert body["bmi_clipped"] == 30.5
    assert body["bmi_category"] == "Obesity, class I"
    assert body["age_group"] == "50-54"


def test_combined_score_after_matches_markdown_value(client, example_patient):
    body = client.post("/predict", json=example_patient).json()
    assert isinstance(body["combined_score_after"], float)
    # the same number is rendered inside report_markdown
    assert f"{body['combined_score_after']:.0%}" in body["report_markdown"]


def test_medical_block_is_structured(client, example_patient):
    medical = client.post("/predict", json=example_patient).json()["medical"]
    assert {m["factor"] for m in medical} == {"HighBP", "HighChol"}
    for m in medical:
        assert set(m) == {"factor", "label", "advice"}
        assert m["label"] and m["advice"]


def test_recommendations_carry_current_score(client, example_patient):
    body = client.post("/predict", json=example_patient).json()
    assert body["recommendations"], "expected at least one recommendation"
    for rec in body["recommendations"]:
        assert rec["current_score"] == body["risk_score"]
        assert set(rec) >= {"factor", "title", "diet", "exercise",
                            "score_after", "current_score"}


def test_shap_covers_every_feature_sorted_by_impact(client, example_patient):
    shap = client.post("/predict", json=example_patient).json()["shap"]
    features = shap["features"]
    assert len(features) == 13
    assert isinstance(shap["base_value"], float)
    impacts = [abs(f["impact"]) for f in features]
    assert impacts == sorted(impacts, reverse=True)


def test_shap_feature_entries_are_complete(client, example_patient):
    features = client.post("/predict", json=example_patient).json()["shap"]["features"]
    for f in features:
        assert set(f) == {"name", "label", "value_display", "impact", "direction"}
        assert f["direction"] in {"raises", "lowers"}


def test_factors_still_top_five(client, example_patient):
    factors = client.post("/predict", json=example_patient).json()["factors"]
    assert len(factors) == 5
    for f in factors:
        assert set(f) == {"name", "value", "impact", "direction"}


def test_health_endpoint(client):
    assert client.get("/health").json() == {"status": "ok"}