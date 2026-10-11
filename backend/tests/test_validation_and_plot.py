import pytest

from fastapi.testclient import TestClient


@pytest.mark.parametrize("overrides, reason", [
    ({"age_years": 17}, "below minimum"),
    ({"age_years": 121}, "above maximum"),
    ({"height_cm": 119}, "below minimum"),
    ({"weight_kg": 24.9}, "below minimum"),
    ({"sex": 2}, "not a 0/1 literal"),
    ({"PhysActivity": 5}, "not a 0/1 literal"),
    ({"HighBP": "yes"}, "wrong type"),
])
def test_invalid_inputs_return_422(client, swagger_default, overrides, reason):
    assert client.post("/predict", json={**swagger_default, **overrides}).status_code == 422, reason


@pytest.mark.parametrize("missing", ["HighBP", "sex", "weight_kg", "Fruits"])
def test_missing_field_returns_422(client, swagger_default, missing):
    payload = dict(swagger_default)
    payload.pop(missing)
    assert client.post("/predict", json=payload).status_code == 422


def test_422_body_does_not_echo_submitted_value(client, swagger_default):
    """AGENTS.md: do not log patient health data. Pydantic's default 422 echoes `input`."""
    sentinel = {"age_years": 17, "sex": 0, "height_cm": 120, "weight_kg": 25}
    r = client.post("/predict", json={**swagger_default, **sentinel})
    assert r.status_code == 422
    text = r.text
    for entry in r.json()["detail"]:
        assert set(entry) == {"loc", "msg", "type"}, "error entries must not carry input"
    # the rejected age must not appear anywhere in the response
    assert "17" not in text.replace("ge=18", "")


def test_plot_omitted_by_default(client, example_patient):
    assert client.post("/predict", json=example_patient).json()["shap_plot_png_base64"] is None


def test_default_path_creates_no_figure(client, example_patient):
    import matplotlib.pyplot as plt
    plt.close("all")
    client.post("/predict", json=example_patient)
    assert plt.get_fignums() == [], "default path must not build a matplotlib figure"


def test_include_plot_returns_png(client, example_patient):
    import base64
    r = client.post("/predict", params={"include_plot": "true"}, json=example_patient)
    b64 = r.json()["shap_plot_png_base64"]
    assert b64 and base64.b64decode(b64).startswith(b"\x89PNG")