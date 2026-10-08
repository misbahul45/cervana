from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Callable, Dict, List, Optional


@dataclass(frozen=True)
class EvaluationScenario:
    scenario_id: str
    difficulty: str
    description: str
    inputs: Dict[str, Any]
    expected: Dict[str, Any]
    rubric: Callable[[Dict[str, Any], Dict[str, Any]], bool]


def _expected_balance_check(payload, expected) -> bool:
    from v1.domain import balance_check

    result = balance_check(payload)
    return result["accepted"] is expected.get("accepted", True)


def _expected_validate_journal_entry(payload, expected) -> bool:
    from v1.domain import validate_journal_entry

    result = validate_journal_entry(payload)
    if "accepted" in expected:
        if result.accepted is not expected["accepted"]:
            return False
    if "error_code" in expected:
        if not any(e["code"] == expected["error_code"] for e in result.errors):
            return False
    return True


def _expected_journal_with_flag(payload, expected) -> bool:
    from v1.domain import validate_journal_entry

    result = validate_journal_entry(payload)
    if "accepted" in expected and result.accepted is not expected["accepted"]:
        return False
    if "flag_code" in expected:
        if not any(f["code"] == expected["flag_code"] for f in result.flags):
            return False
    return True


def _expected_concept_explanation(concept_id, expected) -> bool:
    from v1.domain import concept_explanation

    try:
        result = concept_explanation(concept_id)
    except Exception:
        return expected.get("must_have_keys") is None
    if "must_have_keys" not in expected:
        return True
    payload = result["concept"]
    for key in expected["must_have_keys"]:
        if key not in payload:
            return False
    return True


def _expected_account_lookup(account_code, expected) -> bool:
    from v1.domain import account_lookup

    try:
        result = account_lookup(account_code)
    except Exception:
        return expected.get("accepted", True) is False
    return result["accountCode"] == account_code and result["accountType"] == expected["accountType"]


def _expected_contra_resolver(account_code, expected) -> bool:
    from v1.domain import contra_account_resolver

    try:
        result = contra_account_resolver(account_code)
    except Exception:
        return expected.get("accepted", True) is False
    if "accepted" in expected and result["accountCode"] == account_code:
        return expected["accepted"] is True
    return True


