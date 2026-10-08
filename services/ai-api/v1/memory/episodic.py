from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class EpisodeOutcome(str, Enum):
    SUCCESS = "SUCCESS"
    PARTIAL = "PARTIAL"
    FAILURE = "FAILURE"
    UNKNOWN = "UNKNOWN"


@dataclass
class Episode:
    episode_id: str
    learner_id: str
    trace_id: str
    task: str
    domain_context: Dict[str, Any] = field(default_factory=dict)
    learner_state_snapshot: Dict[str, Any] = field(default_factory=dict)
    policy_decision: Dict[str, Any] = field(default_factory=dict)
    memory_used: List[str] = field(default_factory=list)
    evidence_used: List[str] = field(default_factory=list)
    tutor_response: str = ""
    tool_usage: List[Dict[str, Any]] = field(default_factory=list)
    outcome: EpisodeOutcome = EpisodeOutcome.UNKNOWN
    evaluator_result: Dict[str, Any] = field(default_factory=dict)
    prompt_version: str = "unknown-v0"
    policy_version: str = "unknown-v0"
    tokens_in: Optional[int] = None
    tokens_out: Optional[int] = None
    cost_usd: Optional[float] = None
    latency_ms: Optional[int] = None
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "episodeId": self.episode_id,
            "learnerId": self.learner_id,
            "traceId": self.trace_id,
            "task": self.task,
            "domainContext": dict(self.domain_context),
            "learnerStateSnapshot": dict(self.learner_state_snapshot),
            "policyDecision": dict(self.policy_decision),
            "memoryUsed": list(self.memory_used),
            "evidenceUsed": list(self.evidence_used),
            "tutorResponse": self.tutor_response,
            "toolUsage": list(self.tool_usage),
            "outcome": self.outcome.value,
            "evaluatorResult": dict(self.evaluator_result),
            "promptVersion": self.prompt_version,
            "policyVersion": self.policy_version,
            "tokensIn": self.tokens_in,
            "tokensOut": self.tokens_out,
            "costUsd": self.cost_usd,
            "latencyMs": self.latency_ms,
            "occurredAt": self.occurred_at.isoformat(),
            "metadata": dict(self.metadata),
        }


class EpisodicMemory:
    def __init__(self, *, max_episodes: int = 1000) -> None:
        if max_episodes <= 0:
            raise ValueError("max_episodes must be positive")
        self._episodes: Dict[str, Episode] = {}
        self.max_episodes = max_episodes

    def record(self, episode: Episode) -> None:
        if episode.learner_id is None or episode.learner_id == "":
            raise ValueError("episode.learner_id is required")
        self._episodes[episode.episode_id] = episode
        if len(self._episodes) > self.max_episodes:
            sorted_by_age = sorted(
                self._episodes.values(),
                key=lambda e: e.occurred_at,
            )
            evicted = sorted_by_age[0]
            self._episodes.pop(evicted.episode_id, None)

    def recall(
        self,
        learner_id: str,
        *,
        trace_id: Optional[str] = None,
        outcome: Optional[EpisodeOutcome] = None,
        limit: int = 20,
    ) -> List[Episode]:
        episodes = [
            e
            for e in self._episodes.values()
            if e.learner_id == learner_id
            and (trace_id is None or e.trace_id == trace_id)
            and (outcome is None or e.outcome == outcome)
        ]
        episodes.sort(key=lambda e: e.occurred_at, reverse=True)
        return episodes[:limit]

    def delete(self, episode_id: str) -> bool:
        return self._episodes.pop(episode_id, None) is not None

    def delete_for_learner(self, learner_id: str) -> int:
        to_delete = [
            eid for eid, ep in self._episodes.items() if ep.learner_id == learner_id
        ]
        for eid in to_delete:
            self._episodes.pop(eid, None)
        return len(to_delete)

    def __len__(self) -> int:
        return len(self._episodes)


__all__ = ["Episode", "EpisodeOutcome", "EpisodicMemory"]