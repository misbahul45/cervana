from __future__ import annotations

from decimal import Decimal

from v1.domain import balance_check, set_default_graph
from v1.domain import load_default_taxonomy


def setup_module():
    set_default_graph(load_default_taxonomy())


def test_balanced_journal_entry_accepted():
    payload = {
        "lines": [
            {"accountCode": "1200", "direction": "DEBIT", "amount": "5000000.00"},
            {"accountCode": "1010", "direction": "CREDIT", "amount": "5000000.00"},
        ]
    }
    result = balance_check(payload)
    assert result["accepted"] is True
    from decimal import Decimal

    assert Decimal(result["delta"]) == Decimal("0")
    assert result["errors"] == []


def test_unbalanced_journal_entry_rejected():
    payload = {
        "lines": [
            {"accountCode": "1010", "direction": "DEBIT", "amount": "1000.00"},
            {"accountCode": "4000", "direction": "CREDIT", "amount": "900.00"},
        ]
    }
    result = balance_check(payload)
    assert result["accepted"] is False
    assert result["delta"] != "0"


def test_validate_journal_entry_balanced():
    setup_module()
    from v1.domain import validate_journal_entry

    payload = {
        "lines": [
            {"accountCode": "1200", "direction": "DEBIT", "amount": "5000000.00"},
            {"accountCode": "1010", "direction": "CREDIT", "amount": "5000000.00"},
        ]
    }
    result = validate_journal_entry(payload)
    assert result.accepted is True
    assert result.total_debits == Decimal("5000000.00")
    assert result.total_credits == Decimal("5000000.00")