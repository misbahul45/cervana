from __future__ import annotations

from v1.domain import (
    Concept,
    ConceptGraph,
    ConceptLevel,
    Misconception,
    Procedure,
    ProcedureStep,
    Rule,
)


def test_concept_round_trip():
    concept = Concept(
        concept_id="double_entry",
        name="Double-Entry Bookkeeping",
        domain="ACCOUNTING",
        level=ConceptLevel.INTERMEDIATE,
        description="Every transaction has equal debits and credits.",
        prerequisite_ids=["accounting_equation"],
        related_concept_ids=["journal_entry"],
        contrasts_with_ids=[],
        misconception_ids=["debit_credit_direction_error"],
        rule_ids=["balanced_double_entry"],
        learning_objectives=["Explain why every transaction has equal debits and credits"],
    )
    payload = concept.to_dict()
    assert payload["conceptId"] == "double_entry"
    assert payload["domain"] == "ACCOUNTING"
    assert payload["level"] == "INTERMEDIATE"
    assert "accounting_equation" in payload["prerequisites"]
    assert "balanced_double_entry" in payload["rules"]


def test_graph_topological_order():
    graph = ConceptGraph()
    graph.add_concept(
        Concept(
            concept_id="accounting_equation",
            name="Accounting Equation",
            level=ConceptLevel.FOUNDATION,
        )
    )
    graph.add_concept(
        Concept(
            concept_id="double_entry",
            name="Double-Entry",
            level=ConceptLevel.FOUNDATION,
            prerequisite_ids=["accounting_equation"],
        )
    )
    graph.add_concept(
        Concept(
            concept_id="journal_entry",
            name="Journal Entry",
            level=ConceptLevel.INTERMEDIATE,
            prerequisite_ids=["double_entry"],
        )
    )
    order = [c.concept_id for c in graph.topological_order()]
    assert order.index("accounting_equation") < order.index("double_entry")
    assert order.index("double_entry") < order.index("journal_entry")


def test_graph_explain_path():
    graph = ConceptGraph()
    graph.add_concept(
        Concept(
            concept_id="accounting_equation",
            name="Accounting Equation",
            level=ConceptLevel.FOUNDATION,
        )
    )
    graph.add_concept(
        Concept(
            concept_id="double_entry",
            name="Double-Entry",
            level=ConceptLevel.FOUNDATION,
            prerequisite_ids=["accounting_equation"],
        )
    )
    graph.add_concept(
        Concept(
            concept_id="journal_entry",
            name="Journal Entry",
            level=ConceptLevel.INTERMEDIATE,
            prerequisite_ids=["double_entry"],
        )
    )
    path = graph.explain_path("accounting_equation", "journal_entry")
    assert path == ["accounting_equation", "double_entry", "journal_entry"]


def test_misconception_add_evidence_increments_count():
    from datetime import datetime, timezone

    ms = Misconception(
        misconception_id="m1",
        concept_id="c1",
        confidence=0.6,
        evidence_count=2,
        first_observed_at=datetime.now(timezone.utc),
    )
    ms.add_evidence()
    assert ms.evidence_count == 3
    ms.confirm()
    assert ms.confidence >= 0.7


def test_rule_to_dict():
    rule = Rule(
        rule_id="r1",
        code="DE-001",
        description="Σ debits must equal Σ credits",
        applies_to=["journal_entry"],
    )
    payload = rule.to_dict()
    assert payload["ruleId"] == "r1"
    assert payload["code"] == "DE-001"


def test_procedure_to_dict():
    procedure = Procedure(
        procedure_id="p1",
        name="Post a balanced journal",
        steps=[
            ProcedureStep(step_id="s1", instruction="Identify accounts"),
            ProcedureStep(step_id="s2", instruction="Apply debits and credits"),
        ],
    )
    payload = procedure.to_dict()
    assert payload["procedureId"] == "p1"
    assert len(payload["steps"]) == 2