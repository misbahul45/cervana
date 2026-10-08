from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class DimensionName(str, Enum):
    CORRECTNESS = "CORRECTNESS"
    GROUNDING = "GROUNDING"
    PEDAGOGY = "PEDAGOGY"
    PERSONALIZATION = "PERSONALIZATION"
    HALLUCINATION = "HALLUCINATION"
    LATENCY = "LATENCY"
    COST = "COST"

    CONCEPTUAL_CORRECTNESS = "CONCEPTUAL_CORRECTNESS"
    CALCULATION_CORRECTNESS = "CALCULATION_CORRECTNESS"
    DOUBLE_ENTRY_VALIDITY = "DOUBLE_ENTRY_VALIDITY"
    DOMAIN_TERMINOLOGY = "DOMAIN_TERMINOLOGY"
    RULE_CONSISTENCY = "RULE_CONSISTENCY"
    SCENARIO_INTERPRETATION = "SCENARIO_INTERPRETATION"
    MISCONCEPTION_HANDLING = "MISCONCEPTION_HANDLING"
    PREREQUISITE_AWARENESS = "PREREQUISITE_AWARENESS"


GENERIC_DIMENSIONS: List[DimensionName] = [
    DimensionName.CORRECTNESS,
    DimensionName.GROUNDING,
    DimensionName.PEDAGOGY,
    DimensionName.PERSONALIZATION,
    DimensionName.HALLUCINATION,
    DimensionName.LATENCY,
    DimensionName.COST,
]

ACCOUNTING_DIMENSIONS: List[DimensionName] = [
    DimensionName.CONCEPTUAL_CORRECTNESS,
    DimensionName.CALCULATION_CORRECTNESS,
    DimensionName.DOUBLE_ENTRY_VALIDITY,
    DimensionName.DOMAIN_TERMINOLOGY,
    DimensionName.RULE_CONSISTENCY,
    DimensionName.SCENARIO_INTERPRETATION,
    DimensionName.MISCONCEPTION_HANDLING,
    DimensionName.PREREQUISITE_AWARENESS,
]


@dataclass
class DimensionScore:
    dimension: DimensionName
    value: float
    explanation: str = ""
    evidence: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not (0.0 <= self.value <= 1.0):
            raise ValueError(f"score must be in [0, 1], got {self.value}")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "dimension": self.dimension.value,
            "value": self.value,
            "explanation": self.explanation,
            "evidence": dict(self.evidence),
        }


@dataclass
class EvaluationReport:
    trace_id: str
    scenario_id: str
    prompt_version: str
    evaluator_version: str
    scores: List[DimensionScore] = field(default_factory=list)
    aggregate: float = 0.0
    accepted: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "traceId": self.trace_id,
            "scenarioId": self.scenario_id,
            "promptVersion": self.prompt_version,
            "evaluatorVersion": self.evaluator_version,
            "scores": [s.to_dict() for s in self.scores],
            "aggregate": self.aggregate,
            "accepted": self.accepted,
        }

    def score_for(self, name: DimensionName) -> Optional[DimensionScore]:
        for s in self.scores:
            if s.dimension is name:
                return s
        return None


@dataclass
class ExpectationRubric:
    rubric_id: str
    scenario_id: str
    expected_dimensions: Dict[DimensionName, float] = field(default_factory=dict)
    expected_dimension_floors: Dict[DimensionName, float] = field(default_factory=dict)
    expected_concepts: List[str] = field(default_factory=list)
    forbidden_concepts: List[str] = field(default_factory=list)
    expected_response_signature: Optional[str] = None
    notes: str = ""

    def passes(self, report: EvaluationReport) -> bool:
        for name, threshold in self.expected_dimension_floors.items():
            score = report.score_for(name)
            if score is None or score.value < threshold:
                return False
        return True


__all__ = [
    "DimensionName",
    "GENERIC_DIMENSIONS",
    "ACCOUNTING_DIMENSIONS",
    "DimensionScore",
    "EvaluationReport",
    "ExpectationRubric",
]