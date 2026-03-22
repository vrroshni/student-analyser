"""One-time script to convert the Keras DL model to TFLite format.

Run this locally (where TensorFlow is installed) before deploying:
    python backend/ml/convert_to_tflite.py

The resulting dl_model.tflite should be committed to the repo.
"""
from __future__ import annotations

from pathlib import Path

import tensorflow as tf


def main() -> None:
    models_dir = Path(__file__).resolve().parent / "models"
    keras_path = models_dir / "dl_model.keras"

    if not keras_path.exists():
        raise SystemExit(
            f"Keras model not found at {keras_path}. "
            "Run: python backend/ml/train_dl.py first."
        )

    model = tf.keras.models.load_model(keras_path)
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    tflite_model = converter.convert()

    out_path = models_dir / "dl_model.tflite"
    out_path.write_bytes(tflite_model)
    print(f"Converted model saved to: {out_path} ({len(tflite_model)} bytes)")


if __name__ == "__main__":
    main()
