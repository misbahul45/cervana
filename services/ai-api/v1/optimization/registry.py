from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple


class PromptStatus(str, Enum):
    DRAFT = "DRAFT"
    EXPERIMENTAL = "EXPERIMENTAL"
    VALIDATED = "VALIDATED"
    ACTIVE = "ACTIVE"
    REJECTED = "REJECTED"
    ROLLED_BACK = "ROLLED_BACK"
    ARCHIVED = "ARCHIVED"


VALID_TRANSITIONS = {
    PromptStatus.DRAFT: {PromptStatus.EXPERIMENTAL, PromptStatus.REJECTED, PromptStatus.ARCHIVED},
    PromptStatus.EXPERIMENTAL: {
        PromptStatus.VALIDATED,
        PromptStatus.REJECTED,
        PromptStatus.ARCHIVED,
    },
    PromptStatus.VALIDATED: {
        PromptStatus.ACTIVE,
        PromptStatus.REJECTED,
        PromptStatus.ARCHIVED,
    },
    PromptStatus.ACTIVE: {PromptStatus.ROLLED_BACK, PromptStatus.ARCHIVED},
    PromptStatus.ROLLED_BACK: {PromptStatus.ARCHIVED},
    PromptStatus.REJECTED: {PromptStatus.ARCHIVED},
    PromptStatus.ARCHIVED: set(),
}


def _invalid_for(current: PromptStatus) -> set[PromptStatus]:
    allowed = VALID_TRANSITIONS.get(current, set())
    return {s for s in PromptStatus if s not in allowed and s != current}


INVALID_TRANSITIONS = {state: _invalid_for(state) for state in PromptStatus}


@dataclass(frozen=True)
class PromptVersion:
    prompt_id: str
    version: str
    status: PromptStatus
    artifact: str
    base_version: Optional[str] = None
    benchmark_version: Optional[str] = None
    evaluator_version: Optional[str] = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str = "system"
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def hash(self) -> str:
        return hashlib.sha256(self.artifact.encode("utf-8")).hexdigest()[:16]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "promptId": self.prompt_id,
            "version": self.version,
            "status": self.status.value,
            "artifactHash": self.hash,
            "baseVersion": self.base_version,
            "benchmarkVersion": self.benchmark_version,
            "evaluatorVersion": self.evaluator_version,
            "createdAt": self.created_at.isoformat(),
            "createdBy": self.created_by,
            "metadata": dict(self.metadata),
        }


class PromptRegistry:
    def __init__(self) -> None:
        self._versions: Dict[str, PromptVersion] = {}
        self._history: List[Tuple[str, PromptStatus, datetime]] = []

    def register(self, version: PromptVersion) -> None:
        if not version.prompt_id or not version.version:
            raise ValueError("prompt_id and version are required")
        if version.status is PromptStatus.ACTIVE:
            for existing in self._versions.values():
                if (
                    existing.prompt_id == version.prompt_id
                    and existing.status is PromptStatus.ACTIVE
                ):
                    raise ValueError(
                        f"cannot register a second ACTIVE version for {version.prompt_id}"
                    )
        self._versions[version.version] = version
        self._history.append((version.version, version.status, version.created_at))

    def get(self, version: str) -> PromptVersion:
        return self._versions[version]

    def active(self, prompt_id: str) -> Optional[PromptVersion]:
        for version in self._versions.values():
            if version.prompt_id == prompt_id and version.status is PromptStatus.ACTIVE:
                return version
        return None

    def all_active(self) -> List[PromptVersion]:
        return [v for v in self._versions.values() if v.status is PromptStatus.ACTIVE]

    def transition(
        self,
        version: str,
        to_status: PromptStatus,
        *,
        actor: str,
        reason: str = "",
    ) -> PromptVersion:
        existing = self._versions[version]
        allowed = VALID_TRANSITIONS[existing.status]
        if to_status not in allowed:
            raise InvalidTransition(
                f"cannot transition {existing.status.value} -> {to_status.value} for {version}"
            )
        if existing.status is PromptStatus.ACTIVE and to_status == PromptStatus.ACTIVE:
            raise InvalidTransition("already ACTIVE; cannot self-promote")
        next_version = PromptVersion(
            prompt_id=existing.prompt_id,
            version=existing.version,
            status=to_status,
            artifact=existing.artifact,
            base_version=existing.base_version,
            benchmark_version=existing.benchmark_version,
            evaluator_version=existing.evaluator_version,
            created_at=datetime.now(timezone.utc),
            created_by=actor,
            metadata={**existing.metadata, "transition_actor": actor, "transition_reason": reason},
        )
        self._versions[version] = next_version
        self._history.append((version, to_status, next_version.created_at))
        return next_version

    def history(self) -> List[Tuple[str, PromptStatus, datetime]]:
        return list(self._history)


class InvalidTransition(ValueError):
    pass


@dataclass(frozen=True)
class PolicyVersion:
    policy_version: str
    ruleset: Dict[str, Any]
    parameters: Dict[str, Any] = field(default_factory=dict)
    effective_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    created_by: str = "system"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "policyVersion": self.policy_version,
            "ruleset": dict(self.ruleset),
            "parameters": dict(self.parameters),
            "effectiveAt": self.effective_at.isoformat(),
            "createdBy": self.created_by,
        }


class PolicyVersionRegistry:
    def __init__(self) -> None:
        self._versions: Dict[str, PolicyVersion] = {}

    def register(self, version: PolicyVersion) -> None:
        if not version.policy_version:
            raise ValueError("policy_version is required")
        self._versions[version.policy_version] = version

    def get(self, version: str) -> PolicyVersion:
        return self._versions[version]

    def all_versions(self) -> List[PolicyVersion]:
        return list(self._versions.values())


__all__ = [
    "PromptStatus",
    "VALID_TRANSITIONS",
    "INVALID_TRANSITIONS",
    "PromptVersion",
    "PromptRegistry",
    "InvalidTransition",
    "PolicyVersion",
    "PolicyVersionRegistry",
]