from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from v1.domain.context import render_domain_context
from v1.domain import load_default_taxonomy
from v1.domain.tools import (
    account_lookup,
    balance_check,
    concept_explanation,
    contra_account_resolver,
    rule_lookup,
    validate_journal_entry,
)
from v1.learner_model import (
    AdaptivePolicyService,
    LearnerState,
)
from v1.learner_model.policy import POLICY_VERSION, StrategyName
from v1.memory.decay import RetrievalCandidate, rank_candidates
from v1.memory.types import MemoryCandidate, MemoryDecision, MemoryWritePolicy
from v1.tutor.tutor_state import TutorOutcomeStatus, TutorRunState


logger = logging.getLogger(__name__)


class TutorRuntime:
    def __init__(
        self,
        *,
        domain_graph=None,
        write_policy: Optional[MemoryWritePolicy] = None,
        policy_service: Optional[AdaptivePolicyService] = None,
    ) -> None:
        self.domain_graph = domain_graph or load_default_taxonomy()
        self.domain_block = render_domain_context(self.domain_graph)
        self.write_policy = write_policy or MemoryWritePolicy()
        self.policy_service = policy_service or AdaptivePolicyService()

    def attach_learner_state(self, state: TutorRunState, learner_state: LearnerState) -> None:
        state.learner_state = learner_state
        if not state.domain_ontology_block:
            state.domain_ontology_block = self.domain_block

    def select_strategy(self, state: TutorRunState, concept_id: str):
        if state.learner_state is None:
            return None
        strategy = self.policy_service.select(state.learner_state, concept_id)
        state.adaptive_strategy = strategy
        return strategy

    def recall_memory(
        self,
        state: TutorRunState,
        trait_keys: List[str],
        *,
        limit: int = 5,
    ) -> List[Dict[str, Any]]:
        if state.learner_state is None:
            return []
        semantic = state.learner_state.semantic
        all_items: List[Any] = []
        for key in trait_keys:
            all_items.extend(semantic.recall(state.learner_id, trait_key=key))
        now = datetime.now(timezone.utc)
        candidates: List[RetrievalCandidate] = []
        for item in all_items:
            candidates.append(
                RetrievalCandidate(
                    item_id=item.trait_id,
                    relevance=0.9,
                    confidence=item.confidence,
                    scope_match=1.0,
                    salience=1.0,
                    last_observed_at=item.last_observed_at,
                    metadata={"trait_key": item.trait_key, "value": item.value},
                )
            )
        ranked = rank_candidates(candidates, now=now)
        out: List[Dict[str, Any]] = []
        for cand in ranked[:limit]:
            out.append(
                {
                    "traitId": cand.item_id,
                    "traitKey": cand.metadata.get("trait_key"),
                    "value": cand.metadata.get("value"),
                    "confidence": cand.confidence,
                    "lastObservedAt": cand.last_observed_at.isoformat(),
                }
            )
        state.relevant_memory = out
        return out

    def collect_rag(self, state: TutorRunState, rag_evidence: List[Dict[str, Any]]) -> None:
        state.rag_evidence = list(rag_evidence)

    def record_tool_call(
        self,
        state: TutorRunState,
        tool_id: str,
        endpoint: str,
        result: Any,
    ) -> None:
        state.tool_calls.append(
            {
                "toolId": tool_id,
                "endpoint": endpoint,
                "result_preview": str(result)[:200],
            }
        )

    def guard_refused(self, state: TutorRunState, text: str) -> bool:
        if self.write_policy.is_instruction_like(text):
            state.status = TutorOutcomeStatus.BLOCKED_BY_INJECTION
            state.response_text = (
                "Maaf, saya belum bisa menjawab itu karena pertanyaannya di luar konteks pembelajaran saat ini."
            )
            return True
        return False

    def evaluate_off_topic(self, state: TutorRunState, in_lesson_keyword: str) -> bool:
        lowered = state.user_query.lower()
        if in_lesson_keyword.lower() not in lowered:
            state.status = TutorOutcomeStatus.REJECTED_OFF_TOPIC
            state.response_text = (
                "Maaf, saya belum bisa menjawab itu karena pertanyaannya di luar konteks pembelajaran saat ini."
            )
            return True
        return False

    def build_tool_outputs_block(self, state: TutorRunState) -> str:
        if not state.tool_calls:
            return ""
        lines = ["<tool_outputs trust=\"deterministic\">"]
        for call in state.tool_calls:
            lines.append(
                f"<tool_call id=\"{call['toolId']}\" endpoint=\"{call['endpoint']}\">\n"
                f"{call.get('result_preview', '')}\n"
                f"</tool_call>"
            )
        lines.append("</tool_outputs>")
        return "\n".join(lines)


__all__ = ["TutorRuntime"]