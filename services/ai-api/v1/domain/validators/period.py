from __future__ import annotations

from typing import Iterable, List

from v1.domain.exceptions import ClosedPeriodError


class Period:
    __slots__ = ("period_id", "name", "is_open")

    def __init__(self, period_id: str, name: str, is_open: bool) -> None:
        self.period_id = period_id
        self.name = name
        self.is_open = is_open


class PeriodValidator:
    def __init__(self, periods: Iterable[Period] | None = None) -> None:
        self._periods: dict[str, Period] = {}
        for period in periods or []:
            self._periods[period.period_id] = period

    def register(self, period: Period) -> None:
        self._periods[period.period_id] = period

    def validate(self, period_id: str) -> Period:
        period = self._periods.get(period_id)
        if period is None:
            raise ClosedPeriodError(
                "period not registered",
                details={"periodId": period_id},
            )
        if not period.is_open:
            raise ClosedPeriodError(
                "period is closed",
                details={"periodId": period_id, "periodName": period.name},
            )
        return period


__all__ = ["PeriodValidator", "Period"]