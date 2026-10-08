from __future__ import annotations

import hashlib
from dataclasses import dataclass, replace
from typing import Dict, List, Mapping, Sequence

from config.model_router import RoutingOutcome, RoutingPolicy
from v1.optimization.acceptance_gate import AcceptanceDecision, AcceptanceGate
from v1.optimization.canary import CanarySplitter
from v1.optimization.human_approval import HumanApproval, HumanApprovalRegistry
from v1.optimization.registry import PolicyVersion, PolicyVersionRegistry
from v1.optimization.rollback import RollbackEvent, RollbackManager

LOWER_IS_BETTER = frozenset({"hallucination_rate"})
BUCKET_SPACE = 0x100000000


class PolicyPromotionError(RuntimeError):
    pass


def _higher_is_better(metrics: Mapping[str, float]) -> Dict[str, float]:
    return {key: (1.0 - value if key in LOWER_IS_BETTER else value) for key, value in metrics.items()}


def _bucket(key: str) -> float:
    digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return int(digest[:8], 16) / BUCKET_SPACE


@dataclass
class _Candidate:
    policy: RoutingPolicy
    proposed_by: str
    decision: AcceptanceDecision | None = None
    dropped: bool = False


class RoutingPolicyManager:
    def __init__(
        self,
        baseline: RoutingPolicy,
        *,
        gate: AcceptanceGate | None = None,
        approvals: HumanApprovalRegistry | None = None,
        rollback: RollbackManager | None = None,
        versions: PolicyVersionRegistry | None = None,
        canary_ratio: float = 0.05,
    ) -> None:
        self._gate = gate or AcceptanceGate()
        self._approvals = approvals or HumanApprovalRegistry()
        self._rollback = rollback or RollbackManager()
        self._versions = versions or PolicyVersionRegistry()
        self._splitter = CanarySplitter(candidate_ratio=canary_ratio)
        self._candidates: Dict[str, _Candidate] = {}
        self._history: List[RoutingPolicy] = [baseline]
        self._canary: RoutingPolicy | None = None
        self._versions.register(
            PolicyVersion(policy_version=baseline.version, ruleset={"kind": "routing"}, parameters=baseline.to_dict(), created_by="baseline")
        )

    @property
    def active(self) -> RoutingPolicy:
        return self._history[-1]

    @property
    def canary(self) -> RoutingPolicy | None:
        return self._canary

    @property
    def history(self) -> List[RoutingPolicy]:
        return list(self._history)

    def propose(self, candidate: RoutingPolicy, *, proposed_by: str) -> None:
        if candidate.version in self._candidates or candidate.version == self.active.version:
            raise PolicyPromotionError(f"policy {candidate.version} already proposed")
        self._candidates[candidate.version] = _Candidate(policy=candidate, proposed_by=proposed_by)
        self._versions.register(
            PolicyVersion(
                policy_version=candidate.version,
                ruleset={"kind": "routing"},
                parameters=candidate.to_dict(),
                created_by=proposed_by,
            )
        )

    def evaluate(
        self,
        version: str,
        baseline_metrics: Mapping[str, float],
        candidate_metrics: Mapping[str, float],
        *,
        latency_p95_ms_baseline: float,
        latency_p95_ms_candidate: float,
        cost_per_1k_baseline: float,
        cost_per_1k_candidate: float,
    ) -> AcceptanceDecision:
        candidate = self._candidate(version)
        decision = self._gate.evaluate(
            version,
            dict(baseline_metrics),
            dict(candidate_metrics),
            latency_p95_ms_baseline=latency_p95_ms_baseline,
            latency_p95_ms_candidate=latency_p95_ms_candidate,
            cost_per_1k_baseline=cost_per_1k_baseline,
            cost_per_1k_candidate=cost_per_1k_candidate,
        )
        candidate.decision = decision
        return decision

    def submit_for_approval(self, version: str) -> HumanApproval:
        candidate = self._candidate(version)
        if candidate.decision is None or not candidate.decision.accepted:
            raise PolicyPromotionError(f"policy {version} has not passed the acceptance gate")
        return self._approvals.submit(version)

    def approve(self, version: str, *, decided_by: str, rationale: str = "") -> HumanApproval:
        self._candidate(version)
        return self._approvals.approve(version, decided_by=decided_by, rationale=rationale)

    def reject(self, version: str, *, decided_by: str, rationale: str = "") -> HumanApproval:
        self._candidate(version)
        return self._approvals.reject(version, decided_by=decided_by, rationale=rationale)

    def start_canary(self, version: str) -> RoutingPolicy:
        candidate = self._candidate(version)
        if candidate.dropped:
            raise PolicyPromotionError(f"policy {version} was rolled back")
        if candidate.decision is None or not candidate.decision.accepted:
            raise PolicyPromotionError(f"policy {version} has not passed the acceptance gate")
        if not self._approvals.is_approved(version):
            raise PolicyPromotionError(f"policy {version} lacks human approval")
        if self._canary is not None:
            raise PolicyPromotionError(f"canary {self._canary.version} is still running")
        self._canary = candidate.policy
        self._rollback.start_deployment(version)
        return candidate.policy

    def policy_for(self, key: str) -> RoutingPolicy:
        if self._canary is not None and _bucket(key) < self._splitter.candidate_ratio:
            return self._canary
        return self.active

    def promote(self, version: str) -> RoutingPolicy:
        if self._canary is None or self._canary.version != version:
            raise PolicyPromotionError(f"policy {version} has no running canary")
        promoted = self._canary
        self._history.append(promoted)
        self._canary = None
        self._rollback.clear(version)
        return promoted

    def observe(
        self,
        version: str,
        *,
        baseline_metrics: Mapping[str, float],
        current_metrics: Mapping[str, float],
    ) -> RollbackEvent | None:
        if self._canary is None or self._canary.version != version:
            return None
        event = self._rollback.detect_regression(
            candidate_id=version,
            baseline_metrics=_higher_is_better(baseline_metrics),
            current_metrics=_higher_is_better(current_metrics),
        )
        if event is None:
            return None
        self._candidates[version].dropped = True
        self._canary = None
        self._rollback.clear(version)
        return replace(event, restored_prompt_version=self.active.version)

    def rollback(self, *, reason: str) -> RoutingPolicy:
        if len(self._history) < 2:
            raise PolicyPromotionError("no previous routing policy to restore")
        self._history.pop()
        return self.active

    def _candidate(self, version: str) -> _Candidate:
        try:
            return self._candidates[version]
        except KeyError:
            raise PolicyPromotionError(f"policy {version} was never proposed") from None


