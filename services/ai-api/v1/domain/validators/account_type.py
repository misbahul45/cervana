from __future__ import annotations

from enum import Enum
from typing import Dict, Optional


class AccountType(str, Enum):
    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    EQUITY = "EQUITY"
    REVENUE = "REVENUE"
    EXPENSE = "EXPENSE"
    CONTRA_ASSET = "CONTRA_ASSET"
    CONTRA_LIABILITY = "CONTRA_LIABILITY"
    CONTRA_EQUITY = "CONTRA_EQUITY"
    CONTRA_REVENUE = "CONTRA_REVENUE"
    CONTRA_EXPENSE = "CONTRA_EXPENSE"


_NORMAL_BALANCE_DEBIT = frozenset(
    {AccountType.ASSET, AccountType.EXPENSE, AccountType.CONTRA_LIABILITY, AccountType.CONTRA_EQUITY}
)
_NORMAL_BALANCE_CREDIT = frozenset(
    {AccountType.LIABILITY, AccountType.EQUITY, AccountType.REVENUE, AccountType.CONTRA_ASSET, AccountType.CONTRA_EXPENSE, AccountType.CONTRA_REVENUE}
)


class ChartOfAccounts:
    def __init__(self) -> None:
        self._accounts: Dict[str, AccountType] = {}

    def register(self, account_code: str, account_type: AccountType) -> None:
        if not account_code:
            raise ValueError("account_code is required")
        self._accounts[account_code] = account_type

    def get_type(self, account_code: str) -> Optional[AccountType]:
        return self._accounts.get(account_code)

    def has_account(self, account_code: str) -> bool:
        return account_code in self._accounts

    def all_accounts(self) -> Dict[str, AccountType]:
        return dict(self._accounts)

    def normal_balance(self, account_type: AccountType) -> str:
        if account_type in _NORMAL_BALANCE_DEBIT:
            return "DEBIT"
        if account_type in _NORMAL_BALANCE_CREDIT:
            return "CREDIT"
        raise ValueError(f"unknown account type: {account_type}")

    def is_contra(self, account_type: AccountType) -> bool:
        return account_type.name.startswith("CONTRA_")

    def counterpart(self, account_type: AccountType) -> AccountType:
        name = account_type.name
        if name.startswith("CONTRA_"):
            base = name[len("CONTRA_"):]
            return AccountType[base]
        return AccountType[f"CONTRA_{name}"]


_DEFAULT_CHART: ChartOfAccounts | None = None


def default_chart_of_accounts() -> ChartOfAccounts:
    global _DEFAULT_CHART
    if _DEFAULT_CHART is not None:
        return _DEFAULT_CHART
    chart = ChartOfAccounts()
    chart.register("1000", AccountType.ASSET)
    chart.register("1010", AccountType.ASSET)
    chart.register("1100", AccountType.ASSET)
    chart.register("1200", AccountType.ASSET)
    chart.register("1090", AccountType.CONTRA_ASSET)
    chart.register("2000", AccountType.LIABILITY)
    chart.register("2100", AccountType.LIABILITY)
    chart.register("3000", AccountType.EQUITY)
    chart.register("3100", AccountType.EQUITY)
    chart.register("4000", AccountType.REVENUE)
    chart.register("4100", AccountType.REVENUE)
    chart.register("4900", AccountType.CONTRA_REVENUE)
    chart.register("5000", AccountType.EXPENSE)
    chart.register("5100", AccountType.EXPENSE)
    chart.register("5900", AccountType.CONTRA_EXPENSE)
    _DEFAULT_CHART = chart
    return chart


__all__ = ["ChartOfAccounts", "AccountType", "default_chart_of_accounts"]