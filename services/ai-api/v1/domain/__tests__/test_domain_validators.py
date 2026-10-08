from __future__ import annotations

import pytest

from v1.domain import set_default_graph
from v1.domain import load_default_taxonomy
from v1.domain.exceptions import (
    ClosedPeriodError,
    InvalidAmountError,
    InvalidDirectionError,
    UnknownAccountError,
    UnknownRuleError,
)
from v1.domain.validators import JournalEntryValidator, JournalLine


def setup_module():
    set_default_graph(load_default_taxonomy())


def test_invalid_account_rejected():
    setup_module()
    validator = JournalEntryValidator()
    entry = validator.validate.__self_class__(
        lines=[
            JournalLine(account_code="9999", direction="DEBIT", amount=Decimal("100.00")),
            JournalLine(account_code="1010", direction="CREDIT", amount=Decimal("100.00")),
        ]
    ) if False else None
    payload = {
        "lines": [
            {"accountCode": "9999", "direction": "DEBIT", "amount": "100.00"},
            {"accountCode": "1010", "direction": "CREDIT", "amount": "100.00"},
        ]
    }
    from v1.domain import validate_journal_entry

    result = validate_journal_entry(payload)
    assert result.accepted is False
    assert any(e["code"] == "UNKNOWN_ACCOUNT" for e in result.errors)


def test_direction_opposite_normal_balance_is_flagged_not_rejected():
    setup_module()
    payload = {
        "lines": [
            {"accountCode": "4000", "direction": "DEBIT", "amount": "100.00"},
            {"accountCode": "1010", "direction": "CREDIT", "amount": "100.00"},
        ]
    }
    from v1.domain import validate_journal_entry

    result = validate_journal_entry(payload)
    assert result.accepted is True
    assert any(f["code"] == "DIRECTION_OPPOSITE_NORMAL_BALANCE" for f in result.flags)


def test_negative_amount_rejected():
    setup_module()
    payload = {
        "lines": [
            {"accountCode": "1200", "direction": "DEBIT", "amount": "-1000.00"},
            {"accountCode": "1010", "direction": "CREDIT", "amount": "1000.00"},
        ]
    }
    from v1.domain import validate_journal_entry

    result = validate_journal_entry(payload)
    assert result.accepted is False
    assert any(e["code"] == "INVALID_AMOUNT" for e in result.errors)


def test_closed_period_rejected():
    setup_module()
    payload = {
        "lines": [
            {"accountCode": "1200", "direction": "DEBIT", "amount": "100.00"},
            {"accountCode": "1010", "direction": "CREDIT", "amount": "100.00"},
        ],
        "periodId": "2025-12",
    }
    from v1.domain import validate_journal_entry

    result = validate_journal_entry(payload)
    assert result.accepted is False
    assert any(e["code"] == "CLOSED_PERIOD" for e in result.errors)


def test_open_period_accepted():
    setup_module()
    payload = {
        "lines": [
            {"accountCode": "1200", "direction": "DEBIT", "amount": "100.00"},
            {"accountCode": "1010", "direction": "CREDIT", "amount": "100.00"},
        ],
        "periodId": "2026-Q1",
    }
    from v1.domain import validate_journal_entry

    result = validate_journal_entry(payload)
    assert result.accepted is True