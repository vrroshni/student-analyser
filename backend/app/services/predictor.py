from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Literal, Tuple

import joblib
import numpy as np

try:
    import shap
except Exception:  # pragma: no cover
    shap = None

try:
    from tensorflow import keras
except Exception:  # pragma: no cover
    keras = None


FEATURES: List[str] = ["age", "internal_marks", "previous_marks", "attendance"]


ModelType = Literal["ml", "dl"]


@dataclass
class PredictionResult:
    prediction: str
    confidence: float
    model_used: str
    contributions: Dict[str, float]


class ModelArtifactsNotFound(Exception):
    pass


class PredictorService:
    def __init__(self, models_dir: str | Path | None = None):
        if models_dir is None:
            models_dir = Path(__file__).resolve().parents[2] / "ml" / "models"
        self.models_dir = Path(models_dir)

        self._ml_loaded = False
        self._dl_loaded = False

        self._ml_model = None
        self._ml_scaler = None
        self._ml_label_map: Dict[int, str] | None = None
        self._ml_background: np.ndarray | None = None

        self._dl_model = None
        self._dl_scaler = None
        self._dl_label_map: Dict[int, str] | None = None
        self._dl_background: np.ndarray | None = None

    def _load_label_map(self, path: Path) -> Dict[int, str]:
        with path.open("r", encoding="utf-8") as f:
            raw = json.load(f)
        return {int(k): str(v) for k, v in raw.items()}

    def _load_background(self, path: Path) -> np.ndarray:
        if not path.exists():
            return None
        return np.load(path)

    def _ensure_ml_loaded(self) -> None:
        if self._ml_loaded:
            return
        model_path = self.models_dir / "rf_model.joblib"
        scaler_path = self.models_dir / "scaler.joblib"
        label_map_path = self.models_dir / "label_map.json"
        background_path = self.models_dir / "background.npy"

        if not model_path.exists() or not scaler_path.exists() or not label_map_path.exists():
            raise ModelArtifactsNotFound(
                "ML artifacts not found. Run: python backend/ml/train_ml.py"
            )

        self._ml_model = joblib.load(model_path)
        self._ml_scaler = joblib.load(scaler_path)
        self._ml_label_map = self._load_label_map(label_map_path)
        self._ml_background = self._load_background(background_path)
        self._ml_loaded = True

    def _ensure_dl_loaded(self) -> None:
        if self._dl_loaded:
            return

        if keras is None:
            raise ModelArtifactsNotFound(
                "TensorFlow is not installed/available. Install backend requirements and re-try."
            )

        model_path = self.models_dir / "dl_model.keras"
        scaler_path = self.models_dir / "scaler.joblib"
        label_map_path = self.models_dir / "label_map.json"
        background_path = self.models_dir / "background.npy"

        if not model_path.exists() or not scaler_path.exists() or not label_map_path.exists():
            raise ModelArtifactsNotFound(
                "DL artifacts not found. Run: python backend/ml/train_dl.py"
            )

        self._dl_model = keras.models.load_model(model_path)
        self._dl_scaler = joblib.load(scaler_path)
        self._dl_label_map = self._load_label_map(label_map_path)
        self._dl_background = self._load_background(background_path)
        self._dl_loaded = True

    def _vectorize(self, payload: Dict[str, float | int]) -> np.ndarray:
        return np.array([[float(payload[f]) for f in FEATURES]], dtype=np.float32)

    def predict(self, payload: Dict[str, float | int], *, model_type: ModelType = "ml") -> PredictionResult:
        if model_type == "ml":
            self._ensure_ml_loaded()
            return self._predict_ml(payload)
        if model_type == "dl":
            self._ensure_dl_loaded()
            return self._predict_dl(payload)
        raise ValueError(f"Unsupported model_type: {model_type}")

    def _predict_ml(self, payload: Dict[str, float | int]) -> PredictionResult:
        x = self._vectorize(payload)
        x_scaled = self._ml_scaler.transform(x)

        proba = self._ml_model.predict_proba(x_scaled)[0]
        class_idx = int(np.argmax(proba))
        confidence = float(proba[class_idx])
        prediction = self._ml_label_map[class_idx]

        contribs = self._explain_ml(x_scaled)
        return PredictionResult(
            prediction=prediction,
            confidence=confidence,
            model_used="Random Forest",
            contributions=contribs,
        )

    def _predict_dl(self, payload: Dict[str, float | int]) -> PredictionResult:
        x = self._vectorize(payload)
        x_scaled = self._dl_scaler.transform(x)

        proba = self._dl_model.predict(x_scaled, verbose=0)[0]
        class_idx = int(np.argmax(proba))
        confidence = float(proba[class_idx])
        prediction = self._dl_label_map[class_idx]

        contribs = self._explain_dl(x_scaled)
        return PredictionResult(
            prediction=prediction,
            confidence=confidence,
            model_used="Neural Network",
            contributions=contribs,
        )

    def _explain_ml(self, x_scaled: np.ndarray) -> Dict[str, float]:
        if shap is None:
            return {f: 0.0 for f in FEATURES}

        try:
            explainer = shap.TreeExplainer(self._ml_model)
            shap_vals = explainer.shap_values(x_scaled)
            # shap_vals can be list (per class) or array
            if isinstance(shap_vals, list):
                proba = self._ml_model.predict_proba(x_scaled)[0]
                class_idx = int(np.argmax(proba))
                vals = shap_vals[class_idx][0]
            else:
                vals = shap_vals[0]
            return {FEATURES[i]: float(vals[i]) for i in range(len(FEATURES))}
        except Exception:
            return {f: 0.0 for f in FEATURES}

    def _explain_dl(self, x_scaled: np.ndarray) -> Dict[str, float]:
        if shap is None or self._dl_background is None:
            return {f: 0.0 for f in FEATURES}

        try:
            # KernelExplainer is slow; keep it bounded.
            background = self._dl_background
            if background.ndim == 1:
                background = background.reshape(1, -1)
            background = background[:50]

            def f(inp: np.ndarray) -> np.ndarray:
                return self._dl_model.predict(inp, verbose=0)

            explainer = shap.KernelExplainer(f, background)
            shap_vals = explainer.shap_values(x_scaled, nsamples=100)
            if isinstance(shap_vals, list):
                proba = self._dl_model.predict(x_scaled, verbose=0)[0]
                class_idx = int(np.argmax(proba))
                vals = shap_vals[class_idx][0]
            else:
                vals = shap_vals[0]
            return {FEATURES[i]: float(vals[i]) for i in range(len(FEATURES))}
        except Exception:
            return {f: 0.0 for f in FEATURES}
