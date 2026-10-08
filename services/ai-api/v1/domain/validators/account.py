from __future__ import annotations

from typing import Iterable, List

from v1.domain.exceptions import UnknownAccountError
from v1.domain.validators.account_type import (
    AccountType,
    ChartOfAccounts,
    default_chart_of_accounts,
)
from v1.domain.validators.amount import JournalLine


class AccountValidator:
    def __init__(self, chart: ChartOfAccounts | None = None) -> None:
        self.chart = chart or default_chart_of_accounts()

    def validate_code(self, account_code: str) -> AccountType:
        if not self.chart.has_account(account_code):
            raise UnknownAccountError(
                "account not in chart of accounts",
                details={"accountCode": account_code},
            )
        account_type = self.chart.get_type(account_code)
        assert account_type is not None
        return account_type

    def validate_lines(self, lines: Iterable[JournalLine]) -> List[JournalLine]:
        validated: List[JournalLine] = []
        for line in lines:
            try:
                self.validate_code(line.account_code)
                validated.append(line)
            except UnknownAccountError:
                raise
        return validated


__all__ = ["AccountValidator"]