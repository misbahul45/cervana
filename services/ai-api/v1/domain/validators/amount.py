from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Iterable, List

from v1.domain.exceptions import InvalidAmountError


@dataclass(frozen=True)
class JournalLine:
    account_code: str
    direction: str
    amount: Decimal

    def __post_init__(self) -> None:
        if self.direction not in ("DEBIT", "CREDIT"):
            raise ValueError(f"direction must be DEBIT or CREDIT, got {self.direction}")
        if not isinstance(self.amount, Decimal):
            object.__setattr__(self, "amount", Decimal(str(self.amount)))


def _validate_amount(amount: Decimal) -> Decimal:
    if not isinstance(amount, Decimal):
        try:
            amount = Decimal(str(amount))
        except (InvalidOperation, ValueError) as exc:
            raise InvalidAmountError(
                "amount is not a valid decimal",
                details={"amount": str(amount)},
            ) from exc
    if amount.is_nan():
        raise InvalidAmountError("amount is NaN")
    if amount.is_infinite():
        raise InvalidAmountError("amount is infinite")
    if amount < Decimal("0"):
        raise InvalidAmountError(
            "amount must be non-negative",
            details={"amount": str(amount)},
        )
    quantized = amount.quantize(Decimal("0.01"))
    if quantized != amount:
        raise InvalidAmountError(
            "amount has more than two decimal places",
            details={"amount": str(amount), "quantized": str(quantized)},
        )
    return quantized


class AmountValidator:
    def __init__(self, *, scale: Decimal = Decimal("0.01")) -> None:
        self.scale = scale

    def validate(self, amount: Decimal) -> Decimal:
        if not isinstance(amount, Decimal):
            amount = Decimal(str(amount))
        if amount.is_nan():
            raise InvalidAmountError("amount is NaN")
        if amount.is_infinite():
            raise InvalidAmountError("amount is infinite")
        if amount < Decimal("0"):
            raise InvalidAmountError(
                "amount must be non-negative",
                details={"amount": str(amount)},
            )
        quantized = amount.quantize(self.scale)
        if quantized != amount:
            raise InvalidAmountError(
                "amount has more than two decimal places",
                details={"amount": str(amount), "quantized": str(quantized)},
            )
        return quantized

    def validate_lines(self, lines: Iterable[JournalLine]) -> List[JournalLine]:
        return [JournalLine(line.account_code, line.direction, self.validate(line.amount)) for line in lines]


__all__ = ["AmountValidator", "JournalLine", "_validate_amount"]