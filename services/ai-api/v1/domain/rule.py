from __future__ import annotations

from typing import Any, Dict, List, Optional


class Rule:
    __slots__ = ("rule_id", "code", "description", "applies_to", "predicate")

    def __init__(
        self,
        rule_id: str,
        code: str,
        description: str,
        applies_to: Optional[List[str]] = None,
        predicate: Optional[Any] = None,
    ) -> None:
        self.rule_id = rule_id
        self.code = code
        self.description = description
        self.applies_to = list(applies_to or [])
        self.predicate = predicate

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ruleId": self.rule_id,
            "code": self.code,
            "description": self.description,
            "appliesTo": list(self.applies_to),
        }


__all__ = ["Rule"]