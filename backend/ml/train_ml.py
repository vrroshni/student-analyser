from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from preprocessing import FEATURES, int_to_label_map, label_to_int


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    data_path = root / "data" / "student_data.csv"
    if not data_path.exists():
        raise SystemExit(
            f"Data not found at {data_path}. Run: python backend/data/generate_data.py"
        )

    df = pd.read_csv(data_path)
    X = df[FEATURES].to_numpy(dtype=np.float32)
    y = df["label"].map(label_to_int).to_numpy(dtype=np.int64)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = RandomForestClassifier(
        n_estimators=300,
        random_state=42,
        class_weight="balanced",
    )
    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    acc = accuracy_score(y_test, y_pred)

    out_dir = Path(__file__).resolve().parent / "models"
    out_dir.mkdir(parents=True, exist_ok=True)

    joblib.dump(model, out_dir / "rf_model.joblib")
    joblib.dump(scaler, out_dir / "scaler.joblib")

    with (out_dir / "label_map.json").open("w", encoding="utf-8") as f:
        json.dump(int_to_label_map(), f)

    # SHAP background sample (scaled)
    bg = X_train_scaled[:200]
    np.save(out_dir / "background.npy", bg)

    print(f"ML training complete. Accuracy: {acc:.3f}")
    print(f"Saved artifacts to: {out_dir}")


if __name__ == "__main__":
    main()
