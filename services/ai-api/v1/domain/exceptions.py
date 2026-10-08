from __future__ import annotations

from errors.types import AIServiceError


class DomainError(AIServiceError):
    code = "DOMAIN_ERROR"
    http_status = 422


class DomainValidationError(DomainError):
    code = "DOMAIN_VALIDATION_ERROR"
    http_status = 422


class UnknownConceptError(DomainError):
    code = "UNKNOWN_CONCEPT"
    http_status = 422


class UnknownAccountError(DomainValidationError):
    code = "UNKNOWN_ACCOUNT"
    http_status = 422


class UnknownRuleError(DomainValidationError):
    code = "UNKNOWN_RULE"
    http_status = 422


class ClosedPeriodError(DomainValidationError):
    code = "CLOSED_PERIOD"
    http_status = 422


class UnbalancedJournalError(DomainValidationError):
    code = "UNBALANCED_JOURNAL"
    http_status = 422


class InvalidDirectionError(DomainValidationError):
    code = "INVALID_DIRECTION"
    http_status = 422


class InvalidAmountError(DomainValidationError):
    code = "INVALID_AMOUNT"
    http_status = 422


class RuleViolationError(DomainValidationError):
    code = "RULE_VIOLATION"
    http_status = 422


__all__ = [
    "DomainError",
    "DomainValidationError",
    "UnknownConceptError",
    "UnknownAccountError",
    "UnknownRuleError",
    "ClosedPeriodError",
    "UnbalancedJournalError",
    "InvalidDirectionError",
    "InvalidAmountError",
    "RuleViolationError",
]