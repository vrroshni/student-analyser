from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

from preprocessing import FEATURES, int_to_label_map, label_to_int

try:
    from tensorflow import keras
except Exception as e:  # pragma: no cover
    raise SystemExit(
        "TensorFlow is required for DL training. Install backend requirements and re-run."
    ) from e


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

    model = keras.Sequential(
        [
            keras.layers.Input(shape=(X_train_scaled.shape[1],)),
            keras.layers.Dense(32, activation="relu"),
            keras.layers.Dense(16, activation="relu"),
            keras.layers.Dense(3, activation="softmax"),
        ]
    )

    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    model.fit(
        X_train_scaled,
        y_train,
        validation_split=0.2,
        epochs=30,
        batch_size=32,
        verbose=0,
    )

    loss, acc = model.evaluate(X_test_scaled, y_test, verbose=0)

    out_dir = Path(__file__).resolve().parent / "models"
    out_dir.mkdir(parents=True, exist_ok=True)

    model.save(out_dir / "dl_model.keras")
    joblib.dump(scaler, out_dir / "scaler.joblib")

    with (out_dir / "label_map.json").open("w", encoding="utf-8") as f:
        json.dump(int_to_label_map(), f)

    # SHAP background sample (scaled)
    bg = X_train_scaled[:200]
    np.save(out_dir / "background.npy", bg)

    print(f"DL training complete. Accuracy: {acc:.3f}")
    print(f"Saved artifacts to: {out_dir}")


if __name__ == "__main__":
    main()