class PolicyTuner:
    def __init__(
        self,
        *,
        min_samples: int = 30,
        step: float = 0.05,
        floor: float = 0.3,
        ceiling: float = 0.9,
        escalation_trigger: float = 0.2,
        near_threshold_band: float = 0.15,
        clean_flash_rate: float = 0.95,
    ) -> None:
        self.min_samples = min_samples
        self.step = step
        self.floor = floor
        self.ceiling = ceiling
        self.escalation_trigger = escalation_trigger
        self.near_threshold_band = near_threshold_band
        self.clean_flash_rate = clean_flash_rate

    def propose(
        self,
        base: RoutingPolicy,
        outcomes: Sequence[RoutingOutcome],
        *,
        version: str,
    ) -> RoutingPolicy | None:
        if len(outcomes) < self.min_samples:
            return None

        flash_first = [o for o in outcomes if o.first_mode == "flash"]
        threshold = base.escalate_above
        target = threshold

        if flash_first:
            failures = sum(1 for o in flash_first if o.escalated or not o.ok)
            if failures / len(flash_first) >= self.escalation_trigger:
                target = threshold - self.step
            else:
                near = [o for o in flash_first if o.complexity >= threshold - self.near_threshold_band]
                clean = sum(1 for o in near if o.ok and not o.escalated)
                if len(near) >= self.min_samples // 2 and clean / len(near) >= self.clean_flash_rate:
                    target = threshold + self.step

        target = round(max(self.floor, min(self.ceiling, target)), 4)
        if target == round(threshold, 4):
            return None
        return replace(base, version=version, escalate_above=target, task_modes=dict(base.task_modes))


__all__ = ["PolicyPromotionError", "RoutingPolicyManager", "PolicyTuner"]
