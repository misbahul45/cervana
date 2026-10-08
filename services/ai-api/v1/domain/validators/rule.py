from __future__ import annotations

from typing import Any, Callable, Dict, Iterable, List

from v1.domain.exceptions import RuleViolationError, UnknownRuleError
from v1.domain.rule import Rule


Predicate = Callable[[Dict[str, Any]], None]


class RuleValidator:
    def __init__(self, rules: Iterable[Rule] | None = None) -> None:
        self._rules: Dict[str, Rule] = {}
        for rule in rules or []:
            self._rules[rule.rule_id] = rule

    def register(self, rule: Rule) -> None:
        self._rules[rule.rule_id] = rule

    def apply(self, rule_id: str, context: Dict[str, Any]) -> None:
        rule = self._rules.get(rule_id)
        if rule is None:
            raise UnknownRuleError(
                "rule not registered",
                details={"ruleId": rule_id},
            )
        predicate = rule.predicate
        if predicate is None:
            return
        try:
            predicate(context)
        except RuleViolationError:
            raise
        except Exception as exc:
            raise RuleViolationError(
                "rule predicate raised",
                details={"ruleId": rule_id, "ruleCode": rule.code, "error": str(exc)},
            ) from exc

    def apply_all(self, rule_ids: Iterable[str], context: Dict[str, Any]) -> None:
        for rule_id in rule_ids:
            self.apply(rule_id, context)


__all__ = ["RuleValidator", "Predicate"]