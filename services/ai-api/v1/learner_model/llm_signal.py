from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import List, Optional

from v1.domain.misconception import Misconception, MisconceptionType
from v1.domain import load_default_taxonomy


logger = logging.getLogger(__name__)


_INSTRUCTION_PATTERNS = re.compile(
    r"(ignore|disregard|forget)\s+(?:previous|prior|earlier|above|the)\s+(?:instructions?|prompts?|rules?|directions?|polic(?:y|ies))",
    re.IGNORECASE,
)


@dataclass
class LLMMisconceptionProposal:
    concept_id: str
    misconception_type: MisconceptionType
    evidence_snippet: str
    confidence: float = 0.5


@dataclass
class LLMMasteryProposal:
    concept_id: str
    observed: bool
    confidence: float = 0.5
    hint_level: int = 0


def detect_instruction_injection(text: str) -> bool:
    if not text:
        return False
    return bool(_INSTRUCTION_PATTERNS.search(text))


def extract_misconception_proposals(
    learner_text: str,
    *,
    taxonomy_graph=None,
) -> List[LLMMisconceptionProposal]:
    """Heuristic proposal extractor.

    This is the AI side of the misconception pipeline. The LLM is asked to
    reason about learner_text and propose misconception candidates; this function
    is the structured receiver.
    """
    if detect_instruction_injection(learner_text):
        logger.warning("[SIGNAL] instruction-like text rejected")
        return []
    graph = taxonomy_graph or load_default_taxonomy()
    proposals: List[LLMMisconceptionProposal] = []
    lowered = learner_text.lower()
    if "contra" in lowered and ("asset" in lowered or "depreciation" in lowered):
        if graph.has_concept("contra_account"):
            proposals.append(
                LLMMisconceptionProposal(
                    concept_id="contra_account",
                    misconception_type=MisconceptionType.CONTRA_ACCOUNT_CONFUSION,
                    evidence_snippet=learner_text[:200],
                    confidence=0.7,
                )
            )
    if "revenue" in lowered and ("debit" in lowered):
        if graph.has_concept("normal_balance"):
            proposals.append(
                LLMMisconceptionProposal(
                    concept_id="normal_balance",
                    misconception_type=MisconceptionType.DEBIT_CREDIT_DIRECTION_ERROR,
                    evidence_snippet=learner_text[:200],
                    confidence=0.65,
                )
            )
    if "accrual" in lowered and ("reversing" in lowered or "skip" in lowered):
        if graph.has_concept("adjusting_entry"):
            proposals.append(
                LLMMisconceptionProposal(
                    concept_id="adjusting_entry",
                    misconception_type=MisconceptionType.ADJUSTING_ENTRY_ERROR,
                    evidence_snippet=learner_text[:200],
                    confidence=0.55,
                )
            )
    return proposals


def extract_mastery_proposal(
    concept_id: str,
    *,
    observed: bool,
    hint_level: int = 0,
    confidence: float = 0.5,
) -> LLMMasteryProposal:
    if not (0.0 <= confidence <= 1.0):
        raise ValueError(f"confidence must be in [0,1], got {confidence}")
    if not (0 <= hint_level <= 7):
        raise ValueError(f"hint_level must be in 0..7, got {hint_level}")
    return LLMMasteryProposal(
        concept_id=concept_id,
        observed=observed,
        confidence=confidence,
        hint_level=hint_level,
    )


__all__ = [
    "LLMMisconceptionProposal",
    "LLMMasteryProposal",
    "detect_instruction_injection",
    "extract_misconception_proposals",
    "extract_mastery_proposal",
]