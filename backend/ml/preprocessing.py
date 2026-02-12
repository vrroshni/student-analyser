from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Tuple

import numpy as np


FEATURES: List[str] = [
    "age",
    *[
        f"sem{sem}_{field}"
        for sem in range(1, 9)
        for field in ("internal", "university", "attendance")
    ],
]


LABELS: List[str] = ["Needs Attention", "Average", "Good"]


def label_to_int(label: str) -> int:
    return LABELS.index(label)


def int_to_label_map() -> Dict[int, str]:
    return {i: v for i, v in enumerate(LABELS)}


def vectorize_rows(rows: np.ndarray) -> np.ndarray:
    return rows.astype(np.float32)