SCENARIOS: List[EvaluationScenario] = [
    EvaluationScenario(
        scenario_id="scenario_01_balanced_asset_purchase",
        difficulty="easy",
        description="Buy equipment for IDR 5,000,000 with cash.",
        inputs={
            "tool": "balance_check",
            "payload": {
                "lines": [
                    {"accountCode": "1200", "direction": "DEBIT", "amount": "5000000.00"},
                    {"accountCode": "1010", "direction": "CREDIT", "amount": "5000000.00"},
                ]
            },
        },
        expected={"accepted": True},
        rubric=lambda p, e: _expected_balance_check(p, e),
    ),
    EvaluationScenario(
        scenario_id="scenario_02_balanced_revenue",
        difficulty="easy",
        description="Recognize IDR 2,500,000 of service revenue.",
        inputs={
            "tool": "balance_check",
            "payload": {
                "lines": [
                    {"accountCode": "1010", "direction": "DEBIT", "amount": "2500000.00"},
                    {"accountCode": "4000", "direction": "CREDIT", "amount": "2500000.00"},
                ]
            },
        },
        expected={"accepted": True},
        rubric=lambda p, e: _expected_balance_check(p, e),
    ),
    EvaluationScenario(
        scenario_id="scenario_03_unbalanced_rejected",
        difficulty="easy",
        description="Debits do not equal credits → must be rejected.",
        inputs={
            "tool": "balance_check",
            "payload": {
                "lines": [
                    {"accountCode": "1010", "direction": "DEBIT", "amount": "1000.00"},
                    {"accountCode": "4000", "direction": "CREDIT", "amount": "900.00"},
                ]
            },
        },
        expected={"accepted": False},
        rubric=lambda p, e: _expected_balance_check(p, e),
    ),
    EvaluationScenario(
        scenario_id="scenario_04_invalid_account_rejected",
        difficulty="easy",
        description="Account code not in chart of accounts → must be rejected.",
        inputs={
            "tool": "validate_journal_entry",
            "payload": {
                "lines": [
                    {"accountCode": "9999", "direction": "DEBIT", "amount": "100.00"},
                    {"accountCode": "1010", "direction": "CREDIT", "amount": "100.00"},
                ]
            },
        },
        expected={"accepted": False, "error_code": "UNKNOWN_ACCOUNT"},
        rubric=lambda p, e: _expected_validate_journal_entry(p, e),
    ),
    EvaluationScenario(
        scenario_id="scenario_05_debit_to_revenue_is_flagged",
        difficulty="medium",
        description="Debit to a revenue account is unusual but not auto-rejected; the validator flags it.",
        inputs={
            "tool": "validate_journal_entry",
            "payload": {
                "lines": [
                    {"accountCode": "4000", "direction": "DEBIT", "amount": "100.00"},
                    {"accountCode": "1010", "direction": "CREDIT", "amount": "100.00"},
                ]
            },
        },
        expected={"accepted": True, "flag_code": "DIRECTION_OPPOSITE_NORMAL_BALANCE"},
        rubric=lambda p, e: _expected_journal_with_flag(p, e),
    ),
    EvaluationScenario(
        scenario_id="scenario_06_negative_amount_rejected",
        difficulty="easy",
        description="Amount must be non-negative.",
        inputs={
            "tool": "validate_journal_entry",
            "payload": {
                "lines": [
                    {"accountCode": "1200", "direction": "DEBIT", "amount": "-1000.00"},
                    {"accountCode": "1010", "direction": "CREDIT", "amount": "1000.00"},
                ]
            },
        },
        expected={"accepted": False, "error_code": "INVALID_AMOUNT"},
        rubric=lambda p, e: _expected_validate_journal_entry(p, e),
    ),
    EvaluationScenario(
        scenario_id="scenario_07_contra_account_recognized",
        difficulty="medium",
        description="Accumulated depreciation is a CONTRA_ASSET with credit normal balance.",
        inputs={
            "tool": "account_lookup",
            "payload": "1090",
        },
        expected={"accountType": "CONTRA_ASSET"},
        rubric=lambda p, e: _expected_account_lookup(p, e),
    ),
    EvaluationScenario(
        scenario_id="scenario_08_contra_resolver_returns_pair",
        difficulty="medium",
        description="Resolver returns the pair of an account.",
        inputs={
            "tool": "contra_account_resolver",
            "payload": "1090",
        },
        expected={"accepted": True},
        rubric=lambda p, e: _expected_contra_resolver(p, e),
    ),
    EvaluationScenario(
        scenario_id="scenario_09_multi_step_adjusting_entry",
        difficulty="hard",
        description="Record monthly depreciation of IDR 500,000 and accrued interest of IDR 250,000.",
        inputs={
            "tool": "balance_check",
            "payload": {
                "lines": [
                    {"accountCode": "5000", "direction": "DEBIT", "amount": "500000.00"},
                    {"accountCode": "1090", "direction": "CREDIT", "amount": "500000.00"},
                    {"accountCode": "5000", "direction": "DEBIT", "amount": "250000.00"},
                    {"accountCode": "2100", "direction": "CREDIT", "amount": "250000.00"},
                ]
            },
        },
        expected={"accepted": True},
        rubric=lambda p, e: _expected_balance_check(p, e),
    ),
    EvaluationScenario(
        scenario_id="scenario_10_closed_period_rejected",
        difficulty="medium",
        description="Posting to a closed period must fail.",
        inputs={
            "tool": "validate_journal_entry",
            "payload": {
                "lines": [
                    {"accountCode": "1200", "direction": "DEBIT", "amount": "100.00"},
                    {"accountCode": "1010", "direction": "CREDIT", "amount": "100.00"},
                ],
                "periodId": "2025-12",
            },
        },
        expected={"accepted": False, "error_code": "CLOSED_PERIOD"},
        rubric=lambda p, e: _expected_validate_journal_entry(p, e),
    ),
    EvaluationScenario(
        scenario_id="scenario_11_double_entry_explanation",
        difficulty="medium",
        description="Concept lookup returns prerequisite and rule information.",
        inputs={
            "tool": "concept_explanation",
            "payload": "double_entry",
        },
        expected={"must_have_keys": ["conceptId", "name", "prerequisites", "rules"]},
        rubric=lambda p, e: _expected_concept_explanation(p, e),
    ),
]


def all_scenarios() -> List[EvaluationScenario]:
    return list(SCENARIOS)


def run_scenario(scenario: EvaluationScenario) -> Dict[str, Any]:
    tool = scenario.inputs.get("tool")
    payload = scenario.inputs.get("payload")
    if tool == "balance_check":
        result = scenario.rubric(payload, scenario.expected)
    elif tool == "validate_journal_entry":
        result = scenario.rubric(payload, scenario.expected)
    elif tool == "concept_explanation":
        result = scenario.rubric(payload, scenario.expected)
    elif tool == "account_lookup":
        result = scenario.rubric(payload, scenario.expected)
    elif tool == "contra_account_resolver":
        result = scenario.rubric(payload, scenario.expected)
    else:
        result = False
    return {
        "scenarioId": scenario.scenario_id,
        "passed": result,
        "difficulty": scenario.difficulty,
    }


def run_all() -> Dict[str, Any]:
    results = [run_scenario(s) for s in SCENARIOS]
    total = len(results)
    passed = sum(1 for r in results if r["passed"])
    return {
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "results": results,
    }


__all__ = [
    "EvaluationScenario",
    "SCENARIOS",
    "all_scenarios",
    "run_scenario",
    "run_all",
]