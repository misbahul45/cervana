from __future__ import annotations

from typing import Any, Dict, List, Optional


class ProcedureStep:
    __slots__ = ("step_id", "instruction", "validation")

    def __init__(
        self,
        step_id: str,
        instruction: str,
        validation: Optional[Any] = None,
    ) -> None:
        self.step_id = step_id
        self.instruction = instruction
        self.validation = validation

    def to_dict(self) -> Dict[str, Any]:
        return {
            "stepId": self.step_id,
            "instruction": self.instruction,
        }


class Procedure:
    __slots__ = ("procedure_id", "name", "applicability", "steps")

    def __init__(
        self,
        procedure_id: str,
        name: str,
        steps: List[ProcedureStep],
        applicability: Optional[List[str]] = None,
    ) -> None:
        if not steps:
            raise ValueError("procedure must have at least one step")
        self.procedure_id = procedure_id
        self.name = name
        self.applicability = list(applicability or [])
        self.steps = list(steps)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "procedureId": self.procedure_id,
            "name": self.name,
            "applicability": list(self.applicability),
            "steps": [s.to_dict() for s in self.steps],
        }


__all__ = ["Procedure", "ProcedureStep"]