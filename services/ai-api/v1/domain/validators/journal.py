from __future__ import annotations

from decimal import Decimal
from typing import Iterable, List

from v1.domain.exceptions import UnbalancedJournalError
from v1.domain.validators.amount import JournalLine


class JournalBalanceValidator:
    def __init__(self, *, scale: Decimal = Decimal("0.01")) -> None:
        self.scale = scale

    def validate(self, lines: Iterable[JournalLine]) -> List[JournalLine]:
        materialized = list(lines)
        total_debits = sum(
            (line.amount for line in materialized if line.direction == "DEBIT"),
            Decimal("0"),
        )
        total_credits = sum(
            (line.amount for line in materialized if line.direction == "CREDIT"),
            Decimal("0"),
        )
        if total_debits.quantize(self.scale) != total_credits.quantize(self.scale):
            raise UnbalancedJournalError(
                "debits do not equal credits",
                details={
                    "totalDebits": str(total_debits),
                    "totalCredits": str(total_credits),
                    "delta": str(total_debits - total_credits),
                },
            )
        if total_debits == Decimal("0") and len(materialized) > 0:
            raise UnbalancedJournalError(
                "zero-amount journal is not a journal entry",
                details={"totalDebits": "0", "totalCredits": "0"},
            )
        return materialized


__all__ = ["JournalBalanceValidator"]