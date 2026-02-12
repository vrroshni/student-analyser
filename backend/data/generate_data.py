from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


def _label_from_rules(age: int, internal: float, previous: float, attendance: float) -> str:
    score = 0.0
    score += 0.45 * internal
    score += 0.35 * previous
    score += 0.20 * attendance

    # Small age effect
    score += (age - 20) * 0.5

    if score >= 75:
        return "Good"
    if score >= 55:
        return "Average"
    return "Needs Attention"


def generate(n: int = 500, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    age = rng.integers(15, 31, size=n)
    internal = np.clip(rng.normal(65, 18, size=n), 0, 100)
    previous = np.clip(rng.normal(62, 20, size=n), 0, 100)
    attendance = np.clip(rng.normal(75, 15, size=n), 0, 100)

    labels = [
        _label_from_rules(int(a), float(i), float(p), float(at))
        for a, i, p, at in zip(age, internal, previous, attendance)
    ]

    return pd.DataFrame(
        {
            "age": age,
            "internal_marks": internal.round(2),
            "previous_marks": previous.round(2),
            "attendance": attendance.round(2),
            "label": labels,
        }
    )


if __name__ == "__main__":
    out_dir = Path(__file__).resolve().parent
    out_path = out_dir / "student_data.csv"

    df = generate(n=500)
    df.to_csv(out_path, index=False)
    print(f"Wrote {len(df)} rows to {out_path}")
