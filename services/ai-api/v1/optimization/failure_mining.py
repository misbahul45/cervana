from __future__ import annotations

import hashlib
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class FailureCategory(str, Enum):
    WRONG_ANSWER = "WRONG_ANSWER"
    WRONG_DIFFICULTY = "WRONG_DIFFICULTY"
    WRONG_STRATEGY = "WRONG_STRATEGY"
    WEAK_GROUNDING = "WEAK_GROUNDING"
    MISSING_CITATION = "MISSING_CITATION"
    BAD_PERSONALIZATION = "BAD_PERSONALIZATION"
    MEMORY_MISS = "MEMORY_MISS"
    MEMORY_FALSE_POSITIVE = "MEMORY_FALSE_POSITIVE"
    TOOL_ERROR = "TOOL_ERROR"
    DOMAIN_ERROR = "DOMAIN_ERROR"
    OVER_SCAFFOLDING = "OVER_SCAFFOLDING"
    UNDER_SCAFFOLDING = "UNDER_SCAFFOLDING"
    EXCESSIVE_VERBOSITY = "EXCESSIVE_VERBOSITY"
    HALLUCINATION = "HALLUCINATION"


@dataclass(frozen=True)
class FailureEpisode:
    failure_id: str
    episode_id: str
    category: FailureCategory
    scenario_id: Optional[str]
    dimension: Optional[str]
    snippet: str
    occurred_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        return {
            "failureId": self.failure_id,
            "episodeId": self.episode_id,
            "category": self.category.value,
            "scenarioId": self.scenario_id,
            "dimension": self.dimension,
            "snippet": self.snippet,
            "occurredAt": self.occurred_at.isoformat(),
        }


@dataclass
class FailureCluster:
    category: FailureCategory
    episodes: List[FailureEpisode] = field(default_factory=list)
    dominant_pattern: str = ""
    hypothesized_fix: str = ""

    @property
    def count(self) -> int:
        return len(self.episodes)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "category": self.category.value,
            "count": self.count,
            "dominantPattern": self.dominant_pattern,
            "hypothesizedFix": self.hypothesized_fix,
            "episodeIds": [e.episode_id for e in self.episodes],
        }


DOMINANT_PATTERN_TEMPLATES = {
    FailureCategory.WRONG_ANSWER: (
        "Tutor output answer disagrees with expected reference; "
        "candidate should be retrained on the labelled examples for this scenario set."
    ),
    FailureCategory.WRONG_DIFFICULTY: (
        "Difficulty chosen by AdaptivePolicyService does not match learner evidence; "
        "candidate should tune difficulty calibration."
    ),
    FailureCategory.WRONG_STRATEGY: (
        "Selected pedagogical strategy underperformed; "
        "candidate should narrow the strategy map for this concept band."
    ),
    FailureCategory.WEAK_GROUNDING: (
        "Tutor cites RAG content that does not strongly support the claim; "
        "candidate should tighten the grounding prompt and citation format."
    ),
    FailureCategory.MISSING_CITATION: (
        "Tutor omits citation where the rubric expects one; "
        "candidate should add a citation instruction."
    ),
    FailureCategory.BAD_PERSONALIZATION: (
        "Tutor ignores a learner signal (preference, misconception, mastery); "
        "candidate should respect the typed learner_state block."
    ),
    FailureCategory.MEMORY_MISS: (
        "Tutor fails to surface a stored learner trait that was relevant; "
        "candidate should widen the relevant_memory retrieval scope."
    ),
    FailureCategory.MEMORY_FALSE_POSITIVE: (
        "Tutor surfaces a stored trait that should have been filtered; "
        "candidate should tighten the recency/evidence threshold."
    ),
    FailureCategory.TOOL_ERROR: (
        "Domain tool raised a deterministic exception; "
        "candidate should improve recovery narrative and route."
    ),
    FailureCategory.DOMAIN_ERROR: (
        "Domain validator produced a wrong decision; "
        "candidate should add explicit rule-check before commit."
    ),
    FailureCategory.OVER_SCAFFOLDING: (
        "Tutor over-scaffolds and stalls the learner; "
        "candidate should relax scaffolding for moderate-mastery learners."
    ),
    FailureCategory.UNDER_SCAFFOLDING: (
        "Tutor under-scaffolds a low-mastery learner; "
        "candidate should boost scaffolding for early-evidence learners."
    ),
    FailureCategory.EXCESSIVE_VERBOSITY: (
        "Tutor output exceeds word budget; "
        "candidate should tighten output contract."
    ),
    FailureCategory.HALLUCINATION: (
        "Tutor cites a concept/rule not in the domain ontology; "
        "candidate should strengthen the ontology trust fence and add a post-generation concept-existence guard."
    ),
}


class FailureMiner:
    def __init__(self, *, min_cluster_size: int = 1) -> None:
        if min_cluster_size < 1:
            raise ValueError("min_cluster_size must be >= 1")
        self.min_cluster_size = min_cluster_size
        self._failures: List[FailureEpisode] = []

    def record(self, failure: FailureEpisode) -> None:
        self._failures.append(failure)

    def cluster(self) -> List[FailureCluster]:
        buckets: Dict[FailureCategory, List[FailureEpisode]] = defaultdict(list)
        for failure in self._failures:
            buckets[failure.category].append(failure)
        clusters: List[FailureCluster] = []
        for category, episodes in buckets.items():
            if len(episodes) < self.min_cluster_size:
                continue
            snippet_blob = "\n".join(e.snippet for e in episodes)
            cluster = FailureCluster(
                category=category,
                episodes=episodes,
                dominant_pattern=DOMINANT_PATTERN_TEMPLATES.get(category, ""),
                hypothesized_fix=_hypothesized_fix(snippet_blob),
            )
            clusters.append(cluster)
        return clusters

    def episodes(self) -> List[FailureEpisode]:
        return list(self._failures)


def _hypothesized_fix(snippet: str) -> str:
    h = hashlib.sha256(snippet.encode("utf-8")).hexdigest()[:8]
    return (
        f"Pin a deterministic fix candidate; verify with frozen benchmark; "
        f"ensure Cohen's κ against human-labeled subset remains ≥ 0.85 "
        f"(fixture_hash={h})"
    )


__all__ = [
    "FailureCategory",
    "FailureEpisode",
    "FailureCluster",
    "DOMINANT_PATTERN_TEMPLATES",
    "FailureMiner",
]