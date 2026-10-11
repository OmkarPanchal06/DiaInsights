"""BMI banding must stay byte-for-byte equivalent to the pipeline's pd.cut call.

Band the scaler-clipped BMI, never the raw one: a raw BMI above 100 makes pd.cut
return NaN, which is reachable for ~15% of legal (weight_kg, height_cm) pairs.
"""
import pytest

from diabetes_pipeline import BMI_BINS, BMI_LABELS, bmi_band


@pytest.mark.parametrize("bmi, expected_code, expected_label", [
    (0.1,  0, "Underweight"),
    (18.5, 0, "Underweight"),          # right-closed: the edge stays in the lower band
    (18.6, 1, "Healthy weight"),
    (25.0, 1, "Healthy weight"),
    (25.1, 2, "Overweight"),
    (30.0, 2, "Overweight"),
    (30.1, 3, "Obesity, class I"),
    (35.0, 3, "Obesity, class I"),
    (35.1, 4, "Obesity, class II or higher"),
    (98.0, 4, "Obesity, class II or higher"),
])
def test_band_edges_match_pandas(bmi, expected_code, expected_label):
    code, label = bmi_band(bmi)
    assert (code, label) == (expected_code, expected_label)


def test_bins_unchanged():
    assert BMI_BINS == [0, 18.5, 25, 30, 35, 100]
    assert len(BMI_LABELS) == len(BMI_BINS) - 1
    assert BMI_LABELS[-1] == "Obesity, class II or higher"
    assert not any("40" in l for l in BMI_LABELS), "top band must not split at 40"


def test_clipping_never_produces_nan():
    """Every scaler-clipped BMI in the legal input space must land in a real band."""
    import numpy as np
    for weight in np.arange(25, 300.25, 1.0):
        for height in np.arange(120, 230.25, 1.0):
            raw = weight / (height / 100) ** 2
            code, label = bmi_band(min(max(raw, 12.0), 98.0))
            assert 0 <= code <= 4 and label in BMI_LABELS


def test_extreme_bmi_uses_clipped_value(client):
    """300 kg at 120 cm -> BMI 208.3, which would be NaN if binned raw."""
    patient = {"age_years": 40, "sex": 1, "height_cm": 120, "weight_kg": 300,
               "HighBP": 1, "HighChol": 0, "Smoker": 0, "Stroke": 0,
               "HeartDiseaseorAttack": 0, "PhysActivity": 0, "Fruits": 0,
               "Veggies": 0, "HvyAlcoholConsump": 0, "AnyHealthcare": 1}
    body = client.post("/predict", json=patient).json()
    assert body["bmi"] == 208.3
    assert body["bmi_clipped"] == 98.0
    assert body["bmi_category"] == "Obesity, class II or higher"


def test_extreme_bmi_produces_note(client):
    patient = {"age_years": 40, "sex": 1, "height_cm": 120, "weight_kg": 300,
               "HighBP": 1, "HighChol": 0, "Smoker": 0, "Stroke": 0,
               "HeartDiseaseorAttack": 0, "PhysActivity": 0, "Fruits": 0,
               "Veggies": 0, "HvyAlcoholConsump": 0, "AnyHealthcare": 1}
    r = client.post("/predict", json=patient)
    assert r.status_code == 200
    notes = r.json()["notes"]
    assert len(notes) == 1
    assert "208.3" in notes[0] and "98.0" in notes[0]


def test_underweight_edge_from_api(client, swagger_default):
    """Swagger default is BMI 17.4 -- the band most likely to be mislabelled."""
    body = client.post("/predict", json=swagger_default).json()
    assert body["bmi"] == 17.4
    assert body["bmi_category"] == "Underweight"