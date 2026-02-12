from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_predict_valid_input_ml_missing_models():
    response = client.post(
        "/predict?model_type=ml",
        json={
            "age": 18,
            "internal_marks": 75,
            "previous_marks": 80,
            "attendance": 85,
        },
    )
    # If artifacts are missing, API returns 400 with a clear message
    assert response.status_code in (200, 400)
    if response.status_code == 200:
        data = response.json()
        assert data["prediction"] in ["Good", "Average", "Needs Attention"]
        assert 0 <= data["confidence"] <= 1
        assert "feature_contributions" in data


def test_predict_invalid_age():
    response = client.post(
        "/predict",
        json={
            "age": 10,
            "internal_marks": 75,
            "previous_marks": 80,
            "attendance": 85,
        },
    )
    assert response.status_code == 422
