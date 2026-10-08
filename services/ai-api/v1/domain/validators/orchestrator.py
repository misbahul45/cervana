from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any, Dict, List, Optional

from v1.domain.exceptions import DomainValidationError
from v1.domain.validators.account import AccountValidator
from v1.domain.validators.amount import AmountValidator, JournalLine
from v1.domain.validators.direction import DirectionValidator
from v1.domain.validators.journal import JournalBalanceValidator
from v1.domain.validators.period import PeriodValidator
from v1.domain.validators.rule import RuleValidator


@dataclass
class JournalEntry:
    lines: List[JournalLine] = field(default_factory=list)
    period_id: Optional[str] = None
    rule_ids: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationResult:
    accepted: bool
    lines: List[JournalLine]
    total_debits: Decimal
    total_credits: Decimal
    period_id: Optional[str]
    metadata: Dict[str, Any] = field(default_factory=dict)
    errors: List[Dict[str, Any]] = field(default_factory=list)
    flags: List[Dict[str, Any]] = field(default_factory=list)


class JournalEntryValidator:
    def __init__(
        self,
        *,
        amount_validator: AmountValidator | None = None,
        account_validator: AccountValidator | None = None,
        direction_validator: DirectionValidator | None = None,
        balance_validator: JournalBalanceValidator | None = None,
        period_validator: PeriodValidator | None = None,
        rule_validator: RuleValidator | None = None,
    ) -> None:
        self.amount_validator = amount_validator or AmountValidator()
        self.account_validator = account_validator or AccountValidator()
        self.direction_validator = direction_validator or DirectionValidator(
            account_validator=self.account_validator,
            amount_validator=self.amount_validator,
        )
        self.balance_validator = balance_validator or JournalBalanceValidator()
        self.period_validator = period_validator or PeriodValidator()
        self.rule_validator = rule_validator or RuleValidator()

    def validate(self, entry: JournalEntry) -> ValidationResult:
        errors: List[Dict[str, Any]] = []
        flags: List[Dict[str, Any]] = []

        try:
            validated_lines = self.amount_validator.validate_lines(entry.lines)
        except DomainValidationError as exc:
            return ValidationResult(
                accepted=False,
                lines=[],
                total_debits=Decimal("0"),
                total_credits=Decimal("0"),
                period_id=entry.period_id,
                metadata=entry.metadata,
                errors=[{"code": exc.code, "message": exc.message, "details": exc.details}],
            )

        try:
            self.account_validator.validate_lines(validated_lines)
        except DomainValidationError as exc:
            errors.append({"code": exc.code, "message": exc.message, "details": exc.details})

        for line in validated_lines:
            try:
                self.account_validator.validate_code(line.account_code)
                self.amount_validator.validate(line.amount)
                _, matches_normal = self.direction_validator.validate_line(line)
                if not matches_normal:
                    account_type = self.account_validator.chart.get_type(line.account_code)
                    flags.append({
                        "code": "DIRECTION_OPPOSITE_NORMAL_BALANCE",
                        "message": (
                            "direction is opposite the account's normal balance; "
                            "this is valid (decrease/contra) but should be intentional"
                        ),
                        "details": {
                            "accountCode": line.account_code,
                            "accountType": account_type.value if account_type else None,
                            "direction": line.direction,
                        },
                    })
            except DomainValidationError as exc:
                errors.append({"code": exc.code, "message": exc.message, "details": exc.details})

        try:
            self.balance_validator.validate(validated_lines)
        except DomainValidationError as exc:
            errors.append({"code": exc.code, "message": exc.message, "details": exc.details})

        if entry.period_id is not None:
            try:
                self.period_validator.validate(entry.period_id)
            except DomainValidationError as exc:
                errors.append({"code": exc.code, "message": exc.message, "details": exc.details})

        if entry.rule_ids:
            try:
                self.rule_validator.apply_all(
                    entry.rule_ids,
                    {"lines": [l.__dict__ for l in validated_lines]},
                )
            except DomainValidationError as exc:
                errors.append({"code": exc.code, "message": exc.message, "details": exc.details})

        total_debits = sum(
            (l.amount for l in validated_lines if l.direction == "DEBIT"),
            Decimal("0"),
        )
        total_credits = sum(
            (l.amount for l in validated_lines if l.direction == "CREDIT"),
            Decimal("0"),
        )

        accepted = not errors
        return ValidationResult(
            accepted=accepted,
            lines=validated_lines,
            total_debits=total_debits,
            total_credits=total_credits,
            period_id=entry.period_id,
            metadata=entry.metadata,
            errors=errors,
            flags=flags,
        )


__all__ = ["JournalEntry", "ValidationResult", "JournalEntryValidator"]