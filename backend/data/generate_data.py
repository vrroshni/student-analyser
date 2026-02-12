from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


TOTAL_OUT_OF = 600
INTERNAL_OUT_OF = 300
UNIVERSITY_OUT_OF = 300


def _label_from_rules(*, age: int, avg_pct: float, last_pct: float, avg_att: float) -> str:
    score = 0.0
    score += 0.55 * avg_pct
    score += 0.25 * last_pct
    score += 0.20 * avg_att

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

    sem_internal = np.clip(rng.normal(190, 60, size=(n, 8)), 0, INTERNAL_OUT_OF)
    sem_university = np.clip(rng.normal(185, 65, size=(n, 8)), 0, UNIVERSITY_OUT_OF)
    sem_attendance = np.clip(rng.normal(78, 12, size=(n, 8)), 0, 100)

    sem_pct = (sem_internal + sem_university) / float(TOTAL_OUT_OF) * 100.0
    avg_pct = sem_pct.mean(axis=1)
    last_pct = sem_pct[:, -1]
    avg_att = sem_attendance.mean(axis=1)

    labels = [
        _label_from_rules(
            age=int(a),
            avg_pct=float(ap),
            last_pct=float(lp),
            avg_att=float(aa),
        )
        for a, ap, lp, aa in zip(age, avg_pct, last_pct, avg_att)
    ]

    data: dict[str, object] = {"age": age}
    for sem in range(1, 9):
        data[f"sem{sem}_internal"] = np.round(sem_internal[:, sem - 1]).astype(int)
        data[f"sem{sem}_university"] = np.round(sem_university[:, sem - 1]).astype(int)
        data[f"sem{sem}_attendance"] = np.round(sem_attendance[:, sem - 1], 2)
    data["label"] = labels

    return pd.DataFrame(data)


if __name__ == "__main__":
    out_dir = Path(__file__).resolve().parent
    out_path = out_dir / "student_data.csv"

    df = generate(n=500)
    df.to_csv(out_path, index=False)
    print(f"Wrote {len(df)} rows to {out_path}")
