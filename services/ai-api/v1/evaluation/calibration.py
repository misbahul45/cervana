from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple


COHEN_KAPPA_THRESHOLD = 0.85


def _confusion_matrix(
    rater_a: List[int],
    rater_b: List[int],
    categories: List[int],
) -> List[List[int]]:
    matrix = [[0 for _ in categories] for _ in categories]
    index = {cat: i for i, cat in enumerate(categories)}
    for a, b in zip(rater_a, rater_b):
        if a not in index or b not in index:
            continue
        matrix[index[a]][index[b]] += 1
    return matrix


def cohen_kappa(
    rater_a: List[int],
    rater_b: List[int],
    *,
    categories: List[int],
) -> float:
    """Cohen's kappa coefficient for two raters on categorical labels.

    Master prompt §63 target: κ ≥ 0.85.
    """
    if len(rater_a) != len(rater_b):
        raise ValueError("rater_a and rater_b must have the same length")
    if not categories:
        raise ValueError("categories must be non-empty")
    n = len(rater_a)
    if n == 0:
        return 1.0
    matrix = _confusion_matrix(rater_a, rater_b, categories)
    total = sum(sum(row) for row in matrix)
    if total == 0:
        return 1.0
    po = sum(matrix[i][i] for i in range(len(categories))) / total
    row_totals = [sum(row) for row in matrix]
    col_totals = [sum(matrix[i][j] for i in range(len(categories))) for j in range(len(categories))]
    pe = sum(
        (row_totals[i] * col_totals[i]) / (total * total)
        for i in range(len(categories))
    )
    if pe == 1.0:
        return 1.0
    return (po - pe) / (1.0 - pe)


@dataclass(frozen=True)
class HumanLabeledItem:
    scenario_id: str
    human_score: float
    evaluator_score: float


@dataclass(frozen=True)
class CalibrationReport:
    n_items: int
    pearson: float
    cohen_kappa_above_threshold: bool
    threshold: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "nItems": self.n_items,
            "pearson": self.pearson,
            "cohenKappaAboveThreshold": self.cohen_kappa_above_threshold,
            "threshold": self.threshold,
        }


def pearson_correlation(xs: List[float], ys: List[float]) -> float:
    if len(xs) != len(ys) or len(xs) < 2:
        raise ValueError("need at least two paired samples")
    n = len(xs)
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    cov = sum((xs[i] - mean_x) * (ys[i] - mean_y) for i in range(n))
    var_x = sum((xs[i] - mean_x) ** 2 for i in range(n))
    var_y = sum((ys[i] - mean_y) ** 2 for i in range(n))
    if var_x <= 0 or var_y <= 0:
        return 0.0
    return cov / (var_x * var_y) ** 0.5


def calibrate(items: List[HumanLabeledItem]) -> CalibrationReport:
    if not items:
        return CalibrationReport(
            n_items=0,
            pearson=0.0,
            cohen_kappa_above_threshold=False,
            threshold=COHEN_KAPPA_THRESHOLD,
        )
    evaluator_scores = [round(item.evaluator_score) for item in items]
    human_scores = [round(item.human_score) for item in items]
    categories = sorted(set(evaluator_scores) | set(human_scores))
    kappa = cohen_kappa(
        human_scores,
        evaluator_scores,
        categories=categories,
    )
    pearson = pearson_correlation(
        [item.human_score for item in items],
        [item.evaluator_score for item in items],
    )
    return CalibrationReport(
        n_items=len(items),
        pearson=pearson,
        cohen_kappa_above_threshold=kappa >= COHEN_KAPPA_THRESHOLD,
        threshold=COHEN_KAPPA_THRESHOLD,
    )


__all__ = [
    "COHEN_KAPPA_THRESHOLD",
    "HumanLabeledItem",
    "CalibrationReport",
    "cohen_kappa",
    "pearson_correlation",
    "calibrate",
]