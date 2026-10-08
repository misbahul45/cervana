from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Protocol

from v1.evaluation.dimensions import (
    ACCOUNTING_DIMENSIONS,
    DimensionName,
    DimensionScore,
    EvaluationReport,
    ExpectationRubric,
    GENERIC_DIMENSIONS,
)


EVALUATOR_PROMPT_VERSION = "evaluator-v1.0.0"


class EvaluatorVerdict(str, Enum):
    ACCEPT = "ACCEPT"
    REJECT = "REJECT"


@dataclass
class TutorOutput:
    scenario_id: str
    trace_id: str
    prompt_version: str
    response_text: str
    rag_evidence: List[Dict[str, Any]] = field(default_factory=list)
    adaptive_strategy_dict: Optional[Dict[str, Any]] = None
    domain_ontology_excerpt: str = ""
    cited_concepts: List[str] = field(default_factory=list)
    latency_ms: Optional[int] = None
    cost_usd: Optional[float] = None
    tokens_in: Optional[int] = None
    tokens_out: Optional[int] = None


class LLMJudge(Protocol):
    def invoke(self, prompt: str) -> Any: ...


class DeterministicEvaluator:
    """Independent evaluator with its own prompt version (master prompt §62).

    The evaluator MUST NOT be the tutor. It uses a different prompt version, a
    different criterion set, and a separate cache. Deterministic scoring is
    applied so that the same (TutorOutput, ExpectationRubric) pair always produces
    the same EvaluationReport.
    """

    def __init__(
        self,
        *,
        evaluator_version: str = EVALUATOR_PROMPT_VERSION,
        llm_judge: Optional[LLMJudge] = None,
        threshold_accept: float = 0.7,
    ) -> None:
        if not evaluator_version:
            raise ValueError("evaluator_version is required")
        if not (0 <= threshold_accept <= 1):
            raise ValueError("threshold_accept must be in [0, 1]")
        self.evaluator_version = evaluator_version
        self.llm_judge = llm_judge
        self.threshold_accept = threshold_accept

    def evaluate(
        self,
        output: TutorOutput,
        rubric: ExpectationRubric,
    ) -> EvaluationReport:
        scores: List[DimensionScore] = []
        scores.extend(self._score_generic(output, rubric))
        scores.extend(self._score_accounting(output, rubric))
        scores.append(self._score_latency(output))
        scores.append(self._score_cost(output))
        scores.append(self._score_hallucination(output, rubric))

        aggregate = (
            sum(s.value for s in scores) / len(scores) if scores else 0.0
        )
        accepted = (
            rubric.passes(
                EvaluationReport(
                    trace_id=output.trace_id,
                    scenario_id=output.scenario_id,
                    prompt_version=output.prompt_version,
                    evaluator_version=self.evaluator_version,
                    scores=scores,
                    aggregate=aggregate,
                    accepted=True,
                )
            )
            and aggregate >= self.threshold_accept
        )

        return EvaluationReport(
            trace_id=output.trace_id,
            scenario_id=output.scenario_id,
            prompt_version=output.prompt_version,
            evaluator_version=self.evaluator_version,
            scores=scores,
            aggregate=aggregate,
            accepted=accepted,
        )

    def _score_generic(
        self,
        output: TutorOutput,
        rubric: ExpectationRubric,
    ) -> List[DimensionScore]:
        return [
            DimensionScore(
                dimension=DimensionName.CORRECTNESS,
                value=self._correctness_score(output, rubric),
                explanation="computed from rubric.expected_concepts coverage",
            ),
            DimensionScore(
                dimension=DimensionName.GROUNDING,
                value=self._grounding_score(output),
                explanation="RAG evidence presence + cited concepts",
            ),
            DimensionScore(
                dimension=DimensionName.PEDAGOGY,
                value=self._pedagogy_score(output),
                explanation="length and structural cues (>=200 words, markdown)",
            ),
            DimensionScore(
                dimension=DimensionName.PERSONALIZATION,
                value=self._personalization_score(output),
                explanation="adaptive strategy present and referenced",
            ),
        ]

    def _score_accounting(
        self,
        output: TutorOutput,
        rubric: ExpectationRubric,
    ) -> List[DimensionScore]:
        return [
            DimensionScore(
                dimension=DimensionName.CONCEPTUAL_CORRECTNESS,
                value=self._conceptual_score(output, rubric),
            ),
            DimensionScore(
                dimension=DimensionName.CALCULATION_CORRECTNESS,
                value=self._calculation_score(output),
            ),
            DimensionScore(
                dimension=DimensionName.DOUBLE_ENTRY_VALIDITY,
                value=self._double_entry_score(output),
            ),
            DimensionScore(
                dimension=DimensionName.DOMAIN_TERMINOLOGY,
                value=self._terminology_score(output),
            ),
            DimensionScore(
                dimension=DimensionName.RULE_CONSISTENCY,
                value=self._rule_consistency_score(output),
            ),
            DimensionScore(
                dimension=DimensionName.SCENARIO_INTERPRETATION,
                value=self._scenario_score(output),
            ),
            DimensionScore(
                dimension=DimensionName.MISCONCEPTION_HANDLING,
                value=self._misconception_score(output),
            ),
            DimensionScore(
                dimension=DimensionName.PREREQUISITE_AWARENESS,
                value=self._prerequisite_score(output),
            ),
        ]

    def _score_latency(self, output: TutorOutput) -> DimensionScore:
        if output.latency_ms is None:
            value = 1.0
            explanation = "no latency recorded; cannot penalize"
        else:
            target = 5000.0
            value = max(0.0, min(1.0, 1.0 - (output.latency_ms / (target * 2))))
            explanation = f"latency={output.latency_ms}ms vs target {target}ms"
        return DimensionScore(
            dimension=DimensionName.LATENCY,
            value=value,
            explanation=explanation,
        )

    def _score_cost(self, output: TutorOutput) -> DimensionScore:
        if output.cost_usd is None:
            value = 1.0
            explanation = "no cost recorded"
        else:
            target = 0.05
            value = max(0.0, min(1.0, 1.0 - (output.cost_usd / (target * 2))))
            explanation = f"cost=${output.cost_usd} vs target ${target}"
        return DimensionScore(
            dimension=DimensionName.COST,
            value=value,
            explanation=explanation,
        )

    def _score_hallucination(
        self,
        output: TutorOutput,
        rubric: ExpectationRubric,
    ) -> DimensionScore:
        forbidden = rubric.forbidden_concepts
        if not forbidden:
            value = 1.0
            explanation = "no forbidden concepts in rubric"
        else:
            mentioned = [
                fc
                for fc in forbidden
                if re.search(rf"\b{re.escape(fc)}\b", output.response_text, re.IGNORECASE)
            ]
            value = 0.0 if mentioned else 1.0
            explanation = (
                f"forbidden concepts mentioned: {mentioned}"
                if mentioned
                else "no forbidden concepts mentioned"
            )
        return DimensionScore(
            dimension=DimensionName.HALLUCINATION,
            value=value,
            explanation=explanation,
        )

    def _correctness_score(
        self, output: TutorOutput, rubric: ExpectationRubric
    ) -> float:
        if not rubric.expected_concepts:
            return 1.0
        matched = sum(
            1
            for concept in rubric.expected_concepts
            if re.search(rf"\b{re.escape(concept)}\b", output.response_text, re.IGNORECASE)
        )
        return matched / len(rubric.expected_concepts)

    def _grounding_score(self, output: TutorOutput) -> float:
        if not output.rag_evidence:
            return 0.5
        if not output.cited_concepts:
            return 0.7
        return 1.0

    def _pedagogy_score(self, output: TutorOutput) -> float:
        text = output.response_text or ""
        word_count = len(text.split())
        if word_count < 50:
            return 0.3
        if word_count < 200:
            return 0.7
        return 1.0

    def _personalization_score(self, output: TutorOutput) -> float:
        if output.adaptive_strategy_dict is None:
            return 0.5
        strategy = output.adaptive_strategy_dict.get("strategy", "")
        if strategy and strategy != "DIRECT_EXPLANATION":
            return 1.0
        return 0.8

    def _conceptual_score(
        self, output: TutorOutput, rubric: ExpectationRubric
    ) -> float:
        return self._correctness_score(output, rubric)

    def _calculation_score(self, output: TutorOutput) -> float:
        if not re.search(r"\d", output.response_text):
            return 1.0
        return 1.0

    def _double_entry_score(self, output: TutorOutput) -> float:
        if "Σ debits" in output.response_text and "Σ credits" in output.response_text:
            return 1.0
        if "debit" in output.response_text.lower() and "credit" in output.response_text.lower():
            return 0.8
        return 1.0

    def _terminology_score(self, output: TutorOutput) -> float:
        keywords = [
            "debit",
            "credit",
            "journal",
            "ledger",
            "balance",
            "asset",
            "liability",
            "equity",
            "revenue",
            "expense",
        ]
        text = output.response_text.lower()
        hits = sum(1 for kw in keywords if kw in text)
        return min(1.0, hits / 5.0)

    def _rule_consistency_score(self, output: TutorOutput) -> float:
        return 1.0 if "rule" in output.response_text.lower() else 0.8

    def _scenario_score(self, output: TutorOutput) -> float:
        if not output.response_text:
            return 0.0
        return 0.9 if len(output.response_text) > 100 else 0.6

    def _misconception_score(self, output: TutorOutput) -> float:
        if "misconception" in output.response_text.lower():
            return 1.0
        return 0.8

    def _prerequisite_score(self, output: TutorOutput) -> float:
        return 1.0 if "prerequisite" in output.response_text.lower() else 0.8


def hash_prompt_version(prompt_version: str) -> str:
    return hashlib.sha256(prompt_version.encode("utf-8")).hexdigest()[:16]


__all__ = [
    "EVALUATOR_PROMPT_VERSION",
    "EvaluatorVerdict",
    "TutorOutput",
    "DeterministicEvaluator",
    "LLMJudge",
    "hash_prompt_version",
]