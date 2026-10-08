from __future__ import annotations

from decimal import Decimal
from typing import Iterable, List, Tuple

from v1.domain.validators.account import AccountValidator
from v1.domain.validators.account_type import AccountType
from v1.domain.validators.amount import AmountValidator, JournalLine


class DirectionValidator:
    def __init__(
        self,
        account_validator: AccountValidator | None = None,
        amount_validator: AmountValidator | None = None,
    ) -> None:
        self.account_validator = account_validator or AccountValidator()
        self.amount_validator = amount_validator or AmountValidator()

    def validate_line(self, line: JournalLine) -> Tuple[JournalLine, bool]:
        account_type = self.account_validator.validate_code(line.account_code)
        self.amount_validator.validate(line.amount)
        normal = self.account_validator.chart.normal_balance(account_type)
        matches_normal = normal == line.direction
        return line, matches_normal

    def validate_lines(self, lines: Iterable[JournalLine]) -> List[JournalLine]:
        return [self.validate_line(line)[0] for line in lines]

    def is_debit_increase(self, account_type: AccountType, direction: str) -> bool:
        normal = self.account_validator.chart.normal_balance(account_type)
        return direction == normal


__all__ = ["DirectionValidator"]