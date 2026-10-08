from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional


class PermissionClass(str, Enum):
    READ = "READ"
    WRITE = "WRITE"
    EXTERNAL_ACTION = "EXTERNAL_ACTION"
    FINANCIAL = "FINANCIAL"


class SideEffect(str, Enum):
    NONE = "NONE"
    READS_MEMORY = "READS_MEMORY"
    WRITES_MEMORY = "WRITES_MEMORY"
    READS_EXTERNAL = "READS_EXTERNAL"
    WRITES_API = "WRITES_API"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


@dataclass
class ToolMetadata:
    tool_id: str
    name: str
    description: str
    permission_class: PermissionClass
    input_schema: Dict[str, Any]
    output_schema: Dict[str, Any]
    side_effects: List[SideEffect]
    required_scopes: List[str] = field(default_factory=list)
    timeout_seconds: float = 10.0
    cost_estimate: float = 0.0
    risk_level: RiskLevel = RiskLevel.LOW
    enabled: bool = True

    def to_dict(self) -> Dict[str, Any]:
        return {
            "toolId": self.tool_id,
            "name": self.name,
            "description": self.description,
            "permissionClass": self.permission_class.value,
            "inputSchema": dict(self.input_schema),
            "outputSchema": dict(self.output_schema),
            "sideEffects": [s.value for s in self.side_effects],
            "requiredScopes": list(self.required_scopes),
            "timeoutSeconds": self.timeout_seconds,
            "costEstimate": self.cost_estimate,
            "riskLevel": self.risk_level.value,
            "enabled": self.enabled,
        }


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: Dict[str, ToolMetadata] = {}

    def register(self, tool: ToolMetadata) -> None:
        if not tool.tool_id:
            raise ValueError("tool.tool_id is required")
        self._tools[tool.tool_id] = tool

    def get(self, tool_id: str) -> ToolMetadata:
        return self._tools[tool_id]

    def all_enabled(self) -> List[ToolMetadata]:
        return [t for t in self._tools.values() if t.enabled]

    def all(self) -> List[ToolMetadata]:
        return list(self._tools.values())


def default_registry() -> ToolRegistry:
    from v1.domain.tools import (
            account_lookup,
            balance_check,
            concept_explanation,
            contra_account_resolver,
            prerequisite_chain,
            rule_lookup,
            validate_journal_entry,
        )

    registry = ToolRegistry()
    registry.register(
        ToolMetadata(
            tool_id="validate_journal_entry",
            name=validate_journal_entry.__name__,
            description="Validate a journal entry against double-entry, account, amount, period, and rule invariants.",
            permission_class=PermissionClass.READ,
            input_schema={"type": "object", "required": ["lines"]},
            output_schema={"type": "object"},
            side_effects=[SideEffect.NONE],
            risk_level=RiskLevel.LOW,
        )
    )
    registry.register(
        ToolMetadata(
            tool_id="balance_check",
            name=balance_check.__name__,
            description="Return whether a journal entry balances.",
            permission_class=PermissionClass.READ,
            input_schema={"type": "object", "required": ["lines"]},
            output_schema={"type": "object"},
            side_effects=[SideEffect.NONE],
            risk_level=RiskLevel.LOW,
        )
    )
    registry.register(
        ToolMetadata(
            tool_id="account_lookup",
            name=account_lookup.__name__,
            description="Look up an account code in the chart of accounts.",
            permission_class=PermissionClass.READ,
            input_schema={"type": "string"},
            output_schema={"type": "object"},
            side_effects=[SideEffect.NONE],
            risk_level=RiskLevel.LOW,
        )
    )
    registry.register(
        ToolMetadata(
            tool_id="rule_lookup",
            name=rule_lookup.__name__,
            description="Look up a domain rule by id.",
            permission_class=PermissionClass.READ,
            input_schema={"type": "string"},
            output_schema={"type": "object"},
            side_effects=[SideEffect.NONE],
            risk_level=RiskLevel.LOW,
        )
    )
    registry.register(
        ToolMetadata(
            tool_id="contra_account_resolver",
            name=contra_account_resolver.__name__,
            description="Return the contra-account pair for an account code.",
            permission_class=PermissionClass.READ,
            input_schema={"type": "string"},
            output_schema={"type": "object"},
            side_effects=[SideEffect.NONE],
            risk_level=RiskLevel.LOW,
        )
    )
    registry.register(
        ToolMetadata(
            tool_id="concept_explanation",
            name=concept_explanation.__name__,
            description="Return prerequisites, misconceptions, and rules for a concept.",
            permission_class=PermissionClass.READ,
            input_schema={"type": "string"},
            output_schema={"type": "object"},
            side_effects=[SideEffect.NONE],
            risk_level=RiskLevel.LOW,
        )
    )
    registry.register(
        ToolMetadata(
            tool_id="prerequisite_chain",
            name=prerequisite_chain.__name__,
            description="Return the prerequisite path between two concepts.",
            permission_class=PermissionClass.READ,
            input_schema={"type": "object"},
            output_schema={"type": "array"},
            side_effects=[SideEffect.NONE],
            risk_level=RiskLevel.LOW,
        )
    )
    return registry


__all__ = [
    "PermissionClass",
    "SideEffect",
    "RiskLevel",
    "ToolMetadata",
    "ToolRegistry",
    "default_registry",
]