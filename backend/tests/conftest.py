import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# DiabetesAssistant loads model/* through bare relative paths, so the process CWD must be
# backend/ regardless of where pytest was invoked from.
BACKEND_ROOT = Path(__file__).resolve().parents[1]
os.chdir(BACKEND_ROOT)
sys.path.insert(0, str(BACKEND_ROOT))

from api import app  # noqa: E402


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def swagger_default() -> dict:
    """The default input FastAPI's /docs page submits (age 18, 120 cm, 25 kg, all else 0)."""
    patient = {"age_years": 18, "sex": 0, "height_cm": 120, "weight_kg": 25}
    for key in ["HighBP", "HighChol", "Smoker", "Stroke", "HeartDiseaseorAttack",
                "PhysActivity", "Fruits", "Veggies", "HvyAlcoholConsump", "AnyHealthcare"]:
        patient[key] = 0
    return patient


@pytest.fixture
def example_patient() -> dict:
    import json
    with open(BACKEND_ROOT / "example_request.json", encoding="utf-8") as fh:
        return json.load(fh)