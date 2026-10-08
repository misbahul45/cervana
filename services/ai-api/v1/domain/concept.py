from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Optional


class ConceptLevel(str, Enum):
    FOUNDATION = "FOUNDATION"
    INTERMEDIATE = "INTERMEDIATE"
    ADVANCED = "ADVANCED"
    SPECIALIZATION = "SPECIALIZATION"


class ProblemType(str, Enum):
    CONCEPT_EXPLANATION = "CONCEPT_EXPLANATION"
    JOURNAL_ENTRY = "JOURNAL_ENTRY"
    ERROR_DIAGNOSIS = "ERROR_DIAGNOSIS"
    CASE_ANALYSIS = "CASE_ANALYSIS"
    MULTI_STEP = "MULTI_STEP"
    MISCONCEPTION_REPAIR = "MISCONCEPTION_REPAIR"


class AssessmentSignal(str, Enum):
    EXPLAINS_DEFINITION = "EXPLAINS_DEFINITION"
    APPLIES_RULE = "APPLIES_RULE"
    RECOGNIZES_CONTRA = "RECOGNIZES_CONTRA"
    COMPUTES_BALANCE = "COMPUTES_BALANCE"
    RECONCILES_STATEMENT = "RECONCILES_STATEMENT"


class Concept:
    __slots__ = (
        "concept_id",
        "name",
        "domain",
        "level",
        "description",
        "prerequisite_ids",
        "related_concept_ids",
        "contrasts_with_ids",
        "exemplified_by_ids",
        "misconception_ids",
        "assessed_by_ids",
        "rule_ids",
        "problem_types",
        "learning_objectives",
        "assessment_signals",
    )

    def __init__(
        self,
        concept_id: str,
        name: str,
        domain: str = "ACCOUNTING",
        level: ConceptLevel = ConceptLevel.FOUNDATION,
        description: str = "",
        prerequisite_ids: Optional[List[str]] = None,
        related_concept_ids: Optional[List[str]] = None,
        contrasts_with_ids: Optional[List[str]] = None,
        exemplified_by_ids: Optional[List[str]] = None,
        misconception_ids: Optional[List[str]] = None,
        assessed_by_ids: Optional[List[str]] = None,
        rule_ids: Optional[List[str]] = None,
        problem_types: Optional[List[ProblemType]] = None,
        learning_objectives: Optional[List[str]] = None,
        assessment_signals: Optional[List[AssessmentSignal]] = None,
    ) -> None:
        self.concept_id = concept_id
        self.name = name
        self.domain = domain
        self.level = level
        self.description = description
        self.prerequisite_ids = list(prerequisite_ids or [])
        self.related_concept_ids = list(related_concept_ids or [])
        self.contrasts_with_ids = list(contrasts_with_ids or [])
        self.exemplified_by_ids = list(exemplified_by_ids or [])
        self.misconception_ids = list(misconception_ids or [])
        self.assessed_by_ids = list(assessed_by_ids or [])
        self.rule_ids = list(rule_ids or [])
        self.problem_types = list(problem_types or [])
        self.learning_objectives = list(learning_objectives or [])
        self.assessment_signals = list(assessment_signals or [])

    def to_dict(self) -> Dict[str, Any]:
        return {
            "conceptId": self.concept_id,
            "name": self.name,
            "domain": self.domain,
            "level": self.level.value if isinstance(self.level, ConceptLevel) else self.level,
            "description": self.description,
            "prerequisites": list(self.prerequisite_ids),
            "relatedConcepts": list(self.related_concept_ids),
            "contrastsWith": list(self.contrasts_with_ids),
            "exemplifiedBy": list(self.exemplified_by_ids),
            "misconceptions": list(self.misconception_ids),
            "assessedBy": list(self.assessed_by_ids),
            "rules": list(self.rule_ids),
            "problemTypes": [p.value if isinstance(p, ProblemType) else p for p in self.problem_types],
            "learningObjectives": list(self.learning_objectives),
            "assessmentSignals": [
                a.value if isinstance(a, AssessmentSignal) else a for a in self.assessment_signals
            ],
        }


__all__ = [
    "Concept",
    "ConceptLevel",
    "ProblemType",
    "AssessmentSignal",
]