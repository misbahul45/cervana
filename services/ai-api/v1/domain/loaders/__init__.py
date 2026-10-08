from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict, Union

from v1.domain.concept import (
    AssessmentSignal,
    Concept,
    ConceptLevel,
    ProblemType,
)
from v1.domain.graph import ConceptGraph
from v1.domain.misconception import (
    Misconception,
    MisconceptionStatus,
    MisconceptionType,
)
from v1.domain.rule import Rule


PathLike = Union[str, Path]


def _parse_payload(path: Path) -> Dict[str, Any]:
    suffix = path.suffix.lower()
    text = path.read_text(encoding="utf-8")
    if suffix in {".yaml", ".yml"}:
        try:
            import yaml
        except ImportError as exc:
            raise ImportError(
                "PyYAML is required to load YAML taxonomies. "
                "Install it with `pip install pyyaml` or use a JSON file."
            ) from exc
        return yaml.safe_load(text)
    return json.loads(text)


def _build_concept(raw: Dict[str, Any]) -> Concept:
    return Concept(
        concept_id=raw["conceptId"],
        name=raw["name"],
        domain=raw.get("domain", "ACCOUNTING"),
        level=ConceptLevel(raw.get("level", "FOUNDATION")),
        description=raw.get("description", ""),
        prerequisite_ids=list(raw.get("prerequisites", [])),
        related_concept_ids=list(raw.get("relatedConcepts", [])),
        contrasts_with_ids=list(raw.get("contrastsWith", [])),
        exemplified_by_ids=list(raw.get("exemplifiedBy", [])),
        misconception_ids=list(raw.get("misconceptions", [])),
        assessed_by_ids=list(raw.get("assessedBy", [])),
        rule_ids=list(raw.get("rules", [])),
        problem_types=[ProblemType(p) for p in raw.get("problemTypes", [])],
        learning_objectives=list(raw.get("learningObjectives", [])),
        assessment_signals=[AssessmentSignal(s) for s in raw.get("assessmentSignals", [])],
    )


def _build_misconception(raw: Dict[str, Any]) -> Misconception:
    return Misconception(
        misconception_id=raw["misconceptionId"],
        concept_id=raw["conceptId"],
        type=MisconceptionType(raw.get("type", "OTHER")),
        confidence=float(raw.get("confidence", 0.5)),
        evidence_count=int(raw.get("evidenceCount", 1)),
        status=MisconceptionStatus(raw.get("status", "CANDIDATE")),
        resolution_evidence=list(raw.get("resolutionEvidence", [])),
        description=raw.get("description", ""),
    )


def _build_rule(raw: Dict[str, Any]) -> Rule:
    return Rule(
        rule_id=raw["ruleId"],
        code=raw["code"],
        description=raw["description"],
        applies_to=list(raw.get("appliesTo", [])),
    )


def load_taxonomy_from_path(path: PathLike) -> ConceptGraph:
    graph = ConceptGraph()
    payload = _parse_payload(Path(path))
    for raw in payload.get("concepts", []):
        graph.add_concept(_build_concept(raw))
    for raw in payload.get("misconceptions", []):
        graph.add_misconception(_build_misconception(raw))
    for raw in payload.get("rules", []):
        graph.add_rule(_build_rule(raw))
    return graph


__all__ = ["load_taxonomy_from_path"]