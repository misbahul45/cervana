from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional

from v1.domain.exceptions import (
    DomainValidationError,
    UnknownAccountError,
    UnknownConceptError,
)
from v1.domain.graph import ConceptGraph
from v1.domain.validators.orchestrator import (
    JournalEntry,
    JournalEntryValidator,
    ValidationResult,
)
from v1.domain.validators.amount import JournalLine


_default_graph: ConceptGraph | None = None
_default_validator: JournalEntryValidator | None = None


def set_default_graph(graph: ConceptGraph) -> None:
    global _default_graph, _default_validator
    _default_graph = graph
    from v1.domain.validators.period import Period

    validator = JournalEntryValidator()
    if "2026-Q1" not in validator.period_validator._periods:
        validator.period_validator.register(Period(period_id="2026-Q1", name="Q1 2026", is_open=True))
    if "2025-12" not in validator.period_validator._periods:
        validator.period_validator.register(Period(period_id="2025-12", name="December 2025", is_open=False))
    _default_validator = validator


def get_default_graph() -> ConceptGraph:
    if _default_graph is None:
        from v1.domain.data.default_taxonomy import load_default_taxonomy

        set_default_graph(load_default_taxonomy())
    assert _default_graph is not None
    return _default_graph


def get_default_validator() -> JournalEntryValidator:
    if _default_validator is None:
        set_default_graph(get_default_graph())
    assert _default_validator is not None
    return _default_validator


def _lines_from_payload(payload: Dict[str, Any]) -> List[JournalLine]:
    lines: List[JournalLine] = []
    for raw in payload.get("lines", []):
        account_code = raw["accountCode"]
        direction = raw["direction"]
        amount_value = raw["amount"]
        amount = amount_value if isinstance(amount_value, Decimal) else Decimal(str(amount_value))
        lines.append(JournalLine(account_code=account_code, direction=direction, amount=amount))
    return lines


def validate_journal_entry(payload: Dict[str, Any]) -> ValidationResult:
    entry = JournalEntry(
        lines=_lines_from_payload(payload),
        period_id=payload.get("periodId"),
        rule_ids=list(payload.get("ruleIds", [])),
        metadata=dict(payload.get("metadata", {})),
    )
    validator = get_default_validator()
    try:
        return validator.validate(entry)
    except DomainValidationError as exc:
        from v1.domain.validators.amount import JournalLine
        from decimal import Decimal

        return ValidationResult(
            accepted=False,
            lines=[JournalLine(line.account_code, line.direction, Decimal(str(line.amount))) for line in entry.lines],
            total_debits=Decimal("0"),
            total_credits=Decimal("0"),
            period_id=entry.period_id,
            metadata=entry.metadata,
            errors=[{"code": exc.code, "message": exc.message, "details": exc.details}],
        )


def balance_check(payload: Dict[str, Any]) -> Dict[str, Any]:
    result = validate_journal_entry(payload)
    return {
        "accepted": result.accepted,
        "totalDebits": str(result.total_debits),
        "totalCredits": str(result.total_credits),
        "delta": str(result.total_debits - result.total_credits),
        "errors": result.errors,
    }


def account_lookup(account_code: str) -> Dict[str, Any]:
    chart = get_default_validator().account_validator.chart
    account_type = chart.get_type(account_code)
    if account_type is None:
        raise UnknownAccountError(
            "account not found",
            details={"accountCode": account_code},
        )
    return {
        "accountCode": account_code,
        "accountType": account_type.value,
        "normalBalance": chart.normal_balance(account_type),
        "isContra": chart.is_contra(account_type),
        "counterpartAccountType": chart.counterpart(account_type).value,
    }


def rule_lookup(rule_id: str) -> Dict[str, Any]:
    graph = get_default_graph()
    rules = graph.all_rules()
    for rule in rules:
        if rule.rule_id == rule_id:
            return rule.to_dict()
    from v1.domain.exceptions import UnknownRuleError

    raise UnknownRuleError(
        "rule not found",
        details={"ruleId": rule_id},
    )


def contra_account_resolver(account_code: str) -> Dict[str, Any]:
    chart = get_default_validator().account_validator.chart
    account_type = chart.get_type(account_code)
    if account_type is None:
        raise UnknownAccountError(
            "account not found",
            details={"accountCode": account_code},
        )
    base = chart.counterpart(account_type)
    return {
        "accountCode": account_code,
        "accountType": account_type.value,
        "isContra": chart.is_contra(account_type),
        "counterpartAccountType": base.value,
        "note": (
            "this account is already a contra account; its counterpart is the normal-balance sibling"
            if chart.is_contra(account_type)
            else "this account is a normal-balance account; its contra reduces it"
        ),
    }


def concept_explanation(concept_id: str) -> Dict[str, Any]:
    graph = get_default_graph()
    if not graph.has_concept(concept_id):
        raise UnknownConceptError(
            "concept not found",
            details={"conceptId": concept_id},
        )
    concept = graph.get_concept(concept_id)
    return {
        "concept": concept.to_dict(),
        "prerequisites": [c.to_dict() for c in graph.prerequisites_for(concept_id)],
        "misconceptions": [m.to_dict() for m in graph.misconceptions_for_concept(concept_id)],
        "rules": [r.to_dict() for r in graph.rules_for_concept(concept_id)],
    }


def prerequisite_chain(from_concept_id: str, to_concept_id: str) -> List[str]:
    graph = get_default_graph()
    return graph.explain_path(from_concept_id, to_concept_id)


__all__ = [
    "set_default_graph",
    "get_default_graph",
    "get_default_validator",
    "validate_journal_entry",
    "balance_check",
    "account_lookup",
    "rule_lookup",
    "contra_account_resolver",
    "concept_explanation",
    "prerequisite_chain",
]