import pytest


def _post(client, patient, changes):
    return client.post("/predict/whatif", json={"patient": patient, "changes": changes})


def test_whatif_reduces_score(client, example_patient):
    r = _post(client, example_patient, {"weight_kg": 70})
    assert r.status_code == 200
    body = r.json()
    assert body["new_score"] < body["current_score"]
    assert body["delta"] == pytest.approx(-0.1132, abs=5e-4)
    assert body["direction"] == "lower"
    assert body["effect"] == "meaningful"


def test_whatif_direction_tracks_delta(client, example_patient):
    """Direction must follow the actual sign -- the model does not always improve.

    For this patient PhysActivity=1 *raises* the score (+0.0298); the pipeline's own
    recommend() only ever offers candidates where p1 < p0. /predict/whatif reports
    whatever the model says rather than second-guessing it.
    """
    body = _post(client, example_patient, {"PhysActivity": 1}).json()
    assert body["new_score"] > body["current_score"]
    assert body["delta"] == pytest.approx(0.0298, abs=5e-4)
    assert body["direction"] == "higher"


def test_whatif_reports_both_tiers(client, example_patient):
    body = _post(client, example_patient, {"weight_kg": 60}).json()
    assert set(body) >= {"current_score", "current_tier", "new_score", "new_tier",
                         "delta", "direction", "effect", "changes", "notes", "disclaimer"}


def test_whatif_no_change_is_zero_delta(client, example_patient):
    body = _post(client, example_patient, {}).json()
    assert body["delta"] == 0
    assert body["direction"] == "unchanged"
    assert body["new_score"] == body["current_score"]


def test_small_change_flagged_as_small_effect(client, example_patient):
    """AGENTS.md: under one percentage point must be presented as a small effect.

    Quitting smoking moves this patient by only -0.0091, i.e. 0.91pp.
    """
    body = _post(client, example_patient, {"Smoker": 0}).json()
    assert abs(body["delta"]) < 0.01
    assert body["effect"] == "small"


def test_meaningful_change_not_flagged_small(client, example_patient):
    body = _post(client, example_patient, {"weight_kg": 60}).json()
    assert abs(body["delta"]) >= 0.01
    assert body["effect"] == "meaningful"


def test_whatif_rejects_unknown_change_key(client, example_patient):
    assert _post(client, example_patient, {"cholesterol": 1}).status_code == 422


def test_whatif_rejects_out_of_range_change(client, example_patient):
    assert _post(client, example_patient, {"weight_kg": 400}).status_code == 422


def test_whatif_rejects_invalid_patient(client, swagger_default):
    r = client.post("/predict/whatif", json={"patient": {**swagger_default, "sex": 9},
                                             "changes": {}})
    assert r.status_code == 422


def test_whatif_echoes_applied_changes(client, example_patient):
    body = _post(client, example_patient, {"Smoker": 0}).json()
    assert body["changes"] == {"Smoker": 0}


# ------------------------------------------------------------------ CORS
def test_cors_allows_configured_origin(client, example_patient):
    r = client.options("/predict", headers={"Origin": "http://localhost:3000",
                                            "Access-Control-Request-Method": "POST"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_cors_rejects_unknown_origin(client, example_patient):
    r = client.options("/predict", headers={"Origin": "http://evil.example",
                                            "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in r.headers


def test_cors_allows_whatif_route(client):
    r = client.options("/predict/whatif", headers={"Origin": "http://localhost:3000",
                                                   "Access-Control-Request-Method": "POST"})
    assert r.headers.get("access-control-allow-origin") == "http://localhost:3000"


# ------------------------------------------------------------ rate limit
def test_rate_limit_returns_429(client, swagger_default, monkeypatch):
    import api
    monkeypatch.setattr(api, "RATE_LIMIT_PER_MINUTE", 3)
    api._hits.clear()

    codes = [client.post("/predict", json=swagger_default).status_code
             for _ in range(5)]
    assert codes[:3] == [200, 200, 200]
    assert codes[3] == 429


def test_rate_limit_sets_retry_after(client, swagger_default, monkeypatch):
    import api
    monkeypatch.setattr(api, "RATE_LIMIT_PER_MINUTE", 1)
    api._hits.clear()
    client.post("/predict", json=swagger_default)
    r = client.post("/predict", json=swagger_default)
    assert r.status_code == 429
    assert int(r.headers["Retry-After"]) > 0


def test_health_is_not_rate_limited(client, monkeypatch):
    import api
    monkeypatch.setattr(api, "RATE_LIMIT_PER_MINUTE", 1)
    api._hits.clear()
    assert [client.get("/health").status_code for _ in range(4)] == [200] * 4


def test_rate_limit_applies_to_whatif(client, example_patient, monkeypatch):
    import api
    monkeypatch.setattr(api, "RATE_LIMIT_PER_MINUTE", 2)
    api._hits.clear()
    codes = [_post(client, example_patient, {"Fruits": 1}).status_code for _ in range(4)]
    assert codes[-1] == 429