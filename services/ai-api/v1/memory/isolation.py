from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class IsolationReport:
    learner_a: str
    learner_b: str
    test_name: str
    leaked: bool
    leaked_items: List[Any] = field(default_factory=list)
    message: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "learnerA": self.learner_a,
            "learnerB": self.learner_b,
            "testName": self.test_name,
            "leaked": self.leaked,
            "leakedItems": [str(item) for item in self.leaked_items],
            "message": self.message,
        }


class IsolationError(RuntimeError):
    pass


def assert_no_leak(report: IsolationReport) -> None:
    if report.leaked:
        raise IsolationError(
            f"isolation violated ({report.test_name}): "
            f"{len(report.leaked_items)} item(s) leaked from "
            f"{report.learner_a} into {report.learner_b}"
        )


def detect_leak(
    *,
    learner_a_id: str,
    learner_b_id: str,
    test_name: str,
    learner_b_view: List[Any],
    forbidden_substrings: List[str],
) -> IsolationReport:
    leaked = [
        item
        for item in learner_b_view
        if any(
            substring.lower() in str(item).lower()
            for substring in forbidden_substrings
        )
    ]
    return IsolationReport(
        learner_a=learner_a_id,
        learner_b=learner_b_id,
        test_name=test_name,
        leaked=bool(leaked),
        leaked_items=leaked,
        message="ok" if not leaked else "leak detected",
    )


__all__ = ["IsolationReport", "IsolationError", "assert_no_leak", "detect_leak"]