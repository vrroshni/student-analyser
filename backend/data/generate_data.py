from __future__ import annotations

from pathlib import Path

import numpy as np
import pandas as pd


TOTAL_OUT_OF = 600
INTERNAL_OUT_OF = 300
UNIVERSITY_OUT_OF = 300


def _label_from_rules(*, avg_pct: float, last_pct: float, avg_att: float) -> str:
    score = 0.0
    score += 0.55 * avg_pct
    score += 0.25 * last_pct
    score += 0.20 * avg_att

    if score >= 75:
        return "Good"
    if score >= 55:
        return "Average"
    return "Needs Attention"


def _generate_class(
    rng: np.random.Generator,
    n: int,
    *,
    int_mean: float,
    int_std: float,
    uni_mean: float,
    uni_std: float,
    att_mean: float,
    att_std: float,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    sem_internal = np.clip(rng.normal(int_mean, int_std, size=(n, 8)), 0, INTERNAL_OUT_OF)
    sem_university = np.clip(rng.normal(uni_mean, uni_std, size=(n, 8)), 0, UNIVERSITY_OUT_OF)
    sem_attendance = np.clip(rng.normal(att_mean, att_std, size=(n, 8)), 0, 100)
    return sem_internal, sem_university, sem_attendance


def generate(n: int = 1500, seed: int = 42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    per_class = n // 3

    # Good students: high marks, high attendance
    good_int, good_uni, good_att = _generate_class(
        rng, per_class,
        int_mean=250, int_std=30, uni_mean=255, uni_std=28,
        att_mean=90, att_std=5,
    )

    # Average students: medium marks, medium attendance
    avg_int, avg_uni, avg_att = _generate_class(
        rng, per_class,
        int_mean=170, int_std=35, uni_mean=165, uni_std=35,
        att_mean=72, att_std=10,
    )

    # Needs Attention students: low marks, low attendance
    na_int, na_uni, na_att = _generate_class(
        rng, per_class,
        int_mean=90, int_std=40, uni_mean=85, uni_std=40,
        att_mean=50, att_std=15,
    )

    sem_internal = np.vstack([good_int, avg_int, na_int])
    sem_university = np.vstack([good_uni, avg_uni, na_uni])
    sem_attendance = np.vstack([good_att, avg_att, na_att])

    sem_pct = (sem_internal + sem_university) / float(TOTAL_OUT_OF) * 100.0
    avg_pct = sem_pct.mean(axis=1)
    last_pct = sem_pct[:, -1]
    avg_att_arr = sem_attendance.mean(axis=1)

    labels = [
        _label_from_rules(
            avg_pct=float(ap),
            last_pct=float(lp),
            avg_att=float(aa),
        )
        for ap, lp, aa in zip(avg_pct, last_pct, avg_att_arr)
    ]

    data: dict[str, object] = {}
    for sem in range(1, 9):
        data[f"sem{sem}_internal"] = np.round(sem_internal[:, sem - 1]).astype(int)
        data[f"sem{sem}_university"] = np.round(sem_university[:, sem - 1]).astype(int)
        data[f"sem{sem}_attendance"] = np.round(sem_attendance[:, sem - 1], 2)
    data["label"] = labels

    # Shuffle rows
    df = pd.DataFrame(data)
    return df.sample(frac=1, random_state=seed).reset_index(drop=True)


if __name__ == "__main__":
    out_dir = Path(__file__).resolve().parent
    out_path = out_dir / "student_data.csv"

    df = generate(n=1500)
    df.to_csv(out_path, index=False)
    print(f"Wrote {len(df)} rows to {out_path}")
