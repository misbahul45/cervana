from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from v1.memory.decay import (
    RetrievalCandidate,
    rank_candidates,
    retrieval_score,
)
from v1.memory.episodic import Episode, EpisodicMemory, EpisodeOutcome
from v1.memory.isolation import IsolationReport, assert_no_leak, detect_leak
from v1.memory.procedural import ProceduralMemory, Procedure
from v1.memory.semantic import SemanticLearnerMemory, SemanticSource, SemanticTrait
from v1.memory.types import (
    MemoryCandidate,
    MemoryDecision,
    MemorySource,
    MemoryWritePolicy,
)
from v1.memory.working import WorkingMemory


@dataclass
class WriteOutcome:
    decision: MemoryDecision
    trait_id: Optional[str] = None
    reason: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "decision": self.decision.value,
            "traitId": self.trait_id,
            "reason": self.reason,
        }


class MemoryLayer:
    def __init__(self, write_policy: Optional[MemoryWritePolicy] = None) -> None:
        self.write_policy = write_policy or MemoryWritePolicy()
        self.working: Dict[str, WorkingMemory] = {}
        self.episodic = EpisodicMemory()
        self.semantic = SemanticLearnerMemory()
        self.procedural = ProceduralMemory()

    def working_for(self, session_id: str, learner_id: str) -> WorkingMemory:
        existing = self.working.get(session_id)
        if existing is not None and existing.learner_id == learner_id:
            return existing
        wm = WorkingMemory(session_id=session_id, learner_id=learner_id)
        self.working[session_id] = wm
        return wm

    def discard_working(self, session_id: str) -> None:
        self.working.pop(session_id, None)

    def write_semantic(self, candidate: MemoryCandidate) -> WriteOutcome:
        decision = self.write_policy.decide(candidate)
        if decision is not MemoryDecision.ACCEPT:
            return WriteOutcome(
                decision=decision,
                reason=f"rejected by policy ({decision.value})",
            )
        trait = SemanticTrait(
            trait_id=candidate.candidate_id,
            learner_id=candidate.learner_id,
            trait_key=candidate.trait_key,
            value=candidate.value,
            source=SemanticSource(candidate.source.value),
            confidence=candidate.confidence,
            evidence_count=candidate.evidence_count,
            last_observed_at=candidate.proposed_at,
            scope=candidate.scope,
            provenance=candidate.metadata,
        )
        stored = self.semantic.upsert(trait)
        return WriteOutcome(
            decision=MemoryDecision.ACCEPT,
            trait_id=stored.trait_id,
            reason="accepted",
        )

    def write_procedure(self, procedure: Procedure) -> Procedure:
        return self.procedural.upsert(procedure)

    def record_episode(self, episode: Episode) -> None:
        self.episodic.record(episode)

    def recall_semantic(
        self,
        learner_id: str,
        *,
        trait_key: Optional[str] = None,
        min_confidence: float = 0.0,
        now: Optional[datetime] = None,
    ) -> List[Dict[str, Any]]:
        traits = self.semantic.recall(
            learner_id,
            trait_key=trait_key,
            min_confidence=min_confidence,
        )
        candidates = [
            RetrievalCandidate(
                item_id=t.trait_id,
                relevance=1.0 if trait_key is None else 1.0,
                confidence=t.confidence,
                scope_match=1.0,
                salience=1.0,
                last_observed_at=t.last_observed_at,
                metadata={"trait_key": t.trait_key, "value": t.value},
            )
            for t in traits
        ]
        ranked = rank_candidates(candidates, now=now)
        return [
            {**traits[i].to_dict(), "retrievalScore": ranked[i] and retrieval_score(ranked[i], now=now)}
            for i in range(len(ranked))
        ]

    def cross_learner_audit(
        self,
        *,
        learner_a_id: str,
        learner_b_id: str,
        learner_a_traits: List[str],
        forbidden_substrings: Optional[List[str]] = None,
    ) -> IsolationReport:
        forbidden = forbidden_substrings or learner_a_traits
        view_b = self.recall_semantic(learner_b_id)
        return detect_leak(
            learner_a_id=learner_a_id,
            learner_b_id=learner_b_id,
            test_name="cross_learner_semantic_audit",
            learner_b_view=[item.get("value", "") for item in view_b],
            forbidden_substrings=forbidden,
        )


__all__ = [
    "WriteOutcome",
    "MemoryLayer",
]