from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List


class ProtectedCategory(str, Enum):
    AUTHORIZATION = "AUTHORIZATION"
    FINANCIAL_RULES = "FINANCIAL_RULES"
    ACCOUNTING_ENGINE = "ACCOUNTING_ENGINE"
    EVALUATION_BENCHMARK = "EVALUATION_BENCHMARK"
    SECURITY_GUARDS = "SECURITY_GUARDS"
    MEMORY_ISOLATION = "MEMORY_ISOLATION"
    TENANT_ISOLATION = "TENANT_ISOLATION"
    SYSTEM_POLICY = "SYSTEM_POLICY"
    EDUCATIONAL_SAFETY_POLICY = "EDUCATIONAL_SAFETY_POLICY"


PROTECTED_CATEGORIES: List[ProtectedCategory] = list(ProtectedCategory)


@dataclass(frozen=True)
class SafetyBoundaryViolation:
    category: ProtectedCategory
    attempted_change: str
    detected_at_attempted_change: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "category": self.category.value,
            "attemptedChange": self.attempted_change,
            "detectedAtAttemptedChange": self.detected_at_attempted_change,
        }


class SafetyBoundaryGuard:
    """Master prompt §80.

    The optimizer MUST NOT alter any of these 9 categories.
    """

    FORBIDDEN_PATTERNS = {
        ProtectedCategory.AUTHORIZATION: (
            "@Roles",
            "@RequireOwnership",
            "@ScopeToUser",
            "@TenantScoped",
            "RolesGuard",
            "AuthGuard",
        ),
        ProtectedCategory.FINANCIAL_RULES: (
            "computeMoney",
            "validate_journal_entry",
            "money.ts",
            "wallet.service",
            "payout.service",
        ),
        ProtectedCategory.ACCOUNTING_ENGINE: (
            "AccountingEngineService",
            "JournalBalanceValidator",
            "DomainValidator",
        ),
        ProtectedCategory.EVALUATION_BENCHMARK: (
            "BENCHMARK_SCENARIOS",
            "BenchmarkRunner",
            "BENCHMARK_VERSION",
        ),
        ProtectedCategory.SECURITY_GUARDS: (
            "InternalServiceGuard",
            "looks_like_instruction",
            "contains_pii",
        ),
        ProtectedCategory.MEMORY_ISOLATION: (
            "tool_semantic_search",
            "_semantic_search",
            "lessonId=",
            "learner_id=",
            "learnerId",
        ),
        ProtectedCategory.TENANT_ISOLATION: (
            "tenant_id",
            "tenantId=",
            "acting_user_id",
        ),
        ProtectedCategory.SYSTEM_POLICY: (
            "render_system_policy",
            "system_policy=",
        ),
        ProtectedCategory.EDUCATIONAL_SAFETY_POLICY: (
            "render_educational_policy",
            "educational_policy=",
        ),
    }

    def check(self, proposed_change: str) -> List[SafetyBoundaryViolation]:
        violations: List[SafetyBoundaryViolation] = []
        for category, forbidden in self.FORBIDDEN_PATTERNS.items():
            for marker in forbidden:
                if marker in proposed_change:
                    violations.append(
                        SafetyBoundaryViolation(
                            category=category,
                            attempted_change=proposed_change,
                            detected_at_attempted_change=marker,
                        )
                    )
                    break
        return violations

    def assert_safe(self, proposed_change: str) -> None:
        violations = self.check(proposed_change)
        if violations:
            raise SafetyViolation(
                "optimizer attempted to alter a protected category "
                f"({[v.category.value for v in violations]})"
            )


class SafetyViolation(RuntimeError):
    pass


__all__ = [
    "ProtectedCategory",
    "PROTECTED_CATEGORIES",
    "SafetyBoundaryViolation",
    "SafetyBoundaryGuard",
    "SafetyViolation",
]